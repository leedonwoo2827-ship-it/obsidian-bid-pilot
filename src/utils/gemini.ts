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

	/**
	 * 멀티턴 스트리밍 생성.
	 * Obsidian requestUrl은 스트리밍 미지원이므로 전역 fetch + SSE 파싱 사용.
	 * onChunk 콜백으로 토큰이 도착하는 즉시 호출되며, 최종 전체 텍스트를 반환.
	 */
	async generateStream(
		messages: ChatMessage[],
		opts: {
			systemInstruction?: string;
			onChunk: (delta: string) => void;
			signal?: AbortSignal;
			temperature?: number;
			maxOutputTokens?: number;
		}
	): Promise<string> {
		const url = `${BASE_URL}/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

		const body: any = {
			contents: messages.map((m) => ({
				role: m.role,
				parts: serializeMessageParts(m),
			})),
			generationConfig: {
				temperature: opts.temperature ?? 0.5,
				maxOutputTokens: opts.maxOutputTokens ?? 4096,
			},
		};

		if (opts.systemInstruction) {
			body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
		}

		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: opts.signal,
		});

		if (!response.ok || !response.body) {
			const errText = await response.text().catch(() => "");
			throw new Error(`Gemini 스트림 오류: ${response.status} ${errText.slice(0, 200)}`);
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder("utf-8");
		let buffer = "";
		let full = "";

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			// SSE: 각 이벤트는 빈 줄(\n\n)로 구분, 데이터 줄은 "data: {json}" 형식
			const events = buffer.split("\n\n");
			buffer = events.pop() ?? "";

			for (const evt of events) {
				const dataLine = evt.split("\n").find((l) => l.startsWith("data:"));
				if (!dataLine) continue;
				const payload = dataLine.slice(5).trim();
				if (!payload || payload === "[DONE]") continue;

				try {
					const json = JSON.parse(payload);
					const delta =
						json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
					if (delta) {
						full += delta;
						opts.onChunk(delta);
					}
				} catch {
					// 부분 JSON이면 버퍼에 누적을 기대하지 말고 스킵
				}
			}
		}

		return full;
	}

	/**
	 * function calling 루프 (비스트리밍).
	 * tools가 있으면 모델 응답에 functionCall이 포함될 수 있고,
	 * toolHandler로 실행 결과를 받아 다음 턴에 functionResponse로 전달.
	 * functionCall 없는 응답이 올 때까지 최대 maxRounds 회 반복.
	 */
	async generateWithTools(
		messages: ChatMessage[],
		opts: {
			systemInstruction?: string;
			tools: GeminiToolDeclaration[];
			toolHandler: (call: GeminiFunctionCall) => Promise<any>;
			onAssistantText?: (text: string) => void;
			onToolCall?: (name: string, args: any) => void;
			maxRounds?: number;
			temperature?: number;
		}
	): Promise<string> {
		const url = `${BASE_URL}/${this.model}:generateContent?key=${this.apiKey}`;
		const maxRounds = opts.maxRounds ?? 5;
		const convo: ChatMessage[] = [...messages];
		let finalText = "";

		for (let round = 0; round < maxRounds; round++) {
			const body: any = {
				contents: convo.map((m) => ({
					role: m.role,
					parts: serializeMessageParts(m),
				})),
				generationConfig: {
					temperature: opts.temperature ?? 0.4,
					maxOutputTokens: 4096,
				},
				tools: [
					{
						functionDeclarations: opts.tools.map((t) => ({
							name: t.name,
							description: t.description,
							parameters: t.parameters,
						})),
					},
				],
			};
			if (opts.systemInstruction) {
				body.systemInstruction = {
					parts: [{ text: opts.systemInstruction }],
				};
			}

			const res = await requestUrl({
				url,
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			if (res.status !== 200) {
				throw new Error(`Gemini tool call 오류: ${res.status}`);
			}

			const parts: any[] = res.json?.candidates?.[0]?.content?.parts ?? [];
			const calls: GeminiFunctionCall[] = [];
			let textChunk = "";
			for (const p of parts) {
				if (p.text) textChunk += p.text;
				if (p.functionCall) {
					calls.push({
						name: p.functionCall.name,
						args: p.functionCall.args ?? {},
					});
				}
			}

			if (textChunk) {
				finalText += textChunk;
				opts.onAssistantText?.(textChunk);
			}

			if (calls.length === 0) {
				return finalText || textChunk;
			}

			// 모델의 functionCall 응답을 대화에 추가
			convo.push({
				role: "model",
				text: textChunk,
				parts: calls.map((c) => ({ functionCall: c })),
			});

			// tool 실행 → functionResponse를 user 역할로 추가
			const responseParts: ChatMessagePart[] = [];
			for (const c of calls) {
				opts.onToolCall?.(c.name, c.args);
				try {
					const result = await opts.toolHandler(c);
					responseParts.push({
						functionResponse: { name: c.name, response: result },
					});
				} catch (e: any) {
					responseParts.push({
						functionResponse: {
							name: c.name,
							response: { error: e.message || String(e) },
						},
					});
				}
			}
			convo.push({ role: "user", text: "", parts: responseParts });
		}

		return finalText;
	}
}

function serializeMessageParts(m: ChatMessage): any[] {
	const parts: any[] = [];
	if (m.text) parts.push({ text: m.text });
	if (m.parts) {
		for (const p of m.parts) {
			if (p.text) {
				parts.push({ text: p.text });
			} else if (p.imageBase64) {
				parts.push({
					inlineData: {
						mimeType: p.imageMimeType ?? "image/png",
						data: p.imageBase64,
					},
				});
			} else if (p.functionCall) {
				parts.push({
					functionCall: {
						name: p.functionCall.name,
						args: p.functionCall.args,
					},
				});
			} else if (p.functionResponse) {
				parts.push({
					functionResponse: {
						name: p.functionResponse.name,
						response: p.functionResponse.response,
					},
				});
			}
		}
	}
	// text가 비었고 parts도 없으면 빈 text part를 하나 넣어야 Gemini가 거부하지 않음
	if (parts.length === 0) parts.push({ text: "" });
	return parts;
}

export interface ChatMessagePart {
	text?: string;
	/** base64 인코딩된 이미지 데이터 (data: prefix 없이 순수 base64) */
	imageBase64?: string;
	imageMimeType?: string;
	/** Gemini functionCall (모델이 호출을 요청) */
	functionCall?: GeminiFunctionCall;
	/** Gemini functionResponse (클라이언트가 실행 결과를 전달) */
	functionResponse?: { name: string; response: any };
}

export interface ChatMessage {
	role: "user" | "model";
	text: string;
	/** 선택: 이미지 등 추가 파트. 있으면 text와 함께 전송. */
	parts?: ChatMessagePart[];
}

export interface GeminiToolDeclaration {
	name: string;
	description?: string;
	parameters: any; // JSON Schema
}

export interface GeminiFunctionCall {
	name: string;
	args: Record<string, any>;
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
