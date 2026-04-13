import { ItemView, WorkspaceLeaf, TFile, TFolder, Notice } from "obsidian";
import {
	VIEW_TYPE_CONTEXT,
	CONTEXT_CATEGORIES,
} from "../utils/constants";
import { getContextStats, formatDate } from "../utils/parser";
import { getFrontmatter } from "../utils/frontmatter";
import type BidIntelligencePlugin from "../main";

export class ContextManagerView extends ItemView {
	private plugin: BidIntelligencePlugin;

	constructor(leaf: WorkspaceLeaf, plugin: BidIntelligencePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CONTEXT;
	}

	getDisplayText(): string {
		return "컨텍스트 매니저";
	}

	getIcon(): string {
		return "database";
	}

	async onOpen(): Promise<void> {
		this.render();

		this.registerEvent(
			this.app.vault.on("create", () => this.render())
		);
		this.registerEvent(
			this.app.vault.on("delete", () => this.render())
		);
		this.registerEvent(
			this.app.vault.on("rename", () => this.render())
		);
	}

	async onClose(): Promise<void> {
		// cleanup handled by Obsidian
	}

	render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("bi-context-manager");

		const contextFolder = this.plugin.settings.contextFolder;
		const stats = getContextStats(this.app.vault, contextFolder);

		// Header
		const header = container.createDiv({ cls: "bi-cm-header" });
		header.createEl("h4", { text: "📂 회사 컨텍스트" });
		header.createEl("span", {
			cls: "bi-cm-badge",
			text: `${stats.totalFiles}개 파일`,
		});

		// Status indicator
		const status = container.createDiv({ cls: "bi-cm-status" });
		if (stats.totalFiles === 0) {
			status.addClass("bi-cm-status-empty");
			status.createEl("p", {
				text: "⚠️ _context/ 폴더가 비어 있습니다.",
			});
			status.createEl("p", {
				cls: "bi-cm-hint",
				text: "회사 데이터(IR보고서, 과거 제안서 등)를 넣으면 분석 품질이 향상됩니다.",
			});

			const guide = status.createDiv({ cls: "bi-cm-guide" });
			guide.createEl("strong", { text: "권장 파일:" });
			const list = guide.createEl("ul");
			list.createEl("li", { text: "IR보고서 또는 회사소개서 (PDF/MD)" });
			list.createEl("li", { text: "과거 제안서 1건 이상" });
			list.createEl("li", { text: "최근 3개년 재무제표" });
			list.createEl("li", { text: "핵심 인력 CV" });
		} else {
			status.addClass("bi-cm-status-ok");
			status.createEl("p", {
				text: `✅ ${stats.totalFiles}개 파일 로드됨`,
			});
			if (stats.lastModified) {
				status.createEl("p", {
					cls: "bi-cm-hint",
					text: `최근 수정: ${formatDate(stats.lastModified)}`,
				});
			}
		}

		// AI Analysis section
		if (stats.totalFiles > 0) {
			const aiSection = container.createDiv({ cls: "bi-cm-ai" });
			aiSection.createEl("h5", { text: "🤖 AI 분석" });

			const aiStatus = this.plugin.gemini
				? "Gemini 연결됨"
				: "API 키 미설정";
			const aiStatusCls = this.plugin.gemini
				? "bi-cm-ai-connected"
				: "bi-cm-ai-disconnected";

			aiSection.createEl("span", { cls: `bi-cm-ai-status ${aiStatusCls}`, text: aiStatus });

			if (this.plugin.gemini) {
				const mdFiles = this.app.vault.getFiles().filter(
					(f) => f.path.startsWith(contextFolder + "/") && f.extension === "md"
				);
				const analyzed = mdFiles.filter((f) => {
					const fm = getFrontmatter(f, this.app.metadataCache);
					return fm["type"] || fm["summary"] || fm["category"];
				}).length;

				aiSection.createEl("p", {
					cls: "bi-cm-hint",
					text: `${mdFiles.length}개 MD 파일 중 ${analyzed}개 분석 완료`,
				});

				if (analyzed < mdFiles.length) {
					const analyzeBtn = aiSection.createEl("button", {
						cls: "bi-cm-action-btn bi-cm-analyze-btn",
						text: `🔍 미분석 ${mdFiles.length - analyzed}개 파일 분석`,
					});
					analyzeBtn.addEventListener("click", async () => {
						analyzeBtn.setText("분석 중...");
						analyzeBtn.setAttr("disabled", "true");
						await this.runBatchAnalysis(mdFiles.filter((f) => {
							const fm = getFrontmatter(f, this.app.metadataCache);
							return !fm["type"] && !fm["summary"] && !fm["category"];
						}));
						this.render();
					});
				}
			}
		}

		// Category breakdown
		const catSection = container.createDiv({ cls: "bi-cm-categories" });
		catSection.createEl("h5", { text: "카테고리별 현황" });

