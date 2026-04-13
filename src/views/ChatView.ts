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
import { captureGraphBase64 } from "../utils/graphCapture";
import type { ChatMessage } from "../utils/gemini";

const DEFAULT_CHAT_SYSTEM_PROMPT = `당신은 한국의 공공조달/ODA 수주 분석 전문가입니다.
사용자가 제공한 회사 자료·공고문·경쟁사 정보를 근거로 제안서 작성을 돕습니다.

원칙:
- 한국어로 응답합니다.
- 근거 없는 기관명·금액·수치·실적을 지어내지 않습니다.
- 제공된 컨텍스트에 없는 사실은 "자료에 없음"으로 명시합니다.
- 답변은 간결하고 실행 가능한 형태로 정리합니다.`;

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

		const graphBtn = actions.createEl("button", {
			text: "🕸️ 그래프",
			cls: "bi-chat-btn",
		});
		graphBtn.title = "활성 그래프 뷰를 이미지로 캡처";
		graphBtn.onclick = () => this.attachGraph();

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

		const btnCol = inputRow.createDiv({ cls: "bi-chat-btn-col" });
		this.sendBtn = btnCol.createEl("button", { text: "전송", cls: "bi-chat-send" });
		this.sendBtn.onclick = () => this.handleSend();
		this.stopBtn = btnCol.createEl("button", { text: "중단", cls: "bi-chat-stop" });
		this.stopBtn.onclick = () => this.abortCtrl?.abort();
		this.stopBtn.disabled = true;

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

	attachGraph(): void {
		const captured = captureGraphBase64(this.app);
		if (!captured) return;
		this.pendingAttachments.push({
			mimeType: "image/png",
			base64: captured.base64,
			label: `그래프 (${captured.viewType})`,
		});
		new Notice("그래프 이미지를 다음 전송에 첨부합니다.");
		this.renderAttachQueue();
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
			const chip = this.pinsEl.createDiv({ cls: "bi-chat-chip" });
			chip.createEl("span", { text: this.chipIcon(ref.kind) + " " + ref.label });
			const close = chip.createEl("span", { text: "×", cls: "bi-chat-chip-x" });
			close.onclick = () => {
				this.session.togglePin(ref);
				this.renderPins();
			};
		}
	}

	private chipIcon(kind: ContextRef["kind"]): string {
		return { note: "📄", folder: "📁", selection: "✂️", youtube: "▶️", graph: "🕸️" }[kind];
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
			MarkdownRenderer.render(this.app, msg.text || "…", body, "", this as unknown as Component);
		} else {
			body.setText(msg.text);
		}
	}

	private async handleSend(): Promise<void> {
		if (!this.plugin.gemini) {
			new Notice("Gemini API 키가 설정되지 않았습니다.");
			return;
		}
		const text = this.inputEl.value.trim();
		if (!text) return;

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

			const systemPrompt =
				this.plugin.settings.systemPromptOverride?.trim() || DEFAULT_CHAT_SYSTEM_PROMPT;

			this.abortCtrl = new AbortController();

			// 마지막 메시지 DOM 참조
			const lastWrap = this.messagesEl.lastElementChild as HTMLElement;
			const bodyEl = lastWrap.querySelector(".bi-chat-msg-body") as HTMLElement;

			await this.plugin.gemini.generateStream(history, {
				systemInstruction: systemPrompt,
				signal: this.abortCtrl.signal,
				onChunk: (delta) => {
					assistant.text += delta;
					this.renderBody(bodyEl, assistant);
					this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
				},
			});
		} catch (e: any) {
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
`;
		document.head.appendChild(style);
	}
}
