import { Plugin, WorkspaceLeaf, TFile, Notice, Editor, MarkdownView } from "obsidian";
import {
	VIEW_TYPE_CONTEXT,
	VIEW_TYPE_BRIEFING,
	VIEW_TYPE_REPORT,
	VIEW_TYPE_CHAT,
} from "./utils/constants";
import { ContextManagerView } from "./views/ContextManagerView";
import { BriefingDashboardView } from "./views/BriefingDashboardView";
import { AnalysisReportView } from "./views/AnalysisReportView";
import { ChatView } from "./views/ChatView";
import {
	BidIntelligenceSettings,
	BidIntelligenceSettingTab,
	DEFAULT_SETTINGS,
} from "./settings";
import { GeminiClient } from "./utils/gemini";
import { EmbeddingsClient } from "./utils/embeddings";
import { VectorStore } from "./utils/vectorStore";
import { McpRegistry } from "./utils/mcpClient";
import { updateFrontmatter, addFrontmatter, getFrontmatter } from "./utils/frontmatter";

export default class BidIntelligencePlugin extends Plugin {
	settings: BidIntelligenceSettings = DEFAULT_SETTINGS;
	gemini: GeminiClient | null = null;
	embeddings: EmbeddingsClient | null = null;
	vectorStore: VectorStore | null = null;
	mcpRegistry: McpRegistry = new McpRegistry();

