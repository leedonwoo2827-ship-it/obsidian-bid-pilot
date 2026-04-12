import { TFile, Vault, MetadataCache } from "obsidian";

/**
 * 파일의 기존 frontmatter를 읽어옴
 */
export function getFrontmatter(
	file: TFile,
	metadataCache: MetadataCache
): Record<string, any> {
	const cache = metadataCache.getFileCache(file);
	return cache?.frontmatter ? { ...cache.frontmatter } : {};
}

/**
 * frontmatter를 업데이트 (기존 값 유지, 새 값 머지)
 */
export async function updateFrontmatter(
	file: TFile,
	vault: Vault,
	newProps: Record<string, any>
): Promise<void> {
	const content = await vault.read(file);
	const { body, existing } = parseFrontmatter(content);

	// Merge: keep existing, add new
	const merged = { ...existing, ...newProps };

	// Remove internal obsidian properties
	delete merged["position"];

	const yamlStr = objectToYaml(merged);
	const newContent = `---\n${yamlStr}---\n${body}`;

	await vault.modify(file, newContent);
}

/**
 * frontmatter가 없는 파일에 새로 추가
 */
export async function addFrontmatter(
	file: TFile,
	vault: Vault,
	props: Record<string, any>
): Promise<void> {
	const content = await vault.read(file);
	const { body, existing } = parseFrontmatter(content);

	if (Object.keys(existing).length > 0) {
		// Already has frontmatter — use update instead
		await updateFrontmatter(file, vault, props);
		return;
	}

	const yamlStr = objectToYaml(props);
	const newContent = `---\n${yamlStr}---\n${content}`;

	await vault.modify(file, newContent);
}

/**
 * 마크다운 내용에서 frontmatter와 body를 분리
 */
function parseFrontmatter(content: string): {
	body: string;
	existing: Record<string, any>;
} {
	const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) {
		return { body: content, existing: {} };
	}

	const yamlStr = match[1];
	const body = match[2];
	const existing = yamlToObject(yamlStr);

	return { body, existing };
}

/**
 * 간단한 YAML → Object 파싱 (1-depth)
 */
function yamlToObject(yaml: string): Record<string, any> {
	const result: Record<string, any> = {};
	const lines = yaml.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const match = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
		if (!match) continue;

		const key = match[1];
		let value: any = match[2].trim();

		// Array value: [item1, item2]
		if (value.startsWith("[") && value.endsWith("]")) {
			value = value
				.slice(1, -1)
				.split(",")
				.map((v: string) => v.trim().replace(/^["']|["']$/g, ""))
				.filter((v: string) => v);
		}
		// Multi-line array
		else if (value === "" && i + 1 < lines.length && lines[i + 1].match(/^\s+-\s/)) {
			value = [];
			while (i + 1 < lines.length && lines[i + 1].match(/^\s+-\s/)) {
				i++;
				value.push(lines[i].replace(/^\s+-\s*/, "").replace(/^["']|["']$/g, ""));
			}
		}
		// Boolean
		else if (value === "true") value = true;
		else if (value === "false") value = false;
		// Null
		else if (value === "null" || value === "") value = null;
		// Number
		else if (/^\d+$/.test(value)) value = parseInt(value);
		// Quoted string
		else if ((value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}

		result[key] = value;
	}

	return result;
}

/**
 * Object → YAML 문자열 (1-depth)
 */
function objectToYaml(obj: Record<string, any>): string {
	const lines: string[] = [];

	for (const [key, value] of Object.entries(obj)) {
		if (value === undefined) continue;

		if (Array.isArray(value)) {
			if (value.length === 0) {
				lines.push(`${key}: []`);
			} else {
				const items = value.map((v) => quoteIfNeeded(String(v))).join(", ");
				lines.push(`${key}: [${items}]`);
			}
		} else if (value === null) {
			lines.push(`${key}: null`);
		} else if (typeof value === "boolean") {
			lines.push(`${key}: ${value}`);
		} else if (typeof value === "number") {
			lines.push(`${key}: ${value}`);
		} else {
			lines.push(`${key}: ${quoteIfNeeded(String(value))}`);
		}
	}

	return lines.join("\n") + "\n";
}

function quoteIfNeeded(s: string): string {
	if (/[:#\[\]{}&*!|>'"`,@]/.test(s) || s.includes("\n")) {
		return `"${s.replace(/"/g, '\\"')}"`;
	}
	return s;
}
