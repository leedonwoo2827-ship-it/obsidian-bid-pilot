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
var import_obsidian4, BASE_URL, GeminiClient, SYSTEM_INSTRUCTION;
var init_gemini = __esm({
  "src/utils/gemini.ts"() {
    import_obsidian4 = require("obsidian");
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
        const response = await (0, import_obsidian4.requestUrl)({
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
var import_obsidian6 = require("obsidian");

// src/utils/constants.ts
var VIEW_TYPE_CONTEXT = "bid-context-manager";
var VIEW_TYPE_BRIEFING = "bid-briefing-dashboard";
var VIEW_TYPE_REPORT = "bid-analysis-report";
var CONTEXT_FOLDER = "_context";
var ANALYSIS_FOLDER = "_analysis";
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
function getContextStats(vault) {
  const stats = {
    totalFiles: 0,
    categories: {},
    lastModified: null
  };
  const allFiles = vault.getFiles();
  for (const file of allFiles) {
    if (!file.path.startsWith(CONTEXT_FOLDER + "/"))
      continue;
    stats.totalFiles++;
    const parts = file.path.split("/");
    if (parts.length >= 3) {
      const cat = parts[1];
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
function getAnalysisReports(vault) {
  const reports = [];
  const allFiles = vault.getFiles();
  for (const file of allFiles) {
    if (!file.path.startsWith(ANALYSIS_FOLDER + "/"))
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
    const stats = getContextStats(this.app.vault);
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
          (f) => f.path.startsWith(CONTEXT_FOLDER + "/") && f.extension === "md"
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
          this.openFolder(`${CONTEXT_FOLDER}/${key}`);
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
          this.openFolder(CONTEXT_FOLDER);
        } else {
          this.openFolder(`${CONTEXT_FOLDER}/${key}`);
        }
      });
    }
    if (stats.totalFiles > 0) {
      const fileSection = container.createDiv({ cls: "bi-cm-files" });
      fileSection.createEl("h5", { text: "\uD30C\uC77C \uBAA9\uB85D" });
      const fileList = fileSection.createDiv({ cls: "bi-cm-file-list" });
      const allFiles = this.app.vault.getFiles().filter((f) => f.path.startsWith(CONTEXT_FOLDER + "/")).sort((a, b) => b.stat.mtime - a.stat.mtime);
      for (const file of allFiles.slice(0, 30)) {
        const item = fileList.createDiv({ cls: "bi-cm-file-item" });
        const icon = this.getFileIcon(file.extension);
        item.createEl("span", { cls: "bi-cm-file-icon", text: icon });
        const link = item.createEl("a", {
          cls: "bi-cm-file-link",
          text: file.path.replace(CONTEXT_FOLDER + "/", "")
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
  constructor(leaf) {
    super(leaf);
    this.currentFile = null;
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
        if (file instanceof import_obsidian2.TFile && file.path.startsWith(ANALYSIS_FOLDER + "/brief-")) {
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
    const briefs = this.app.vault.getFiles().filter((f) => f.path.startsWith(ANALYSIS_FOLDER + "/") && f.basename.startsWith("brief-")).sort((a, b) => b.stat.mtime - a.stat.mtime);
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
  constructor(leaf) {
    super(leaf);
    this.selectedType = "all";
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
        if (file instanceof import_obsidian3.TFile && file.path.startsWith(ANALYSIS_FOLDER + "/")) {
          this.render();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof import_obsidian3.TFile && file.path.startsWith(ANALYSIS_FOLDER + "/")) {
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
    const reports = getAnalysisReports(this.app.vault);
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

// src/settings.ts
var import_obsidian5 = require("obsidian");
var DEFAULT_SETTINGS = {
  geminiApiKey: "",
  geminiModel: "gemini-2.0-flash",
  autoAnalyzeContext: true,
  autoFrontmatter: true,
  briefingKeywords: "\uAD50\uC721, ICT, ODA, \uB514\uC9C0\uD138, \uCEE8\uC124\uD305",
  briefingAgencies: "KOICA, \uB098\uB77C\uC7A5\uD130, NIPA, NIA",
  language: "ko"
};
var BidIntelligenceSettingTab = class extends import_obsidian5.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Bid Intelligence \uC124\uC815" });
    containerEl.createEl("h3", { text: "\u{1F916} AI \uC124\uC815" });
    new import_obsidian5.Setting(containerEl).setName("Gemini API \uD0A4").setDesc("Google AI Studio\uC5D0\uC11C \uBC1C\uAE09\uBC1B\uC740 API \uD0A4\uB97C \uC785\uB825\uD558\uC138\uC694.").addText(
      (text) => text.setPlaceholder("AIzaSy...").setValue(this.plugin.settings.geminiApiKey).onChange(async (value) => {
        this.plugin.settings.geminiApiKey = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("Gemini \uBAA8\uB378").setDesc("\uC0AC\uC6A9\uD560 Gemini \uBAA8\uB378\uC744 \uC120\uD0DD\uD558\uC138\uC694.").addDropdown(
      (dropdown) => dropdown.addOption("gemini-2.0-flash", "Gemini 2.0 Flash (\uBE60\uB984, \uBB34\uB8CC)").addOption("gemini-2.5-flash-preview-05-20", "Gemini 2.5 Flash (\uCD5C\uC2E0)").addOption("gemini-2.5-pro-preview-05-06", "Gemini 2.5 Pro (\uACE0\uD488\uC9C8)").setValue(this.plugin.settings.geminiModel).onChange(async (value) => {
        this.plugin.settings.geminiModel = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u2699\uFE0F \uC790\uB3D9\uD654" });
    new import_obsidian5.Setting(containerEl).setName("\uCEE8\uD14D\uC2A4\uD2B8 \uC790\uB3D9 \uBD84\uC11D").setDesc("_context/ \uD3F4\uB354 \uD30C\uC77C\uC774 \uCD94\uAC00/\uBCC0\uACBD\uB418\uBA74 Gemini\uB85C \uC790\uB3D9 \uC694\uC57D\uD569\uB2C8\uB2E4.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoAnalyzeContext).onChange(async (value) => {
        this.plugin.settings.autoAnalyzeContext = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\uD504\uB85C\uD37C\uD2F0 \uC790\uB3D9 \uC0DD\uC131").setDesc("\uBD84\uC11D \uACB0\uACFC\uB97C \uD30C\uC77C \uD504\uB85C\uD37C\uD2F0(frontmatter)\uC5D0 \uC790\uB3D9 \uAE30\uB85D\uD569\uB2C8\uB2E4.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoFrontmatter).onChange(async (value) => {
        this.plugin.settings.autoFrontmatter = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u{1F4CB} \uBE0C\uB9AC\uD551" });
    new import_obsidian5.Setting(containerEl).setName("\uAD00\uC2EC \uD0A4\uC6CC\uB4DC").setDesc("\uBE0C\uB9AC\uD551 \uC2DC \uAC80\uC0C9\uD560 \uD0A4\uC6CC\uB4DC (\uC27C\uD45C \uAD6C\uBD84)").addText(
      (text) => text.setPlaceholder("\uAD50\uC721, ICT, ODA").setValue(this.plugin.settings.briefingKeywords).onChange(async (value) => {
        this.plugin.settings.briefingKeywords = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\uAD00\uC2EC \uBC1C\uC8FC\uCC98").setDesc("\uBAA8\uB2C8\uD130\uB9C1\uD560 \uBC1C\uC8FC\uCC98 (\uC27C\uD45C \uAD6C\uBD84)").addText(
      (text) => text.setPlaceholder("KOICA, \uB098\uB77C\uC7A5\uD130, NIPA").setValue(this.plugin.settings.briefingAgencies).onChange(async (value) => {
        this.plugin.settings.briefingAgencies = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u{1F527} \uC9C4\uB2E8" });
    new import_obsidian5.Setting(containerEl).setName("API \uC5F0\uACB0 \uD14C\uC2A4\uD2B8").setDesc("Gemini API\uAC00 \uC815\uC0C1 \uC791\uB3D9\uD558\uB294\uC9C0 \uD655\uC778\uD569\uB2C8\uB2E4.").addButton(
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
init_frontmatter();
var BidIntelligencePlugin = class extends import_obsidian6.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.gemini = null;
  }
  async onload() {
    await this.loadSettings();
    this.initGemini();
    this.addSettingTab(new BidIntelligenceSettingTab(this.app, this));
    this.registerView(VIEW_TYPE_CONTEXT, (leaf) => new ContextManagerView(leaf, this));
    this.registerView(VIEW_TYPE_BRIEFING, (leaf) => new BriefingDashboardView(leaf));
    this.registerView(VIEW_TYPE_REPORT, (leaf) => new AnalysisReportView(leaf));
    this.addCommand({
      id: "open-context-manager",
      name: "\uCEE8\uD14D\uC2A4\uD2B8 \uB9E4\uB2C8\uC800 \uC5F4\uAE30",
      callback: () => this.activateView(VIEW_TYPE_CONTEXT, "left")
    });
    this.addCommand({
      id: "open-briefing-dashboard",
      name: "\uBE0C\uB9AC\uD551 \uB300\uC2DC\uBCF4\uB4DC \uC5F4\uAE30",
      callback: () => this.activateView(VIEW_TYPE_BRIEFING, "right")
    });
    this.addCommand({
      id: "open-analysis-report",
      name: "\uBD84\uC11D \uB9AC\uD3EC\uD2B8 \uBDF0\uC5B4 \uC5F4\uAE30",
      callback: () => this.activateView(VIEW_TYPE_REPORT, "right")
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
    this.addRibbonIcon("database", "\uCEE8\uD14D\uC2A4\uD2B8 \uB9E4\uB2C8\uC800", () => {
      this.activateView(VIEW_TYPE_CONTEXT, "left");
    });
    this.addRibbonIcon("bar-chart-3", "\uBE0C\uB9AC\uD551 \uB300\uC2DC\uBCF4\uB4DC", () => {
      this.activateView(VIEW_TYPE_BRIEFING, "right");
    });
    if (this.settings.autoAnalyzeContext) {
      this.registerEvent(
        this.app.vault.on("create", (file) => {
          if (file instanceof import_obsidian6.TFile && this.shouldAutoAnalyze(file)) {
            setTimeout(() => this.autoAnalyzeFile(file), 2e3);
          }
        })
      );
    }
    this.app.workspace.onLayoutReady(() => {
      this.activateView(VIEW_TYPE_CONTEXT, "left");
    });
  }
  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CONTEXT);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_BRIEFING);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_REPORT);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.initGemini();
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
  /**
   * 현재 열린 파일을 Gemini로 분석하고 frontmatter 생성
   */
  async analyzeCurrentFile() {
    if (!this.gemini) {
      new import_obsidian6.Notice("Gemini API \uD0A4\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
      return;
    }
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new import_obsidian6.Notice("\uC5F4\uB9B0 \uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    if (file.extension !== "md") {
      new import_obsidian6.Notice("\uB9C8\uD06C\uB2E4\uC6B4 \uD30C\uC77C\uB9CC \uBD84\uC11D\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      return;
    }
    new import_obsidian6.Notice(`\u{1F50D} ${file.basename} \uBD84\uC11D \uC911...`);
    try {
      const content = await this.app.vault.read(file);
      const existing = getFrontmatter(file, this.app.metadataCache);
      const props = await this.gemini.generateProperties(
        file.name,
        content,
        existing
      );
      await updateFrontmatter(file, this.app.vault, props);
      new import_obsidian6.Notice(`\u2705 ${file.basename} \uD504\uB85C\uD37C\uD2F0 \uC0DD\uC131 \uC644\uB8CC`);
    } catch (e) {
      new import_obsidian6.Notice(`\u274C \uBD84\uC11D \uC2E4\uD328: ${e.message}`);
    }
  }
  /**
   * _context/ 전체 파일 일괄 분석
   */
  async analyzeAllContext() {
    if (!this.gemini) {
      new import_obsidian6.Notice("Gemini API \uD0A4\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
      return;
    }
    const files = this.app.vault.getFiles().filter(
      (f) => f.path.startsWith(CONTEXT_FOLDER + "/") && f.extension === "md"
    );
    if (files.length === 0) {
      new import_obsidian6.Notice("_context/ \uD3F4\uB354\uC5D0 \uB9C8\uD06C\uB2E4\uC6B4 \uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    new import_obsidian6.Notice(`\u{1F50D} ${files.length}\uAC1C \uD30C\uC77C \uBD84\uC11D \uC2DC\uC791...`);
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
    new import_obsidian6.Notice(`\u2705 \uBD84\uC11D \uC644\uB8CC: ${done}\uAC1C \uC131\uACF5, ${failed}\uAC1C \uC2E4\uD328`);
  }
  /**
   * 파일이 자동 분석 대상인지 확인
   */
  shouldAutoAnalyze(file) {
    if (file.extension !== "md")
      return false;
    return file.path.startsWith(CONTEXT_FOLDER + "/") || file.path.startsWith(ANALYSIS_FOLDER + "/");
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
