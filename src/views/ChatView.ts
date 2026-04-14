import {
	ItemView,
	WorkspaceLeaf,
	Notice,
	MarkdownRenderer,
	TFile,
	Component,
} from "obsidian";
import { VIEW_TYPE_CHAT } from "../utils/constants";
import type BidIntelligencePlugin from "../main";
import { ChatSession, type ContextRef, type UiMessage } from "../utils/chatSession";
import { buildContextBlock, buildRagBlock, activeFileRef } from "../utils/contextBuilder";
import { extractVideoId, fetchYoutubeTranscript } from "../utils/youtube";
import {
	fileToAttachment,
	extractImagesFromClipboard,
	formatBytes,
} from "../utils/imageUtils";
import type { ChatMessage, GeminiToolDeclaration } from "../utils/gemini";
import type { McpTool } from "../utils/mcpClient";
import { parseEditProposals, type EditProposal } from "./ApplyEditModal";
import { loadGuardrails } from "../utils/guardrails";

const DEFAULT_CHAT_SYSTEM_PROMPT = `당신은 한국의 공공조달/ODA 수주 분석 전문가입니다.
사용자가 제공한 회사 자료·공고문·경쟁사 정보를 근거로 제안서 작성을 돕습니다.

원칙:
- 한국어로 응답합니다.
- 근거 없는 기관명·금액·수치·실적을 지어내지 않습니다.
- 제공된 컨텍스트에 없는 사실은 "자료에 없음"으로 명시합니다.
- 답변은 간결하고 실행 가능한 형태로 정리합니다.

노트 편집 제안 규칙:
사용자가 "다시 써줘", "수정해줘", "바꿔줘", "변경해줘" 등 편집을 요청하면:
1. 수정된 내용을 마크다운 코드블록(\`\`\`markdown ... \`\`\`)으로 감싸서 제시합니다.
2. 가능하면 <<<EDIT target="파일.md" mode="section" section="## 헤딩">>> ... <<<END_EDIT>>> 태그도 사용합니다.
3. 설명은 코드블록 바깥에 씁니다. 코드블록 안에는 적용할 내용만 넣습니다.`;

export class ChatView extends ItemView {
	private plugin: BidIntelligencePlugin;
	private session = new ChatSession();
	private messagesEl!: HTMLElement;
	private pinsEl!: HTMLElement;
	private attachEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;
	private stopBtn!: HTMLButtonElement;
	private abortCtrl: AbortController | null = null;
	/** 다음 전송에 첨부할 이미지/텍스트 큐 */
	private pendingAttachments: { mimeType: string; base64: string; label: string }[] = [];
	private pendingPrefetched: { label: string; text: string }[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: BidIntelligencePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CHAT;
	}

	getDisplayText(): string {
		return "수주 AI 채팅";
	}

