import { requestUrl } from "obsidian";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Gemini text-embedding-004 래퍼.
 * 기본 차원: 768. "RETRIEVAL_DOCUMENT" vs "RETRIEVAL_QUERY" taskType을 구분해 인덱싱/검색 품질 개선.
 */
export class EmbeddingsClient {
	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model = "text-embedding-004") {
		this.apiKey = apiKey;
		this.model = model;
	}

	/**
	 * 단일 텍스트 임베딩.
	 */
	async embed(text: string, task: "document" | "query"): Promise<number[]> {
		const url = `${BASE_URL}/${this.model}:embedContent?key=${this.apiKey}`;
		const body = {
			content: { parts: [{ text }] },
			taskType: task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
		};

		const res = await requestUrl({
			url,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (res.status !== 200) {
			throw new Error(`임베딩 API 오류: ${res.status}`);
		}

		const values = res.json?.embedding?.values;
		if (!Array.isArray(values)) throw new Error("임베딩 응답이 비어 있습니다.");
		return values;
	}

	/**
	 * 배치 임베딩. 요청당 최대 100개 내부적으로 분할.
	 */
	async embedBatch(
		texts: string[],
		task: "document" | "query"
	): Promise<number[][]> {
		const results: number[][] = [];
		const taskType = task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";

		for (let i = 0; i < texts.length; i += 100) {
			const slice = texts.slice(i, i + 100);
			const url = `${BASE_URL}/${this.model}:batchEmbedContents?key=${this.apiKey}`;
			const body = {
				requests: slice.map((t) => ({
					model: `models/${this.model}`,
					content: { parts: [{ text: t }] },
					taskType,
				})),
			};

			const res = await requestUrl({
				url,
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (res.status !== 200) {
				throw new Error(`배치 임베딩 API 오류: ${res.status}`);
			}

			const embeddings = res.json?.embeddings ?? [];
			for (const e of embeddings) {
				results.push(e.values || []);
			}
		}

		return results;
	}
}

export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length || a.length === 0) return 0;
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	if (normA === 0 || normB === 0) return 0;
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
