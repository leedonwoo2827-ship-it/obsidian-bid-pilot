import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer } from "obsidian";
import {
	VIEW_TYPE_REPORT,
	AnalysisReport,
} from "../utils/constants";
import { getAnalysisReports, reportTypeLabel, formatDate } from "../utils/parser";
import type BidIntelligencePlugin from "../main";

export class AnalysisReportView extends ItemView {
	private selectedType: string = "all";
	private plugin: BidIntelligencePlugin;

	constructor(leaf: WorkspaceLeaf, plugin: BidIntelligencePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_REPORT;
	}

	getDisplayText(): string {
		return "분석 리포트";
	}

	getIcon(): string {
		return "file-text";
	}

	async onOpen(): Promise<void> {
		await this.render();

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				const analysisFolder = this.plugin.settings.analysisFolder;
				if (file instanceof TFile && file.path.startsWith(analysisFolder + "/")) {
					this.render();
				}
			})
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				const analysisFolder = this.plugin.settings.analysisFolder;
				if (file instanceof TFile && file.path.startsWith(analysisFolder + "/")) {
					this.render();
				}
			})
		);
	}

	async onClose(): Promise<void> {
		// cleanup
	}

	async render(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("bi-report");

		const reports = getAnalysisReports(this.app.vault, this.plugin.settings.analysisFolder);

		// Header
		const header = container.createDiv({ cls: "bi-report-header" });
		header.createEl("h4", { text: "📑 분석 리포트" });
		header.createEl("span", {
			cls: "bi-report-count",
			text: `${reports.length}개`,
		});

		if (reports.length === 0) {
			this.renderEmptyState(container);
			return;
		}

		// Filter bar
		const filterBar = container.createDiv({ cls: "bi-report-filter" });
		const types = ["all", "brief", "bid-analyze", "scan", "compete", "pipeline", "other"];
		const typeLabels: Record<string, string> = {
			all: "전체",
			brief: "브리핑",
			"bid-analyze": "수주 분석",
			scan: "공고 스캔",
			compete: "경쟁 분석",
			pipeline: "파이프라인",
			other: "기타",
		};

		for (const t of types) {
			const count = t === "all"
				? reports.length
				: reports.filter((r) => r.type === t).length;

			if (count === 0 && t !== "all") continue;

			const btn = filterBar.createEl("button", {
				cls: `bi-filter-btn ${this.selectedType === t ? "bi-filter-active" : ""}`,
				text: `${typeLabels[t]} (${count})`,
			});
			btn.addEventListener("click", () => {
				this.selectedType = t;
				this.render();
			});
		}

		// Report list
		const filtered = this.selectedType === "all"
			? reports
			: reports.filter((r) => r.type === this.selectedType);

		const list = container.createDiv({ cls: "bi-report-list" });

		// Group by date
		const grouped = this.groupByDate(filtered);
		for (const [date, items] of Object.entries(grouped)) {
			const group = list.createDiv({ cls: "bi-report-group" });
			group.createEl("div", { cls: "bi-report-date-header", text: date });

			for (const report of items) {
				const item = group.createDiv({ cls: "bi-report-item" });

				const badge = item.createEl("span", {
					cls: `bi-report-badge bi-badge-${report.type}`,
					text: reportTypeLabel(report.type),
				});

				const titleEl = item.createEl("a", {
					cls: "bi-report-title",
					text: this.cleanTitle(report.title),
				});
				titleEl.addEventListener("click", (e) => {
					e.preventDefault();
					this.openReport(report);
				});

				// Preview button
				const previewBtn = item.createEl("button", {
					cls: "bi-report-preview-btn",
					text: "미리보기",
				});
				previewBtn.addEventListener("click", async (e) => {
					e.stopPropagation();
					await this.showPreview(container, report);
				});
			}
		}
	}

	private renderEmptyState(container: HTMLElement): void {
		const empty = container.createDiv({ cls: "bi-report-empty" });
		empty.createEl("div", { cls: "bi-report-empty-icon", text: "📊" });
		empty.createEl("p", { text: "아직 분석 리포트가 없습니다." });
		empty.createEl("p", {
			cls: "bi-cm-hint",
			text: "Claude Code에서 /bid-analyze, /scan, /compete 등을 실행하면 리포트가 생성됩니다.",
		});

		const cmds = empty.createDiv({ cls: "bi-report-cmds" });
		for (const cmd of ["/bid-analyze", "/scan", "/compete", "/brief"]) {
			const code = cmds.createEl("code", { cls: "bi-report-cmd", text: cmd });
			code.addEventListener("click", () => {
				navigator.clipboard.writeText(cmd);
			});
		}
	}

	private async showPreview(container: HTMLElement, report: AnalysisReport): Promise<void> {
		// Remove existing preview
		const existing = container.querySelector(".bi-report-preview");
		if (existing) existing.remove();

		const file = this.app.vault.getAbstractFileByPath(report.path);
		if (!(file instanceof TFile)) return;

		const content = await this.app.vault.read(file);

		const preview = container.createDiv({ cls: "bi-report-preview" });

		const previewHeader = preview.createDiv({ cls: "bi-preview-header" });
		previewHeader.createEl("strong", { text: this.cleanTitle(report.title) });
		const closeBtn = previewHeader.createEl("button", {
			cls: "bi-preview-close",
			text: "✕",
		});
		closeBtn.addEventListener("click", () => preview.remove());

		const previewBody = preview.createDiv({ cls: "bi-preview-body" });

		// Use Obsidian's markdown renderer
		await MarkdownRenderer.render(
			this.app,
			content.slice(0, 3000), // Limit preview length
			previewBody,
			report.path,
			this,
		);

		if (content.length > 3000) {
			previewBody.createEl("p", {
				cls: "bi-preview-truncated",
				text: "… (전체 내용은 파일을 열어 확인하세요)",
			});
		}

		const openBtn = preview.createEl("button", {
			cls: "bi-preview-open-btn",
			text: "📄 전체 보기",
		});
		openBtn.addEventListener("click", () => {
			this.openReport(report);
			preview.remove();
		});
	}

	private openReport(report: AnalysisReport): void {
		this.app.workspace.openLinkText(report.path, "", false);
	}

	private cleanTitle(title: string): string {
		return title
			.replace(/^(brief|bid-analyze|scan|compete|pipeline)-/, "")
			.replace(/-/g, " ")
			.trim() || title;
	}

	private groupByDate(reports: AnalysisReport[]): Record<string, AnalysisReport[]> {
		const groups: Record<string, AnalysisReport[]> = {};
		for (const r of reports) {
			const date = r.date;
			if (!groups[date]) groups[date] = [];
			groups[date].push(r);
		}
		return groups;
	}
}
