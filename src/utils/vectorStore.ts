import { App, TFile, Notice } from "obsidian";
import { EmbeddingsClient, cosineSimilarity } from "./embeddings";
import { chunkMarkdown } from "./chunker";

export interface VectorEntry {
	/** vault 상대 경로 */
	path: string;
	/** 파일 내 청크 인덱스 */
	chunkIdx: number;
	/** 청크 텍스트 (검색 결과 표시/프롬프트 삽입용) */
	text: string;
	/** 헤딩 경로 */
	headingPath: string;
	/** 임베딩 벡터 */
	vec: number[];
	/** frontmatter 메타데이터 (필터링용) */
	meta: { category?: string; relevance?: string; tags?: string[] };
	/** 인덱싱 시점의 mtime (증분 인덱싱용) */
	mtime: number;
}

interface StoreFile {
	version: 1;
	model: string;
	entries: VectorEntry[];
}

const STORE_FILENAME = "vectors.json";

export class VectorStore {
	private app: App;
	private pluginId: string;
	private entries: VectorEntry[] = [];
	private model: string;
	private loaded = false;

	constructor(app: App, pluginId: string, model: string) {
		this.app = app;
		this.pluginId = pluginId;
		this.model = model;
	}

	private storePath(): string {
		return `${this.app.vault.configDir}/plugins/${this.pluginId}/${STORE_FILENAME}`;
	}

	async load(): Promise<void> {
		if (this.loaded) return;
		const path = this.storePath();
		try {
			const adapter = this.app.vault.adapter;
			if (await adapter.exists(path)) {
				const raw = await adapter.read(path);
				const parsed: StoreFile = JSON.parse(raw);
				if (parsed.model === this.model) {
					this.entries = parsed.entries;
				}
				// 모델이 바뀌면 무시하고 재인덱싱 필요
			}
		} catch {
			// 손상된 경우 빈 상태로
		}
		this.loaded = true;
	}

	async save(): Promise<void> {
		const path = this.storePath();
		const data: StoreFile = {
			version: 1,
			model: this.model,
			entries: this.entries,
		};
		await this.app.vault.adapter.write(path, JSON.stringify(data));
	}

	/**
	 * 폴더 경로를 대상으로 전체 재인덱싱. 기존 데이터는 제거.
	 */
	async reindex(
		folderPath: string,
		client: EmbeddingsClient,
		onProgress?: (done: number, total: number) => void
	): Promise<{ files: number; chunks: number }> {
		await this.load();

		const files = this.app.vault
			.getFiles()
			.filter(
				(f) =>
					f.path.startsWith(folderPath + "/") && f.extension === "md"
			);

		this.entries = [];
		let totalChunks = 0;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			try {
				const added = await this.indexFile(file, client);
				totalChunks += added;
			} catch (e) {
				console.error("indexFile failed", file.path, e);
			}
			onProgress?.(i + 1, files.length);
		}

		await this.save();
		return { files: files.length, chunks: totalChunks };
	}

	/**
	 * 단일 파일 인덱싱 (증분용). 기존 파일 엔트리는 제거 후 재생성.
	 */
	async indexFile(file: TFile, client: EmbeddingsClient): Promise<number> {
		await this.load();
		this.entries = this.entries.filter((e) => e.path !== file.path);

		const content = await this.app.vault.cachedRead(file);
		if (content.trim().length < 50) return 0;

		const chunks = chunkMarkdown(content);
		if (chunks.length === 0) return 0;

		const meta = this.extractMeta(file);
		const vectors = await client.embedBatch(
			chunks.map((c) => c.text),
			"document"
		);

		for (let i = 0; i < chunks.length; i++) {
			this.entries.push({
				path: file.path,
				chunkIdx: i,
				text: chunks[i].text,
				headingPath: chunks[i].headingPath,
				vec: vectors[i],
				meta,
				mtime: file.stat.mtime,
			});
		}
		return chunks.length;
	}

	removeFile(path: string): void {
		this.entries = this.entries.filter((e) => e.path !== path);
	}

	/**
	 * 쿼리 임베딩과 코사인 유사도 상위 K개 반환.
	 */
	async search(
		query: string,
		client: EmbeddingsClient,
		topK: number
	): Promise<Array<VectorEntry & { score: number }>> {
		await this.load();
		if (this.entries.length === 0) return [];

		const qvec = await client.embed(query, "query");
		const scored = this.entries.map((e) => ({
			...e,
			score: cosineSimilarity(qvec, e.vec),
		}));
		scored.sort((a, b) => b.score - a.score);
		return scored.slice(0, topK);
	}

	size(): number {
		return this.entries.length;
	}

	private extractMeta(file: TFile): VectorEntry["meta"] {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter ?? {};
		return {
			category: fm.category,
			relevance: fm.relevance,
			tags: Array.isArray(fm.tags) ? fm.tags : undefined,
		};
	}
}
