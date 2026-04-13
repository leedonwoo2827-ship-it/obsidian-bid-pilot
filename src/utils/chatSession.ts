import type { ChatMessage } from "./gemini";

/**
 * 단일 채팅 세션의 메시지 히스토리와 pin된 컨텍스트 참조를 보관.
 * UI에서는 messages를 렌더링하고, Gemini 호출 전에 toApiMessages()로 변환한다.
 */
export interface ContextRef {
	/** vault 기준 상대 경로 ("foo/bar.md") 또는 식별자 ("graph:ts", "yt:videoId") */
	id: string;
	/** 사용자에게 보일 라벨 */
	label: string;
	/** 컨텍스트 종류 */
	kind: "note" | "folder" | "selection" | "youtube" | "graph";
}

export interface UiMessage {
	role: "user" | "assistant";
	text: string;
	/** 스트리밍 중이면 true, 완료되면 false */
	pending?: boolean;
	/** 이 메시지에 포함된 컨텍스트 라벨들 (표시용) */
	contextLabels?: string[];
	/** 멀티모달: 첨부된 이미지 base64 (그래프 캡처 등) */
	attachments?: { mimeType: string; base64: string; label: string }[];
	/** 멀티모달: 프리페치된 텍스트(유튜브 자막) */
	prefetchedText?: { label: string; text: string }[];
}

export class ChatSession {
	messages: UiMessage[] = [];
	pinnedContext: ContextRef[] = [];

	addUser(text: string, contextLabels: string[] = []): UiMessage {
		const msg: UiMessage = { role: "user", text, contextLabels };
		this.messages.push(msg);
		return msg;
	}

	startAssistant(): UiMessage {
		const msg: UiMessage = { role: "assistant", text: "", pending: true };
		this.messages.push(msg);
		return msg;
	}

	clear(): void {
		this.messages = [];
	}

	togglePin(ref: ContextRef): void {
		const idx = this.pinnedContext.findIndex((p) => p.id === ref.id);
		if (idx >= 0) this.pinnedContext.splice(idx, 1);
		else this.pinnedContext.push(ref);
	}

	/**
	 * Gemini API 포맷으로 변환. 최근 historyLimit개 쌍(user+model)만 유지.
	 * 진행 중인 assistant 메시지(pending=true)는 제외.
	 */
	toApiMessages(historyLimit: number): ChatMessage[] {
		const completed = this.messages.filter((m) => !m.pending);
		const sliced = completed.slice(-historyLimit * 2);
		return sliced.map((m) => ({
			role: m.role === "user" ? "user" : "model",
			text: m.text,
		}));
	}
}
