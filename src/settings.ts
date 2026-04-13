import { App, PluginSettingTab, Setting } from "obsidian";
import type BidIntelligencePlugin from "./main";
import { DEFAULT_CONTEXT_FOLDER, DEFAULT_ANALYSIS_FOLDER } from "./utils/constants";

export interface BidIntelligenceSettings {
	geminiApiKey: string;
	geminiModel: string;
	autoAnalyzeContext: boolean;
	autoFrontmatter: boolean;
	briefingKeywords: string;
	briefingAgencies: string;
	language: string;
	contextFolder: string;
	analysisFolder: string;
	chatHistoryLimit: number;
	systemPromptOverride: string;
	ragEnabled: boolean;
	ragTopK: number;
	embeddingModel: string;
}

export const DEFAULT_SETTINGS: BidIntelligenceSettings = {
	geminiApiKey: "",
	geminiModel: "gemini-2.5-flash",
	autoAnalyzeContext: true,
	autoFrontmatter: true,
	briefingKeywords: "교육, ICT, ODA, 디지털, 컨설팅",
	briefingAgencies: "KOICA, 나라장터, NIPA, NIA",
	language: "ko",
	contextFolder: DEFAULT_CONTEXT_FOLDER,
	analysisFolder: DEFAULT_ANALYSIS_FOLDER,
	chatHistoryLimit: 20,
	systemPromptOverride: "",
	ragEnabled: true,
	ragTopK: 5,
	embeddingModel: "text-embedding-004",
};

/** 경로 문자열 정규화 (선후 슬래시 제거, 백슬래시→슬래시) */
export function normalizeFolderPath(input: string, fallback: string): string {
	if (!input) return fallback;
	const cleaned = input
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.trim();
	return cleaned || fallback;
}

export class BidIntelligenceSettingTab extends PluginSettingTab {
	plugin: BidIntelligencePlugin;

