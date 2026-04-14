var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/utils/frontmatter.ts
var frontmatter_exports = {};
__export(frontmatter_exports, {
  addFrontmatter: () => addFrontmatter,
  getFrontmatter: () => getFrontmatter,
  updateFrontmatter: () => updateFrontmatter
});
function getFrontmatter(file, metadataCache) {
  const cache = metadataCache.getFileCache(file);
  return (cache == null ? void 0 : cache.frontmatter) ? { ...cache.frontmatter } : {};
}
async function updateFrontmatter(file, vault, newProps) {
  const content = await vault.read(file);
  const { body, existing } = parseFrontmatter(content);
  const merged = { ...existing, ...newProps };
  delete merged["position"];
  const yamlStr = objectToYaml(merged);
  const newContent = `---
${yamlStr}---
${body}`;
  await vault.modify(file, newContent);
}
async function addFrontmatter(file, vault, props) {
  const content = await vault.read(file);
  const { body, existing } = parseFrontmatter(content);
  if (Object.keys(existing).length > 0) {
    await updateFrontmatter(file, vault, props);
    return;
  }
  const yamlStr = objectToYaml(props);
  const newContent = `---
${yamlStr}---
${content}`;
  await vault.modify(file, newContent);
}
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { body: content, existing: {} };
  }
  const yamlStr = match[1];
  const body = match[2];
  const existing = yamlToObject(yamlStr);
  return { body, existing };
}
function yamlToObject(yaml) {
  const result = {};
  const lines = yaml.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (!match)
      continue;
    const key = match[1];
    let value = match[2].trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1).split(",").map((v) => v.trim().replace(/^["']|["']$/g, "")).filter((v) => v);
    } else if (value === "" && i + 1 < lines.length && lines[i + 1].match(/^\s+-\s/)) {
      value = [];
      while (i + 1 < lines.length && lines[i + 1].match(/^\s+-\s/)) {
        i++;
        value.push(lines[i].replace(/^\s+-\s*/, "").replace(/^["']|["']$/g, ""));
      }
    } else if (value === "true")
      value = true;
    else if (value === "false")
      value = false;
    else if (value === "null" || value === "")
      value = null;
    else if (/^\d+$/.test(value))
      value = parseInt(value);
    else if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}
function objectToYaml(obj) {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === void 0)
      continue;
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
function quoteIfNeeded(s) {
  if (/[:#\[\]{}&*!|>'"`,@]/.test(s) || s.includes("\n")) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}
var init_frontmatter = __esm({
  "src/utils/frontmatter.ts"() {
  }
});

// src/utils/gemini.ts
var gemini_exports = {};
__export(gemini_exports, {
  GeminiClient: () => GeminiClient
});
function serializeMessageParts(m) {
  var _a;
  const parts = [];
  if (m.text)
    parts.push({ text: m.text });
  if (m.parts) {
    for (const p of m.parts) {
      if (p.text) {
        parts.push({ text: p.text });
      } else if (p.imageBase64) {
        parts.push({
          inlineData: {
            mimeType: (_a = p.imageMimeType) != null ? _a : "image/png",
            data: p.imageBase64
          }
        });
      } else if (p.functionCall) {
        parts.push({
          functionCall: {
            name: p.functionCall.name,
            args: p.functionCall.args
          }
        });
      } else if (p.functionResponse) {
        parts.push({
          functionResponse: {
            name: p.functionResponse.name,
            response: p.functionResponse.response
          }
        });
      }
    }
  }
  if (parts.length === 0)
    parts.push({ text: "" });
  return parts;
}
var import_obsidian9, BASE_URL, GeminiClient, SYSTEM_INSTRUCTION;
var init_gemini = __esm({
  "src/utils/gemini.ts"() {
    import_obsidian9 = require("obsidian");
    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
    GeminiClient = class {
      constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model;
      }
      /**
       * API 연결 테스트
       */
      async testConnection() {
        try {
          const res = await this.generate("\uC548\uB155\uD558\uC138\uC694. \uD55C \uBB38\uC7A5\uC73C\uB85C \uC751\uB2F5\uD574\uC8FC\uC138\uC694.");
          return res ? { ok: true } : { ok: false, error: "\uBE48 \uC751\uB2F5" };
        } catch (e) {
          return { ok: false, error: e.message || "\uC54C \uC218 \uC5C6\uB294 \uC624\uB958" };
        }
      }
      /**
       * 텍스트 생성
       */
      async generate(prompt, systemInstruction) {
        var _a, _b, _c, _d, _e;
        const url = `${BASE_URL}/${this.model}:generateContent?key=${this.apiKey}`;
        const body = {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096
          }
        };
        if (systemInstruction) {
          body.systemInstruction = {
            parts: [{ text: systemInstruction }]
          };
        }
        const response = await (0, import_obsidian9.requestUrl)({
          url,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (response.status !== 200) {
          throw new Error(`Gemini API \uC624\uB958: ${response.status}`);
        }
        const data = response.json;
        const text = (_e = (_d = (_c = (_b = (_a = data == null ? void 0 : data.candidates) == null ? void 0 : _a[0]) == null ? void 0 : _b.content) == null ? void 0 : _c.parts) == null ? void 0 : _d[0]) == null ? void 0 : _e.text;
        if (!text)
          throw new Error("Gemini \uC751\uB2F5\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.");
        return text;
      }
      /**
       * 컨텍스트 파일 요약
       */
      async summarizeFile(fileName, content) {
        const prompt = `\uB2E4\uC74C \uD30C\uC77C\uC744 \uBD84\uC11D\uD558\uACE0 JSON\uC73C\uB85C \uC751\uB2F5\uD558\uC138\uC694.

\uD30C\uC77C\uBA85: ${fileName}
\uB0B4\uC6A9:
${content.slice(0, 8e3)}

\uB2E4\uC74C JSON \uD615\uC2DD\uC73C\uB85C\uB9CC \uC751\uB2F5\uD558\uC138\uC694 (\uB9C8\uD06C\uB2E4\uC6B4 \uCF54\uB4DC\uBE14\uB85D \uC5C6\uC774 \uC21C\uC218 JSON\uB9CC):
{
  "summary": "2-3\uBB38\uC7A5 \uC694\uC57D",
  "category": "company|proposal|credential|personnel|sector|financial|other \uC911 \uD558\uB098",
  "tags": ["\uAD00\uB828 \uD0DC\uADF8 3-5\uAC1C"],
  "keyEntities": ["\uD575\uC2EC \uC5D4\uD2F0\uD2F0(\uD68C\uC0AC\uBA85, \uAE30\uAD00\uBA85, \uAE30\uC220\uBA85 \uB4F1)"],
  "relevance": "\uD68C\uC0AC \uC218\uC8FC \uD65C\uB3D9\uC5D0 \uC5B4\uB5BB\uAC8C \uD65C\uC6A9\uB420 \uC218 \uC788\uB294\uC9C0 1\uBB38\uC7A5"
}`;
        const result = await this.generate(prompt, SYSTEM_INSTRUCTION);
        return this.parseJson(result);
      }
      /**
       * 공고/RFP 적합도 분석
       */
      async analyzeFitness(bidContent, companyContext) {
        const prompt = `\uD68C\uC0AC \uC815\uBCF4\uC640 \uACF5\uACE0/RFP\uB97C \uBE44\uAD50 \uBD84\uC11D\uD558\uC138\uC694.

## \uD68C\uC0AC \uC815\uBCF4
${companyContext.slice(0, 4e3)}

## \uACF5\uACE0/RFP \uB0B4\uC6A9
${bidContent.slice(0, 6e3)}

\uB2E4\uC74C JSON \uD615\uC2DD\uC73C\uB85C\uB9CC \uC751\uB2F5\uD558\uC138\uC694 (\uB9C8\uD06C\uB2E4\uC6B4 \uCF54\uB4DC\uBE14\uB85D \uC5C6\uC774 \uC21C\uC218 JSON\uB9CC):
{
  "fitness": "high|medium|low",
  "score": 0-100,
  "strengths": ["\uAC15\uC810 \uD56D\uBAA9\uB4E4"],
  "weaknesses": ["\uC57D\uC810 \uD56D\uBAA9\uB4E4"],
  "requirements": [
    {"item": "\uC694\uAD6C\uC0AC\uD56D", "met": true/false, "note": "\uBE44\uACE0"}
  ],
  "recommendation": "Go/No-Go \uD310\uB2E8\uACFC \uADFC\uAC70 1-2\uBB38\uC7A5",
  "tags": ["\uBD84\uC57C \uD0DC\uADF8\uB4E4"]
}`;
        const result = await this.generate(prompt, SYSTEM_INSTRUCTION);
        return this.parseJson(result);
      }
      /**
       * 노트에 추가할 frontmatter 프로퍼티 생성
       */
      async generateProperties(fileName, content, existingProps) {
        const prompt = `\uD30C\uC77C \uB0B4\uC6A9\uC744 \uBD84\uC11D\uD558\uC5EC Obsidian frontmatter \uD504\uB85C\uD37C\uD2F0\uB97C \uC0DD\uC131\uD558\uC138\uC694.

\uD30C\uC77C\uBA85: ${fileName}
\uAE30\uC874 \uD504\uB85C\uD37C\uD2F0: ${JSON.stringify(existingProps)}
\uB0B4\uC6A9:
${content.slice(0, 6e3)}

\uB2E4\uC74C JSON \uD615\uC2DD\uC73C\uB85C\uB9CC \uC751\uB2F5\uD558\uC138\uC694 (\uB9C8\uD06C\uB2E4\uC6B4 \uCF54\uB4DC\uBE14\uB85D \uC5C6\uC774 \uC21C\uC218 JSON\uB9CC).
\uD30C\uC77C \uC720\uD615\uC5D0 \uB9DE\uB294 \uD504\uB85C\uD37C\uD2F0\uB9CC \uD3EC\uD568\uD558\uC138\uC694:

\uBD84\uC11D \uBCF4\uACE0\uC11C\uC778 \uACBD\uC6B0:
{
  "type": "bid-analysis|brief|scan|compete|pipeline",
  "project": "\uC0AC\uC5C5\uBA85",
  "agency": "\uBC1C\uC8FC\uCC98",
  "deadline": "YYYY-MM-DD \uB610\uB294 null",
  "fitness": "high|medium|low|null",
  "status": "analyzing|go|nogo|proposal|submitted",
  "budget": "\uC608\uC0B0 \uBB38\uC790\uC5F4 \uB610\uB294 null",
  "tags": ["\uD0DC\uADF8\uB4E4"]
}

\uD68C\uC0AC \uCEE8\uD14D\uC2A4\uD2B8 \uD30C\uC77C\uC778 \uACBD\uC6B0:
{
  "type": "context",
  "category": "company|proposal|credential|personnel|sector|financial",
  "summary": "1\uBB38\uC7A5 \uC694\uC57D",
  "tags": ["\uD0DC\uADF8\uB4E4"]
}

\uAE30\uC874 \uD504\uB85C\uD37C\uD2F0\uAC00 \uC788\uC73C\uBA74 \uC720\uC9C0\uD558\uACE0, \uBE60\uC9C4 \uAC83\uB9CC \uCD94\uAC00\uD558\uC138\uC694.`;
        const result = await this.generate(prompt, SYSTEM_INSTRUCTION);
        return this.parseJson(result);
      }
      parseJson(text) {
        let cleaned = text.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }
        return JSON.parse(cleaned);
      }
      /**
       * 멀티턴 스트리밍 생성.
       * Obsidian requestUrl은 스트리밍 미지원이므로 전역 fetch + SSE 파싱 사용.
       * onChunk 콜백으로 토큰이 도착하는 즉시 호출되며, 최종 전체 텍스트를 반환.
       */
      async generateStream(messages, opts) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i;
        const url = `${BASE_URL}/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
        const body = {
          contents: messages.map((m) => ({
            role: m.role,
            parts: serializeMessageParts(m)
          })),
          generationConfig: {
            temperature: (_a = opts.temperature) != null ? _a : 0.5,
            maxOutputTokens: (_b = opts.maxOutputTokens) != null ? _b : 4096
          }
        };
        if (opts.systemInstruction) {
          body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
        }
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: opts.signal
        });
        if (!response.ok || !response.body) {
          const errText = await response.text().catch(() => "");
          throw new Error(`Gemini \uC2A4\uD2B8\uB9BC \uC624\uB958: ${response.status} ${errText.slice(0, 200)}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let full = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done)
            break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = (_c = events.pop()) != null ? _c : "";
          for (const evt of events) {
            const dataLine = evt.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine)
              continue;
            const payload = dataLine.slice(5).trim();
            if (!payload || payload === "[DONE]")
              continue;
            try {
              const json = JSON.parse(payload);
              const delta = (_i = (_h = (_g = (_f = (_e = (_d = json == null ? void 0 : json.candidates) == null ? void 0 : _d[0]) == null ? void 0 : _e.content) == null ? void 0 : _f.parts) == null ? void 0 : _g[0]) == null ? void 0 : _h.text) != null ? _i : "";
              if (delta) {
                full += delta;
                opts.onChunk(delta);
              }
            } catch (e) {
            }
          }
        }
        return full;
      }
      /**
       * function calling 루프 (비스트리밍).
       * tools가 있으면 모델 응답에 functionCall이 포함될 수 있고,
       * toolHandler로 실행 결과를 받아 다음 턴에 functionResponse로 전달.
       * functionCall 없는 응답이 올 때까지 최대 maxRounds 회 반복.
       */
      async generateWithTools(messages, opts) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
        const url = `${BASE_URL}/${this.model}:generateContent?key=${this.apiKey}`;
        const maxRounds = (_a = opts.maxRounds) != null ? _a : 5;
        const convo = [...messages];
        let finalText = "";
        for (let round = 0; round < maxRounds; round++) {
          const body = {
            contents: convo.map((m) => ({
              role: m.role,
              parts: serializeMessageParts(m)
            })),
            generationConfig: {
              temperature: (_b = opts.temperature) != null ? _b : 0.4,
              maxOutputTokens: 4096
            },
            tools: [
              {
                functionDeclarations: opts.tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters
                }))
              }
            ]
          };
          if (opts.systemInstruction) {
            body.systemInstruction = {
              parts: [{ text: opts.systemInstruction }]
            };
          }
          const res = await (0, import_obsidian9.requestUrl)({
            url,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });
          if (res.status !== 200) {
            throw new Error(`Gemini tool call \uC624\uB958: ${res.status}`);
          }
          const parts = (_g = (_f = (_e = (_d = (_c = res.json) == null ? void 0 : _c.candidates) == null ? void 0 : _d[0]) == null ? void 0 : _e.content) == null ? void 0 : _f.parts) != null ? _g : [];
          const calls = [];
          let textChunk = "";
          for (const p of parts) {
            if (p.text)
              textChunk += p.text;
            if (p.functionCall) {
              calls.push({
                name: p.functionCall.name,
                args: (_h = p.functionCall.args) != null ? _h : {}
              });
            }
          }
          if (textChunk) {
            finalText += textChunk;
            (_i = opts.onAssistantText) == null ? void 0 : _i.call(opts, textChunk);
          }
          if (calls.length === 0) {
            return finalText || textChunk;
          }
          convo.push({
            role: "model",
            text: textChunk,
            parts: calls.map((c) => ({ functionCall: c }))
          });
          const responseParts = [];
          for (const c of calls) {
            (_j = opts.onToolCall) == null ? void 0 : _j.call(opts, c.name, c.args);
            try {
              const result = await opts.toolHandler(c);
              responseParts.push({
                functionResponse: { name: c.name, response: result }
              });
            } catch (e) {
              responseParts.push({
                functionResponse: {
                  name: c.name,
                  response: { error: e.message || String(e) }
                }
              });
            }
          }
          convo.push({ role: "user", text: "", parts: responseParts });
        }
        return finalText;
      }
    };
    SYSTEM_INSTRUCTION = `\uB2F9\uC2E0\uC740 \uD55C\uAD6D\uC758 \uACF5\uACF5\uC870\uB2EC/ODA \uC218\uC8FC \uBD84\uC11D \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4.
\uD56D\uC0C1 \uD55C\uAD6D\uC5B4\uB85C \uC751\uB2F5\uD558\uC138\uC694.
\uC694\uCCAD\uB41C JSON \uD615\uC2DD\uC73C\uB85C\uB9CC \uC751\uB2F5\uD558\uC138\uC694. \uCD94\uAC00 \uC124\uBA85 \uC5C6\uC774 \uC21C\uC218 JSON\uB9CC \uCD9C\uB825\uD558\uC138\uC694.
\uB9C8\uD06C\uB2E4\uC6B4 \uCF54\uB4DC\uBE14\uB85D(\`\`\`)\uC744 \uC0AC\uC6A9\uD558\uC9C0 \uB9C8\uC138\uC694.`;
  }
});

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => BidIntelligencePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian13 = require("obsidian");

