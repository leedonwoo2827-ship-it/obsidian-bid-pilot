import { App, Notice } from "obsidian";

/**
 * 활성 Obsidian 그래프 뷰의 캔버스를 PNG base64로 추출.
 * Obsidian core/localgraph 플러그인이 view 내부에 <canvas>를 그리는 것을 이용.
 * 내부 API에 의존하므로 업데이트 시 깨질 가능성이 있음.
 */
export function captureGraphBase64(app: App): {
	base64: string;
	viewType: string;
} | null {
	const viewTypes = ["graph", "localgraph"];
	for (const type of viewTypes) {
		const leaves = app.workspace.getLeavesOfType(type);
		for (const leaf of leaves) {
			const canvas = (leaf.view as any)?.containerEl?.querySelector(
				"canvas"
			) as HTMLCanvasElement | null;
			if (canvas) {
				try {
					const dataUrl = canvas.toDataURL("image/png");
					const base64 = dataUrl.split(",")[1];
					return { base64, viewType: type };
				} catch (e) {
					console.warn("toDataURL 실패:", e);
				}
			}
		}
	}
	new Notice(
		"활성 그래프 뷰를 찾지 못했습니다. 그래프 패널을 먼저 열어주세요."
	);
	return null;
}
