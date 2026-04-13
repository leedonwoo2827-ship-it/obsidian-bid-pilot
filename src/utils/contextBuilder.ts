import { App, TFile, TFolder } from "obsidian";
import type { ContextRef } from "./chatSession";
import type { VectorStore } from "./vectorStore";
import type { EmbeddingsClient } from "./embeddings";

/**
 * pin된 컨텍스트 참조 배열을 실제 텍스트 블록으로 조립.
 * 각 블록은 "## <label>\n<content>" 포맷으로 이어붙이고, 파일당 최대 charBudget만 포함.
 *
 * 단계 2 범위: note / folder / selection 처리.
 * YouTube·graph는 단계 4에서 확장.
 */
export async function buildContextBlock(
	app: App,
	refs: ContextRef[],
	opts: { perFileCharBudget?: number; totalCharBudget?: number } = {}
): Promise<string> {
	const perFile = opts.perFileCharBudget ?? 4000;
	const total = opts.totalCharBudget ?? 24000;

	const blocks: string[] = [];
	let used = 0;

	for (const ref of refs) {
		if (used >= total) break;

		const block = await resolveRef(app, ref, perFile);
		if (!block) continue;

		const truncated = used + block.length > total
			? block.slice(0, total - used) + "\n…(truncated)"
			: block;

		blocks.push(truncated);
		used += truncated.length;
	}

	return blocks.join("\n\n---\n\n");
}

async function resolveRef(
	app: App,
	ref: ContextRef,
	perFile: number
): Promise<string | null> {
	switch (ref.kind) {
		case "note": {
			const file = app.vault.getAbstractFileByPath(ref.id);
			if (!(file instanceof TFile)) return null;
			const text = await app.vault.cachedRead(file);
			return `## 📄 ${ref.label} (${ref.id})\n${text.slice(0, perFile)}`;
		}
		case "folder": {
			const folder = app.vault.getAbstractFileByPath(ref.id);
			if (!(folder instanceof TFolder)) return null;
			const files = folder.children.filter(
				(c): c is TFile => c instanceof TFile && c.extension === "md"
			);
			if (files.length === 0) return `## 📁 ${ref.label} (비어 있음)`;
			const summaries = await Promise.all(
				files.slice(0, 10).map(async (f) => {
					const t = await app.vault.cachedRead(f);
					return `### ${f.name}\n${t.slice(0, Math.floor(perFile / files.length))}`;
				})
			);
			return `## 📁 ${ref.label}\n${summaries.join("\n\n")}`;
		}
		case "selection": {
			// id에 선택 텍스트 자체가 담겨있다고 가정 (ChatView에서 설정)
			return `## ✂️ 선택 영역 (${ref.label})\n${ref.id.slice(0, perFile)}`;
		}
		case "youtube":
		case "graph":
			// 단계 4에서 구현
			return null;
	}
}

/**
 * 활성 파일을 자동 컨텍스트로 쓰고 싶을 때 사용.
 */
export function activeFileRef(app: App): ContextRef | null {
	const file = app.workspace.getActiveFile();
	if (!file) return null;
	return { id: file.path, label: file.basename, kind: "note" };
}

export interface RagHit {
	path: string;
	headingPath: string;
	text: string;
	score: number;
}

/**
 * 쿼리로 vectorStore에서 top-K 청크 검색 후 프롬프트용 블록으로 조립.
 */
export async function buildRagBlock(
	query: string,
	store: VectorStore,
	client: EmbeddingsClient,
	topK: number
): Promise<{ block: string; hits: RagHit[] }> {
	const results = await store.search(query, client, topK);
	if (results.length === 0) return { block: "", hits: [] };

	const hits: RagHit[] = results.map((r) => ({
		path: r.path,
		headingPath: r.headingPath,
		text: r.text,
		score: r.score,
	}));

	const block = results
		.map(
			(r, i) =>
				`### [${i + 1}] ${r.path}${r.headingPath ? " · " + r.headingPath : ""} (유사도 ${r.score.toFixed(2)})\n${r.text}`
		)
		.join("\n\n");

	return { block: `## 🔍 자동 검색된 근거\n${block}`, hits };
}