// src/utils/constants.ts
var VIEW_TYPE_CONTEXT = "bid-context-manager";
var VIEW_TYPE_BRIEFING = "bid-briefing-dashboard";
var VIEW_TYPE_REPORT = "bid-analysis-report";
var VIEW_TYPE_CHAT = "bid-chat";
var DEFAULT_CONTEXT_FOLDER = "_context";
var DEFAULT_ANALYSIS_FOLDER = "_analysis";
var CONTEXT_CATEGORIES = {
  company: "\uD68C\uC0AC \uC18C\uAC1C/IR\uBCF4\uACE0\uC11C",
  proposals: "\uACFC\uAC70 \uC81C\uC548\uC11C",
  credentials: "\uC778\uC99D\uC11C/\uC218\uC0C1\uC774\uB825",
  personnel: "\uD575\uC2EC \uC778\uB825 CV",
  sector: "\uBD80\uC11C\uBCC4 \uC804\uBB38 \uB370\uC774\uD130"
};

// src/views/ContextManagerView.ts
var import_obsidian = require("obsidian");

// src/utils/parser.ts
function getContextStats(vault, contextFolder = DEFAULT_CONTEXT_FOLDER) {
  const stats = {
    totalFiles: 0,
    categories: {},
    lastModified: null
  };
  const prefix = contextFolder + "/";
  const depth = contextFolder.split("/").length;
  const allFiles = vault.getFiles();
  for (const file of allFiles) {
    if (!file.path.startsWith(prefix))
      continue;
    stats.totalFiles++;
    const parts = file.path.split("/");
    if (parts.length >= depth + 2) {
      const cat = parts[depth];
      stats.categories[cat] = (stats.categories[cat] || 0) + 1;
    } else {
      stats.categories["(\uB8E8\uD2B8)"] = (stats.categories["(\uB8E8\uD2B8)"] || 0) + 1;
    }
    const mtime = new Date(file.stat.mtime);
    if (!stats.lastModified || mtime > stats.lastModified) {
      stats.lastModified = mtime;
    }
  }
  return stats;
}
function getAnalysisReports(vault, analysisFolder = DEFAULT_ANALYSIS_FOLDER) {
  const reports = [];
  const prefix = analysisFolder + "/";
  const allFiles = vault.getFiles();
  for (const file of allFiles) {
    if (!file.path.startsWith(prefix))
      continue;
    if (file.extension !== "md")
      continue;
    const name = file.basename;
    let type = "other";
    if (name.startsWith("brief-"))
      type = "brief";
    else if (name.startsWith("bid-analyze-"))
      type = "bid-analyze";
    else if (name.startsWith("scan-"))
      type = "scan";
    else if (name.startsWith("compete-"))
      type = "compete";
    else if (name.startsWith("pipeline-"))
      type = "pipeline";
    reports.push({
      path: file.path,
      title: name,
      date: formatDate(new Date(file.stat.mtime)),
      type
    });
  }
  reports.sort((a, b) => b.date.localeCompare(a.date));
  return reports;
}
function parseBriefTable(content) {
  const entries = [];
  const lines = content.split("\n");
  let inTable = false;
  let headerPassed = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes("\uC21C\uC704") && trimmed.includes("\uC0AC\uC5C5\uBA85") && trimmed.startsWith("|")) {
      inTable = true;
      continue;
    }
    if (inTable && !headerPassed && trimmed.match(/^\|[\s-|]+\|$/)) {
      headerPassed = true;
      continue;
    }
    if (inTable && headerPassed && trimmed.startsWith("|")) {
      const cells = trimmed.split("|").filter((c) => c.trim() !== "");
      if (cells.length >= 6) {
        entries.push({
          rank: parseInt(cells[0].trim()) || entries.length + 1,
          name: cells[1].trim(),
          agency: cells[2].trim(),
          deadline: cells[3].trim(),
          dDay: extractDDay(cells[3].trim()),
          budget: cells[4].trim(),
          fitness: cells[5].trim()
        });
      }
    }
    if (inTable && headerPassed && !trimmed.startsWith("|") && trimmed !== "") {
      inTable = false;
      headerPassed = false;
    }
  }
  return entries;
}
function extractSection(content, heading) {
  const lines = content.split("\n");
  let capturing = false;
  let level = 0;
  const result = [];
  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const currentLevel = headingMatch[1].length;
      const currentTitle = headingMatch[2].trim();
      if (currentTitle.includes(heading)) {
        capturing = true;
        level = currentLevel;
        continue;
      }
      if (capturing && currentLevel <= level) {
        break;
      }
    }
    if (capturing) {
      result.push(line);
    }
  }
  return result.join("\n").trim();
}
function extractDDay(text) {
  const match = text.match(/\(D[+-]?\d+\)/);
  return match ? match[0].replace(/[()]/g, "") : "";
}
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function reportTypeLabel(type) {
  const labels = {
    brief: "\uC77C\uC77C \uBE0C\uB9AC\uD551",
    "bid-analyze": "\uC218\uC8FC \uBD84\uC11D",
    scan: "\uACF5\uACE0 \uC2A4\uCE94",
    compete: "\uACBD\uC7C1 \uBD84\uC11D",
    pipeline: "\uD30C\uC774\uD504\uB77C\uC778",
    other: "\uAE30\uD0C0"
  };
  return labels[type] || "\uAE30\uD0C0";
}

// src/views/ContextManagerView.ts
init_frontmatter();
var ContextManagerView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_CONTEXT;
  }
  getDisplayText() {
    return "\uCEE8\uD14D\uC2A4\uD2B8 \uB9E4\uB2C8\uC800";
  }
  getIcon() {
    return "database";
  }
  async onOpen() {
    this.render();
    this.registerEvent(
      this.app.vault.on("create", () => this.render())
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.render())
    );
    this.registerEvent(
      this.app.vault.on("rename", () => this.render())
    );
  }
  async onClose() {
  }
  render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("bi-context-manager");
    const contextFolder = this.plugin.settings.contextFolder;
    const stats = getContextStats(this.app.vault, contextFolder);
    const header = container.createDiv({ cls: "bi-cm-header" });
    header.createEl("h4", { text: "\u{1F4C2} \uD68C\uC0AC \uCEE8\uD14D\uC2A4\uD2B8" });
    header.createEl("span", {
      cls: "bi-cm-badge",
      text: `${stats.totalFiles}\uAC1C \uD30C\uC77C`
    });
    const status = container.createDiv({ cls: "bi-cm-status" });
    if (stats.totalFiles === 0) {
      status.addClass("bi-cm-status-empty");
      status.createEl("p", {
        text: "\u26A0\uFE0F _context/ \uD3F4\uB354\uAC00 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4."
      });
      status.createEl("p", {
        cls: "bi-cm-hint",
        text: "\uD68C\uC0AC \uB370\uC774\uD130(IR\uBCF4\uACE0\uC11C, \uACFC\uAC70 \uC81C\uC548\uC11C \uB4F1)\uB97C \uB123\uC73C\uBA74 \uBD84\uC11D \uD488\uC9C8\uC774 \uD5A5\uC0C1\uB429\uB2C8\uB2E4."
      });
      const guide = status.createDiv({ cls: "bi-cm-guide" });
      guide.createEl("strong", { text: "\uAD8C\uC7A5 \uD30C\uC77C:" });
      const list = guide.createEl("ul");
      list.createEl("li", { text: "IR\uBCF4\uACE0\uC11C \uB610\uB294 \uD68C\uC0AC\uC18C\uAC1C\uC11C (PDF/MD)" });
      list.createEl("li", { text: "\uACFC\uAC70 \uC81C\uC548\uC11C 1\uAC74 \uC774\uC0C1" });
      list.createEl("li", { text: "\uCD5C\uADFC 3\uAC1C\uB144 \uC7AC\uBB34\uC81C\uD45C" });
      list.createEl("li", { text: "\uD575\uC2EC \uC778\uB825 CV" });
    } else {
      status.addClass("bi-cm-status-ok");
      status.createEl("p", {
        text: `\u2705 ${stats.totalFiles}\uAC1C \uD30C\uC77C \uB85C\uB4DC\uB428`
      });
      if (stats.lastModified) {
        status.createEl("p", {
          cls: "bi-cm-hint",
          text: `\uCD5C\uADFC \uC218\uC815: ${formatDate(stats.lastModified)}`
        });
      }
    }
    if (stats.totalFiles > 0) {
      const aiSection = container.createDiv({ cls: "bi-cm-ai" });
      aiSection.createEl("h5", { text: "\u{1F916} AI \uBD84\uC11D" });
      const aiStatus = this.plugin.gemini ? "Gemini \uC5F0\uACB0\uB428" : "API \uD0A4 \uBBF8\uC124\uC815";
      const aiStatusCls = this.plugin.gemini ? "bi-cm-ai-connected" : "bi-cm-ai-disconnected";
      aiSection.createEl("span", { cls: `bi-cm-ai-status ${aiStatusCls}`, text: aiStatus });
      if (this.plugin.gemini) {
        const mdFiles = this.app.vault.getFiles().filter(
          (f) => f.path.startsWith(contextFolder + "/") && f.extension === "md"
        );
        const analyzed = mdFiles.filter((f) => {
          const fm = getFrontmatter(f, this.app.metadataCache);
          return fm["type"] || fm["summary"] || fm["category"];
        }).length;
        aiSection.createEl("p", {
          cls: "bi-cm-hint",
          text: `${mdFiles.length}\uAC1C MD \uD30C\uC77C \uC911 ${analyzed}\uAC1C \uBD84\uC11D \uC644\uB8CC`
        });
        if (analyzed < mdFiles.length) {
          const analyzeBtn = aiSection.createEl("button", {
            cls: "bi-cm-action-btn bi-cm-analyze-btn",
            text: `\u{1F50D} \uBBF8\uBD84\uC11D ${mdFiles.length - analyzed}\uAC1C \uD30C\uC77C \uBD84\uC11D`
          });
          analyzeBtn.addEventListener("click", async () => {
            analyzeBtn.setText("\uBD84\uC11D \uC911...");
            analyzeBtn.setAttr("disabled", "true");
            await this.runBatchAnalysis(mdFiles.filter((f) => {
              const fm = getFrontmatter(f, this.app.metadataCache);
              return !fm["type"] && !fm["summary"] && !fm["category"];
            }));
            this.render();
          });
        }
      }
    }
    const catSection = container.createDiv({ cls: "bi-cm-categories" });
    catSection.createEl("h5", { text: "\uCE74\uD14C\uACE0\uB9AC\uBCC4 \uD604\uD669" });
    const catGrid = catSection.createDiv({ cls: "bi-cm-cat-grid" });
    for (const [key, label] of Object.entries(CONTEXT_CATEGORIES)) {
      const count = stats.categories[key] || 0;
      const item = catGrid.createDiv({ cls: "bi-cm-cat-item" });
      item.createEl("span", {
        cls: `bi-cm-cat-count ${count > 0 ? "bi-cm-cat-active" : "bi-cm-cat-empty"}`,
        text: String(count)
      });
      item.createEl("span", { cls: "bi-cm-cat-label", text: label });
      if (count > 0) {
        item.addClass("bi-cm-cat-has-files");
        item.addEventListener("click", () => {
          this.openFolder(`${contextFolder}/${key}`);
        });
      }
    }
    for (const [key, count] of Object.entries(stats.categories)) {
      if (key in CONTEXT_CATEGORIES)
        continue;
      const item = catGrid.createDiv({ cls: "bi-cm-cat-item bi-cm-cat-has-files" });
      item.createEl("span", {
        cls: "bi-cm-cat-count bi-cm-cat-active",
        text: String(count)
      });
      item.createEl("span", { cls: "bi-cm-cat-label", text: key });
      item.addEventListener("click", () => {
        if (key === "(\uB8E8\uD2B8)") {
          this.openFolder(contextFolder);
        } else {
          this.openFolder(`${contextFolder}/${key}`);
        }
      });
    }
    if (stats.totalFiles > 0) {
      const fileSection = container.createDiv({ cls: "bi-cm-files" });
      fileSection.createEl("h5", { text: "\uD30C\uC77C \uBAA9\uB85D" });
      const fileList = fileSection.createDiv({ cls: "bi-cm-file-list" });
      const allFiles = this.app.vault.getFiles().filter((f) => f.path.startsWith(contextFolder + "/")).sort((a, b) => b.stat.mtime - a.stat.mtime);
      for (const file of allFiles.slice(0, 30)) {
        const item = fileList.createDiv({ cls: "bi-cm-file-item" });
        const icon = this.getFileIcon(file.extension);
        item.createEl("span", { cls: "bi-cm-file-icon", text: icon });
        const link = item.createEl("a", {
          cls: "bi-cm-file-link",
          text: file.path.replace(contextFolder + "/", "")
        });
        link.addEventListener("click", (e) => {
          e.preventDefault();
          this.app.workspace.openLinkText(file.path, "", false);
        });
        if (file.extension === "md") {
          const fm = getFrontmatter(file, this.app.metadataCache);
          if (fm["summary"] || fm["type"]) {
            item.createEl("span", { cls: "bi-cm-file-analyzed", text: "\u2713" });
          }
        }
        item.createEl("span", {
          cls: "bi-cm-file-date",
          text: formatDate(new Date(file.stat.mtime))
        });
      }
      if (allFiles.length > 30) {
        fileList.createEl("p", {
          cls: "bi-cm-hint",
          text: `...\uC678 ${allFiles.length - 30}\uAC1C \uD30C\uC77C`
        });
      }
    }
    const actions = container.createDiv({ cls: "bi-cm-actions" });
    actions.createEl("h5", { text: "\uBE60\uB978 \uC2E4\uD589" });
    const btnGrid = actions.createDiv({ cls: "bi-cm-btn-grid" });
    this.createActionButton(btnGrid, "\u{1F4CA} \uC218\uC8FC \uBD84\uC11D", "bid-analyze");
    this.createActionButton(btnGrid, "\u{1F4E1} \uACF5\uACE0 \uC2A4\uCE94", "scan");
    this.createActionButton(btnGrid, "\u{1F3E2} \uACBD\uC7C1 \uBD84\uC11D", "compete");
    this.createActionButton(btnGrid, "\u{1F4CB} \uC77C\uC77C \uBE0C\uB9AC\uD551", "brief");
  }
  async runBatchAnalysis(files) {
    if (!this.plugin.gemini)
      return;
    let done = 0;
    for (const file of files) {
      try {
        const content = await this.app.vault.read(file);
        const summary = await this.plugin.gemini.summarizeFile(file.name, content);
        const { updateFrontmatter: updateFrontmatter2 } = await Promise.resolve().then(() => (init_frontmatter(), frontmatter_exports));
        await updateFrontmatter2(file, this.app.vault, {
          type: "context",
          category: summary.category,
          summary: summary.summary,
          tags: summary.tags,
          entities: summary.keyEntities,
          relevance: summary.relevance
        });
        done++;
        new import_obsidian.Notice(`\uBD84\uC11D ${done}/${files.length}: ${file.basename}`);
        await new Promise((r) => setTimeout(r, 1500));
      } catch (e) {
      }
    }
    new import_obsidian.Notice(`\u2705 \uBD84\uC11D \uC644\uB8CC: ${done}/${files.length}`);
  }
  createActionButton(parent, label, command) {
    const btn = parent.createEl("button", {
      cls: "bi-cm-action-btn",
      text: label
    });
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(`/${command}`).then(() => {
        btn.setText(`\u2713 /${command} \uBCF5\uC0AC\uB428`);
        setTimeout(() => btn.setText(label), 2e3);
      });
    });
  }
  openFolder(path) {
    var _a, _b, _c, _d;
    const folder = this.app.vault.getAbstractFileByPath(path);
    if (folder && folder instanceof import_obsidian.TFolder) {
      (_d = (_c = (_b = (_a = this.app.internalPlugins) == null ? void 0 : _a.plugins) == null ? void 0 : _b["file-explorer"]) == null ? void 0 : _c.instance) == null ? void 0 : _d.revealInFolder(folder);
    }
  }
  getFileIcon(ext) {
    const icons = {
      md: "\u{1F4DD}",
      pdf: "\u{1F4C4}",
      docx: "\u{1F4C3}",
      xlsx: "\u{1F4CA}",
      pptx: "\u{1F4D1}",
      hwp: "\u{1F4DC}",
      hwpx: "\u{1F4DC}",
      jpg: "\u{1F5BC}",
      png: "\u{1F5BC}",
      csv: "\u{1F4CB}"
    };
    return icons[ext] || "\u{1F4CE}";
  }
};

