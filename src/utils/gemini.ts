import { requestUrl } from "obsidian";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiClient {
	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model: string) {
		this.apiKey = apiKey;
		this.model = model;
	}

	/**
	 * API 연결 테스트
	 */
	async testConnection(): Promise<{ ok: boolean; error?: string }> {
		try {
			const res = await this.generate("안녕하세요. 한 문장으로 응답해주세요.");
			return res ? { ok: true } : { ok: false, error: "빈 응답" };
		} catch (e: any) {
			return { ok: false, error: e.message || "알 수 없는 오류" };
		}
	}

	/**
	 * 텍스트 생성
	 */
	async generate(prompt: string, systemInstruction?: string): Promise<string> {
		const url = `${BASE_URL}/${this.model}:generateContent?key=${this.apiKey}`;

		const body: any = {
			contents: [
				{
					parts: [{ text: prompt }],
				},
			],
			generationConfig: {
				temperature: 0.3,
				maxOutputTokens: 4096,
			},
		};

		if (systemInstruction) {
			body.systemInstruction = {
				parts: [{ text: systemInstruction }],
			};
		}

		const response = await requestUrl({
			url,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (response.status !== 200) {
			throw new Error(`Gemini API 오류: ${response.status}`);
		}

		const data = response.json;
		const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
		if (!text) throw new Error("Gemini 응답이 비어 있습니다.");
		return text;
	}

	/**
	 * 컨텍스트 파일 요약
	 */
	async summarizeFile(fileName: string, content: string): Promise<FileSummary> {
		const prompt = `다음 파일을 분석하고 JSON으로 응답하세요.

파일명: ${fileName}
내용:
${content.slice(0, 8000)}

다음 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON만):
{
  "summary": "2-3문장 요약",
  "category": "company|proposal|credential|personnel|sector|financial|other 중 하나",
  "tags": ["관련 태그 3-5개"],
  "keyEntities": ["핵심 엔티티(회사명, 기관명, 기술명 등)"],
  "relevance": "회사 수주 활동에 어떻게 활용될 수 있는지 1문장"
}`;

		const result = await this.generate(prompt, SYSTEM_INSTRUCTION);
		return this.parseJson<FileSummary>(result);
	}

	/**
	 * 공고/RFP 적합도 분석
	 */
	async analyzeFitness(
		bidContent: string,
		companyContext: string
	): Promise<FitnessAnalysis> {
		const prompt = `회사 정보와 공고/RFP를 비교 분석하세요.

## 회사 정보
${companyContext.slice(0, 4000)}

## 공고/RFP 내용
${bidContent.slice(0, 6000)}

다음 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON만):
{
  "fitness": "high|medium|low",
  "score": 0-100,
  "strengths": ["강점 항목들"],
  "weaknesses": ["약점 항목들"],
  "requirements": [
    {"item": "요구사항", "met": true/false, "note": "비고"}
  ],
  "recommendation": "Go/No-Go 판단과 근거 1-2문장",
  "tags": ["분야 태그들"]
}`;

		const result = await this.generate(prompt, SYSTEM_INSTRUCTION);
		return this.parseJson<FitnessAnalysis>(result);
	}

	/**
	 * 노트에 추가할 frontmatter 프로퍼티 생성
	 */
	async generateProperties(
		fileName: string,
		content: string,
		existingProps: Record<string, any>
	): Promise<Record<string, any>> {
		const prompt = `파일 내용을 분석하여 Obsidian frontmatter 프로퍼티를 생성하세요.

파일명: ${fileName}
기존 프로퍼티: ${JSON.stringify(existingProps)}
내용:
${content.slice(0, 6000)}

다음 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON만).
파일 유형에 맞는 프로퍼티만 포함하세요:

분석 보고서인 경우:
{
  "type": "bid-analysis|brief|scan|compete|pipeline",
  "project": "사업명",
  "agency": "발주처",
  "deadline": "YYYY-MM-DD 또는 null",
  "fitness": "high|medium|low|null",
  "status": "analyzing|go|nogo|proposal|submitted",
  "budget": "예산 문자열 또는 null",
  "tags": ["태그들"]
}

회사 컨텍스트 파일인 경우:
{
  "type": "context",
  "category": "company|proposal|credential|personnel|sector|financial",
  "summary": "1문장 요약",
  "tags": ["태그들"]
}

기존 프로퍼티가 있으면 유지하고, 빠진 것만 추가하세요.`;

		const result = await this.generate(prompt, SYSTEM_INSTRUCTION);
		return this.parseJson<Record<string, any>>(result);
	}

	private parseJson<T>(text: string): T {
		// Strip markdown code fences if present
		let cleaned = text.trim();
		if (cleaned.startsWith("```")) {
			cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
		}
		return JSON.parse(cleaned) as T;
	}
}

const SYSTEM_INSTRUCTION = `당신은 한국의 공공조달/ODA 수주 분석 전문가입니다.
항상 한국어로 응답하세요.
요청된 JSON 형식으로만 응답하세요. 추가 설명 없이 순수 JSON만 출력하세요.
마크다운 코드블록(\`\`\`)을 사용하지 마세요.`;

export interface FileSummary {
	summary: string;
	category: string;
	tags: string[];
	keyEntities: string[];
	relevance: string;
}

export interface FitnessAnalysis {
	fitness: "high" | "medium" | "low";
	score: number;
	strengths: string[];
	weaknesses: string[];
	requirements: Array<{ item: string; met: boolean; note: string }>;
	recommendation: string;
	tags: string[];
}