	constructor(app: App, plugin: BidIntelligencePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Bid Intelligence 설정" });

		// ── 프로젝트 경로 ──
		containerEl.createEl("h3", { text: "📁 프로젝트 경로" });

		const pathDesc = containerEl.createEl("p", {
			cls: "setting-item-description",
		});
		pathDesc.style.marginBottom = "12px";
		pathDesc.innerHTML = `
			볼트 루트 기준 상대 경로입니다.
			<br>• 기본: <code>_context</code> / <code>_analysis</code>
			<br>• 하위 프로젝트 사용 시: <code>bid-pilot/_context</code> / <code>bid-pilot/_analysis</code>
			<br>• 변경 후 사이드바가 즉시 갱신되지 않으면 아래 "다시 그리기" 버튼을 누르세요.
		`;

		new Setting(containerEl)
			.setName("컨텍스트 폴더 경로")
			.setDesc("회사 자료가 들어 있는 폴더")
			.addText((text) =>
				text
					.setPlaceholder("_context 또는 bid-pilot/_context")
					.setValue(this.plugin.settings.contextFolder)
					.onChange(async (value) => {
						this.plugin.settings.contextFolder = normalizeFolderPath(
							value,
							DEFAULT_CONTEXT_FOLDER
						);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("분석 결과 폴더 경로")
			.setDesc("/bid-analyze, /brief 결과가 저장되는 폴더")
			.addText((text) =>
				text
					.setPlaceholder("_analysis 또는 bid-pilot/_analysis")
					.setValue(this.plugin.settings.analysisFolder)
					.onChange(async (value) => {
						this.plugin.settings.analysisFolder = normalizeFolderPath(
							value,
							DEFAULT_ANALYSIS_FOLDER
						);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("뷰 즉시 갱신")
			.setDesc("경로 변경 후 사이드바/대시보드를 지금 다시 그립니다.")
			.addButton((button) =>
				button.setButtonText("다시 그리기").onClick(() => {
					this.plugin.refreshAllViews();
					button.setButtonText("✓ 완료");
					setTimeout(() => button.setButtonText("다시 그리기"), 1500);
				})
			);

		// ── AI 설정 ──
		containerEl.createEl("h3", { text: "🤖 AI 설정" });

		new Setting(containerEl)
			.setName("Gemini API 키")
			.setDesc("Google AI Studio에서 발급받은 API 키를 입력하세요.")
			.addText((text) =>
				text
					.setPlaceholder("AIzaSy...")
					.setValue(this.plugin.settings.geminiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.geminiApiKey = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Gemini 모델")
			.setDesc("사용할 Gemini 모델을 선택하세요.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("gemini-2.5-flash", "Gemini 2.5 Flash (빠름, 범용)")
					.addOption("gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite (저비용)")
					.addOption("gemini-2.5-pro", "Gemini 2.5 Pro (고품질)")
					.setValue(this.plugin.settings.geminiModel)
					.onChange(async (value) => {
						this.plugin.settings.geminiModel = value;
						await this.plugin.saveSettings();
					})
			);

		// ── 자동화 설정 ──
		containerEl.createEl("h3", { text: "⚙️ 자동화" });

		new Setting(containerEl)
			.setName("컨텍스트 자동 분석")
			.setDesc("_context/ 폴더 파일이 추가/변경되면 Gemini로 자동 요약합니다.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoAnalyzeContext)
					.onChange(async (value) => {
						this.plugin.settings.autoAnalyzeContext = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("프로퍼티 자동 생성")
			.setDesc("분석 결과를 파일 프로퍼티(frontmatter)에 자동 기록합니다.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoFrontmatter)
					.onChange(async (value) => {
						this.plugin.settings.autoFrontmatter = value;
						await this.plugin.saveSettings();
					})
			);

		// ── 채팅 설정 ──
		containerEl.createEl("h3", { text: "💬 채팅" });

		new Setting(containerEl)
			.setName("히스토리 유지 턴 수")
			.setDesc("Gemini에 전달할 최근 대화 쌍(user+assistant)의 개수. 길수록 문맥 유지, 토큰 사용 증가.")
			.addText((text) =>
				text
					.setPlaceholder("20")
					.setValue(String(this.plugin.settings.chatHistoryLimit))
					.onChange(async (value) => {
						const n = parseInt(value, 10);
						this.plugin.settings.chatHistoryLimit =
							Number.isFinite(n) && n > 0 ? n : 20;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("시스템 프롬프트 재정의")
			.setDesc("비워두면 기본 수주 분석 프롬프트를 사용. 프로젝트별 규범을 강제하려면 여기에 기입.")
			.addTextArea((text) => {
				text.setValue(this.plugin.settings.systemPromptOverride).onChange(
					async (value) => {
						this.plugin.settings.systemPromptOverride = value;
						await this.plugin.saveSettings();
					}
				);
				text.inputEl.rows = 5;
				text.inputEl.style.width = "100%";
			});

		// ── RAG 설정 ──
		containerEl.createEl("h3", { text: "🔍 RAG (자동 근거 검색)" });

		new Setting(containerEl)
			.setName("RAG 활성화")
			.setDesc("채팅 질문 시 컨텍스트 폴더에서 관련 청크를 자동 검색해 프롬프트에 주입합니다.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.ragEnabled).onChange(async (v) => {
					this.plugin.settings.ragEnabled = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("검색 Top K")
			.setDesc("질문당 가져올 관련 청크 개수. 기본 5.")
			.addText((text) =>
				text
					.setPlaceholder("5")
					.setValue(String(this.plugin.settings.ragTopK))
					.onChange(async (value) => {
						const n = parseInt(value, 10);
						this.plugin.settings.ragTopK = Number.isFinite(n) && n > 0 ? n : 5;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("임베딩 모델")
			.setDesc("현재 Gemini text-embedding-004만 지원.")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.embeddingModel)
					.setDisabled(true)
			);

		new Setting(containerEl)
			.setName("볼트 재인덱싱")
			.setDesc("컨텍스트 폴더 전체를 다시 임베딩합니다. 파일 수에 비례한 시간 소요.")
			.addButton((button) =>
				button.setButtonText("재인덱싱").onClick(async () => {
					button.setDisabled(true);
					button.setButtonText("인덱싱 중...");
					try {
						await this.plugin.indexVault((done, total) =>
							button.setButtonText(`${done}/${total}`)
						);
						button.setButtonText("✓ 완료");
					} catch (e: any) {
						button.setButtonText(`❌ ${e.message?.slice(0, 20) ?? "오류"}`);
					}
					setTimeout(() => {
						button.setButtonText("재인덱싱");
						button.setDisabled(false);
					}, 3000);
				})
			);

		// ── 브리핑 설정 ──
		containerEl.createEl("h3", { text: "📋 브리핑" });

		new Setting(containerEl)
			.setName("관심 키워드")
			.setDesc("브리핑 시 검색할 키워드 (쉼표 구분)")
			.addText((text) =>
				text
					.setPlaceholder("교육, ICT, ODA")
					.setValue(this.plugin.settings.briefingKeywords)
					.onChange(async (value) => {
						this.plugin.settings.briefingKeywords = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("관심 발주처")
			.setDesc("모니터링할 발주처 (쉼표 구분)")
			.addText((text) =>
				text
					.setPlaceholder("KOICA, 나라장터, NIPA")
					.setValue(this.plugin.settings.briefingAgencies)
					.onChange(async (value) => {
						this.plugin.settings.briefingAgencies = value;
						await this.plugin.saveSettings();
					})
			);

		// ── API 테스트 ──
		containerEl.createEl("h3", { text: "🔧 진단" });

		new Setting(containerEl)
			.setName("API 연결 테스트")
			.setDesc("Gemini API가 정상 작동하는지 확인합니다.")
			.addButton((button) =>
				button.setButtonText("테스트").onClick(async () => {
					button.setButtonText("테스트 중...");
					button.setDisabled(true);
					try {
						const { GeminiClient } = await import("./utils/gemini");
						const client = new GeminiClient(
							this.plugin.settings.geminiApiKey,
							this.plugin.settings.geminiModel
						);
						const result = await client.testConnection();
						if (result.ok) {
							button.setButtonText("✅ 연결 성공!");
						} else {
							button.setButtonText(`❌ ${result.error}`);
						}
					} catch (e) {
						button.setButtonText("❌ 연결 실패");
					}
					setTimeout(() => {
						button.setButtonText("테스트");
						button.setDisabled(false);
					}, 3000);
				})
			);
	}
}
