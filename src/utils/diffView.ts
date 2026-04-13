/**
 * 최소한의 라인 기반 diff 유틸.
 * LCS(longest common subsequence)로 공통 라인 매칭 후 +/- 마커 산출.
 * 외부 의존성 없이 ~100줄 내외로 구현.
 */

export type DiffOp =
	| { kind: "eq"; text: string }
	| { kind: "add"; text: string }
	| { kind: "del"; text: string };

export function lineDiff(oldText: string, newText: string): DiffOp[] {
	const a = oldText.split(/\r?\n/);
	const b = newText.split(/\r?\n/);
	const m = a.length;
	const n = b.length;

	// LCS 테이블 (공간 O(m*n) — 일반 노트 크기에서 실용적)
	const dp: number[][] = Array.from({ length: m + 1 }, () =>
		new Array(n + 1).fill(0)
	);
	for (let i = 0; i < m; i++) {
		for (let j = 0; j < n; j++) {
			dp[i + 1][j + 1] =
				a[i] === b[j]
					? dp[i][j] + 1
					: Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}

	// 역추적
	const ops: DiffOp[] = [];
	let i = m;
	let j = n;
	while (i > 0 && j > 0) {
		if (a[i - 1] === b[j - 1]) {
			ops.push({ kind: "eq", text: a[i - 1] });
			i--;
			j--;
		} else if (dp[i - 1][j] >= dp[i][j - 1]) {
			ops.push({ kind: "del", text: a[i - 1] });
			i--;
		} else {
			ops.push({ kind: "add", text: b[j - 1] });
			j--;
		}
	}
	while (i > 0) {
		ops.push({ kind: "del", text: a[--i] });
	}
	while (j > 0) {
		ops.push({ kind: "add", text: b[--j] });
	}
	return ops.reverse();
}

/**
 * diff 결과를 HTMLElement에 렌더.
 * 변경 라인 주변 3줄만 표시(컨텍스트).
 */
export function renderDiff(ops: DiffOp[], container: HTMLElement): void {
	container.empty();
	container.addClass("bi-diff");

	const pre = container.createEl("pre", { cls: "bi-diff-pre" });
	const contextLines = 3;

	// 변경 라인 위치 수집
	const changedIndices = new Set<number>();
	for (let idx = 0; idx < ops.length; idx++) {
		if (ops[idx].kind !== "eq") changedIndices.add(idx);
	}

	// 표시할 라인 집합: 변경 라인 ± contextLines
	const showIdx = new Set<number>();
	for (const idx of changedIndices) {
		for (
			let k = Math.max(0, idx - contextLines);
			k <= Math.min(ops.length - 1, idx + contextLines);
			k++
		) {
			showIdx.add(k);
		}
	}

	const sorted = Array.from(showIdx).sort((a, b) => a - b);
	let prev = -2;
	for (const idx of sorted) {
		if (idx > prev + 1) {
			pre.createEl("div", { text: "…", cls: "bi-diff-sep" });
		}
		const op = ops[idx];
		const line = pre.createEl("div", { cls: `bi-diff-line bi-diff-${op.kind}` });
		const marker = op.kind === "add" ? "+ " : op.kind === "del" ? "- " : "  ";
		line.setText(marker + op.text);
		prev = idx;
	}

	// 변경사항 없음
	if (changedIndices.size === 0) {
		pre.createEl("div", { text: "(변경 사항 없음)", cls: "bi-diff-sep" });
	}
}

export function injectDiffStyle(): void {
	if (document.getElementById("bi-diff-style")) return;
	const style = document.createElement("style");
	style.id = "bi-diff-style";
	style.textContent = `
.bi-diff-pre { font-family: var(--font-monospace); font-size: 12px; max-height: 400px; overflow: auto; padding: 8px; background: var(--background-secondary); margin: 0; }
.bi-diff-line { white-space: pre-wrap; }
.bi-diff-add { background: rgba(80, 200, 120, 0.15); color: var(--text-success, #2f7); }
.bi-diff-del { background: rgba(230, 80, 80, 0.15); color: var(--text-error, #e55); text-decoration: line-through; }
.bi-diff-eq { color: var(--text-muted); }
.bi-diff-sep { color: var(--text-muted); padding: 2px 0; text-align: center; }
`;
	document.head.appendChild(style);
}