		const catGrid = catSection.createDiv({ cls: "bi-cm-cat-grid" });
		for (const [key, label] of Object.entries(CONTEXT_CATEGORIES)) {
			const count = stats.categories[key] || 0;
			const item = catGrid.createDiv({ cls: "bi-cm-cat-item" });
			item.createEl("span", {
				cls: `bi-cm-cat-count ${count > 0 ? "bi-cm-cat-active" : "bi-cm-cat-empty"}`,
				text: String(count),
			});
			item.createEl("span", { cls: "bi-cm-cat-label", text: label });

			if (count > 0) {
				item.addClass("bi-cm-cat-has-files");
				item.addEventListener("click", () => {
					this.openFolder(`${contextFolder}/${key}`);
				});
			}
		}

		for (const [key, count] of Object.entries(stats.categories)) {
			if (key in CONTEXT_CATEGORIES) continue;
			const item = catGrid.createDiv({ cls: "bi-cm-cat-item bi-cm-cat-has-files" });
			item.createEl("span", {
				cls: "bi-cm-cat-count bi-cm-cat-active",
				text: String(count),
			});
			item.createEl("span", { cls: "bi-cm-cat-label", text: key });
			item.addEventListener("click", () => {
				if (key === "(루트)") {
					this.openFolder(contextFolder);
				} else {
					this.openFolder(`${contextFolder}/${key}`);
				}
			});
		}

		// File list with analysis status
		if (stats.totalFiles > 0) {
			const fileSection = container.createDiv({ cls: "bi-cm-files" });
			fileSection.createEl("h5", { text: "파일 목록" });

			const fileList = fileSection.createDiv({ cls: "bi-cm-file-list" });
			const allFiles = this.app.vault.getFiles()
				.filter((f) => f.path.startsWith(contextFolder + "/"))
				.sort((a, b) => b.stat.mtime - a.stat.mtime);

			for (const file of allFiles.slice(0, 30)) {
				const item = fileList.createDiv({ cls: "bi-cm-file-item" });
				const icon = this.getFileIcon(file.extension);
				item.createEl("span", { cls: "bi-cm-file-icon", text: icon });

				const link = item.createEl("a", {
					cls: "bi-cm-file-link",
					text: file.path.replace(contextFolder + "/", ""),
				});
				link.addEventListener("click", (e) => {
					e.preventDefault();
					this.app.workspace.openLinkText(file.path, "", false);
				});

				// Show analysis status for md files
				if (file.extension === "md") {
					const fm = getFrontmatter(file, this.app.metadataCache);
					if (fm["summary"] || fm["type"]) {
						item.createEl("span", { cls: "bi-cm-file-analyzed", text: "✓" });
					}
				}

				item.createEl("span", {
					cls: "bi-cm-file-date",
					text: formatDate(new Date(file.stat.mtime)),
				});
			}

			if (allFiles.length > 30) {
				fileList.createEl("p", {
					cls: "bi-cm-hint",
					text: `...외 ${allFiles.length - 30}개 파일`,
				});
			}
		}

		// Quick actions
		const actions = container.createDiv({ cls: "bi-cm-actions" });
		actions.createEl("h5", { text: "빠른 실행" });

		const btnGrid = actions.createDiv({ cls: "bi-cm-btn-grid" });
		this.createActionButton(btnGrid, "📊 수주 분석", "bid-analyze");
		this.createActionButton(btnGrid, "📡 공고 스캔", "scan");
		this.createActionButton(btnGrid, "🏢 경쟁 분석", "compete");
		this.createActionButton(btnGrid, "📋 일일 브리핑", "brief");
	}

	private async runBatchAnalysis(files: TFile[]): Promise<void> {
		if (!this.plugin.gemini) return;

		let done = 0;
		for (const file of files) {
			try {
				const content = await this.app.vault.read(file);
				const summary = await this.plugin.gemini.summarizeFile(file.name, content);
				const { updateFrontmatter } = await import("../utils/frontmatter");
				await updateFrontmatter(file, this.app.vault, {
					type: "context",
					category: summary.category,
					summary: summary.summary,
					tags: summary.tags,
					entities: summary.keyEntities,
					relevance: summary.relevance,
				});
				done++;
				new Notice(`분석 ${done}/${files.length}: ${file.basename}`);
				await new Promise((r) => setTimeout(r, 1500));
			} catch {
				// Continue on failure
			}
		}
		new Notice(`✅ 분석 완료: ${done}/${files.length}`);
	}

	private createActionButton(parent: HTMLElement, label: string, command: string): void {
		const btn = parent.createEl("button", {
			cls: "bi-cm-action-btn",
			text: label,
		});
		btn.addEventListener("click", () => {
			navigator.clipboard.writeText(`/${command}`).then(() => {
				btn.setText(`✓ /${command} 복사됨`);
				setTimeout(() => btn.setText(label), 2000);
			});
		});
	}

	private openFolder(path: string): void {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (folder && folder instanceof TFolder) {
			(this.app as any).internalPlugins?.plugins?.["file-explorer"]?.instance?.revealInFolder(folder);
		}
	}

	private getFileIcon(ext: string): string {
		const icons: Record<string, string> = {
			md: "📝",
			pdf: "📄",
			docx: "📃",
			xlsx: "📊",
			pptx: "📑",
			hwp: "📜",
			hwpx: "📜",
			jpg: "🖼",
			png: "🖼",
			csv: "📋",
		};
		return icons[ext] || "📎";
	}
}