	async onload(): Promise<void> {
		await this.loadSettings();
		this.initGemini();
		this.initRag();
		this.initMcp();

		// Settings tab
		this.addSettingTab(new BidIntelligenceSettingTab(this.app, this));

		// Register views — pass plugin reference so views can read settings & Gemini
		this.registerView(VIEW_TYPE_CONTEXT, (leaf) => new ContextManagerView(leaf, this));
		this.registerView(VIEW_TYPE_BRIEFING, (leaf) => new BriefingDashboardView(leaf, this));
		this.registerView(VIEW_TYPE_REPORT, (leaf) => new AnalysisReportView(leaf, this));
		this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, this));

		// Register commands
		this.addCommand({
			id: "open-context-manager",
			name: "컨텍스트 매니저 열기",
			callback: () => this.activateView(VIEW_TYPE_CONTEXT, "left"),
		});

		this.addCommand({
			id: "open-chat",
			name: "수주 AI 채팅 열기",
			callback: () => this.activateView(VIEW_TYPE_CHAT, "right"),
		});

		this.addCommand({
			id: "analyze-current-file",
			name: "현재 파일 AI 분석 (프로퍼티 생성)",
			callback: () => this.analyzeCurrentFile(),
		});

		this.addCommand({
			id: "analyze-all-context",
			name: "컨텍스트 전체 분석",
			callback: () => this.analyzeAllContext(),
		});

		this.addCommand({
			id: "index-vault",
			name: "컨텍스트 볼트 재인덱싱 (RAG)",
			callback: () => this.indexVault(),
		});

		// ── 채팅 연동 커맨드 ──

		this.addCommand({
			id: "pin-selection-as-context",
			name: "선택 영역을 컨텍스트로 핀",
			editorCallback: async (editor: Editor, ctx: MarkdownView) => {
				const sel = editor.getSelection();
				if (!sel) { new Notice("텍스트를 먼저 선택하세요."); return; }
				await this.activateView(VIEW_TYPE_CHAT, "right");
				const view = this.getChatView();
				if (view) view.receiveSelectionAsContext(sel, ctx.file?.basename ?? "선택", ctx.file?.path);
			},
		});

		this.addCommand({
			id: "insert-last-response",
			name: "마지막 AI 응답을 커서 위치에 삽입",
			editorCallback: (editor: Editor) => {
				const view = this.getChatView();
				if (!view) { new Notice("채팅을 먼저 열어주세요."); return; }
				const text = view.getLastAssistantText();
				if (!text) { new Notice("AI 응답이 없습니다."); return; }
				editor.replaceSelection(text);
				new Notice("AI 응답이 삽입되었습니다.");
			},
		});

		this.addCommand({
			id: "clear-chat",
			name: "채팅 대화 초기화",
			callback: () => {
				const view = this.getChatView();
				if (view) { view.clearChat(); new Notice("채팅이 초기화되었습니다."); }
				else new Notice("채팅을 먼저 열어주세요.");
			},
		});

		this.addCommand({
			id: "switch-model",
			name: "채팅 모델 전환 (Flash ↔ Pro)",
			callback: async () => {
				const current = this.settings.geminiModel;
				const next = current.includes("pro") ? "gemini-2.5-flash" : "gemini-2.5-pro";
				this.settings.geminiModel = next;
				await this.saveSettings();
				new Notice(`모델 전환: ${next}`);
			},
		});

		// Ribbon icons
		this.addRibbonIcon("database", "컨텍스트 매니저", () => {
			this.activateView(VIEW_TYPE_CONTEXT, "left");
		});

		this.addRibbonIcon("messages-square", "수주 AI 채팅", () => {
			this.activateView(VIEW_TYPE_CHAT, "right");
		});

		// Auto-analyze context files on create/modify
		if (this.settings.autoAnalyzeContext) {
			this.registerEvent(
				this.app.vault.on("create", (file) => {
					if (file instanceof TFile && this.shouldAutoAnalyze(file)) {
						// Delay to let file content settle
						setTimeout(() => this.autoAnalyzeFile(file), 2000);
					}
				})
			);
		}

		// RAG 증분 인덱싱
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile && this.shouldIndex(file)) {
					setTimeout(() => this.indexFileQuiet(file), 2000);
				}
			})
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile && this.vectorStore) {
					this.vectorStore.removeFile(file.path);
					void this.vectorStore.save();
				}
			})
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (this.vectorStore) {
					this.vectorStore.removeFile(oldPath);
					if (file instanceof TFile && this.shouldIndex(file)) {
						setTimeout(() => this.indexFileQuiet(file), 500);
					}
				}
			})
		);

		// Auto-open context manager on startup
		this.app.workspace.onLayoutReady(() => {
			this.activateView(VIEW_TYPE_CONTEXT, "left");
		});
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CONTEXT);
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_BRIEFING);
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_REPORT);
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHAT);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.initGemini();
		this.initRag();
		this.initMcp();
	}

	private initGemini(): void {
		if (this.settings.geminiApiKey) {
			this.gemini = new GeminiClient(
				this.settings.geminiApiKey,
				this.settings.geminiModel
			);
		} else {
			this.gemini = null;
		}
	}

	getChatView(): ChatView | null {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT);
		return leaves.length > 0 ? (leaves[0].view as ChatView) : null;
	}

	private initMcp(): void {
		this.mcpRegistry.setServers(this.settings.mcpServers ?? []);
	}

	private initRag(): void {
		if (!this.settings.geminiApiKey) {
			this.embeddings = null;
			this.vectorStore = null;
			return;
		}
		this.embeddings = new EmbeddingsClient(
			this.settings.geminiApiKey,
			this.settings.embeddingModel
		);
		this.vectorStore = new VectorStore(
			this.app,
			this.manifest.id,
			this.settings.embeddingModel
		);
	}

	/**
	 * 컨텍스트 폴더 전체를 재인덱싱.
	 * 설정 UI의 버튼과 명령 팔레트에서 호출.
	 */
	async indexVault(
		onProgress?: (done: number, total: number) => void
	): Promise<{ files: number; chunks: number }> {
		if (!this.embeddings || !this.vectorStore) {
			new Notice("Gemini API 키가 설정되지 않았습니다.");
			throw new Error("no-api-key");
		}
		const folder = this.settings.contextFolder;
		new Notice(`🔍 ${folder}/ 인덱싱 시작...`);
		const result = await this.vectorStore.reindex(
			folder,
			this.embeddings,
			onProgress
		);
		new Notice(`✅ 인덱싱 완료: ${result.files}개 파일, ${result.chunks}개 청크`);
		return result;
	}

	/**
	 * 현재 열린 파일을 Gemini로 분석하고 frontmatter 생성
	 */
	private async analyzeCurrentFile(): Promise<void> {
		if (!this.gemini) {
			new Notice("Gemini API 키가 설정되지 않았습니다.");
			return;
		}

		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("열린 파일이 없습니다.");
			return;
		}

		if (file.extension !== "md") {
			new Notice("마크다운 파일만 분석할 수 있습니다.");
			return;
		}

		new Notice(`🔍 ${file.basename} 분석 중...`);

		try {
			const content = await this.app.vault.read(file);
			const existing = getFrontmatter(file, this.app.metadataCache);
			const props = await this.gemini.generateProperties(
				file.name,
				content,
				existing
			);
			await updateFrontmatter(file, this.app.vault, props);
			new Notice(`✅ ${file.basename} 프로퍼티 생성 완료`);
		} catch (e: any) {
			new Notice(`❌ 분석 실패: ${e.message}`);
		}
	}

	/**
	 * _context/ 전체 파일 일괄 분석
	 */
	private async analyzeAllContext(): Promise<void> {
		if (!this.gemini) {
			new Notice("Gemini API 키가 설정되지 않았습니다.");
			return;
		}

		const files = this.app.vault.getFiles().filter(
			(f) => f.path.startsWith(this.settings.contextFolder + "/") && f.extension === "md"
		);

		if (files.length === 0) {
			new Notice(`${this.settings.contextFolder}/ 폴더에 마크다운 파일이 없습니다.`);
			return;
		}

		new Notice(`🔍 ${files.length}개 파일 분석 시작...`);

		let done = 0;
		let failed = 0;

		for (const file of files) {
			try {
				const content = await this.app.vault.read(file);
				const existing = getFrontmatter(file, this.app.metadataCache);

				// Skip if already analyzed
				if (existing["summary"] && existing["category"]) {
					done++;
					continue;
				}

				const summary = await this.gemini.summarizeFile(file.name, content);
				await updateFrontmatter(file, this.app.vault, {
					type: "context",
					category: summary.category,
					summary: summary.summary,
					tags: summary.tags,
					entities: summary.keyEntities,
					relevance: summary.relevance,
				});
				done++;

				// Rate limiting for free tier
				await sleep(1500);
			} catch (e) {
				failed++;
			}
		}

		new Notice(`✅ 분석 완료: ${done}개 성공, ${failed}개 실패`);
	}

	/**
	 * 파일이 자동 분석 대상인지 확인
	 */
	private shouldAutoAnalyze(file: TFile): boolean {
		if (file.extension !== "md") return false;
		return file.path.startsWith(this.settings.contextFolder + "/") ||
			file.path.startsWith(this.settings.analysisFolder + "/");
	}

	/**
	 * 파일이 RAG 인덱싱 대상인지 확인 (컨텍스트 폴더 내 마크다운만).
	 */
	private shouldIndex(file: TFile): boolean {
		if (file.extension !== "md") return false;
		return file.path.startsWith(this.settings.contextFolder + "/");
	}

	/**
	 * 단일 파일을 조용히 증분 인덱싱 (UI 알림 없음).
	 */
	private async indexFileQuiet(file: TFile): Promise<void> {
		if (!this.embeddings || !this.vectorStore) return;
		try {
			await this.vectorStore.indexFile(file, this.embeddings);
			await this.vectorStore.save();
		} catch (e) {
			console.warn("indexFileQuiet failed:", file.path, e);
		}
	}

	/**
	 * 열려 있는 모든 플러그인 뷰를 다시 그린다 (설정에서 경로 바꾼 뒤 호출용).
	 */
	refreshAllViews(): void {
		for (const type of [VIEW_TYPE_CONTEXT, VIEW_TYPE_BRIEFING, VIEW_TYPE_REPORT]) {
			const leaves = this.app.workspace.getLeavesOfType(type);
			for (const leaf of leaves) {
				const view = leaf.view as any;
				if (view && typeof view.render === "function") {
					try {
						view.render();
					} catch {
						// swallow render errors — next vault event will try again
					}
				}
			}
		}
	}

	/**
	 * 파일 자동 분석 (백그라운드)
	 */
	private async autoAnalyzeFile(file: TFile): Promise<void> {
		if (!this.gemini || !this.settings.autoFrontmatter) return;

		try {
			const content = await this.app.vault.read(file);
			if (content.length < 50) return; // Too short to analyze

			const existing = getFrontmatter(file, this.app.metadataCache);
			if (existing["type"]) return; // Already has properties

			const props = await this.gemini.generateProperties(
				file.name,
				content,
				existing
			);
			await updateFrontmatter(file, this.app.vault, props);
		} catch {
			// Silent fail for auto-analysis
		}
	}

	private async activateView(viewType: string, side: "left" | "right"): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(viewType);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = side === "left"
			? this.app.workspace.getLeftLeaf(false)
			: this.app.workspace.getRightLeaf(false);

		if (leaf) {
			await leaf.setViewState({ type: viewType, active: true });
			this.app.workspace.revealLeaf(leaf);
		}
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
