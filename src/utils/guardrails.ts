import { App, TFile } from "obsidian";

const GUARDRAILS_PATH = "_memory/quality-guardrails.md";
const SECTION_HEADING = "## 작성 원칙 (시스템 프롬프트 자동 주입 대상)";

/**
 * _memory/quality-guardrails.md의 "작성 원칙" 섹션을 읽어 반환.
 * 파일이 없거나 섹션을 찾지 못하면 null (기본 프롬프트 사용).
 */
export async function loadGuardrails(app: App): Promise<string | null> {
	const file = app.vault.getAbstractFileByPath(GUARDRAILS_PATH);
	if (!(file instanceof TFile)) return null;

	const content = await app.vault.cachedRead(file);
	const lines = content.split(/\r?\n/);
	const startIdx = lines.findIndex((l) => l.trim() === SECTION_HEADING);
	if (startIdx === -1) return null;

	// 다음 ## 헤딩 직전까지
	let endIdx = lines.length;
	for (let i = startIdx + 1; i < lines.length; i++) {
		if (/^#{1,2}\s+/.test(lines[i])) {
			endIdx = i;
			break;
		}
	}

	return lines.slice(startIdx + 1, endIdx).join("\n").trim();
}
