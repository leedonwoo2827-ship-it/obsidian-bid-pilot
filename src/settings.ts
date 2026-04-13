import { App, PluginSettingTab, Setting } from "obsidian";
import type BidIntelligencePlugin from "./main";

export interface BidIntelligenceSettings {
	geminiApiKey: string;
	geminiModel: string;
	autoAnalyzeContext: boolean;
	autoFrontmatter: boolean;
	briefingKeywords: string;
	briefingAgencies: string;
	language: string;
}

export const DEFAULT_SETTINGS: BidIntelligenceSettings = {
	geminiApiKey: "",
	geminiModel: "gemini-2.5-flash",
	autoAnalyzeContext: true,
	autoFrontmatter: true,
	briefingKeywords: "교육, ICT, ODA, 디지털, 컨설팅",
	briefingAgencies: "KOICA, 나라장터, NIPA, NIA",
	language: "ko",
};

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
