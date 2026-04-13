import { requestUrl } from "obsidian";

/**
 * 최소 MCP (Model Context Protocol) 클라이언트.
 * 전송 방식: Streamable HTTP (spec 2024-11-05) — JSON-RPC 2.0 over POST.
 * Obsidian requestUrl로 CORS 우회. stdio 전송은 미지원.
 *
 * 지원 메서드: initialize / tools/list / tools/call
 * SSE 알림·sampling·resources·prompts는 범위 외.
 */

export interface McpServerConfig {
	name: string;
	url: string;
	enabled: boolean;
	/** 선택: 인증 헤더 (Bearer 토큰 등) */
	authHeader?: string;
}

export interface McpTool {
	name: string;
	description?: string;
	inputSchema: any; // JSON Schema
	/** 내부 추적용 — 어느 서버 소속인지 */
	_server: string;
}

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id: number;
	method: string;
	params?: any;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: number;
	result?: any;
	error?: { code: number; message: string; data?: any };
}

export class McpClient {
	private config: McpServerConfig;
	private nextId = 1;
	private initialized = false;

	constructor(config: McpServerConfig) {
		this.config = config;
	}

	get name(): string {
		return this.config.name;
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;
		await this.call("initialize", {
			protocolVersion: "2024-11-05",
			capabilities: {},
			clientInfo: {
				name: "obsidian-bid-intelligence",
				version: "1.1.0",
			},
		});
		this.initialized = true;
	}

	async listTools(): Promise<McpTool[]> {
		await this.initialize();
		const result = await this.call("tools/list", {});
		const tools: any[] = result?.tools ?? [];
		return tools.map((t) => ({
			name: t.name,
			description: t.description,
			inputSchema: t.inputSchema ?? { type: "object" },
			_server: this.config.name,
		}));
	}

	async callTool(
		name: string,
		args: Record<string, any>
	): Promise<{ content: any[]; isError?: boolean }> {
		await this.initialize();
		const result = await this.call("tools/call", {
			name,
			arguments: args,
		});
		return {
			content: result?.content ?? [],
			isError: result?.isError,
		};
	}

	private async call(method: string, params: any): Promise<any> {
		const req: JsonRpcRequest = {
			jsonrpc: "2.0",
			id: this.nextId++,
			method,
			params,
		};

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
		};
		if (this.config.authHeader) {
			headers.Authorization = this.config.authHeader;
		}

		const res = await requestUrl({
			url: this.config.url,
			method: "POST",
			headers,
			body: JSON.stringify(req),
		});

		if (res.status < 200 || res.status >= 300) {
			throw new Error(`MCP ${method} HTTP ${res.status}`);
		}

		// 서버가 SSE로 응답하면 text, 일반 JSON이면 json으로
		let body: JsonRpcResponse;
		if (res.headers?.["content-type"]?.includes("text/event-stream")) {
			body = parseSseJsonRpc(res.text);
		} else {
			body = res.json;
		}

		if (body.error) {
			throw new Error(`MCP ${method}: ${body.error.message}`);
		}
		return body.result;
	}
}

function parseSseJsonRpc(sse: string): JsonRpcResponse {
	const events = sse.split("\n\n");
	for (const evt of events) {
		const dataLine = evt.split("\n").find((l) => l.startsWith("data:"));
		if (!dataLine) continue;
		const payload = dataLine.slice(5).trim();
		if (!payload) continue;
		try {
			const json = JSON.parse(payload);
			if (json.jsonrpc === "2.0" && typeof json.id !== "undefined") {
				return json;
			}
		} catch {
			// skip
		}
	}
	throw new Error("SSE 응답에서 JSON-RPC 결과를 찾지 못했습니다.");
}

/**
 * 여러 MCP 서버 관리자. 설정 변경 시 재초기화.
 */
export class McpRegistry {
	private clients: Map<string, McpClient> = new Map();

	setServers(servers: McpServerConfig[]): void {
		this.clients.clear();
		for (const s of servers) {
			if (s.enabled && s.url) {
				this.clients.set(s.name, new McpClient(s));
			}
		}
	}

	async listAllTools(): Promise<McpTool[]> {
		const all: McpTool[] = [];
		for (const [, client] of this.clients) {
			try {
				const tools = await client.listTools();
				all.push(...tools);
			} catch (e) {
				console.warn(`MCP ${client.name} listTools 실패:`, e);
			}
		}
		return all;
	}

	async callTool(
		serverName: string,
		toolName: string,
		args: Record<string, any>
	): Promise<{ content: any[]; isError?: boolean }> {
		const client = this.clients.get(serverName);
		if (!client) throw new Error(`MCP 서버 "${serverName}" 미등록`);
		return client.callTool(toolName, args);
	}

	size(): number {
		return this.clients.size;
	}
}
