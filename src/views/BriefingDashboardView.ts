import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import {
	VIEW_TYPE_BRIEFING,
	ANALYSIS_FOLDER,
	BriefEntry,
} from "../utils/constants";
import {
	parseBriefTable,
	extractSection,
	formatDate,
} from "../utils/parser";

export class BriefingDashboardView extends ItemView {
	private currentFile: TFile | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_BRIEFING;
	}

	getDisplayText(): string {
		return "수주 브리핑";
	}

	getIcon(): string {
		return "bar-chart-3";
	}

	async onOpen(): Promise<void> {
		await this.render();

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile && file.path.startsWith(ANALYSIS_FOLDER + "/brief-")) {
					this.render();
				}
			})
		);
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile && this.currentFile && file.path === this.currentFile.path) {
					this.render();
				}
			})
		);
	}

	async onClose(): Promise<void> {
		// cleanup
	}

	private async render(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("bi-briefing");

		// Find latest brief file
		const briefs = this.app.vault.getFiles()
			.filter((f) => f.path.startsWith(ANALYSIS_FOLDER + "/") && f.basename.startsWith("brief-"))
			.sort((a, b) => b.stat.mtime - a.stat.mtime);

		// Header
		const header = container.createDiv({ cls: "bi-brief-header" });
		header.createEl("h4", { text: "📊 수주 브리핑 대시보드" });
		header.createEl("span", {
			cls: "bi-brief-date",
			text: formatDate(new Date()),
		});

		if (briefs.length === 0) {
			this.renderEmptyState(container);
			return;
		}

		// Brief selector
		if (briefs.length > 1) {
			const selector = container.createDiv({ cls: "bi-brief-selector" });
			const select = selector.createEl("select", { cls: "bi-brief-select" });
			for (const brief of briefs.slice(0, 20)) {
				const opt = select.createEl("option", {
					text: brief.basename,
					value: brief.path,
				});
			}
			select.addEventListener("change", async () => {
				const file = this.app.vault.getAbstractFileByPath(select.value);
				if (file instanceof TFile) {
					this.currentFile = file;
					await this.renderBrief(container, file);
				}
			});
		}

		this.currentFile = briefs[0];
		await this.renderBrief(container, briefs[0]);
	}

	private async renderBrief(container: HTMLElement, file: TFile): Promise<void> {
		// Remove previous brief content (keep header and selector)
		const existing = container.querySelector(".bi-brief-content");
		if (existing) existing.remove();

		const content = await this.app.vault.read(file);
		const briefContent = container.createDiv({ cls: "bi-brief-content" });

		// Parse entries from the table
		const entries = parseBriefTable(content);

		// Summary cards
		const summary = briefContent.createDiv({ cls: "bi-brief-summary" });
		const total = entries.length;
		const highFit = entries.filter((e) => e.fitness.includes("🟢")).length;
		const deadlineSoon = entries.filter((e) => {
			const match = e.dDay.match(/D-?(\d+)/);
			return match && parseInt(match[1]) <= 7;
		}).length;

		this.createSummaryCard(summary, "전체 공고", String(total), "bi-card-total");
		this.createSummaryCard(summary, "적합도 높음", String(highFit), "bi-card-high");
		this.createSummaryCard(summary, "마감 임박", String(deadlineSoon), "bi-card-urgent");

		// Main table
		if (entries.length > 0) {
			const tableSection = briefContent.createDiv({ cls: "bi-brief-table-section" });
			tableSection.createEl("h5", { text: "신규 공고" });

			const table = tableSection.createEl("table", { cls: "bi-brief-table" });
			const thead = table.createEl("thead");
			const headerRow = thead.createEl("tr");
			for (const h of ["#", "사업명", "발주처", "마감일", "예산", "적합도"]) {
				headerRow.createEl("th", { text: h });
			}

			const tbody = table.createEl("tbody");
			for (const entry of entries) {
				const row = tbody.createEl("tr");
				row.createEl("td", { text: String(entry.rank) });

				const nameCell = row.createEl("td", { cls: "bi-brief-name" });
				nameCell.createEl("span", { text: entry.name });
				if (entry.dDay) {
					nameCell.createEl("span", {
						cls: `bi-dday ${this.getDDayClass(entry.dDay)}`,
						text: entry.dDay,
					});
				}

				row.createEl("td", { text: entry.agency });
				row.createEl("td", { text: entry.deadline.replace(/\s*\(D[+-]?\d+\)/, "") });
				row.createEl("td", { text: entry.budget });
				row.createEl("td", { cls: "bi-fitness", text: entry.fitness });
			}
		}

		// Deadline section
		const deadlineSection = extractSection(content, "마감 임박");
		if (deadlineSection) {
			const dlSection = briefContent.createDiv({ cls: "bi-brief-deadline" });
			dlSection.createEl("h5", { text: "⏰ 마감 임박 (7일 이내)" });
			dlSection.createDiv({ cls: "bi-brief-deadline-content" }).innerHTML =
				this.simpleMarkdownToHtml(deadlineSection);
		}

		// Market trends
		const trendSection = extractSection(content, "시장 동향");
		if (trendSection) {
			const trends = briefContent.createDiv({ cls: "bi-brief-trends" });
			trends.createEl("h5", { text: "📈 시장 동향" });
			trends.createDiv({ cls: "bi-brief-trends-content" }).innerHTML =
				this.simpleMarkdownToHtml(trendSection);
		}

		// Action items
		const actionSection = extractSection(content, "추천 액션");
		if (actionSection) {
			const actions = briefContent.createDiv({ cls: "bi-brief-actions" });
			actions.createEl("h5", { text: "💡 추천 액션" });
			actions.createDiv({ cls: "bi-brief-actions-content" }).innerHTML =
				this.simpleMarkdownToHtml(actionSection);
		}

		// Open source file link
		const footer = briefContent.createDiv({ cls: "bi-brief-footer" });
		const link = footer.createEl("a", {
			text: `📄 ${file.basename}.md 열기`,
			cls: "bi-brief-source-link",
		});
		link.addEventListener("click", (e) => {
			e.preventDefault();
			this.app.workspace.openLinkText(file.path, "", false);
		});
	}

	private renderEmptyState(container: HTMLElement): void {
		const empty = container.createDiv({ cls: "bi-brief-empty" });
		empty.createEl("div", { cls: "bi-brief-empty-icon", text: "📭" });
		empty.createEl("p", { text: "아직 브리핑이 없습니다." });
		empty.createEl("p", {
			cls: "bi-cm-hint",
			text: "Claude Code에서 /brief 명령을 실행하면 일일 브리핑이 생성됩니다.",
		});

		const cmd = empty.createEl("code", {
			cls: "bi-brief-cmd",
			text: "/brief",
		});
		cmd.addEventListener("click", () => {
			navigator.clipboard.writeText("/brief");
		});
	}

	private createSummaryCard(parent: HTMLElement, label: string, value: string, cls: string): void {
		const card = parent.createDiv({ cls: `bi-summary-card ${cls}` });
		card.createEl("div", { cls: "bi-card-value", text: value });
		card.createEl("div", { cls: "bi-card-label", text: label });
	}

	private getDDayClass(dDay: string): string {
		const match = dDay.match(/D-?(\d+)/);
		if (!match) return "";
		const days = parseInt(match[1]);
		if (days <= 3) return "bi-dday-critical";
		if (days <= 7) return "bi-dday-soon";
		return "bi-dday-normal";
	}

	private simpleMarkdownToHtml(md: string): string {
		return md
			.replace(/^- (.+)$/gm, "<li>$1</li>")
			.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
			.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
			.replace(/`(.+?)`/g, "<code>$1</code>")
			.replace(/\n{2,}/g, "<br><br>")
			.replace(/\|.*\|/g, (match) => {
				// Simple table row rendering
				const cells = match.split("|").filter((c) => c.trim());
				if (cells.every((c) => c.trim().match(/^-+$/))) return "";
				return "<div class='bi-table-row'>" +
					cells.map((c) => `<span class='bi-table-cell'>${c.trim()}</span>`).join("") +
					"</div>";
			});
	}
}
