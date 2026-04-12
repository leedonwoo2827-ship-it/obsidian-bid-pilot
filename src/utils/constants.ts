import { ItemView } from "obsidian";

// View type identifiers
export const VIEW_TYPE_CONTEXT = "bid-context-manager";
export const VIEW_TYPE_BRIEFING = "bid-briefing-dashboard";
export const VIEW_TYPE_REPORT = "bid-analysis-report";

// Folder paths
export const CONTEXT_FOLDER = "_context";
export const ANALYSIS_FOLDER = "_analysis";

// Context subfolder categories
export const CONTEXT_CATEGORIES: Record<string, string> = {
	company: "회사 소개/IR보고서",
	proposals: "과거 제안서",
	credentials: "인증서/수상이력",
	personnel: "핵심 인력 CV",
	sector: "부서별 전문 데이터",
};

// Fitness level icons
export const FITNESS_ICONS: Record<string, string> = {
	high: "🟢",
	medium: "🟡",
	low: "🔴",
	unknown: "⚪",
};

// Brief table headers
export const BRIEF_HEADERS = [
	"순위", "사업명", "발주처", "마감일", "예산규모", "적합도",
];

export interface BriefEntry {
	rank: number;
	name: string;
	agency: string;
	deadline: string;
	dDay: string;
	budget: string;
	fitness: string;
}

export interface AnalysisReport {
	path: string;
	title: string;
	date: string;
	type: "brief" | "bid-analyze" | "scan" | "compete" | "pipeline" | "other";
}

export interface ContextStats {
	totalFiles: number;
	categories: Record<string, number>;
	lastModified: Date | null;
}