	getIcon(): string {
		return "messages-square";
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	async onClose(): Promise<void> {
		this.abortCtrl?.abort();
	}

	private render(): void {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass("bi-chat");

		// Header
		const header = root.createDiv({ cls: "bi-chat-header" });
		header.createEl("h4", { text: "💬 수주 AI 채팅" });
		const actions = header.createDiv({ cls: "bi-chat-actions" });

		const pinActiveBtn = actions.createEl("button", {
			text: "📎 현재 노트",
			cls: "bi-chat-btn",
		});
		pinActiveBtn.onclick = () => this.pinActiveFile();

		const imageBtn = actions.createEl("button", {
			text: "🖼️ 이미지",
			cls: "bi-chat-btn",
		});
		imageBtn.title = "이미지 파일 첨부 (또는 입력창에 Ctrl+V로 붙여넣기)";
		imageBtn.onclick = () => this.triggerImagePicker();

		const clearBtn = actions.createEl("button", { text: "🗑️", cls: "bi-chat-btn" });
		clearBtn.title = "대화 초기화";
		clearBtn.onclick = () => {
			this.session.clear();
			this.renderMessages();
		};

		// Pin chips row
		this.pinsEl = root.createDiv({ cls: "bi-chat-pins" });
		this.renderPins();

		// Attachment queue row (grafik/YouTube 프리페치)
		this.attachEl = root.createDiv({ cls: "bi-chat-attach" });
		this.renderAttachQueue();

		// Messages area
		this.messagesEl = root.createDiv({ cls: "bi-chat-messages" });
		this.renderMessages();

		// Input area
		const inputRow = root.createDiv({ cls: "bi-chat-input-row" });
		this.inputEl = inputRow.createEl("textarea", {
			cls: "bi-chat-input",
			attr: { placeholder: "질문을 입력하세요. (Ctrl+Enter 전송)", rows: "3" },
		});
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.handleSend();
			}
		});

		// 클립보드 이미지 붙여넣기
		this.inputEl.addEventListener("paste", async (e: ClipboardEvent) => {
			const images = extractImagesFromClipboard(e);
			if (images.length === 0) return; // 텍스트 paste는 기본 동작 유지
			e.preventDefault();
			for (const file of images) {
				await this.attachImageFile(file);
			}
		});

		const btnCol = inputRow.createDiv({ cls: "bi-chat-btn-col" });
		this.sendBtn = btnCol.createEl("button", { text: "전송", cls: "bi-chat-send" });
		this.sendBtn.onclick = () => this.handleSend();
		this.stopBtn = btnCol.createEl("button", { text: "중단", cls: "bi-chat-stop" });
		this.stopBtn.onclick = () => this.abortCtrl?.abort();
		this.stopBtn.disabled = true;

		this.setupSlashSuggest();
		this.injectStyle();
	}

	private pinActiveFile(): void {
		const ref = activeFileRef(this.app);
		if (!ref) {
			new Notice("활성 파일이 없습니다.");
			return;
		}
		this.session.togglePin(ref);
		this.renderPins();
	}

	/**
	 * 숨겨진 <input type="file">을 트리거해 이미지 선택 받음.
	 */
	private triggerImagePicker(): void {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.multiple = true;
		input.onchange = async () => {
			if (!input.files) return;
			for (let i = 0; i < input.files.length; i++) {
				await this.attachImageFile(input.files[i]);
			}
		};
		input.click();
	}

	/**
	 * 단일 이미지 파일 → 리사이즈 → base64 → pendingAttachments에 추가.
	 */
	private async attachImageFile(file: File): Promise<void> {
		try {
			const att = await fileToAttachment(file, { maxDimension: 2048 });
			this.pendingAttachments.push({
				mimeType: att.mimeType,
				base64: att.base64,
				label: `${att.label} (${formatBytes(att.sizeBytes)})`,
			});
			new Notice(`🖼️ 이미지 첨부: ${att.label}`);
			this.renderAttachQueue();
		} catch (e: any) {
			new Notice(`❌ 이미지 처리 실패: ${e.message || e}`);
		}
	}

	private async attachYoutube(url: string): Promise<void> {
		new Notice("YouTube 자막을 가져오는 중...");
		try {
			const langs = this.plugin.settings.youtubeCaptionLang
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
			const t = await fetchYoutubeTranscript(url, langs.length > 0 ? langs : ["ko", "en"]);
			this.pendingPrefetched.push({
				label: `▶️ ${t.title} (${t.language})`,
				text: `## ▶️ YouTube: ${t.title} (${t.language})\n${t.text}`,
			});
			new Notice("자막이 다음 전송에 첨부됩니다.");
			this.renderAttachQueue();
		} catch (e: any) {
			new Notice(`❌ ${e.message || "자막 수집 실패"}`);
		}
	}

	private renderAttachQueue(): void {
		this.attachEl.empty();
		const total = this.pendingAttachments.length + this.pendingPrefetched.length;
		if (total === 0) return;
		for (let i = 0; i < this.pendingAttachments.length; i++) {
			const a = this.pendingAttachments[i];
			const chip = this.attachEl.createDiv({ cls: "bi-chat-chip" });
			chip.createEl("span", { text: `🖼️ ${a.label}` });
			const close = chip.createEl("span", { text: "×", cls: "bi-chat-chip-x" });
			close.onclick = () => {
				this.pendingAttachments.splice(i, 1);
				this.renderAttachQueue();
			};
		}
		for (let i = 0; i < this.pendingPrefetched.length; i++) {
			const p = this.pendingPrefetched[i];
			const chip = this.attachEl.createDiv({ cls: "bi-chat-chip" });
			chip.createEl("span", { text: p.label });
			const close = chip.createEl("span", { text: "×", cls: "bi-chat-chip-x" });
			close.onclick = () => {
				this.pendingPrefetched.splice(i, 1);
				this.renderAttachQueue();
			};
		}
	}

	private renderPins(): void {
		this.pinsEl.empty();
		if (this.session.pinnedContext.length === 0) {
			this.pinsEl.createEl("span", {
				text: "컨텍스트 없음 (현재 노트 버튼으로 추가)",
				cls: "bi-chat-pins-empty",
			});
			return;
		}
		for (const ref of this.session.pinnedContext) {
			const row = this.pinsEl.createDiv({ cls: "bi-chat-pin-row" });
			const chip = row.createDiv({ cls: "bi-chat-chip" });
			chip.createEl("span", { text: this.chipIcon(ref.kind) + " " + ref.label });
			const close = chip.createEl("span", { text: "×", cls: "bi-chat-chip-x" });
			close.onclick = () => {
				this.session.togglePin(ref);
				this.renderPins();
			};

			// selection 타입이면 텍스트 미리보기 표시 (접고 펼칠 수 있음)
			if (ref.kind === "selection") {
				const preview = row.createDiv({ cls: "bi-chat-pin-preview" });
				const previewText = ref.id.length > 200
					? ref.id.slice(0, 200) + "…"
					: ref.id;
				preview.setText(previewText);
				preview.style.display = "block";
				chip.style.cursor = "pointer";
				chip.onclick = (e) => {
					if ((e.target as HTMLElement).classList.contains("bi-chat-chip-x")) return;
					preview.style.display = preview.style.display === "none" ? "block" : "none";
				};
			}
		}
	}

	private chipIcon(kind: ContextRef["kind"]): string {
		return { note: "📄", folder: "📁", selection: "✂️", youtube: "▶️", graph: "🕸️" }[kind];
	}

	// ── 슬래시 커맨드 ──

	private static SLASH_COMMANDS = [
		{ cmd: "/clear", desc: "대화 초기화" },
		{ cmd: "/model flash", desc: "Gemini 2.5 Flash로 전환" },
		{ cmd: "/model pro", desc: "Gemini 2.5 Pro로 전환" },
		{ cmd: "/model lite", desc: "Gemini 2.5 Flash-Lite로 전환" },
		{ cmd: "/pin", desc: "현재 노트 핀 토글" },
		{ cmd: "/topk", desc: "RAG Top K 변경 (예: /topk 3)" },
	];

	/**
	 * 슬래시 커맨드 처리. 처리했으면 true, 아니면 false(일반 메시지로 전송).
	 */
	private handleSlashCommand(input: string): boolean {
		const lower = input.toLowerCase().trim();

		if (lower === "/clear") {
			this.clearChat();
			new Notice("채팅 초기화 완료");
			return true;
		}
		if (lower === "/model flash") {
			this.plugin.settings.geminiModel = "gemini-2.5-flash";
			void this.plugin.saveSettings();
			new Notice("모델 전환: gemini-2.5-flash");
			return true;
		}
		if (lower === "/model pro") {
			this.plugin.settings.geminiModel = "gemini-2.5-pro";
			void this.plugin.saveSettings();
			new Notice("모델 전환: gemini-2.5-pro");
			return true;
		}
		if (lower === "/model lite") {
			this.plugin.settings.geminiModel = "gemini-2.5-flash-lite";
			void this.plugin.saveSettings();
			new Notice("모델 전환: gemini-2.5-flash-lite");
			return true;
		}
		if (lower === "/pin") {
			this.pinActiveFile();
			return true;
		}
		if (lower.startsWith("/topk")) {
			const n = parseInt(lower.replace("/topk", "").trim(), 10);
			if (Number.isFinite(n) && n > 0) {
				this.plugin.settings.ragTopK = n;
				void this.plugin.saveSettings();
				new Notice(`RAG Top K → ${n}`);
			} else {
				new Notice(`현재 Top K: ${this.plugin.settings.ragTopK} (변경: /topk 숫자)`);
			}
			return true;
		}
		return false; // 알 수 없는 커맨드 → 일반 메시지로 전송
	}

	private slashSuggestEl: HTMLElement | null = null;

	/**
	 * 입력창에 "/" 입력 시 자동완성 드롭다운 표시.
	 */
	private setupSlashSuggest(): void {
		this.inputEl.addEventListener("input", () => {
			const val = this.inputEl.value;
			if (val.startsWith("/") && val.length <= 15) {
				this.showSlashSuggest(val.toLowerCase());
			} else {
				this.hideSlashSuggest();
			}
		});
	}

	private showSlashSuggest(partial: string): void {
		if (!this.slashSuggestEl) {
			this.slashSuggestEl = document.createElement("div");
			this.slashSuggestEl.addClass("bi-slash-suggest");
			this.inputEl.parentElement?.insertBefore(this.slashSuggestEl, this.inputEl);
		}
		this.slashSuggestEl.empty();
		const matches = ChatView.SLASH_COMMANDS.filter((c) =>
			c.cmd.startsWith(partial) || partial === "/"
		);
		if (matches.length === 0) { this.hideSlashSuggest(); return; }
		this.slashSuggestEl.style.display = "block";
		for (const m of matches) {
			const row = this.slashSuggestEl.createDiv({ cls: "bi-slash-item" });
			row.createEl("span", { text: m.cmd, cls: "bi-slash-cmd" });
			row.createEl("span", { text: ` — ${m.desc}`, cls: "bi-slash-desc" });
			row.onclick = () => {
				this.inputEl.value = m.cmd + " ";
				this.inputEl.focus();
				this.hideSlashSuggest();
			};
		}
	}

	private hideSlashSuggest(): void {
		if (this.slashSuggestEl) this.slashSuggestEl.style.display = "none";
	}

	private findYoutubeUrls(text: string): string[] {
		const urls: string[] = [];
		const re = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+)/gi;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text))) {
			if (extractVideoId(m[1])) urls.push(m[1]);
		}
		return urls;
	}

	private renderMessages(): void {
		this.messagesEl.empty();
		if (this.session.messages.length === 0) {
			this.messagesEl.createEl("div", {
				cls: "bi-chat-empty",
				text: "아직 대화가 없습니다. 노트를 핀한 뒤 질문해 보세요.",
			});
			return;
		}
		for (const msg of this.session.messages) {
			this.renderMessage(msg);
		}
		this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
	}

	private renderMessage(msg: UiMessage): HTMLElement {
		const wrap = this.messagesEl.createDiv({
			cls: `bi-chat-msg bi-chat-msg-${msg.role}`,
		});
		const label = wrap.createEl("div", { cls: "bi-chat-msg-label" });
		label.setText(msg.role === "user" ? "🙋 나" : "🤖 AI");
		if (msg.pending) label.createEl("span", { cls: "bi-chat-spinner", text: " ●●●" });

		const body = wrap.createDiv({ cls: "bi-chat-msg-body" });
		this.renderBody(body, msg);

		if (msg.contextLabels && msg.contextLabels.length > 0) {
			const ctxRow = wrap.createDiv({ cls: "bi-chat-msg-ctx" });
			ctxRow.setText("참조: " + msg.contextLabels.join(", "));
		}
		return body;
	}

	private renderBody(body: HTMLElement, msg: UiMessage): void {
		body.empty();
		if (msg.role === "assistant") {
			// EDIT 블록을 인라인 diff 카드로 교체해서 렌더링
			if (!msg.pending) {
				const proposals = parseEditProposals(msg.text);
				if (proposals.length > 0) {
					// EDIT 태그 바깥 텍스트만 마크다운으로 렌더
					const cleaned = msg.text.replace(/<<<EDIT[^>]*>>>[\s\S]*?<<<END_EDIT>>>/g, "").trim();
					if (cleaned) {
						MarkdownRenderer.render(this.app, cleaned, body, "", this as unknown as Component);
					}
					// 각 제안을 인라인 diff 카드로 표시
					for (const p of proposals) {
						this.renderInlineDiff(body, p);
					}
					return;
				}
			}
			MarkdownRenderer.render(this.app, msg.text || "…", body, "", this as unknown as Component);
		} else {
			body.setText(msg.text);
		}
	}

	/**
	 * smart-composer 스타일 인라인 diff 카드.
	 * 제안 내용을 채팅 메시지 안에 직접 보여주고 적용/패스 버튼 제공.
	 */
	private renderInlineDiff(container: HTMLElement, proposal: EditProposal): void {
		const card = container.createDiv({ cls: "bi-inline-diff" });

		// 헤더: 대상 파일명 + 모드
		const header = card.createDiv({ cls: "bi-inline-diff-header" });
		const targetLabel = proposal.targetPath || "활성 파일";
		const modeMap: Record<string, string> = { replace: "전체 교체", append: "끝에 추가", section: "섹션 교체" };
		const modeLabel = modeMap[proposal.mode ?? "replace"] ?? "교체";
		header.createEl("span", { text: `📝 ${targetLabel}`, cls: "bi-inline-diff-target" });
		header.createEl("span", { text: modeLabel, cls: "bi-inline-diff-mode" });
		if (proposal.sectionHeading) {
			header.createEl("span", { text: `→ ${proposal.sectionHeading}`, cls: "bi-inline-diff-section" });
		}

		// 제안 내용 미리보기
		const preview = card.createDiv({ cls: "bi-inline-diff-content" });
		MarkdownRenderer.render(
			this.app,
			proposal.proposedContent.length > 500
				? proposal.proposedContent.slice(0, 500) + "\n\n…(더보기는 적용 클릭)"
				: proposal.proposedContent,
			preview, "", this as unknown as Component
		);

		// 버튼 행: 적용 / 패스
		const btnRow = card.createDiv({ cls: "bi-inline-diff-buttons" });

		const applyBtn = btnRow.createEl("button", { text: "✅ 적용", cls: "bi-inline-diff-apply" });
		applyBtn.onclick = async () => {
			try {
				const file = proposal.targetPath
					? this.app.vault.getAbstractFileByPath(proposal.targetPath)
					: this.app.workspace.getActiveFile();
				if (!file || !(file instanceof TFile)) {
					new Notice("❌ 대상 파일을 찾지 못했습니다.");
					return;
				}
				const oldContent = await this.app.vault.read(file);
				const newContent = this.computeNewContent(oldContent, proposal);
				await this.app.vault.modify(file, newContent);
				new Notice(`✅ ${file.basename} 업데이트 완료`);
				card.empty();
				card.createEl("div", { text: `✅ ${file.basename} 적용 완료`, cls: "bi-inline-diff-done" });
			} catch (e: any) {
				new Notice(`❌ 적용 실패: ${e.message || e}`);
			}
		};

		const skipBtn = btnRow.createEl("button", { text: "⏭️ 패스", cls: "bi-inline-diff-skip" });
		skipBtn.onclick = () => {
			card.empty();
			card.createEl("div", { text: "⏭️ 패스됨", cls: "bi-inline-diff-skipped" });
		};
	}

	private computeNewContent(oldContent: string, proposal: EditProposal): string {
		const mode = proposal.mode ?? "replace";
		switch (mode) {
			case "append":
				return oldContent.replace(/\s*$/, "") + "\n\n" + proposal.proposedContent + "\n";
			case "section": {
				const heading = proposal.sectionHeading ?? "";
				if (!heading) return oldContent + "\n\n" + proposal.proposedContent;
				const hMatch = heading.match(/^(#{1,6})\s+/);
				if (!hMatch) return oldContent + "\n\n" + proposal.proposedContent;
				const level = hMatch[1].length;
				const lines = oldContent.split(/\r?\n/);
				let start = lines.findIndex((l) => l.trim() === heading.trim());
				if (start === -1) return oldContent + "\n\n" + proposal.proposedContent;
				let end = lines.length;
				for (let i = start + 1; i < lines.length; i++) {
					const m = lines[i].match(/^(#{1,6})\s+/);
					if (m && m[1].length <= level) { end = i; break; }
				}
				const before = lines.slice(0, start).join("\n");
				const after = lines.slice(end).join("\n");
				return [before, proposal.proposedContent.trim(), after].filter(Boolean).join("\n\n");
			}
			case "replace":
			default:
				return proposal.proposedContent;
		}
	}

	// ── 외부에서 호출되는 public 메서드 (main.ts 커맨드용) ──

	/** 선택 텍스트를 selection 타입 컨텍스트로 핀 */
	receiveSelectionAsContext(text: string, label: string): void {
		const ref: ContextRef = {
			id: text.slice(0, 2000), // id에 텍스트 자체 저장 (selection 타입)
			label: `✂️ ${label} (${text.length}자)`,
			kind: "selection",
		};
		// 중복 방지
		if (!this.session.pinnedContext.some((p) => p.id === ref.id)) {
			this.session.pinnedContext.push(ref);
			this.renderPins();
			new Notice(`선택 영역을 컨텍스트에 핀했습니다.`);
		}
	}

	/** 마지막 assistant 메시지 텍스트 반환 */
	getLastAssistantText(): string | null {
		for (let i = this.session.messages.length - 1; i >= 0; i--) {
			const m = this.session.messages[i];
			if (m.role === "assistant" && !m.pending && m.text) return m.text;
		}
		return null;
	}

	/** 대화 초기화 */
	clearChat(): void {
		this.session.clear();
		this.renderMessages();
	}

	private async handleSend(): Promise<void> {
		const raw = this.inputEl.value.trim();
		if (!raw) return;

		// ── 슬래시 커맨드 처리 ──
		if (raw.startsWith("/")) {
			if (this.handleSlashCommand(raw)) {
				this.inputEl.value = "";
				return;
			}
		}

		if (!this.plugin.gemini) {
			new Notice("Gemini API 키가 설정되지 않았습니다.");
			return;
		}
		const text = raw;

		// 사용자 입력에 YouTube URL이 있으면 자막 자동 fetch
		const ytUrls = this.findYoutubeUrls(text);
		for (const url of ytUrls) {
			if (!this.pendingPrefetched.some((p) => p.label.includes(url))) {
				await this.attachYoutube(url);
			}
		}

		this.inputEl.value = "";
		this.sendBtn.disabled = true;
		this.stopBtn.disabled = false;

		// 사용자 메시지 추가 (첨부 라벨 포함)
		const contextLabels = [
			...this.session.pinnedContext.map((p) => p.label),
			...this.pendingAttachments.map((a) => `🖼️ ${a.label}`),
			...this.pendingPrefetched.map((p) => p.label),
		];
		const userMsg = this.session.addUser(text, contextLabels);
		userMsg.attachments = [...this.pendingAttachments];
		userMsg.prefetchedText = [...this.pendingPrefetched];
		const assistant = this.session.startAssistant();
		this.renderMessages();

		try {
			// 핀 컨텍스트 조립
			const contextBlock = await buildContextBlock(
				this.app,
				this.session.pinnedContext
			);

			// RAG 자동 검색 (활성화 시)
			let ragBlock = "";
			let ragHitLabels: string[] = [];
			if (
				this.plugin.settings.ragEnabled &&
				this.plugin.vectorStore &&
				this.plugin.embeddings &&
				this.plugin.vectorStore.size() > 0
			) {
				try {
					const rag = await buildRagBlock(
						text,
						this.plugin.vectorStore,
						this.plugin.embeddings,
						this.plugin.settings.ragTopK
					);
					ragBlock = rag.block;
					ragHitLabels = rag.hits.map((h) => h.path);
					if (ragHitLabels.length > 0) {
						// 사용자 메시지에 참조 라벨 보강
						const userMsg = this.session.messages[this.session.messages.length - 2];
						userMsg.contextLabels = [
							...(userMsg.contextLabels ?? []),
							...ragHitLabels.map((p) => `🔍 ${p}`),
						];
					}
				} catch (e) {
					console.warn("RAG search failed:", e);
				}
			}

			// 프리페치된 텍스트(유튜브 자막 등)를 컨텍스트에 포함
			const prefetchedBlock = this.pendingPrefetched.map((p) => p.text).join("\n\n");

			const history = this.session.toApiMessages(this.plugin.settings.chatHistoryLimit ?? 20);
			// history 마지막은 방금 추가한 사용자 메시지. 여기에 컨텍스트를 prepend.
			const combined = [contextBlock, ragBlock, prefetchedBlock]
				.filter(Boolean)
				.join("\n\n");
			if (history.length > 0 && combined) {
				const last = history[history.length - 1];
				last.text = `# 참조 컨텍스트\n${combined}\n\n# 질문\n${last.text}`;
			}

			// 이미지 첨부를 마지막 메시지에 부착
			if (this.pendingAttachments.length > 0 && history.length > 0) {
				const last = history[history.length - 1] as ChatMessage;
				last.parts = this.pendingAttachments.map((a) => ({
					imageBase64: a.base64,
					imageMimeType: a.mimeType,
				}));
			}

			// 첨부 큐 초기화 (전송 후)
			this.pendingAttachments = [];
			this.pendingPrefetched = [];
			this.renderAttachQueue();

			// 시스템 프롬프트 우선순위:
			// 1) 설정 override (있으면 그대로)
			// 2) _memory/quality-guardrails.md의 "작성 원칙" 섹션 (있으면 기본과 결합)
			// 3) 인라인 기본 프롬프트
			let systemPrompt = this.plugin.settings.systemPromptOverride?.trim();
			if (!systemPrompt) {
				const guardrails = await loadGuardrails(this.app);
				systemPrompt = guardrails
					? `${DEFAULT_CHAT_SYSTEM_PROMPT}\n\n# 볼트 규범 (_memory/quality-guardrails.md)\n${guardrails}`
					: DEFAULT_CHAT_SYSTEM_PROMPT;
			}

			this.abortCtrl = new AbortController();

			// 마지막 메시지 DOM 참조
			const lastWrap = this.messagesEl.lastElementChild as HTMLElement;
			const bodyEl = lastWrap.querySelector(".bi-chat-msg-body") as HTMLElement;

			// MCP 도구가 등록되어 있으면 tool-calling 루프 사용 (비스트리밍)
			const mcpTools: McpTool[] =
				this.plugin.mcpRegistry.size() > 0
					? await this.plugin.mcpRegistry.listAllTools().catch(() => [])
					: [];

			if (mcpTools.length > 0) {
				const decls: GeminiToolDeclaration[] = mcpTools.map((t) => ({
					name: `${t._server}__${t.name}`, // 서버 구분 prefix
					description: t.description,
					parameters: t.inputSchema,
				}));

				await this.plugin.gemini.generateWithTools(history, {
					systemInstruction: systemPrompt,
					tools: decls,
					toolHandler: async (call) => {
						const [serverName, ...rest] = call.name.split("__");
						const toolName = rest.join("__");
						return this.plugin.mcpRegistry.callTool(
							serverName,
							toolName,
							call.args
						);
					},
					onAssistantText: (t) => {
						assistant.text += t;
						this.renderBody(bodyEl, assistant);
						this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
					},
					onToolCall: (name, args) => {
						assistant.text += `\n\n🔧 **도구 호출**: \`${name}\` ${JSON.stringify(args).slice(0, 80)}\n`;
						this.renderBody(bodyEl, assistant);
					},
				});
			} else {
				await this.plugin.gemini.generateStream(history, {
					systemInstruction: systemPrompt,
					signal: this.abortCtrl.signal,
					onChunk: (delta) => {
						assistant.text += delta;
						this.renderBody(bodyEl, assistant);
						this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
					},
				});
			}
		} catch (e: any) {
			console.error("[bid-intelligence] 채팅 오류:", e);
			if (e.name === "AbortError") {
				assistant.text += "\n\n_(중단됨)_";
			} else {
				assistant.text = `❌ 오류: ${e.message || e}`;
			}
		} finally {
			assistant.pending = false;
			this.abortCtrl = null;
			this.sendBtn.disabled = false;
			this.stopBtn.disabled = true;
			this.renderMessages();
		}
	}

	private injectStyle(): void {
		if (document.getElementById("bi-chat-style")) return;
		const style = document.createElement("style");
		style.id = "bi-chat-style";
		style.textContent = `
.bi-chat { display: flex; flex-direction: column; height: 100%; padding: 8px; gap: 8px; }
.bi-chat-header { display: flex; align-items: center; justify-content: space-between; }
.bi-chat-header h4 { margin: 0; }
.bi-chat-actions { display: flex; gap: 4px; }
.bi-chat-btn { font-size: 11px; padding: 2px 8px; cursor: pointer; }
.bi-chat-pins { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; padding: 4px; border: 1px dashed var(--background-modifier-border); border-radius: 4px; }
.bi-chat-attach { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 4px; }
.bi-chat-attach:empty { display: none; }
.bi-chat-pins-empty { color: var(--text-muted); font-size: 11px; }
.bi-chat-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background: var(--background-secondary); border-radius: 10px; font-size: 11px; }
.bi-chat-chip-x { cursor: pointer; color: var(--text-muted); font-weight: bold; }
.bi-chat-chip-x:hover { color: var(--text-error); }
.bi-chat-pin-row { display: flex; flex-direction: column; gap: 2px; width: 100%; }
.bi-chat-pin-preview { font-size: 11px; color: var(--text-muted); background: var(--background-primary-alt); padding: 4px 8px; border-radius: 4px; white-space: pre-wrap; max-height: 120px; overflow-y: auto; border-left: 2px solid var(--text-accent); }
.bi-chat-messages { flex: 1; overflow-y: auto; padding: 4px; display: flex; flex-direction: column; gap: 10px; }
.bi-chat-empty { color: var(--text-muted); text-align: center; padding: 20px; font-size: 12px; }
.bi-chat-msg { border-radius: 6px; padding: 6px 8px; }
.bi-chat-msg-user { background: var(--background-secondary); }
.bi-chat-msg-assistant { background: var(--background-primary-alt); }
.bi-chat-msg-label { font-size: 11px; color: var(--text-muted); margin-bottom: 2px; }
.bi-chat-msg-body { font-size: 13px; line-height: 1.5; }
.bi-chat-msg-body p { margin: 4px 0; }
.bi-chat-msg-ctx { font-size: 10px; color: var(--text-muted); margin-top: 4px; font-style: italic; }
.bi-chat-spinner { color: var(--text-accent); animation: bi-blink 1s infinite; }
@keyframes bi-blink { 50% { opacity: 0.3; } }
.bi-chat-input-row { display: flex; gap: 4px; }
.bi-chat-input { flex: 1; resize: vertical; font-family: inherit; }
.bi-chat-btn-col { display: flex; flex-direction: column; gap: 4px; }
.bi-chat-send, .bi-chat-stop { font-size: 11px; padding: 4px 10px; cursor: pointer; }
.bi-chat-send:disabled, .bi-chat-stop:disabled { opacity: 0.4; cursor: not-allowed; }
.bi-chat-edit-actions { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--background-modifier-border); }
.bi-chat-apply-btn { font-size: 11px; padding: 4px 8px; cursor: pointer; text-align: left; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 4px; }
.bi-inline-diff { border: 1px solid var(--background-modifier-border); border-radius: 6px; margin: 8px 0; overflow: hidden; }
.bi-inline-diff-header { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--background-secondary); font-size: 11px; }
.bi-inline-diff-target { font-weight: 600; color: var(--text-accent); }
.bi-inline-diff-mode { background: var(--background-modifier-hover); padding: 1px 6px; border-radius: 3px; }
.bi-inline-diff-section { color: var(--text-muted); }
.bi-inline-diff-content { padding: 8px 10px; max-height: 200px; overflow-y: auto; font-size: 12px; line-height: 1.5; background: var(--background-primary-alt); border-left: 3px solid var(--text-success, #4c4); }
.bi-inline-diff-content p { margin: 4px 0; }
.bi-inline-diff-buttons { display: flex; gap: 6px; padding: 6px 10px; background: var(--background-secondary); }
.bi-inline-diff-apply { background: var(--interactive-accent); color: var(--text-on-accent); border: none; padding: 4px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; }
.bi-inline-diff-apply:hover { background: var(--interactive-accent-hover); }
.bi-inline-diff-skip { background: transparent; border: 1px solid var(--background-modifier-border); padding: 4px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; color: var(--text-muted); }
.bi-inline-diff-skip:hover { background: var(--background-modifier-hover); }
.bi-inline-diff-done { padding: 8px 10px; color: var(--text-success, #4c4); font-size: 12px; }
.bi-inline-diff-skipped { padding: 8px 10px; color: var(--text-muted); font-size: 12px; }
.bi-slash-suggest { display: none; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 4px; max-height: 150px; overflow-y: auto; }
.bi-slash-item { padding: 4px 8px; cursor: pointer; border-radius: 3px; font-size: 12px; }
.bi-slash-item:hover { background: var(--background-modifier-hover); }
.bi-slash-cmd { font-weight: 600; color: var(--text-accent); }
.bi-slash-desc { color: var(--text-muted); }
`;
		document.head.appendChild(style);
	}
}
