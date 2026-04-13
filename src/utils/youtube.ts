import { requestUrl } from "obsidian";

export interface YoutubeTranscript {
	videoId: string;
	title: string;
	language: string;
	text: string;
}

/**
 * URL에서 videoId 추출. 유튜브의 대부분 URL 형식 지원.
 */
export function extractVideoId(url: string): string | null {
	const patterns = [
		/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
		/[?&]v=([A-Za-z0-9_-]{11})/,
	];
	for (const p of patterns) {
		const m = url.match(p);
		if (m) return m[1];
	}
	return null;
}

/**
 * YouTube 페이지에서 caption track을 찾아 자막 텍스트를 가져온다.
 * 공식 API 키 없이 동작. Obsidian requestUrl로 CORS 우회.
 *
 * langPriority: 선호 언어 코드 순서 (예: ["ko", "en"]).
 */
export async function fetchYoutubeTranscript(
	url: string,
	langPriority: string[] = ["ko", "en"]
): Promise<YoutubeTranscript> {
	const videoId = extractVideoId(url);
	if (!videoId) throw new Error("유효한 YouTube URL이 아닙니다.");

	const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=${langPriority[0] ?? "en"}`;
	const res = await requestUrl({ url: watchUrl, method: "GET" });
	if (res.status !== 200) throw new Error(`YouTube 페이지 요청 실패: ${res.status}`);
	const html = res.text;

	// ytInitialPlayerResponse 추출
	const prMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s);
	if (!prMatch) throw new Error("플레이어 응답을 찾지 못했습니다.");

	let playerResponse: any;
	try {
		playerResponse = JSON.parse(prMatch[1]);
	} catch {
		throw new Error("플레이어 응답 파싱 실패");
	}

	const tracks: any[] =
		playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
	if (tracks.length === 0) {
		throw new Error("이 영상에 자막이 없습니다.");
	}

	// 언어 우선순위대로 선택
	let track = null as any;
	for (const lang of langPriority) {
		track = tracks.find(
			(t) => t.languageCode === lang && !t.kind // 자동 생성(asr) 배제 우선
		);
		if (track) break;
	}
	if (!track) {
		// 자동 생성 허용
		for (const lang of langPriority) {
			track = tracks.find((t) => t.languageCode === lang);
			if (track) break;
		}
	}
	if (!track) track = tracks[0];

	const baseUrl: string = track.baseUrl;
	const language: string = track.languageCode;

	const captionRes = await requestUrl({ url: baseUrl, method: "GET" });
	if (captionRes.status !== 200)
		throw new Error(`자막 요청 실패: ${captionRes.status}`);

	const text = parseCaptionXml(captionRes.text);

	const title =
		playerResponse?.videoDetails?.title ?? `YouTube ${videoId}`;

	return { videoId, title, language, text };
}

/**
 * YouTube의 timedtext XML을 평문으로 변환.
 */
function parseCaptionXml(xml: string): string {
	const lines: string[] = [];
	const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(xml))) {
		const raw = m[1]
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
			.replace(/<[^>]+>/g, "")
			.trim();
		if (raw) lines.push(raw);
	}
	return lines.join("\n");
}
