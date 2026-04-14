/**
 * 이미지 첨부 유틸 — 클립보드/파일 → base64 변환 (필요 시 리사이즈).
 * 무료 티어 토큰 비용을 줄이기 위해 최대 변 길이를 기본 2048px로 제한.
 */

export interface ImageAttachment {
	mimeType: string;
	base64: string;
	label: string;
	/** 리사이즈 후 실제 바이트 수 (UI 표시용) */
	sizeBytes: number;
}

const DEFAULT_MAX_DIMENSION = 2048;
const SUPPORTED_MIME = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];

/**
 * File(또는 Blob)을 리사이즈하여 base64로 변환.
 * - PNG/JPEG/WebP만 브라우저 canvas로 처리. HEIC/HEIF는 원본 그대로 전송(변환 불가).
 */
export async function fileToAttachment(
	file: File,
	opts: { maxDimension?: number; label?: string } = {}
): Promise<ImageAttachment> {
	const maxDim = opts.maxDimension ?? DEFAULT_MAX_DIMENSION;
	const label = opts.label ?? (file.name || `image-${Date.now()}`);

	if (!SUPPORTED_MIME.includes(file.type) && !file.type.startsWith("image/")) {
		throw new Error(`지원하지 않는 이미지 형식: ${file.type || "unknown"}`);
	}

	// HEIC/HEIF는 canvas로 로드 불가 → 원본 그대로
	if (file.type === "image/heic" || file.type === "image/heif") {
		const base64 = await blobToBase64(file);
		return {
			mimeType: file.type,
			base64,
			label,
			sizeBytes: file.size,
		};
	}

	// canvas 리사이즈 경로
	const dataUrl = await blobToDataUrl(file);
	const img = await loadImage(dataUrl);

	const { width, height } = fitInside(img.width, img.height, maxDim);
	if (width === img.width && height === img.height && file.size < 500_000) {
		// 크기 이미 작고 리사이즈 불필요 → 원본 base64 사용
		const base64 = dataUrl.split(",")[1];
		return { mimeType: file.type, base64, label, sizeBytes: file.size };
	}

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("canvas 2D context 생성 실패");
	ctx.drawImage(img, 0, 0, width, height);

	// JPEG로 재인코딩하면 용량 감소가 크지만 차트는 PNG가 가독성 유리.
	// PNG → PNG 재인코딩이 가장 안전. 단 용량은 줄지 않을 수 있음.
	const outMime = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
	const quality = outMime === "image/jpeg" ? 0.85 : undefined;
	const outDataUrl = canvas.toDataURL(outMime, quality);
	const base64 = outDataUrl.split(",")[1];
	const sizeBytes = Math.ceil((base64.length * 3) / 4);

	return { mimeType: outMime, base64, label, sizeBytes };
}

/**
 * ClipboardEvent에서 이미지 파일을 모두 추출.
 */
export function extractImagesFromClipboard(evt: ClipboardEvent): File[] {
	const files: File[] = [];
	const items = evt.clipboardData?.items;
	if (!items) return files;
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (item.kind === "file" && item.type.startsWith("image/")) {
			const f = item.getAsFile();
			if (f) files.push(f);
		}
	}
	return files;
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

function blobToBase64(blob: Blob): Promise<string> {
	return blobToDataUrl(blob).then((d) => d.split(",")[1]);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("이미지 로드 실패"));
		img.src = dataUrl;
	});
}

function fitInside(
	w: number,
	h: number,
	max: number
): { width: number; height: number } {
	if (w <= max && h <= max) return { width: w, height: h };
	const ratio = w > h ? max / w : max / h;
	return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