// src/views/BriefingDashboardView.ts
var import_obsidian2 = require("obsidian");
var BriefingDashboardView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.currentFile = null;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_BRIEFING;
  }
  getDisplayText() {
    return "\uC218\uC8FC \uBE0C\uB9AC\uD551";
  }
  getIcon() {
    return "bar-chart-3";
  }
  async onOpen() {
    await this.render();
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        const analysisFolder = this.plugin.settings.analysisFolder;
        if (file instanceof import_obsidian2.TFile && file.path.startsWith(analysisFolder + "/brief-")) {
          this.render();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian2.TFile && this.currentFile && file.path === this.currentFile.path) {
          this.render();
        }
      })
    );
  }
  async onClose() {
  }
  async render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("bi-briefing");
    const analysisFolder = this.plugin.settings.analysisFolder;
    const briefs = this.app.vault.getFiles().filter((f) => f.path.startsWith(analysisFolder + "/") && f.basename.startsWith("brief-")).sort((a, b) => b.stat.mtime - a.stat.mtime);
    const header = container.createDiv({ cls: "bi-brief-header" });
    header.createEl("h4", { text: "\u{1F4CA} \uC218\uC8FC \uBE0C\uB9AC\uD551 \uB300\uC2DC\uBCF4\uB4DC" });
    header.createEl("span", {
      cls: "bi-brief-date",
      text: formatDate(/* @__PURE__ */ new Date())
    });
    if (briefs.length === 0) {
      this.renderEmptyState(container);
      return;
    }
    if (briefs.length > 1) {
      const selector = container.createDiv({ cls: "bi-brief-selector" });
      const select = selector.createEl("select", { cls: "bi-brief-select" });
      for (const brief of briefs.slice(0, 20)) {
        const opt = select.createEl("option", {
          text: brief.basename,
          value: brief.path
        });
      }
      select.addEventListener("change", async () => {
        const file = this.app.vault.getAbstractFileByPath(select.value);
        if (file instanceof import_obsidian2.TFile) {
          this.currentFile = file;
          await this.renderBrief(container, file);
        }
      });
    }
    this.currentFile = briefs[0];
    await this.renderBrief(container, briefs[0]);
  }
  async renderBrief(container, file) {
    const existing = container.querySelector(".bi-brief-content");
    if (existing)
      existing.remove();
    const content = await this.app.vault.read(file);
    const briefContent = container.createDiv({ cls: "bi-brief-content" });
    const entries = parseBriefTable(content);
    const summary = briefContent.createDiv({ cls: "bi-brief-summary" });
    const total = entries.length;
    const highFit = entries.filter((e) => e.fitness.includes("\u{1F7E2}")).length;
    const deadlineSoon = entries.filter((e) => {
      const match = e.dDay.match(/D-?(\d+)/);
      return match && parseInt(match[1]) <= 7;
    }).length;
    this.createSummaryCard(summary, "\uC804\uCCB4 \uACF5\uACE0", String(total), "bi-card-total");
    this.createSummaryCard(summary, "\uC801\uD569\uB3C4 \uB192\uC74C", String(highFit), "bi-card-high");
    this.createSummaryCard(summary, "\uB9C8\uAC10 \uC784\uBC15", String(deadlineSoon), "bi-card-urgent");
    if (entries.length > 0) {
      const tableSection = briefContent.createDiv({ cls: "bi-brief-table-section" });
      tableSection.createEl("h5", { text: "\uC2E0\uADDC \uACF5\uACE0" });
      const table = tableSection.createEl("table", { cls: "bi-brief-table" });
      const thead = table.createEl("thead");
      const headerRow = thead.createEl("tr");
      for (const h of ["#", "\uC0AC\uC5C5\uBA85", "\uBC1C\uC8FC\uCC98", "\uB9C8\uAC10\uC77C", "\uC608\uC0B0", "\uC801\uD569\uB3C4"]) {
        headerRow.createEl("th", { text: h });
      }
      const tbody = table.createEl("tbody");
      for (const entry of entries) {
        const row = tbody.createEl("tr");
        row.createEl("td", { text: String(entry.rank) });
        const nameCell = row.createEl("td", { cls: "bi-brief-name" });
        nameCell.createEl("span", { text: entry.name });
        if (entry.dDay) {
          nameCell.createEl("span", {
            cls: `bi-dday ${this.getDDayClass(entry.dDay)}`,
            text: entry.dDay
          });
        }
        row.createEl("td", { text: entry.agency });
        row.createEl("td", { text: entry.deadline.replace(/\s*\(D[+-]?\d+\)/, "") });
        row.createEl("td", { text: entry.budget });
        row.createEl("td", { cls: "bi-fitness", text: entry.fitness });
      }
    }
    const deadlineSection = extractSection(content, "\uB9C8\uAC10 \uC784\uBC15");
    if (deadlineSection) {
      const dlSection = briefContent.createDiv({ cls: "bi-brief-deadline" });
      dlSection.createEl("h5", { text: "\u23F0 \uB9C8\uAC10 \uC784\uBC15 (7\uC77C \uC774\uB0B4)" });
      dlSection.createDiv({ cls: "bi-brief-deadline-content" }).innerHTML = this.simpleMarkdownToHtml(deadlineSection);
    }
    const trendSection = extractSection(content, "\uC2DC\uC7A5 \uB3D9\uD5A5");
    if (trendSection) {
      const trends = briefContent.createDiv({ cls: "bi-brief-trends" });
      trends.createEl("h5", { text: "\u{1F4C8} \uC2DC\uC7A5 \uB3D9\uD5A5" });
      trends.createDiv({ cls: "bi-brief-trends-content" }).innerHTML = this.simpleMarkdownToHtml(trendSection);
    }
    const actionSection = extractSection(content, "\uCD94\uCC9C \uC561\uC158");
    if (actionSection) {
      const actions = briefContent.createDiv({ cls: "bi-brief-actions" });
      actions.createEl("h5", { text: "\u{1F4A1} \uCD94\uCC9C \uC561\uC158" });
      actions.createDiv({ cls: "bi-brief-actions-content" }).innerHTML = this.simpleMarkdownToHtml(actionSection);
    }
    const footer = briefContent.createDiv({ cls: "bi-brief-footer" });
    const link = footer.createEl("a", {
      text: `\u{1F4C4} ${file.basename}.md \uC5F4\uAE30`,
      cls: "bi-brief-source-link"
    });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      this.app.workspace.openLinkText(file.path, "", false);
    });
  }
  renderEmptyState(container) {
    const empty = container.createDiv({ cls: "bi-brief-empty" });
    empty.createEl("div", { cls: "bi-brief-empty-icon", text: "\u{1F4ED}" });
    empty.createEl("p", { text: "\uC544\uC9C1 \uBE0C\uB9AC\uD551\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." });
    empty.createEl("p", {
      cls: "bi-cm-hint",
      text: "Claude Code\uC5D0\uC11C /brief \uBA85\uB839\uC744 \uC2E4\uD589\uD558\uBA74 \uC77C\uC77C \uBE0C\uB9AC\uD551\uC774 \uC0DD\uC131\uB429\uB2C8\uB2E4."
    });
    const cmd = empty.createEl("code", {
      cls: "bi-brief-cmd",
      text: "/brief"
    });
    cmd.addEventListener("click", () => {
      navigator.clipboard.writeText("/brief");
    });
  }
  createSummaryCard(parent, label, value, cls) {
    const card = parent.createDiv({ cls: `bi-summary-card ${cls}` });
    card.createEl("div", { cls: "bi-card-value", text: value });
    card.createEl("div", { cls: "bi-card-label", text: label });
  }
  getDDayClass(dDay) {
    const match = dDay.match(/D-?(\d+)/);
    if (!match)
      return "";
    const days = parseInt(match[1]);
    if (days <= 3)
      return "bi-dday-critical";
    if (days <= 7)
      return "bi-dday-soon";
    return "bi-dday-normal";
  }
  simpleMarkdownToHtml(md) {
    return md.replace(/^- (.+)$/gm, "<li>$1</li>").replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>").replace(/\n{2,}/g, "<br><br>").replace(/\|.*\|/g, (match) => {
      const cells = match.split("|").filter((c) => c.trim());
      if (cells.every((c) => c.trim().match(/^-+$/)))
        return "";
      return "<div class='bi-table-row'>" + cells.map((c) => `<span class='bi-table-cell'>${c.trim()}</span>`).join("") + "</div>";
    });
  }
};

// src/views/AnalysisReportView.ts
var import_obsidian3 = require("obsidian");
var AnalysisReportView = class extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.selectedType = "all";
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_REPORT;
  }
  getDisplayText() {
    return "\uBD84\uC11D \uB9AC\uD3EC\uD2B8";
  }
  getIcon() {
    return "file-text";
  }
  async onOpen() {
    await this.render();
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        const analysisFolder = this.plugin.settings.analysisFolder;
        if (file instanceof import_obsidian3.TFile && file.path.startsWith(analysisFolder + "/")) {
          this.render();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        const analysisFolder = this.plugin.settings.analysisFolder;
        if (file instanceof import_obsidian3.TFile && file.path.startsWith(analysisFolder + "/")) {
          this.render();
        }
      })
    );
  }
  async onClose() {
  }
  async render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("bi-report");
    const reports = getAnalysisReports(this.app.vault, this.plugin.settings.analysisFolder);
    const header = container.createDiv({ cls: "bi-report-header" });
    header.createEl("h4", { text: "\u{1F4D1} \uBD84\uC11D \uB9AC\uD3EC\uD2B8" });
    header.createEl("span", {
      cls: "bi-report-count",
      text: `${reports.length}\uAC1C`
    });
    if (reports.length === 0) {
      this.renderEmptyState(container);
      return;
    }
    const filterBar = container.createDiv({ cls: "bi-report-filter" });
    const types = ["all", "brief", "bid-analyze", "scan", "compete", "pipeline", "other"];
    const typeLabels = {
      all: "\uC804\uCCB4",
      brief: "\uBE0C\uB9AC\uD551",
      "bid-analyze": "\uC218\uC8FC \uBD84\uC11D",
      scan: "\uACF5\uACE0 \uC2A4\uCE94",
      compete: "\uACBD\uC7C1 \uBD84\uC11D",
      pipeline: "\uD30C\uC774\uD504\uB77C\uC778",
      other: "\uAE30\uD0C0"
    };
    for (const t of types) {
      const count = t === "all" ? reports.length : reports.filter((r) => r.type === t).length;
      if (count === 0 && t !== "all")
        continue;
      const btn = filterBar.createEl("button", {
        cls: `bi-filter-btn ${this.selectedType === t ? "bi-filter-active" : ""}`,
        text: `${typeLabels[t]} (${count})`
      });
      btn.addEventListener("click", () => {
        this.selectedType = t;
        this.render();
      });
    }
    const filtered = this.selectedType === "all" ? reports : reports.filter((r) => r.type === this.selectedType);
    const list = container.createDiv({ cls: "bi-report-list" });
    const grouped = this.groupByDate(filtered);
    for (const [date, items] of Object.entries(grouped)) {
      const group = list.createDiv({ cls: "bi-report-group" });
      group.createEl("div", { cls: "bi-report-date-header", text: date });
      for (const report of items) {
        const item = group.createDiv({ cls: "bi-report-item" });
        const badge = item.createEl("span", {
          cls: `bi-report-badge bi-badge-${report.type}`,
          text: reportTypeLabel(report.type)
        });
        const titleEl = item.createEl("a", {
          cls: "bi-report-title",
          text: this.cleanTitle(report.title)
        });
        titleEl.addEventListener("click", (e) => {
          e.preventDefault();
          this.openReport(report);
        });
        const previewBtn = item.createEl("button", {
          cls: "bi-report-preview-btn",
          text: "\uBBF8\uB9AC\uBCF4\uAE30"
        });
        previewBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await this.showPreview(container, report);
        });
      }
    }
  }
  renderEmptyState(container) {
    const empty = container.createDiv({ cls: "bi-report-empty" });
    empty.createEl("div", { cls: "bi-report-empty-icon", text: "\u{1F4CA}" });
    empty.createEl("p", { text: "\uC544\uC9C1 \uBD84\uC11D \uB9AC\uD3EC\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." });
    empty.createEl("p", {
      cls: "bi-cm-hint",
      text: "Claude Code\uC5D0\uC11C /bid-analyze, /scan, /compete \uB4F1\uC744 \uC2E4\uD589\uD558\uBA74 \uB9AC\uD3EC\uD2B8\uAC00 \uC0DD\uC131\uB429\uB2C8\uB2E4."
    });
    const cmds = empty.createDiv({ cls: "bi-report-cmds" });
    for (const cmd of ["/bid-analyze", "/scan", "/compete", "/brief"]) {
      const code = cmds.createEl("code", { cls: "bi-report-cmd", text: cmd });
      code.addEventListener("click", () => {
        navigator.clipboard.writeText(cmd);
      });
    }
  }
  async showPreview(container, report) {
    const existing = container.querySelector(".bi-report-preview");
    if (existing)
      existing.remove();
    const file = this.app.vault.getAbstractFileByPath(report.path);
    if (!(file instanceof import_obsidian3.TFile))
      return;
    const content = await this.app.vault.read(file);
    const preview = container.createDiv({ cls: "bi-report-preview" });
    const previewHeader = preview.createDiv({ cls: "bi-preview-header" });
    previewHeader.createEl("strong", { text: this.cleanTitle(report.title) });
    const closeBtn = previewHeader.createEl("button", {
      cls: "bi-preview-close",
      text: "\u2715"
    });
    closeBtn.addEventListener("click", () => preview.remove());
    const previewBody = preview.createDiv({ cls: "bi-preview-body" });
    await import_obsidian3.MarkdownRenderer.render(
      this.app,
      content.slice(0, 3e3),
      // Limit preview length
      previewBody,
      report.path,
      this
    );
    if (content.length > 3e3) {
      previewBody.createEl("p", {
        cls: "bi-preview-truncated",
        text: "\u2026 (\uC804\uCCB4 \uB0B4\uC6A9\uC740 \uD30C\uC77C\uC744 \uC5F4\uC5B4 \uD655\uC778\uD558\uC138\uC694)"
      });
    }
    const openBtn = preview.createEl("button", {
      cls: "bi-preview-open-btn",
      text: "\u{1F4C4} \uC804\uCCB4 \uBCF4\uAE30"
    });
    openBtn.addEventListener("click", () => {
      this.openReport(report);
      preview.remove();
    });
  }
  openReport(report) {
    this.app.workspace.openLinkText(report.path, "", false);
  }
  cleanTitle(title) {
    return title.replace(/^(brief|bid-analyze|scan|compete|pipeline)-/, "").replace(/-/g, " ").trim() || title;
  }
  groupByDate(reports) {
    const groups = {};
    for (const r of reports) {
      const date = r.date;
      if (!groups[date])
        groups[date] = [];
      groups[date].push(r);
    }
    return groups;
  }
};

