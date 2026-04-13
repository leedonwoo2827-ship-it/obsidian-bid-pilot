/**
 * 마크다운 청크 분할기.
 * 헤딩을 주 경계로 사용하고, 헤딩 섹션이 너무 길면 문단 단위로 추가 분할.
 * 대략적인 문자 기준(한국어 ~1.5자/token 가정)으로 목표 크기 유지.
 */

export interface Chunk {
	/** 청크 내용 (헤딩 경로 포함 서두) */
	text: string;
	/** 헤딩 경로 (예: "회사소개 > 연혁") */
	headingPath: string;
	/** 청크 시작 라인 번호 (0-base) */
	startLine: number;
}

export function chunkMarkdown(
	content: string,
	targetChars: number = 1500
): Chunk[] {
	const lines = content.split(/\r?\n/);
	const sections = splitByHeading(lines);
	const chunks: Chunk[] = [];

	for (const sec of sections) {
		if (sec.text.length <= targetChars) {
			chunks.push(sec);
			continue;
		}
		// 문단 단위 재분할 (빈 줄 기준)
		const paragraphs = sec.text.split(/\n{2,}/);
		let buffer = "";
		let bufferStart = sec.startLine;

		for (const p of paragraphs) {
			if ((buffer + "\n\n" + p).length > targetChars && buffer.length > 0) {
				chunks.push({
					text: prefixHeading(sec.headingPath, buffer),
					headingPath: sec.headingPath,
					startLine: bufferStart,
				});
				buffer = p;
				bufferStart = sec.startLine; // 근사치 — 정확한 라인 트래킹은 과한 복잡성
			} else {
				buffer = buffer ? buffer + "\n\n" + p : p;
			}
		}
		if (buffer) {
			chunks.push({
				text: prefixHeading(sec.headingPath, buffer),
				headingPath: sec.headingPath,
				startLine: bufferStart,
			});
		}
	}

	return chunks.filter((c) => c.text.trim().length >= 50);
}

function splitByHeading(lines: string[]): Chunk[] {
	const result: Chunk[] = [];
	const stack: { level: number; title: string }[] = [];
	let curStart = 0;
	let curHeadingPath = "";
	let curLines: string[] = [];

	const flush = () => {
		const text = curLines.join("\n").trim();
		if (text) {
			result.push({
				text: prefixHeading(curHeadingPath, text),
				headingPath: curHeadingPath,
				startLine: curStart,
			});
		}
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
		if (m) {
			flush();
			const level = m[1].length;
			const title = m[2];
			while (stack.length > 0 && stack[stack.length - 1].level >= level) {
				stack.pop();
			}
			stack.push({ level, title });
			curHeadingPath = stack.map((s) => s.title).join(" > ");
			curLines = [];
			curStart = i + 1;
		} else {
			curLines.push(line);
		}
	}
	flush();
	return result;
}

function prefixHeading(path: string, body: string): string {
	return path ? `[${path}]\n${body}` : body;
}
