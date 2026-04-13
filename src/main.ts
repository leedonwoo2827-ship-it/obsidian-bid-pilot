import { Plugin, WorkspaceLeaf, TFile, Notice } from "obsidian";
import {
	VIEW_TYPE_CONTEXT,
	VIEW_TYPE_BRIEFING,
	VIEW_TYPE_REPORT,
} from "./utils/constants";
import { ContextManagerView } from "./views/ContextManagerView";
import { BriefingDashboardView } from "./views/BriefingDashboardView";
import { AnalysisReportView } from "./views/AnalysisReportView";
import {
	BidIntelligenceSettings,
	BidIntelligenceSettingTab,
	DEFAULT_SETTINGS,
} from "./settings";
import { GeminiClient } from "./utils/gemini";
import { updateFrontmatter, addFrontmatter, getFrontmatter } from "./utils/frontmatter";

export default class BidIntelligencePlugin extends Plugin {
	settings: BidIntelligenceSettings = DEFAULT_SETTINGS;
	gemini: GeminiClient | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.initGemini();

		// Settings tab
		this.addSettingTab(new BidIntelligenceSettingTab(this.app, this));

		// Register views — pass plugin reference so views can read settings & Gemini
		this.registerView(VIEW_TYPE_CONTEXT, (leaf) => new ContextManagerView(leaf, this));
		this.registerView(VIEW_TYPE_BRIEFING, (leaf) => new BriefingDashboardView(leaf, this));
		this.registerView(VIEW_TYPE_REPORT, (leaf) => new AnalysisReportView(leaf, this));

		// Register commands
		this.addCommand({
			id: "open-context-manager",
			name: "컨텍스트 매니저 열기",
			callback: () => this.activateView(VIEW_TYPE_CONTEXT, "left"),
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

		// Ribbon icons
		this.addRibbonIcon("database", "컨텍스트 매니저", () => {
			this.activateView(VIEW_TYPE_CONTEXT, "left");
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

		// Auto-open context manager on startup
		this.app.workspace.onLayoutReady(() => {
			this.activateView(VIEW_TYPE_CONTEXT, "left");
		});
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CONTEXT);
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_BRIEFING);
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_REPORT);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.initGemini();
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