// src/views/ChatView.ts
var import_obsidian8 = require("obsidian");

// src/utils/chatSession.ts
var ChatSession = class {
  constructor() {
    this.messages = [];
    this.pinnedContext = [];
  }
  addUser(text, contextLabels = []) {
    const msg = { role: "user", text, contextLabels };
    this.messages.push(msg);
    return msg;
  }
  startAssistant() {
    const msg = { role: "assistant", text: "", pending: true };
    this.messages.push(msg);
    return msg;
  }
  clear() {
    this.messages = [];
  }
  togglePin(ref) {
    const idx = this.pinnedContext.findIndex((p) => p.id === ref.id);
    if (idx >= 0)
      this.pinnedContext.splice(idx, 1);
    else
      this.pinnedContext.push(ref);
  }
  /**
   * Gemini API 포맷으로 변환. 최근 historyLimit개 쌍(user+model)만 유지.
   * 진행 중인 assistant 메시지(pending=true)는 제외.
   */
  toApiMessages(historyLimit) {
    const completed = this.messages.filter((m) => !m.pending);
    const sliced = completed.slice(-historyLimit * 2);
    return sliced.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      text: m.text
    }));
  }
};

// src/utils/contextBuilder.ts
var import_obsidian4 = require("obsidian");
async function buildContextBlock(app, refs, opts = {}) {
  var _a, _b;
  const perFile = (_a = opts.perFileCharBudget) != null ? _a : 4e3;
  const total = (_b = opts.totalCharBudget) != null ? _b : 24e3;
  const blocks = [];
  let used = 0;
  for (const ref of refs) {
    if (used >= total)
      break;
    const block = await resolveRef(app, ref, perFile);
    if (!block)
      continue;
    const truncated = used + block.length > total ? block.slice(0, total - used) + "\n\u2026(truncated)" : block;
    blocks.push(truncated);
    used += truncated.length;
  }
  return blocks.join("\n\n---\n\n");
}
async function resolveRef(app, ref, perFile) {
  switch (ref.kind) {
    case "note": {
      const file = app.vault.getAbstractFileByPath(ref.id);
      if (!(file instanceof import_obsidian4.TFile))
        return null;
      const text = await app.vault.cachedRead(file);
      return `## \u{1F4C4} ${ref.label} (${ref.id})
${text.slice(0, perFile)}`;
    }
    case "folder": {
      const folder = app.vault.getAbstractFileByPath(ref.id);
      if (!(folder instanceof import_obsidian4.TFolder))
        return null;
      const files = folder.children.filter(
        (c) => c instanceof import_obsidian4.TFile && c.extension === "md"
      );
      if (files.length === 0)
        return `## \u{1F4C1} ${ref.label} (\uBE44\uC5B4 \uC788\uC74C)`;
      const summaries = await Promise.all(
        files.slice(0, 10).map(async (f) => {
          const t = await app.vault.cachedRead(f);
          return `### ${f.name}
${t.slice(0, Math.floor(perFile / files.length))}`;
        })
      );
      return `## \u{1F4C1} ${ref.label}
${summaries.join("\n\n")}`;
    }
    case "selection": {
      return `## \u2702\uFE0F \uC120\uD0DD \uC601\uC5ED (${ref.label})
${ref.id.slice(0, perFile)}`;
    }
    case "youtube":
    case "graph":
      return null;
  }
}
function activeFileRef(app) {
  const file = app.workspace.getActiveFile();
  if (!file)
    return null;
  return { id: file.path, label: file.basename, kind: "note" };
}
async function buildRagBlock(query, store, client, topK) {
  const results = await store.search(query, client, topK);
  if (results.length === 0)
    return { block: "", hits: [] };
  const hits = results.map((r) => ({
    path: r.path,
    headingPath: r.headingPath,
    text: r.text,
    score: r.score
  }));
  const block = results.map(
    (r, i) => `### [${i + 1}] ${r.path}${r.headingPath ? " \xB7 " + r.headingPath : ""} (\uC720\uC0AC\uB3C4 ${r.score.toFixed(2)})
${r.text}`
  ).join("\n\n");
  return { block: `## \u{1F50D} \uC790\uB3D9 \uAC80\uC0C9\uB41C \uADFC\uAC70
${block}`, hits };
}

