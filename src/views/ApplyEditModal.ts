import { App, Modal, Notice, TFile } from "obsidian";
import { lineDiff, renderDiff, injectDiffStyle } from "../utils/diffView";

export interface EditProposal {
	/** 대상 파일 경로 (vault 기준). 빈 문자열이면 활성 파일 */
	targetPath: string;
	/** AI가 제안한 새 내용 또는 교체할 단편 */
	proposedContent: string;
	/** "replace" — 파일 전체 교체 / "append" — 끝에 추가 / "section" — 특정 섹션 교체 */
	mode?: "replace" | "append" | "section";
	/** section 모드 시 대상 섹션 헤딩 경로 */
	sectionHeading?: string;
}

/**
 * AI의 편집 제안을 diff로 보여주고 사용자 승인 시 파일에 적용.
 */
export class ApplyEditModal extends Modal {
	private proposal: EditProposal;
	private onApplied?: () => void;

	constructor(app: App, proposal: EditProposal, onApplied?: () => void) {
		super(app);
		this.proposal = proposal;
		this.onApplied = onApplied;
	}

	async onOpen(): Promise<void> {
		injectDiffStyle();
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: "📝 편집 제안 검토" });

		const file = this.resolveFile();
		if (!file) {
			contentEl.createEl("p", {
				text: "❌ 대상 파일을 찾지 못했습니다: " + (this.proposal.targetPath || "(활성 파일 없음)"),
			});
			return;
		}

		const oldContent = await this.app.vault.read(file);
		const newContent = this.computeNewContent(oldContent);

		const info = contentEl.createDiv({ cls: "bi-apply-info" });
		info.createEl("strong", { text: "대상: " });
		info.createEl("code", { text: file.path });
		info.createEl("span", {
			text: ` (${this.proposal.mode ?? "replace"} 모드)`,
		});

		const diffContainer = contentEl.createDiv();
		renderDiff(lineDiff(oldContent, newContent), diffContainer);

		const btnRow = contentEl.createDiv({ cls: "bi-apply-buttons" });
		btnRow.style.display = "flex";
		btnRow.style.gap = "8px";
		btnRow.style.marginTop = "12px";
		btnRow.style.justifyContent = "flex-end";

		const cancel = btnRow.createEl("button", { text: "취소" });
		cancel.onclick = () => this.close();

		const apply = btnRow.createEl("button", {
			text: "✅ 적용",
			cls: "mod-cta",
		});
		apply.onclick = async () => {
			try {
				await this.app.vault.modify(file, newContent);
				new Notice(`✅ ${file.basename} 업데이트 완료`);
				this.onApplied?.();
				this.close();
			} catch (e: any) {
				new Notice(`❌ 적용 실패: ${e.message || e}`);
			}
		};
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private resolveFile(): TFile | null {
		if (this.proposal.targetPath) {
			const f = this.app.vault.getAbstractFileByPath(this.proposal.targetPath);
			return f instanceof TFile ? f : null;
		}
		return this.app.workspace.getActiveFile();
	}

	private computeNewContent(oldContent: string): string {
		const mode = this.proposal.mode ?? "replace";
		switch (mode) {
			case "append":
				return oldContent.replace(/\s*$/, "") + "\n\n" + this.proposal.proposedContent + "\n";
			case "section":
				return this.replaceSection(
					oldContent,
					this.proposal.sectionHeading ?? "",
					this.proposal.proposedContent
				);
			case "replace":
			default:
				return this.proposal.proposedContent;
		}
	}

	/**
	 * 특정 헤딩부터 다음 동일/상위 헤딩 직전까지 교체.
	 * heading은 "## 섹션명" 형태 문자열. 매칭 실패 시 append로 폴백.
	 */
	private replaceSection(content: string, heading: string, replacement: string): string {
		if (!heading) return content + "\n\n" + replacement;

		const hMatch = heading.match(/^(#{1,6})\s+/);
		if (!hMatch) return content + "\n\n" + replacement;
		const level = hMatch[1].length;

		const lines = content.split(/\r?\n/);
		let start = -1;
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].trim() === heading.trim()) {
				start = i;
				break;
			}
		}
		if (start === -1) return content + "\n\n" + replacement;

		let end = lines.length;
		for (let i = start + 1; i < lines.length; i++) {
			const m = lines[i].match(/^(#{1,6})\s+/);
			if (m && m[1].length <= level) {
				end = i;
				break;
			}
		}

		const before = lines.slice(0, start).join("\n");
		const after = lines.slice(end).join("\n");
		return [before, replacement.trim(), after].filter(Boolean).join("\n\n");
	}
}

/**
 * 어시스턴트 응답 본문에서 `<<<EDIT target="..." mode="...">>>…<<<END_EDIT>>>`
 * 블록을 추출. 없으면 빈 배열.
 */
export function parseEditProposals(responseText: string): EditProposal[] {
	const result: EditProposal[] = [];
	const re = /<<<EDIT([^>]*)>>>([\s\S]*?)<<<END_EDIT>>>/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(responseText))) {
		const attrs = m[1];
		const body = m[2].trim();
		const targetMatch = attrs.match(/target="([^"]+)"/);
		const modeMatch = attrs.match(/mode="([^"]+)"/);
		const sectionMatch = attrs.match(/section="([^"]+)"/);
		result.push({
			targetPath: targetMatch?.[1] ?? "",
			proposedContent: body,
			mode: (modeMatch?.[1] as EditProposal["mode"]) ?? "replace",
			sectionHeading: sectionMatch?.[1],
		});
	}
	return result;
}
