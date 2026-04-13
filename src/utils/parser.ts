import { TFile, Vault } from "obsidian";
import {
	BriefEntry,
	AnalysisReport,
	ContextStats,
	FITNESS_ICONS,
	DEFAULT_CONTEXT_FOLDER,
	DEFAULT_ANALYSIS_FOLDER,
	CONTEXT_CATEGORIES,
} from "./constants";

/**
 * 컨텍스트 폴더 통계 수집
 * @param vault Obsidian Vault
 * @param contextFolder 볼트 루트 기준 상대 경로 (예: "_context", "bid-pilot/_context")
 */
export function getContextStats(
	vault: Vault,
	contextFolder: string = DEFAULT_CONTEXT_FOLDER
): ContextStats {
	const stats: ContextStats = {
		totalFiles: 0,
		categories: {},
		lastModified: null,
	};

	const prefix = contextFolder + "/";
	const depth = contextFolder.split("/").length; // 몇 단계 하위에서 카테고리가 시작되는지

	const allFiles = vault.getFiles();
	for (const file of allFiles) {
		if (!file.path.startsWith(prefix)) continue;
		stats.totalFiles++;

		// Categorize by first subfolder under contextFolder
		const parts = file.path.split("/");
		// parts: [contextFolder 구성 조각들..., category, ...filename]
		if (parts.length >= depth + 2) {
			const cat = parts[depth];
			stats.categories[cat] = (stats.categories[cat] || 0) + 1;
		} else {
			stats.categories["(루트)"] = (stats.categories["(루트)"] || 0) + 1;
		}

		// Track latest modification
		const mtime = new Date(file.stat.mtime);
		if (!stats.lastModified || mtime > stats.lastModified) {
			stats.lastModified = mtime;
		}
	}

	return stats;
}

/**
 * 분석 결과 폴더에서 보고서 목록 추출
 */
export function getAnalysisReports(
	vault: Vault,
	analysisFolder: string = DEFAULT_ANALYSIS_FOLDER
): AnalysisReport[] {
	const reports: AnalysisReport[] = [];
	const prefix = analysisFolder + "/";

	const allFiles = vault.getFiles();
	for (const file of allFiles) {
		if (!file.path.startsWith(prefix)) continue;
		if (file.extension !== "md") continue;

		const name = file.basename;
		let type: AnalysisReport["type"] = "other";
		if (name.startsWith("brief-")) type = "brief";
		else if (name.startsWith("bid-analyze-")) type = "bid-analyze";
		else if (name.startsWith("scan-")) type = "scan";
		else if (name.startsWith("compete-")) type = "compete";
		else if (name.startsWith("pipeline-")) type = "pipeline";

		reports.push({
			path: file.path,
			title: name,
			date: formatDate(new Date(file.stat.mtime)),
			type,
		});
	}

	// Sort by date descending
	reports.sort((a, b) => b.date.localeCompare(a.date));
	return reports;
}

/**
 * 브리핑 마크다운에서 공고 테이블 파싱
 */
export function parseBriefTable(content: string): BriefEntry[] {
	const entries: BriefEntry[] = [];
	const lines = content.split("\n");

	let inTable = false;
	let headerPassed = false;

	for (const line of lines) {
		const trimmed = line.trim();

		// Detect table start (header row with 순위 or rank)
		if (trimmed.includes("순위") && trimmed.includes("사업명") && trimmed.startsWith("|")) {
			inTable = true;
			continue;
		}

		// Skip separator row
		if (inTable && !headerPassed && trimmed.match(/^\|[\s-|]+\|$/)) {
			headerPassed = true;
			continue;
		}

		// Parse data rows
		if (inTable && headerPassed && trimmed.startsWith("|")) {
			const cells = trimmed.split("|").filter((c) => c.trim() !== "");
			if (cells.length >= 6) {
				entries.push({
					rank: parseInt(cells[0].trim()) || entries.length + 1,
					name: cells[1].trim(),
					agency: cells[2].trim(),
					deadline: cells[3].trim(),
					dDay: extractDDay(cells[3].trim()),
					budget: cells[4].trim(),
					fitness: cells[5].trim(),
				});
			}
		}

		// End of table
		if (inTable && headerPassed && !trimmed.startsWith("|") && trimmed !== "") {
			inTable = false;
			headerPassed = false;
		}
	}

	return entries;
}

/**
 * 마크다운에서 섹션 추출
 */
export function extractSection(content: string, heading: string): string {
	const lines = content.split("\n");
	let capturing = false;
	let level = 0;
	const result: string[] = [];

	for (const line of lines) {
		const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

		if (headingMatch) {
			const currentLevel = headingMatch[1].length;
			const currentTitle = headingMatch[2].trim();

			if (currentTitle.includes(heading)) {
				capturing = true;
				level = currentLevel;
				continue;
			}

			if (capturing && currentLevel <= level) {
				break;
			}
		}

		if (capturing) {
			result.push(line);
		}
	}

	return result.join("\n").trim();
}

/**
 * D-day 추출: "2026-04-30 (D-18)" → "D-18"
 */
function extractDDay(text: string): string {
	const match = text.match(/\(D[+-]?\d+\)/);
	return match ? match[0].replace(/[()]/g, "") : "";
}

/**
 * 날짜 포맷
 */
export function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/**
 * 보고서 타입 한글 라벨
 */
export function reportTypeLabel(type: AnalysisReport["type"]): string {
	const labels: Record<string, string> = {
		brief: "일일 브리핑",
		"bid-analyze": "수주 분석",
		scan: "공고 스캔",
		compete: "경쟁 분석",
		pipeline: "파이프라인",
		other: "기타",
	};
	return labels[type] || "기타";
}