// src/utils/youtube.ts
var import_obsidian5 = require("obsidian");
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /[?&]v=([A-Za-z0-9_-]{11})/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m)
      return m[1];
  }
  return null;
}
async function fetchYoutubeTranscript(url, langPriority = ["ko", "en"]) {
  var _a, _b, _c, _d, _e, _f;
  const videoId = extractVideoId(url);
  if (!videoId)
    throw new Error("\uC720\uD6A8\uD55C YouTube URL\uC774 \uC544\uB2D9\uB2C8\uB2E4.");
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=${(_a = langPriority[0]) != null ? _a : "en"}`;
  const res = await (0, import_obsidian5.requestUrl)({ url: watchUrl, method: "GET" });
  if (res.status !== 200)
    throw new Error(`YouTube \uD398\uC774\uC9C0 \uC694\uCCAD \uC2E4\uD328: ${res.status}`);
  const html = res.text;
  const prMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s);
  if (!prMatch)
    throw new Error("\uD50C\uB808\uC774\uC5B4 \uC751\uB2F5\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  let playerResponse;
  try {
    playerResponse = JSON.parse(prMatch[1]);
  } catch (e) {
    throw new Error("\uD50C\uB808\uC774\uC5B4 \uC751\uB2F5 \uD30C\uC2F1 \uC2E4\uD328");
  }
  const tracks = (_d = (_c = (_b = playerResponse == null ? void 0 : playerResponse.captions) == null ? void 0 : _b.playerCaptionsTracklistRenderer) == null ? void 0 : _c.captionTracks) != null ? _d : [];
  if (tracks.length === 0) {
    throw new Error("\uC774 \uC601\uC0C1\uC5D0 \uC790\uB9C9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
  }
  let track = null;
  for (const lang of langPriority) {
    track = tracks.find(
      (t) => t.languageCode === lang && !t.kind
      // 자동 생성(asr) 배제 우선
    );
    if (track)
      break;
  }
  if (!track) {
    for (const lang of langPriority) {
      track = tracks.find((t) => t.languageCode === lang);
      if (track)
        break;
    }
  }
  if (!track)
    track = tracks[0];
  const baseUrl = track.baseUrl;
  const language = track.languageCode;
  const captionRes = await (0, import_obsidian5.requestUrl)({ url: baseUrl, method: "GET" });
  if (captionRes.status !== 200)
    throw new Error(`\uC790\uB9C9 \uC694\uCCAD \uC2E4\uD328: ${captionRes.status}`);
  const text = parseCaptionXml(captionRes.text);
  const title = (_f = (_e = playerResponse == null ? void 0 : playerResponse.videoDetails) == null ? void 0 : _e.title) != null ? _f : `YouTube ${videoId}`;
  return { videoId, title, language, text };
}
function parseCaptionXml(xml) {
  const lines = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while (m = re.exec(xml)) {
    const raw = m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10))).replace(/<[^>]+>/g, "").trim();
    if (raw)
      lines.push(raw);
  }
  return lines.join("\n");
}

// src/views/ApplyEditModal.ts
var import_obsidian6 = require("obsidian");

// src/utils/diffView.ts
function lineDiff(oldText, newText) {
  const a = oldText.split(/\r?\n/);
  const b = newText.split(/\r?\n/);
  const m = a.length;
  const n = b.length;
  const dp = Array.from(
    { length: m + 1 },
    () => new Array(n + 1).fill(0)
  );
  for (let i2 = 0; i2 < m; i2++) {
    for (let j2 = 0; j2 < n; j2++) {
      dp[i2 + 1][j2 + 1] = a[i2] === b[j2] ? dp[i2][j2] + 1 : Math.max(dp[i2 + 1][j2], dp[i2][j2 + 1]);
    }
  }
  const ops = [];
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
function renderDiff(ops, container) {
  container.empty();
  container.addClass("bi-diff");
  const pre = container.createEl("pre", { cls: "bi-diff-pre" });
  const contextLines = 3;
  const changedIndices = /* @__PURE__ */ new Set();
  for (let idx = 0; idx < ops.length; idx++) {
    if (ops[idx].kind !== "eq")
      changedIndices.add(idx);
  }
  const showIdx = /* @__PURE__ */ new Set();
  for (const idx of changedIndices) {
    for (let k = Math.max(0, idx - contextLines); k <= Math.min(ops.length - 1, idx + contextLines); k++) {
      showIdx.add(k);
    }
  }
  const sorted = Array.from(showIdx).sort((a, b) => a - b);
  let prev = -2;
  for (const idx of sorted) {
    if (idx > prev + 1) {
      pre.createEl("div", { text: "\u2026", cls: "bi-diff-sep" });
    }
    const op = ops[idx];
    const line = pre.createEl("div", { cls: `bi-diff-line bi-diff-${op.kind}` });
    const marker = op.kind === "add" ? "+ " : op.kind === "del" ? "- " : "  ";
    line.setText(marker + op.text);
    prev = idx;
  }
  if (changedIndices.size === 0) {
    pre.createEl("div", { text: "(\uBCC0\uACBD \uC0AC\uD56D \uC5C6\uC74C)", cls: "bi-diff-sep" });
  }
}
function injectDiffStyle() {
  if (document.getElementById("bi-diff-style"))
    return;
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

// src/views/ApplyEditModal.ts
var ApplyEditModal = class extends import_obsidian6.Modal {
  constructor(app, proposal, onApplied) {
    super(app);
    this.proposal = proposal;
    this.onApplied = onApplied;
  }
  async onOpen() {
    var _a;
    injectDiffStyle();
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "\u{1F4DD} \uD3B8\uC9D1 \uC81C\uC548 \uAC80\uD1A0" });
    const file = this.resolveFile();
    if (!file) {
      contentEl.createEl("p", {
        text: "\u274C \uB300\uC0C1 \uD30C\uC77C\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4: " + (this.proposal.targetPath || "(\uD65C\uC131 \uD30C\uC77C \uC5C6\uC74C)")
      });
      return;
    }
    const oldContent = await this.app.vault.read(file);
    const newContent = this.computeNewContent(oldContent);
    const info = contentEl.createDiv({ cls: "bi-apply-info" });
    info.createEl("strong", { text: "\uB300\uC0C1: " });
    info.createEl("code", { text: file.path });
    info.createEl("span", {
      text: ` (${(_a = this.proposal.mode) != null ? _a : "replace"} \uBAA8\uB4DC)`
    });
    const diffContainer = contentEl.createDiv();
    renderDiff(lineDiff(oldContent, newContent), diffContainer);
    const btnRow = contentEl.createDiv({ cls: "bi-apply-buttons" });
    btnRow.style.display = "flex";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "12px";
    btnRow.style.justifyContent = "flex-end";
    const cancel = btnRow.createEl("button", { text: "\uCDE8\uC18C" });
    cancel.onclick = () => this.close();
    const apply = btnRow.createEl("button", {
      text: "\u2705 \uC801\uC6A9",
      cls: "mod-cta"
    });
    apply.onclick = async () => {
      var _a2;
      try {
        await this.app.vault.modify(file, newContent);
        new import_obsidian6.Notice(`\u2705 ${file.basename} \uC5C5\uB370\uC774\uD2B8 \uC644\uB8CC`);
        (_a2 = this.onApplied) == null ? void 0 : _a2.call(this);
        this.close();
      } catch (e) {
        new import_obsidian6.Notice(`\u274C \uC801\uC6A9 \uC2E4\uD328: ${e.message || e}`);
      }
    };
  }
  onClose() {
    this.contentEl.empty();
  }
  resolveFile() {
    if (this.proposal.targetPath) {
      const f = this.app.vault.getAbstractFileByPath(this.proposal.targetPath);
      return f instanceof import_obsidian6.TFile ? f : null;
    }
    return this.app.workspace.getActiveFile();
  }
  computeNewContent(oldContent) {
    var _a, _b;
    const mode = (_a = this.proposal.mode) != null ? _a : "replace";
    switch (mode) {
      case "append":
        return oldContent.replace(/\s*$/, "") + "\n\n" + this.proposal.proposedContent + "\n";
      case "section":
        return this.replaceSection(
          oldContent,
          (_b = this.proposal.sectionHeading) != null ? _b : "",
          this.proposal.proposedContent
        );
      case "replace":
      default:
        return this.proposal.proposedContent;
    }
  }
  /**
   * 특정 헤딩부터 다음 동일/상위 헤딩 직전까지 교체.
   * heading은 "## 섹션명" 형태 문자열. 매칭 실패 시 append로 폴백.
   */
  replaceSection(content, heading, replacement) {
    if (!heading)
      return content + "\n\n" + replacement;
    const hMatch = heading.match(/^(#{1,6})\s+/);
    if (!hMatch)
      return content + "\n\n" + replacement;
    const level = hMatch[1].length;
    const lines = content.split(/\r?\n/);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === heading.trim()) {
        start = i;
        break;
      }
    }
    if (start === -1)
      return content + "\n\n" + replacement;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      const m = lines[i].match(/^(#{1,6})\s+/);
      if (m && m[1].length <= level) {
        end = i;
        break;
      }
    }
    const before = lines.slice(0, start).join("\n");
    const after = lines.slice(end).join("\n");
    return [before, replacement.trim(), after].filter(Boolean).join("\n\n");
  }
};
function parseEditProposals(responseText) {
  var _a, _b;
  const result = [];
  const re = /<<<EDIT([^>]*)>>>([\s\S]*?)<<<END_EDIT>>>/g;
  let m;
  while (m = re.exec(responseText)) {
    const attrs = m[1];
    const body = m[2].trim();
    const targetMatch = attrs.match(/target="([^"]+)"/);
    const modeMatch = attrs.match(/mode="([^"]+)"/);
    const sectionMatch = attrs.match(/section="([^"]+)"/);
    result.push({
      targetPath: (_a = targetMatch == null ? void 0 : targetMatch[1]) != null ? _a : "",
      proposedContent: body,
      mode: (_b = modeMatch == null ? void 0 : modeMatch[1]) != null ? _b : "replace",
      sectionHeading: sectionMatch == null ? void 0 : sectionMatch[1]
    });
  }
  return result;
}

// src/utils/guardrails.ts
var import_obsidian7 = require("obsidian");
var GUARDRAILS_PATH = "_memory/quality-guardrails.md";
var SECTION_HEADING = "## \uC791\uC131 \uC6D0\uCE59 (\uC2DC\uC2A4\uD15C \uD504\uB86C\uD504\uD2B8 \uC790\uB3D9 \uC8FC\uC785 \uB300\uC0C1)";
async function loadGuardrails(app) {
  const file = app.vault.getAbstractFileByPath(GUARDRAILS_PATH);
  if (!(file instanceof import_obsidian7.TFile))
    return null;
  const content = await app.vault.cachedRead(file);
  const lines = content.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => l.trim() === SECTION_HEADING);
  if (startIdx === -1)
    return null;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^#{1,2}\s+/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx + 1, endIdx).join("\n").trim();
}

// src/views/ChatView.ts
var DEFAULT_CHAT_SYSTEM_PROMPT = `\uB2F9\uC2E0\uC740 \uD55C\uAD6D\uC758 \uACF5\uACF5\uC870\uB2EC/ODA \uC218\uC8FC \uBD84\uC11D \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4.
\uC0AC\uC6A9\uC790\uAC00 \uC81C\uACF5\uD55C \uD68C\uC0AC \uC790\uB8CC\xB7\uACF5\uACE0\uBB38\xB7\uACBD\uC7C1\uC0AC \uC815\uBCF4\uB97C \uADFC\uAC70\uB85C \uC81C\uC548\uC11C \uC791\uC131\uC744 \uB3D5\uC2B5\uB2C8\uB2E4.

\uC6D0\uCE59:
- \uD55C\uAD6D\uC5B4\uB85C \uC751\uB2F5\uD569\uB2C8\uB2E4.
- \uADFC\uAC70 \uC5C6\uB294 \uAE30\uAD00\uBA85\xB7\uAE08\uC561\xB7\uC218\uCE58\xB7\uC2E4\uC801\uC744 \uC9C0\uC5B4\uB0B4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.
- \uC81C\uACF5\uB41C \uCEE8\uD14D\uC2A4\uD2B8\uC5D0 \uC5C6\uB294 \uC0AC\uC2E4\uC740 "\uC790\uB8CC\uC5D0 \uC5C6\uC74C"\uC73C\uB85C \uBA85\uC2DC\uD569\uB2C8\uB2E4.
- \uB2F5\uBCC0\uC740 \uAC04\uACB0\uD558\uACE0 \uC2E4\uD589 \uAC00\uB2A5\uD55C \uD615\uD0DC\uB85C \uC815\uB9AC\uD569\uB2C8\uB2E4.

\uB178\uD2B8 \uD3B8\uC9D1 \uC81C\uC548 \uADDC\uCE59:
\uC0AC\uC6A9\uC790\uAC00 "\uC774 \uC139\uC158\uC744 \uB2E4\uC2DC \uC368\uC918", "\uC774 \uBB38\uB2E8\uC744 \uAC04\uACB0\uD558\uAC8C" \uB4F1 \uB178\uD2B8 \uD3B8\uC9D1\uC744 \uC694\uCCAD\uD558\uBA74
\uC81C\uC548 \uB0B4\uC6A9\uC744 \uBC18\uB4DC\uC2DC \uB2E4\uC74C \uD615\uC2DD\uC73C\uB85C \uAC10\uC309\uB2C8\uB2E4:

<<<EDIT target="\uACBD\uB85C/\uD30C\uC77C\uBA85.md" mode="section" section="## \uC139\uC158\uC81C\uBAA9">>>
(\uAD50\uCCB4\uD560 \uC0C8 \uB0B4\uC6A9 \uC804\uCCB4)
<<<END_EDIT>>>

mode \uAC12: replace(\uC804\uCCB4 \uAD50\uCCB4) / append(\uB05D\uC5D0 \uCD94\uAC00) / section(\uC139\uC158 \uAD50\uCCB4).
target\uC744 \uC0DD\uB7B5\uD558\uBA74 \uD65C\uC131 \uD30C\uC77C\uC5D0 \uC801\uC6A9\uB429\uB2C8\uB2E4.
\uC774 \uD0DC\uADF8 \uBC16\uC5D0\uB3C4 \uC124\uBA85\uC744 \uC790\uC720\uB86D\uAC8C \uC4F8 \uC218 \uC788\uC73C\uB098, \uC2E4\uC81C \uC801\uC6A9 \uB300\uC0C1\uC740 \uBC18\uB4DC\uC2DC \uD0DC\uADF8 \uC548\uC5D0\uB9CC \uB123\uC2B5\uB2C8\uB2E4.`;
var ChatView = class extends import_obsidian8.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.session = new ChatSession();
    this.abortCtrl = null;
    /** 다음 전송에 첨부할 이미지/텍스트 큐 */
    this.pendingAttachments = [];
    this.pendingPrefetched = [];
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_CHAT;
  }
  getDisplayText() {
    return "\uC218\uC8FC AI \uCC44\uD305";
  }
  getIcon() {
    return "messages-square";
  }
  async onOpen() {
    this.render();
  }
  async onClose() {
    var _a;
    (_a = this.abortCtrl) == null ? void 0 : _a.abort();
  }
  render() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("bi-chat");
    const header = root.createDiv({ cls: "bi-chat-header" });
    header.createEl("h4", { text: "\u{1F4AC} \uC218\uC8FC AI \uCC44\uD305" });
    const actions = header.createDiv({ cls: "bi-chat-actions" });
    const pinActiveBtn = actions.createEl("button", {
      text: "\u{1F4CE} \uD604\uC7AC \uB178\uD2B8",
      cls: "bi-chat-btn"
    });
    pinActiveBtn.onclick = () => this.pinActiveFile();
    const clearBtn = actions.createEl("button", { text: "\u{1F5D1}\uFE0F", cls: "bi-chat-btn" });
    clearBtn.title = "\uB300\uD654 \uCD08\uAE30\uD654";
    clearBtn.onclick = () => {
      this.session.clear();
      this.renderMessages();
    };
    this.pinsEl = root.createDiv({ cls: "bi-chat-pins" });
    this.renderPins();
    this.attachEl = root.createDiv({ cls: "bi-chat-attach" });
    this.renderAttachQueue();
    this.messagesEl = root.createDiv({ cls: "bi-chat-messages" });
    this.renderMessages();
    const inputRow = root.createDiv({ cls: "bi-chat-input-row" });
    this.inputEl = inputRow.createEl("textarea", {
      cls: "bi-chat-input",
      attr: { placeholder: "\uC9C8\uBB38\uC744 \uC785\uB825\uD558\uC138\uC694. (Ctrl+Enter \uC804\uC1A1)", rows: "3" }
    });
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.handleSend();
      }
    });
    const btnCol = inputRow.createDiv({ cls: "bi-chat-btn-col" });
    this.sendBtn = btnCol.createEl("button", { text: "\uC804\uC1A1", cls: "bi-chat-send" });
    this.sendBtn.onclick = () => this.handleSend();
    this.stopBtn = btnCol.createEl("button", { text: "\uC911\uB2E8", cls: "bi-chat-stop" });
    this.stopBtn.onclick = () => {
      var _a;
      return (_a = this.abortCtrl) == null ? void 0 : _a.abort();
    };
    this.stopBtn.disabled = true;
    this.injectStyle();
  }
  pinActiveFile() {
    const ref = activeFileRef(this.app);
    if (!ref) {
      new import_obsidian8.Notice("\uD65C\uC131 \uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    this.session.togglePin(ref);
    this.renderPins();
  }
  async attachYoutube(url) {
    new import_obsidian8.Notice("YouTube \uC790\uB9C9\uC744 \uAC00\uC838\uC624\uB294 \uC911...");
    try {
      const langs = this.plugin.settings.youtubeCaptionLang.split(",").map((s) => s.trim()).filter(Boolean);
      const t = await fetchYoutubeTranscript(url, langs.length > 0 ? langs : ["ko", "en"]);
      this.pendingPrefetched.push({
        label: `\u25B6\uFE0F ${t.title} (${t.language})`,
        text: `## \u25B6\uFE0F YouTube: ${t.title} (${t.language})
${t.text}`
      });
      new import_obsidian8.Notice("\uC790\uB9C9\uC774 \uB2E4\uC74C \uC804\uC1A1\uC5D0 \uCCA8\uBD80\uB429\uB2C8\uB2E4.");
      this.renderAttachQueue();
    } catch (e) {
      new import_obsidian8.Notice(`\u274C ${e.message || "\uC790\uB9C9 \uC218\uC9D1 \uC2E4\uD328"}`);
    }
  }
  renderAttachQueue() {
    this.attachEl.empty();
    const total = this.pendingAttachments.length + this.pendingPrefetched.length;
    if (total === 0)
      return;
    for (let i = 0; i < this.pendingAttachments.length; i++) {
      const a = this.pendingAttachments[i];
      const chip = this.attachEl.createDiv({ cls: "bi-chat-chip" });
      chip.createEl("span", { text: `\u{1F5BC}\uFE0F ${a.label}` });
      const close = chip.createEl("span", { text: "\xD7", cls: "bi-chat-chip-x" });
      close.onclick = () => {
        this.pendingAttachments.splice(i, 1);
        this.renderAttachQueue();
      };
    }
    for (let i = 0; i < this.pendingPrefetched.length; i++) {
      const p = this.pendingPrefetched[i];
      const chip = this.attachEl.createDiv({ cls: "bi-chat-chip" });
      chip.createEl("span", { text: p.label });
      const close = chip.createEl("span", { text: "\xD7", cls: "bi-chat-chip-x" });
      close.onclick = () => {
        this.pendingPrefetched.splice(i, 1);
        this.renderAttachQueue();
      };
    }
  }
  renderPins() {
    this.pinsEl.empty();
    if (this.session.pinnedContext.length === 0) {
      this.pinsEl.createEl("span", {
        text: "\uCEE8\uD14D\uC2A4\uD2B8 \uC5C6\uC74C (\uD604\uC7AC \uB178\uD2B8 \uBC84\uD2BC\uC73C\uB85C \uCD94\uAC00)",
        cls: "bi-chat-pins-empty"
      });
      return;
    }
    for (const ref of this.session.pinnedContext) {
      const chip = this.pinsEl.createDiv({ cls: "bi-chat-chip" });
      chip.createEl("span", { text: this.chipIcon(ref.kind) + " " + ref.label });
      const close = chip.createEl("span", { text: "\xD7", cls: "bi-chat-chip-x" });
      close.onclick = () => {
        this.session.togglePin(ref);
        this.renderPins();
      };
    }
  }
  chipIcon(kind) {
    return { note: "\u{1F4C4}", folder: "\u{1F4C1}", selection: "\u2702\uFE0F", youtube: "\u25B6\uFE0F", graph: "\u{1F578}\uFE0F" }[kind];
  }
  findYoutubeUrls(text) {
    const urls = [];
    const re = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+)/gi;
    let m;
    while (m = re.exec(text)) {
      if (extractVideoId(m[1]))
        urls.push(m[1]);
    }
    return urls;
  }
  renderMessages() {
    this.messagesEl.empty();
    if (this.session.messages.length === 0) {
      this.messagesEl.createEl("div", {
        cls: "bi-chat-empty",
        text: "\uC544\uC9C1 \uB300\uD654\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uB178\uD2B8\uB97C \uD540\uD55C \uB4A4 \uC9C8\uBB38\uD574 \uBCF4\uC138\uC694."
      });
      return;
    }
    for (const msg of this.session.messages) {
      this.renderMessage(msg);
    }
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
  renderMessage(msg) {
    const wrap = this.messagesEl.createDiv({
      cls: `bi-chat-msg bi-chat-msg-${msg.role}`
    });
    const label = wrap.createEl("div", { cls: "bi-chat-msg-label" });
    label.setText(msg.role === "user" ? "\u{1F64B} \uB098" : "\u{1F916} AI");
    if (msg.pending)
      label.createEl("span", { cls: "bi-chat-spinner", text: " \u25CF\u25CF\u25CF" });
    const body = wrap.createDiv({ cls: "bi-chat-msg-body" });
    this.renderBody(body, msg);
    if (msg.contextLabels && msg.contextLabels.length > 0) {
      const ctxRow = wrap.createDiv({ cls: "bi-chat-msg-ctx" });
      ctxRow.setText("\uCC38\uC870: " + msg.contextLabels.join(", "));
    }
    return body;
  }
  renderBody(body, msg) {
    body.empty();
    if (msg.role === "assistant") {
      import_obsidian8.MarkdownRenderer.render(this.app, msg.text || "\u2026", body, "", this);
      if (!msg.pending) {
        const proposals = parseEditProposals(msg.text);
        if (proposals.length > 0) {
          const actions = body.createDiv({ cls: "bi-chat-edit-actions" });
          proposals.forEach((p, idx) => {
            const btn = actions.createEl("button", {
              text: `\u{1F4DD} ${p.targetPath || "\uD65C\uC131 \uD30C\uC77C"} \uC5D0 \uC801\uC6A9 (${idx + 1}/${proposals.length})`,
              cls: "bi-chat-apply-btn"
            });
            btn.onclick = () => {
              new ApplyEditModal(this.app, p).open();
            };
          });
        }
      }
    } else {
      body.setText(msg.text);
    }
  }
  async handleSend() {
    var _a, _b, _c;
    if (!this.plugin.gemini) {
      new import_obsidian8.Notice("Gemini API \uD0A4\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
      return;
    }
    const text = this.inputEl.value.trim();
    if (!text)
      return;
    const ytUrls = this.findYoutubeUrls(text);
    for (const url of ytUrls) {
      if (!this.pendingPrefetched.some((p) => p.label.includes(url))) {
        await this.attachYoutube(url);
      }
    }
    this.inputEl.value = "";
    this.sendBtn.disabled = true;
    this.stopBtn.disabled = false;
    const contextLabels = [
      ...this.session.pinnedContext.map((p) => p.label),
      ...this.pendingAttachments.map((a) => `\u{1F5BC}\uFE0F ${a.label}`),
      ...this.pendingPrefetched.map((p) => p.label)
    ];
    const userMsg = this.session.addUser(text, contextLabels);
    userMsg.attachments = [...this.pendingAttachments];
    userMsg.prefetchedText = [...this.pendingPrefetched];
    const assistant = this.session.startAssistant();
    this.renderMessages();
    try {
      const contextBlock = await buildContextBlock(
        this.app,
        this.session.pinnedContext
      );
      let ragBlock = "";
      let ragHitLabels = [];
      if (this.plugin.settings.ragEnabled && this.plugin.vectorStore && this.plugin.embeddings && this.plugin.vectorStore.size() > 0) {
        try {
          const rag = await buildRagBlock(
            text,
            this.plugin.vectorStore,
            this.plugin.embeddings,
            this.plugin.settings.ragTopK
          );
          ragBlock = rag.block;
          ragHitLabels = rag.hits.map((h) => h.path);
          if (ragHitLabels.length > 0) {
            const userMsg2 = this.session.messages[this.session.messages.length - 2];
            userMsg2.contextLabels = [
              ...(_a = userMsg2.contextLabels) != null ? _a : [],
              ...ragHitLabels.map((p) => `\u{1F50D} ${p}`)
            ];
          }
        } catch (e) {
          console.warn("RAG search failed:", e);
        }
      }
      const prefetchedBlock = this.pendingPrefetched.map((p) => p.text).join("\n\n");
      const history = this.session.toApiMessages((_b = this.plugin.settings.chatHistoryLimit) != null ? _b : 20);
      const combined = [contextBlock, ragBlock, prefetchedBlock].filter(Boolean).join("\n\n");
      if (history.length > 0 && combined) {
        const last = history[history.length - 1];
        last.text = `# \uCC38\uC870 \uCEE8\uD14D\uC2A4\uD2B8
${combined}

# \uC9C8\uBB38
${last.text}`;
      }
      if (this.pendingAttachments.length > 0 && history.length > 0) {
        const last = history[history.length - 1];
        last.parts = this.pendingAttachments.map((a) => ({
          imageBase64: a.base64,
          imageMimeType: a.mimeType
        }));
      }
      this.pendingAttachments = [];
      this.pendingPrefetched = [];
      this.renderAttachQueue();
      let systemPrompt = (_c = this.plugin.settings.systemPromptOverride) == null ? void 0 : _c.trim();
      if (!systemPrompt) {
        const guardrails = await loadGuardrails(this.app);
        systemPrompt = guardrails ? `${DEFAULT_CHAT_SYSTEM_PROMPT}

# \uBCFC\uD2B8 \uADDC\uBC94 (_memory/quality-guardrails.md)
${guardrails}` : DEFAULT_CHAT_SYSTEM_PROMPT;
      }
      this.abortCtrl = new AbortController();
      const lastWrap = this.messagesEl.lastElementChild;
      const bodyEl = lastWrap.querySelector(".bi-chat-msg-body");
      const mcpTools = this.plugin.mcpRegistry.size() > 0 ? await this.plugin.mcpRegistry.listAllTools().catch(() => []) : [];
      if (mcpTools.length > 0) {
        const decls = mcpTools.map((t) => ({
          name: `${t._server}__${t.name}`,
          // 서버 구분 prefix
          description: t.description,
          parameters: t.inputSchema
        }));
        await this.plugin.gemini.generateWithTools(history, {
          systemInstruction: systemPrompt,
          tools: decls,
          toolHandler: async (call) => {
            const [serverName, ...rest] = call.name.split("__");
            const toolName = rest.join("__");
            return this.plugin.mcpRegistry.callTool(
              serverName,
              toolName,
              call.args
            );
          },
          onAssistantText: (t) => {
            assistant.text += t;
            this.renderBody(bodyEl, assistant);
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
          },
          onToolCall: (name, args) => {
            assistant.text += `

\u{1F527} **\uB3C4\uAD6C \uD638\uCD9C**: \`${name}\` ${JSON.stringify(args).slice(0, 80)}
`;
            this.renderBody(bodyEl, assistant);
          }
        });
      } else {
        await this.plugin.gemini.generateStream(history, {
          systemInstruction: systemPrompt,
          signal: this.abortCtrl.signal,
          onChunk: (delta) => {
            assistant.text += delta;
            this.renderBody(bodyEl, assistant);
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
          }
        });
      }
    } catch (e) {
      if (e.name === "AbortError") {
        assistant.text += "\n\n_(\uC911\uB2E8\uB428)_";
      } else {
        assistant.text = `\u274C \uC624\uB958: ${e.message || e}`;
      }
    } finally {
      assistant.pending = false;
      this.abortCtrl = null;
      this.sendBtn.disabled = false;
      this.stopBtn.disabled = true;
      this.renderMessages();
    }
  }
  injectStyle() {
    if (document.getElementById("bi-chat-style"))
      return;
    const style = document.createElement("style");
    style.id = "bi-chat-style";
    style.textContent = `
.bi-chat { display: flex; flex-direction: column; height: 100%; padding: 8px; gap: 8px; }
.bi-chat-header { display: flex; align-items: center; justify-content: space-between; }
.bi-chat-header h4 { margin: 0; }
.bi-chat-actions { display: flex; gap: 4px; }
.bi-chat-btn { font-size: 11px; padding: 2px 8px; cursor: pointer; }
.bi-chat-pins { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; padding: 4px; border: 1px dashed var(--background-modifier-border); border-radius: 4px; }
.bi-chat-attach { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 4px; }
.bi-chat-attach:empty { display: none; }
.bi-chat-pins-empty { color: var(--text-muted); font-size: 11px; }
.bi-chat-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background: var(--background-secondary); border-radius: 10px; font-size: 11px; }
.bi-chat-chip-x { cursor: pointer; color: var(--text-muted); font-weight: bold; }
.bi-chat-chip-x:hover { color: var(--text-error); }
.bi-chat-messages { flex: 1; overflow-y: auto; padding: 4px; display: flex; flex-direction: column; gap: 10px; }
.bi-chat-empty { color: var(--text-muted); text-align: center; padding: 20px; font-size: 12px; }
.bi-chat-msg { border-radius: 6px; padding: 6px 8px; }
.bi-chat-msg-user { background: var(--background-secondary); }
.bi-chat-msg-assistant { background: var(--background-primary-alt); }
.bi-chat-msg-label { font-size: 11px; color: var(--text-muted); margin-bottom: 2px; }
.bi-chat-msg-body { font-size: 13px; line-height: 1.5; }
.bi-chat-msg-body p { margin: 4px 0; }
.bi-chat-msg-ctx { font-size: 10px; color: var(--text-muted); margin-top: 4px; font-style: italic; }
.bi-chat-spinner { color: var(--text-accent); animation: bi-blink 1s infinite; }
@keyframes bi-blink { 50% { opacity: 0.3; } }
.bi-chat-input-row { display: flex; gap: 4px; }
.bi-chat-input { flex: 1; resize: vertical; font-family: inherit; }
.bi-chat-btn-col { display: flex; flex-direction: column; gap: 4px; }
.bi-chat-send, .bi-chat-stop { font-size: 11px; padding: 4px 10px; cursor: pointer; }
.bi-chat-send:disabled, .bi-chat-stop:disabled { opacity: 0.4; cursor: not-allowed; }
.bi-chat-edit-actions { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--background-modifier-border); }
.bi-chat-apply-btn { font-size: 11px; padding: 4px 8px; cursor: pointer; text-align: left; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 4px; }
.bi-chat-apply-btn:hover { background: var(--interactive-accent-hover); }
`;
    document.head.appendChild(style);
  }
};

// src/settings.ts
var import_obsidian10 = require("obsidian");
var DEFAULT_SETTINGS = {
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  autoAnalyzeContext: true,
  autoFrontmatter: true,
  briefingKeywords: "\uAD50\uC721, ICT, ODA, \uB514\uC9C0\uD138, \uCEE8\uC124\uD305",
  briefingAgencies: "KOICA, \uB098\uB77C\uC7A5\uD130, NIPA, NIA",
  language: "ko",
  contextFolder: DEFAULT_CONTEXT_FOLDER,
  analysisFolder: DEFAULT_ANALYSIS_FOLDER,
  chatHistoryLimit: 20,
  systemPromptOverride: "",
  ragEnabled: true,
  ragTopK: 5,
  embeddingModel: "text-embedding-004",
  youtubeCaptionLang: "ko,en",
  mcpServers: []
};
function normalizeFolderPath(input, fallback) {
  if (!input)
    return fallback;
  const cleaned = input.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  return cleaned || fallback;
}
var BidIntelligenceSettingTab = class extends import_obsidian10.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Bid Intelligence \uC124\uC815" });
    containerEl.createEl("h3", { text: "\u{1F4C1} \uD504\uB85C\uC81D\uD2B8 \uACBD\uB85C" });
    const pathDesc = containerEl.createEl("p", {
      cls: "setting-item-description"
    });
    pathDesc.style.marginBottom = "12px";
    pathDesc.innerHTML = `
			\uBCFC\uD2B8 \uB8E8\uD2B8 \uAE30\uC900 \uC0C1\uB300 \uACBD\uB85C\uC785\uB2C8\uB2E4.
			<br>\u2022 \uAE30\uBCF8: <code>_context</code> / <code>_analysis</code>
			<br>\u2022 \uD558\uC704 \uD504\uB85C\uC81D\uD2B8 \uC0AC\uC6A9 \uC2DC: <code>bid-pilot/_context</code> / <code>bid-pilot/_analysis</code>
			<br>\u2022 \uBCC0\uACBD \uD6C4 \uC0AC\uC774\uB4DC\uBC14\uAC00 \uC989\uC2DC \uAC31\uC2E0\uB418\uC9C0 \uC54A\uC73C\uBA74 \uC544\uB798 "\uB2E4\uC2DC \uADF8\uB9AC\uAE30" \uBC84\uD2BC\uC744 \uB204\uB974\uC138\uC694.
		`;
    new import_obsidian10.Setting(containerEl).setName("\uCEE8\uD14D\uC2A4\uD2B8 \uD3F4\uB354 \uACBD\uB85C").setDesc("\uD68C\uC0AC \uC790\uB8CC\uAC00 \uB4E4\uC5B4 \uC788\uB294 \uD3F4\uB354").addText(
      (text) => text.setPlaceholder("_context \uB610\uB294 bid-pilot/_context").setValue(this.plugin.settings.contextFolder).onChange(async (value) => {
        this.plugin.settings.contextFolder = normalizeFolderPath(
          value,
          DEFAULT_CONTEXT_FOLDER
        );
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian10.Setting(containerEl).setName("\uBD84\uC11D \uACB0\uACFC \uD3F4\uB354 \uACBD\uB85C").setDesc("/bid-analyze, /brief \uACB0\uACFC\uAC00 \uC800\uC7A5\uB418\uB294 \uD3F4\uB354").addText(
      (text) => text.setPlaceholder("_analysis \uB610\uB294 bid-pilot/_analysis").setValue(this.plugin.settings.analysisFolder).onChange(async (value) => {
        this.plugin.settings.analysisFolder = normalizeFolderPath(
          value,
          DEFAULT_ANALYSIS_FOLDER
        );
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian10.Setting(containerEl).setName("\uBDF0 \uC989\uC2DC \uAC31\uC2E0").setDesc("\uACBD\uB85C \uBCC0\uACBD \uD6C4 \uC0AC\uC774\uB4DC\uBC14/\uB300\uC2DC\uBCF4\uB4DC\uB97C \uC9C0\uAE08 \uB2E4\uC2DC \uADF8\uB9BD\uB2C8\uB2E4.").addButton(
      (button) => button.setButtonText("\uB2E4\uC2DC \uADF8\uB9AC\uAE30").onClick(() => {
        this.plugin.refreshAllViews();
        button.setButtonText("\u2713 \uC644\uB8CC");
        setTimeout(() => button.setButtonText("\uB2E4\uC2DC \uADF8\uB9AC\uAE30"), 1500);
      })
    );
    containerEl.createEl("h3", { text: "\u{1F916} AI \uC124\uC815" });
    new import_obsidian10.Setting(containerEl).setName("Gemini API \uD0A4").setDesc("Google AI Studio\uC5D0\uC11C \uBC1C\uAE09\uBC1B\uC740 API \uD0A4\uB97C \uC785\uB825\uD558\uC138\uC694.").addText(
      (text) => text.setPlaceholder("AIzaSy...").setValue(this.plugin.settings.geminiApiKey).onChange(async (value) => {
        this.plugin.settings.geminiApiKey = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian10.Setting(containerEl).setName("Gemini \uBAA8\uB378").setDesc("\uC0AC\uC6A9\uD560 Gemini \uBAA8\uB378\uC744 \uC120\uD0DD\uD558\uC138\uC694.").addDropdown(
      (dropdown) => dropdown.addOption("gemini-2.5-flash", "Gemini 2.5 Flash (\uBE60\uB984, \uBC94\uC6A9)").addOption("gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite (\uC800\uBE44\uC6A9)").addOption("gemini-2.5-pro", "Gemini 2.5 Pro (\uACE0\uD488\uC9C8)").setValue(this.plugin.settings.geminiModel).onChange(async (value) => {
        this.plugin.settings.geminiModel = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u2699\uFE0F \uC790\uB3D9\uD654" });
    new import_obsidian10.Setting(containerEl).setName("\uCEE8\uD14D\uC2A4\uD2B8 \uC790\uB3D9 \uBD84\uC11D").setDesc("_context/ \uD3F4\uB354 \uD30C\uC77C\uC774 \uCD94\uAC00/\uBCC0\uACBD\uB418\uBA74 Gemini\uB85C \uC790\uB3D9 \uC694\uC57D\uD569\uB2C8\uB2E4.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoAnalyzeContext).onChange(async (value) => {
        this.plugin.settings.autoAnalyzeContext = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian10.Setting(containerEl).setName("\uD504\uB85C\uD37C\uD2F0 \uC790\uB3D9 \uC0DD\uC131").setDesc("\uBD84\uC11D \uACB0\uACFC\uB97C \uD30C\uC77C \uD504\uB85C\uD37C\uD2F0(frontmatter)\uC5D0 \uC790\uB3D9 \uAE30\uB85D\uD569\uB2C8\uB2E4.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoFrontmatter).onChange(async (value) => {
        this.plugin.settings.autoFrontmatter = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u{1F4AC} \uCC44\uD305" });
    new import_obsidian10.Setting(containerEl).setName("\uD788\uC2A4\uD1A0\uB9AC \uC720\uC9C0 \uD134 \uC218").setDesc("Gemini\uC5D0 \uC804\uB2EC\uD560 \uCD5C\uADFC \uB300\uD654 \uC30D(user+assistant)\uC758 \uAC1C\uC218. \uAE38\uC218\uB85D \uBB38\uB9E5 \uC720\uC9C0, \uD1A0\uD070 \uC0AC\uC6A9 \uC99D\uAC00.").addText(
      (text) => text.setPlaceholder("20").setValue(String(this.plugin.settings.chatHistoryLimit)).onChange(async (value) => {
        const n = parseInt(value, 10);
        this.plugin.settings.chatHistoryLimit = Number.isFinite(n) && n > 0 ? n : 20;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian10.Setting(containerEl).setName("\uC2DC\uC2A4\uD15C \uD504\uB86C\uD504\uD2B8 \uC7AC\uC815\uC758").setDesc("\uBE44\uC6CC\uB450\uBA74 \uAE30\uBCF8 \uC218\uC8FC \uBD84\uC11D \uD504\uB86C\uD504\uD2B8\uB97C \uC0AC\uC6A9. \uD504\uB85C\uC81D\uD2B8\uBCC4 \uADDC\uBC94\uC744 \uAC15\uC81C\uD558\uB824\uBA74 \uC5EC\uAE30\uC5D0 \uAE30\uC785.").addTextArea((text) => {
      text.setValue(this.plugin.settings.systemPromptOverride).onChange(
        async (value) => {
          this.plugin.settings.systemPromptOverride = value;
          await this.plugin.saveSettings();
        }
      );
      text.inputEl.rows = 5;
      text.inputEl.style.width = "100%";
    });
    containerEl.createEl("h3", { text: "\u{1F50D} RAG (\uC790\uB3D9 \uADFC\uAC70 \uAC80\uC0C9)" });
    new import_obsidian10.Setting(containerEl).setName("RAG \uD65C\uC131\uD654").setDesc("\uCC44\uD305 \uC9C8\uBB38 \uC2DC \uCEE8\uD14D\uC2A4\uD2B8 \uD3F4\uB354\uC5D0\uC11C \uAD00\uB828 \uCCAD\uD06C\uB97C \uC790\uB3D9 \uAC80\uC0C9\uD574 \uD504\uB86C\uD504\uD2B8\uC5D0 \uC8FC\uC785\uD569\uB2C8\uB2E4.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.ragEnabled).onChange(async (v) => {
        this.plugin.settings.ragEnabled = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian10.Setting(containerEl).setName("\uAC80\uC0C9 Top K").setDesc("\uC9C8\uBB38\uB2F9 \uAC00\uC838\uC62C \uAD00\uB828 \uCCAD\uD06C \uAC1C\uC218. \uAE30\uBCF8 5.").addText(
      (text) => text.setPlaceholder("5").setValue(String(this.plugin.settings.ragTopK)).onChange(async (value) => {
        const n = parseInt(value, 10);
        this.plugin.settings.ragTopK = Number.isFinite(n) && n > 0 ? n : 5;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian10.Setting(containerEl).setName("\uC784\uBCA0\uB529 \uBAA8\uB378").setDesc("\uD604\uC7AC Gemini text-embedding-004\uB9CC \uC9C0\uC6D0.").addText(
      (text) => text.setValue(this.plugin.settings.embeddingModel).setDisabled(true)
    );
    new import_obsidian10.Setting(containerEl).setName("\uBCFC\uD2B8 \uC7AC\uC778\uB371\uC2F1").setDesc("\uCEE8\uD14D\uC2A4\uD2B8 \uD3F4\uB354 \uC804\uCCB4\uB97C \uB2E4\uC2DC \uC784\uBCA0\uB529\uD569\uB2C8\uB2E4. \uD30C\uC77C \uC218\uC5D0 \uBE44\uB840\uD55C \uC2DC\uAC04 \uC18C\uC694.").addButton(
      (button) => button.setButtonText("\uC7AC\uC778\uB371\uC2F1").onClick(async () => {
        var _a, _b;
        button.setDisabled(true);
        button.setButtonText("\uC778\uB371\uC2F1 \uC911...");
        try {
          await this.plugin.indexVault(
            (done, total) => button.setButtonText(`${done}/${total}`)
          );
          button.setButtonText("\u2713 \uC644\uB8CC");
        } catch (e) {
          button.setButtonText(`\u274C ${(_b = (_a = e.message) == null ? void 0 : _a.slice(0, 20)) != null ? _b : "\uC624\uB958"}`);
        }
        setTimeout(() => {
          button.setButtonText("\uC7AC\uC778\uB371\uC2F1");
          button.setDisabled(false);
        }, 3e3);
      })
    );
    containerEl.createEl("h3", { text: "\u{1F50C} MCP \uC11C\uBC84 (\uB3C4\uAD6C \uD1B5\uD569)" });
    const mcpDesc = containerEl.createEl("p", {
      cls: "setting-item-description"
    });
    mcpDesc.innerHTML = `
			Model Context Protocol(HTTP \uC804\uC1A1)\uC744 \uC9C0\uC6D0\uD558\uB294 \uC678\uBD80 \uC11C\uBC84\uB97C \uB4F1\uB85D\uD558\uBA74
			\uCC44\uD305 \uC911 \uB3C4\uAD6C \uD638\uCD9C\uC774 \uAC00\uB2A5\uD569\uB2C8\uB2E4. (\uC608: Slack \uB77C\uC6B0\uD305, \uCE98\uB9B0\uB354 \uC870\uD68C)
			<br>\u2022 JSON \uBC30\uC5F4 \uD615\uC2DD\uC73C\uB85C \uC785\uB825: <code>[{"name":"slack","url":"https://...","enabled":true}]</code>
			<br>\u2022 stdio \uC804\uC1A1 \uC11C\uBC84\uB294 \uBBF8\uC9C0\uC6D0 \u2014 HTTP/SSE \uC5D4\uB4DC\uD3EC\uC778\uD2B8\uB9CC \uC0AC\uC6A9\uD558\uC138\uC694.
		`;
    new import_obsidian10.Setting(containerEl).setName("MCP \uC11C\uBC84 \uBAA9\uB85D (JSON)").setDesc("\uAC01 \uD56D\uBAA9: name, url, enabled, authHeader(\uC120\uD0DD)").addTextArea((text) => {
      text.setValue(JSON.stringify(this.plugin.settings.mcpServers, null, 2)).onChange(
        async (value) => {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              this.plugin.settings.mcpServers = parsed;
              await this.plugin.saveSettings();
            }
          } catch (e) {
          }
        }
      );
      text.inputEl.rows = 6;
      text.inputEl.style.width = "100%";
      text.inputEl.style.fontFamily = "var(--font-monospace)";
    });
    new import_obsidian10.Setting(containerEl).setName("MCP \uB3C4\uAD6C \uBAA9\uB85D \uD655\uC778").setDesc("\uB4F1\uB85D\uB41C \uC11C\uBC84\uC5D0\uC11C \uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uB3C4\uAD6C\uB97C \uAC00\uC838\uC640 \uCF58\uC194\uC5D0 \uCD9C\uB825.").addButton(
      (button) => button.setButtonText("\uB3C4\uAD6C \uC870\uD68C").onClick(async () => {
        var _a, _b;
        button.setButtonText("\uC870\uD68C \uC911...");
        try {
          const tools = await this.plugin.mcpRegistry.listAllTools();
          console.log("[bid-intelligence MCP tools]", tools);
          button.setButtonText(`\u2713 ${tools.length}\uAC1C \uB3C4\uAD6C`);
        } catch (e) {
          button.setButtonText(`\u274C ${(_b = (_a = e.message) == null ? void 0 : _a.slice(0, 20)) != null ? _b : "\uC624\uB958"}`);
        }
        setTimeout(() => button.setButtonText("\uB3C4\uAD6C \uC870\uD68C"), 3e3);
      })
    );
    containerEl.createEl("h3", { text: "\u{1F3AC} \uBA40\uD2F0\uBBF8\uB514\uC5B4" });
    new import_obsidian10.Setting(containerEl).setName("YouTube \uC790\uB9C9 \uC5B8\uC5B4 \uC6B0\uC120\uC21C\uC704").setDesc("\uC27C\uD45C\uB85C \uAD6C\uBD84\uD55C \uC5B8\uC5B4 \uCF54\uB4DC. \uC608: ko,en \uC774\uBA74 \uD55C\uAD6D\uC5B4 \uC6B0\uC120, \uC5C6\uC73C\uBA74 \uC601\uC5B4.").addText(
      (text) => text.setPlaceholder("ko,en").setValue(this.plugin.settings.youtubeCaptionLang).onChange(async (value) => {
        this.plugin.settings.youtubeCaptionLang = value.trim() || "ko,en";
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u{1F4CB} \uBE0C\uB9AC\uD551" });
    new import_obsidian10.Setting(containerEl).setName("\uAD00\uC2EC \uD0A4\uC6CC\uB4DC").setDesc("\uBE0C\uB9AC\uD551 \uC2DC \uAC80\uC0C9\uD560 \uD0A4\uC6CC\uB4DC (\uC27C\uD45C \uAD6C\uBD84)").addText(
      (text) => text.setPlaceholder("\uAD50\uC721, ICT, ODA").setValue(this.plugin.settings.briefingKeywords).onChange(async (value) => {
        this.plugin.settings.briefingKeywords = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian10.Setting(containerEl).setName("\uAD00\uC2EC \uBC1C\uC8FC\uCC98").setDesc("\uBAA8\uB2C8\uD130\uB9C1\uD560 \uBC1C\uC8FC\uCC98 (\uC27C\uD45C \uAD6C\uBD84)").addText(
      (text) => text.setPlaceholder("KOICA, \uB098\uB77C\uC7A5\uD130, NIPA").setValue(this.plugin.settings.briefingAgencies).onChange(async (value) => {
        this.plugin.settings.briefingAgencies = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u{1F527} \uC9C4\uB2E8" });
    new import_obsidian10.Setting(containerEl).setName("API \uC5F0\uACB0 \uD14C\uC2A4\uD2B8").setDesc("Gemini API\uAC00 \uC815\uC0C1 \uC791\uB3D9\uD558\uB294\uC9C0 \uD655\uC778\uD569\uB2C8\uB2E4.").addButton(
      (button) => button.setButtonText("\uD14C\uC2A4\uD2B8").onClick(async () => {
        button.setButtonText("\uD14C\uC2A4\uD2B8 \uC911...");
        button.setDisabled(true);
        try {
          const { GeminiClient: GeminiClient2 } = await Promise.resolve().then(() => (init_gemini(), gemini_exports));
          const client = new GeminiClient2(
            this.plugin.settings.geminiApiKey,
            this.plugin.settings.geminiModel
          );
          const result = await client.testConnection();
          if (result.ok) {
            button.setButtonText("\u2705 \uC5F0\uACB0 \uC131\uACF5!");
          } else {
            button.setButtonText(`\u274C ${result.error}`);
          }
        } catch (e) {
          button.setButtonText("\u274C \uC5F0\uACB0 \uC2E4\uD328");
        }
        setTimeout(() => {
          button.setButtonText("\uD14C\uC2A4\uD2B8");
          button.setDisabled(false);
        }, 3e3);
      })
    );
  }
};

// src/main.ts
init_gemini();

// src/utils/embeddings.ts
var import_obsidian11 = require("obsidian");
var BASE_URL2 = "https://generativelanguage.googleapis.com/v1beta/models";
var EmbeddingsClient = class {
  constructor(apiKey, model = "text-embedding-004") {
    this.apiKey = apiKey;
    this.model = model;
  }
  /**
   * 단일 텍스트 임베딩.
   */
  async embed(text, task) {
    var _a, _b;
    const url = `${BASE_URL2}/${this.model}:embedContent?key=${this.apiKey}`;
    const body = {
      content: { parts: [{ text }] },
      taskType: task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT"
    };
    const res = await (0, import_obsidian11.requestUrl)({
      url,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (res.status !== 200) {
      throw new Error(`\uC784\uBCA0\uB529 API \uC624\uB958: ${res.status}`);
    }
    const values = (_b = (_a = res.json) == null ? void 0 : _a.embedding) == null ? void 0 : _b.values;
    if (!Array.isArray(values))
      throw new Error("\uC784\uBCA0\uB529 \uC751\uB2F5\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.");
    return values;
  }
  /**
   * 배치 임베딩. 요청당 최대 100개 내부적으로 분할.
   */
  async embedBatch(texts, task) {
    var _a, _b;
    const results = [];
    const taskType = task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";
    for (let i = 0; i < texts.length; i += 100) {
      const slice = texts.slice(i, i + 100);
      const url = `${BASE_URL2}/${this.model}:batchEmbedContents?key=${this.apiKey}`;
      const body = {
        requests: slice.map((t) => ({
          model: `models/${this.model}`,
          content: { parts: [{ text: t }] },
          taskType
        }))
      };
      const res = await (0, import_obsidian11.requestUrl)({
        url,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.status !== 200) {
        throw new Error(`\uBC30\uCE58 \uC784\uBCA0\uB529 API \uC624\uB958: ${res.status}`);
      }
      const embeddings = (_b = (_a = res.json) == null ? void 0 : _a.embeddings) != null ? _b : [];
      for (const e of embeddings) {
        results.push(e.values || []);
      }
    }
    return results;
  }
};
function cosineSimilarity(a, b) {
  if (a.length !== b.length || a.length === 0)
    return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0)
    return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// src/utils/chunker.ts
function chunkMarkdown(content, targetChars = 1500) {
  const lines = content.split(/\r?\n/);
  const sections = splitByHeading(lines);
  const chunks = [];
  for (const sec of sections) {
    if (sec.text.length <= targetChars) {
      chunks.push(sec);
      continue;
    }
    const paragraphs = sec.text.split(/\n{2,}/);
    let buffer = "";
    let bufferStart = sec.startLine;
    for (const p of paragraphs) {
      if ((buffer + "\n\n" + p).length > targetChars && buffer.length > 0) {
        chunks.push({
          text: prefixHeading(sec.headingPath, buffer),
          headingPath: sec.headingPath,
          startLine: bufferStart
        });
        buffer = p;
        bufferStart = sec.startLine;
      } else {
        buffer = buffer ? buffer + "\n\n" + p : p;
      }
    }
    if (buffer) {
      chunks.push({
        text: prefixHeading(sec.headingPath, buffer),
        headingPath: sec.headingPath,
        startLine: bufferStart
      });
    }
  }
  return chunks.filter((c) => c.text.trim().length >= 50);
}
function splitByHeading(lines) {
  const result = [];
  const stack = [];
  let curStart = 0;
  let curHeadingPath = "";
  let curLines = [];
  const flush = () => {
    const text = curLines.join("\n").trim();
    if (text) {
      result.push({
        text: prefixHeading(curHeadingPath, text),
        headingPath: curHeadingPath,
        startLine: curStart
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
function prefixHeading(path, body) {
  return path ? `[${path}]
${body}` : body;
}

// src/utils/vectorStore.ts
var STORE_FILENAME = "vectors.json";
var VectorStore = class {
  constructor(app, pluginId, model) {
    this.entries = [];
    this.loaded = false;
    this.app = app;
    this.pluginId = pluginId;
    this.model = model;
  }
  storePath() {
    return `${this.app.vault.configDir}/plugins/${this.pluginId}/${STORE_FILENAME}`;
  }
  async load() {
    if (this.loaded)
      return;
    const path = this.storePath();
    try {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(path)) {
        const raw = await adapter.read(path);
        const parsed = JSON.parse(raw);
        if (parsed.model === this.model) {
          this.entries = parsed.entries;
        }
      }
    } catch (e) {
    }
    this.loaded = true;
  }
  async save() {
    const path = this.storePath();
    const data = {
      version: 1,
      model: this.model,
      entries: this.entries
    };
    await this.app.vault.adapter.write(path, JSON.stringify(data));
  }
  /**
   * 폴더 경로를 대상으로 전체 재인덱싱. 기존 데이터는 제거.
   */
  async reindex(folderPath, client, onProgress) {
    await this.load();
    const files = this.app.vault.getFiles().filter(
      (f) => f.path.startsWith(folderPath + "/") && f.extension === "md"
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
      onProgress == null ? void 0 : onProgress(i + 1, files.length);
    }
    await this.save();
    return { files: files.length, chunks: totalChunks };
  }
  /**
   * 단일 파일 인덱싱 (증분용). 기존 파일 엔트리는 제거 후 재생성.
   */
  async indexFile(file, client) {
    await this.load();
    this.entries = this.entries.filter((e) => e.path !== file.path);
    const content = await this.app.vault.cachedRead(file);
    if (content.trim().length < 50)
      return 0;
    const chunks = chunkMarkdown(content);
    if (chunks.length === 0)
      return 0;
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
        mtime: file.stat.mtime
      });
    }
    return chunks.length;
  }
  removeFile(path) {
    this.entries = this.entries.filter((e) => e.path !== path);
  }
  /**
   * 쿼리 임베딩과 코사인 유사도 상위 K개 반환.
   */
  async search(query, client, topK) {
    await this.load();
    if (this.entries.length === 0)
      return [];
    const qvec = await client.embed(query, "query");
    const scored = this.entries.map((e) => ({
      ...e,
      score: cosineSimilarity(qvec, e.vec)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
  size() {
    return this.entries.length;
  }
  extractMeta(file) {
    var _a;
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = (_a = cache == null ? void 0 : cache.frontmatter) != null ? _a : {};
    return {
      category: fm.category,
      relevance: fm.relevance,
      tags: Array.isArray(fm.tags) ? fm.tags : void 0
    };
  }
};

// src/utils/mcpClient.ts
var import_obsidian12 = require("obsidian");
var McpClient = class {
  constructor(config) {
    this.nextId = 1;
    this.initialized = false;
    this.config = config;
  }
  get name() {
    return this.config.name;
  }
  async initialize() {
    if (this.initialized)
      return;
    await this.call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "obsidian-bid-intelligence",
        version: "1.1.0"
      }
    });
    this.initialized = true;
  }
  async listTools() {
    var _a;
    await this.initialize();
    const result = await this.call("tools/list", {});
    const tools = (_a = result == null ? void 0 : result.tools) != null ? _a : [];
    return tools.map((t) => {
      var _a2;
      return {
        name: t.name,
        description: t.description,
        inputSchema: (_a2 = t.inputSchema) != null ? _a2 : { type: "object" },
        _server: this.config.name
      };
    });
  }
  async callTool(name, args) {
    var _a;
    await this.initialize();
    const result = await this.call("tools/call", {
      name,
      arguments: args
    });
    return {
      content: (_a = result == null ? void 0 : result.content) != null ? _a : [],
      isError: result == null ? void 0 : result.isError
    };
  }
  async call(method, params) {
    var _a, _b;
    const req = {
      jsonrpc: "2.0",
      id: this.nextId++,
      method,
      params
    };
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream"
    };
    if (this.config.authHeader) {
      headers.Authorization = this.config.authHeader;
    }
    const res = await (0, import_obsidian12.requestUrl)({
      url: this.config.url,
      method: "POST",
      headers,
      body: JSON.stringify(req)
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`MCP ${method} HTTP ${res.status}`);
    }
    let body;
    if ((_b = (_a = res.headers) == null ? void 0 : _a["content-type"]) == null ? void 0 : _b.includes("text/event-stream")) {
      body = parseSseJsonRpc(res.text);
    } else {
      body = res.json;
    }
    if (body.error) {
      throw new Error(`MCP ${method}: ${body.error.message}`);
    }
    return body.result;
  }
};
function parseSseJsonRpc(sse) {
  const events = sse.split("\n\n");
  for (const evt of events) {
    const dataLine = evt.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine)
      continue;
    const payload = dataLine.slice(5).trim();
    if (!payload)
      continue;
    try {
      const json = JSON.parse(payload);
      if (json.jsonrpc === "2.0" && typeof json.id !== "undefined") {
        return json;
      }
    } catch (e) {
    }
  }
  throw new Error("SSE \uC751\uB2F5\uC5D0\uC11C JSON-RPC \uACB0\uACFC\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
}
var McpRegistry = class {
  constructor() {
    this.clients = /* @__PURE__ */ new Map();
  }
  setServers(servers) {
    this.clients.clear();
    for (const s of servers) {
      if (s.enabled && s.url) {
        this.clients.set(s.name, new McpClient(s));
      }
    }
  }
  async listAllTools() {
    const all = [];
    for (const [, client] of this.clients) {
      try {
        const tools = await client.listTools();
        all.push(...tools);
      } catch (e) {
        console.warn(`MCP ${client.name} listTools \uC2E4\uD328:`, e);
      }
    }
    return all;
  }
  async callTool(serverName, toolName, args) {
    const client = this.clients.get(serverName);
    if (!client)
      throw new Error(`MCP \uC11C\uBC84 "${serverName}" \uBBF8\uB4F1\uB85D`);
    return client.callTool(toolName, args);
  }
  size() {
    return this.clients.size;
  }
};

// src/main.ts
init_frontmatter();
var BidIntelligencePlugin = class extends import_obsidian13.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.gemini = null;
    this.embeddings = null;
    this.vectorStore = null;
    this.mcpRegistry = new McpRegistry();
  }
  async onload() {
    await this.loadSettings();
    this.initGemini();
    this.initRag();
    this.initMcp();
    this.addSettingTab(new BidIntelligenceSettingTab(this.app, this));
    this.registerView(VIEW_TYPE_CONTEXT, (leaf) => new ContextManagerView(leaf, this));
    this.registerView(VIEW_TYPE_BRIEFING, (leaf) => new BriefingDashboardView(leaf, this));
    this.registerView(VIEW_TYPE_REPORT, (leaf) => new AnalysisReportView(leaf, this));
    this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, this));
    this.addCommand({
      id: "open-context-manager",
      name: "\uCEE8\uD14D\uC2A4\uD2B8 \uB9E4\uB2C8\uC800 \uC5F4\uAE30",
      callback: () => this.activateView(VIEW_TYPE_CONTEXT, "left")
    });
    this.addCommand({
      id: "open-chat",
      name: "\uC218\uC8FC AI \uCC44\uD305 \uC5F4\uAE30",
      callback: () => this.activateView(VIEW_TYPE_CHAT, "right")
    });
    this.addCommand({
      id: "analyze-current-file",
      name: "\uD604\uC7AC \uD30C\uC77C AI \uBD84\uC11D (\uD504\uB85C\uD37C\uD2F0 \uC0DD\uC131)",
      callback: () => this.analyzeCurrentFile()
    });
    this.addCommand({
      id: "analyze-all-context",
      name: "\uCEE8\uD14D\uC2A4\uD2B8 \uC804\uCCB4 \uBD84\uC11D",
      callback: () => this.analyzeAllContext()
    });
    this.addCommand({
      id: "index-vault",
      name: "\uCEE8\uD14D\uC2A4\uD2B8 \uBCFC\uD2B8 \uC7AC\uC778\uB371\uC2F1 (RAG)",
      callback: () => this.indexVault()
    });
    this.addRibbonIcon("database", "\uCEE8\uD14D\uC2A4\uD2B8 \uB9E4\uB2C8\uC800", () => {
      this.activateView(VIEW_TYPE_CONTEXT, "left");
    });
    this.addRibbonIcon("messages-square", "\uC218\uC8FC AI \uCC44\uD305", () => {
      this.activateView(VIEW_TYPE_CHAT, "right");
    });
    if (this.settings.autoAnalyzeContext) {
      this.registerEvent(
        this.app.vault.on("create", (file) => {
          if (file instanceof import_obsidian13.TFile && this.shouldAutoAnalyze(file)) {
            setTimeout(() => this.autoAnalyzeFile(file), 2e3);
          }
        })
      );
    }
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian13.TFile && this.shouldIndex(file)) {
          setTimeout(() => this.indexFileQuiet(file), 2e3);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof import_obsidian13.TFile && this.vectorStore) {
          this.vectorStore.removeFile(file.path);
          void this.vectorStore.save();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (this.vectorStore) {
          this.vectorStore.removeFile(oldPath);
          if (file instanceof import_obsidian13.TFile && this.shouldIndex(file)) {
            setTimeout(() => this.indexFileQuiet(file), 500);
          }
        }
      })
    );
    this.app.workspace.onLayoutReady(() => {
      this.activateView(VIEW_TYPE_CONTEXT, "left");
    });
  }
  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CONTEXT);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_BRIEFING);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_REPORT);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHAT);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.initGemini();
    this.initRag();
    this.initMcp();
  }
  initGemini() {
    if (this.settings.geminiApiKey) {
      this.gemini = new GeminiClient(
        this.settings.geminiApiKey,
        this.settings.geminiModel
      );
    } else {
      this.gemini = null;
    }
  }
  initMcp() {
    var _a;
    this.mcpRegistry.setServers((_a = this.settings.mcpServers) != null ? _a : []);
  }
  initRag() {
    if (!this.settings.geminiApiKey) {
      this.embeddings = null;
      this.vectorStore = null;
      return;
    }
    this.embeddings = new EmbeddingsClient(
      this.settings.geminiApiKey,
      this.settings.embeddingModel
    );
    this.vectorStore = new VectorStore(
      this.app,
      this.manifest.id,
      this.settings.embeddingModel
    );
  }
  /**
   * 컨텍스트 폴더 전체를 재인덱싱.
   * 설정 UI의 버튼과 명령 팔레트에서 호출.
   */
  async indexVault(onProgress) {
    if (!this.embeddings || !this.vectorStore) {
      new import_obsidian13.Notice("Gemini API \uD0A4\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
      throw new Error("no-api-key");
    }
    const folder = this.settings.contextFolder;
    new import_obsidian13.Notice(`\u{1F50D} ${folder}/ \uC778\uB371\uC2F1 \uC2DC\uC791...`);
    const result = await this.vectorStore.reindex(
      folder,
      this.embeddings,
      onProgress
    );
    new import_obsidian13.Notice(`\u2705 \uC778\uB371\uC2F1 \uC644\uB8CC: ${result.files}\uAC1C \uD30C\uC77C, ${result.chunks}\uAC1C \uCCAD\uD06C`);
    return result;
  }
  /**
   * 현재 열린 파일을 Gemini로 분석하고 frontmatter 생성
   */
  async analyzeCurrentFile() {
    if (!this.gemini) {
      new import_obsidian13.Notice("Gemini API \uD0A4\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
      return;
    }
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new import_obsidian13.Notice("\uC5F4\uB9B0 \uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    if (file.extension !== "md") {
      new import_obsidian13.Notice("\uB9C8\uD06C\uB2E4\uC6B4 \uD30C\uC77C\uB9CC \uBD84\uC11D\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      return;
    }
    new import_obsidian13.Notice(`\u{1F50D} ${file.basename} \uBD84\uC11D \uC911...`);
    try {
      const content = await this.app.vault.read(file);
      const existing = getFrontmatter(file, this.app.metadataCache);
      const props = await this.gemini.generateProperties(
        file.name,
        content,
        existing
      );
      await updateFrontmatter(file, this.app.vault, props);
      new import_obsidian13.Notice(`\u2705 ${file.basename} \uD504\uB85C\uD37C\uD2F0 \uC0DD\uC131 \uC644\uB8CC`);
    } catch (e) {
      new import_obsidian13.Notice(`\u274C \uBD84\uC11D \uC2E4\uD328: ${e.message}`);
    }
  }
  /**
   * _context/ 전체 파일 일괄 분석
   */
  async analyzeAllContext() {
    if (!this.gemini) {
      new import_obsidian13.Notice("Gemini API \uD0A4\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
      return;
    }
    const files = this.app.vault.getFiles().filter(
      (f) => f.path.startsWith(this.settings.contextFolder + "/") && f.extension === "md"
    );
    if (files.length === 0) {
      new import_obsidian13.Notice(`${this.settings.contextFolder}/ \uD3F4\uB354\uC5D0 \uB9C8\uD06C\uB2E4\uC6B4 \uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.`);
      return;
    }
    new import_obsidian13.Notice(`\u{1F50D} ${files.length}\uAC1C \uD30C\uC77C \uBD84\uC11D \uC2DC\uC791...`);
    let done = 0;
    let failed = 0;
    for (const file of files) {
      try {
        const content = await this.app.vault.read(file);
        const existing = getFrontmatter(file, this.app.metadataCache);
        if (existing["summary"] && existing["category"]) {
          done++;
          continue;
        }
        const summary = await this.gemini.summarizeFile(file.name, content);
        await updateFrontmatter(file, this.app.vault, {
          type: "context",
          category: summary.category,
          summary: summary.summary,
          tags: summary.tags,
          entities: summary.keyEntities,
          relevance: summary.relevance
        });
        done++;
        await sleep(1500);
      } catch (e) {
        failed++;
      }
    }
    new import_obsidian13.Notice(`\u2705 \uBD84\uC11D \uC644\uB8CC: ${done}\uAC1C \uC131\uACF5, ${failed}\uAC1C \uC2E4\uD328`);
  }
  /**
   * 파일이 자동 분석 대상인지 확인
   */
  shouldAutoAnalyze(file) {
    if (file.extension !== "md")
      return false;
    return file.path.startsWith(this.settings.contextFolder + "/") || file.path.startsWith(this.settings.analysisFolder + "/");
  }
  /**
   * 파일이 RAG 인덱싱 대상인지 확인 (컨텍스트 폴더 내 마크다운만).
   */
  shouldIndex(file) {
    if (file.extension !== "md")
      return false;
    return file.path.startsWith(this.settings.contextFolder + "/");
  }
  /**
   * 단일 파일을 조용히 증분 인덱싱 (UI 알림 없음).
   */
  async indexFileQuiet(file) {
    if (!this.embeddings || !this.vectorStore)
      return;
    try {
      await this.vectorStore.indexFile(file, this.embeddings);
      await this.vectorStore.save();
    } catch (e) {
      console.warn("indexFileQuiet failed:", file.path, e);
    }
  }
  /**
   * 열려 있는 모든 플러그인 뷰를 다시 그린다 (설정에서 경로 바꾼 뒤 호출용).
   */
  refreshAllViews() {
    for (const type of [VIEW_TYPE_CONTEXT, VIEW_TYPE_BRIEFING, VIEW_TYPE_REPORT]) {
      const leaves = this.app.workspace.getLeavesOfType(type);
      for (const leaf of leaves) {
        const view = leaf.view;
        if (view && typeof view.render === "function") {
          try {
            view.render();
          } catch (e) {
          }
        }
      }
    }
  }
  /**
   * 파일 자동 분석 (백그라운드)
   */
  async autoAnalyzeFile(file) {
    if (!this.gemini || !this.settings.autoFrontmatter)
      return;
    try {
      const content = await this.app.vault.read(file);
      if (content.length < 50)
        return;
      const existing = getFrontmatter(file, this.app.metadataCache);
      if (existing["type"])
        return;
      const props = await this.gemini.generateProperties(
        file.name,
        content,
        existing
      );
      await updateFrontmatter(file, this.app.vault, props);
    } catch (e) {
    }
  }
  async activateView(viewType, side) {
    const existing = this.app.workspace.getLeavesOfType(viewType);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = side === "left" ? this.app.workspace.getLeftLeaf(false) : this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: viewType, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }
};
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
