import { escapeHtmlText } from "./text.ts";
import { formatZonedTimestamp, isZonedIsoTimestamp, type LocaleContext } from "./locale.ts";

export type ComponentKind =
  | "stats"
  | "timeline"
  | "findings"
  | "compare"
  | "callout"
  | "progress"
  | "diff"
  | "copy"
  | "mermaid"
  | "decisions"
  | "table";

export const COMPONENT_KINDS: ReadonlySet<string> = new Set([
  "stats",
  "timeline",
  "findings",
  "compare",
  "callout",
  "progress",
  "diff",
  "copy",
  "mermaid",
  "decisions",
  "table",
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function str(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function num(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function errorBox(kind: string, reason: string): string {
  return `<div class="chart-error" role="alert">${escapeHtmlText(`Component '${kind}' failed to render: ${reason}`)}</div>`;
}

function toneClass(prefix: string, tone: string | undefined, allowed: readonly string[]): string {
  return tone !== undefined && allowed.includes(tone) ? ` ${prefix}-${tone}` : "";
}

const STAT_TONES = ["good", "bad", "warn", "neutral"] as const;
const ITEM_TONES = ["good", "bad", "warn", "info", "neutral"] as const;
const SEVERITIES = ["critical", "high", "medium", "low"] as const;

export interface ComponentIssue {
  code: string;
  reason: string;
  nextAction: string;
}

export interface ComponentRenderContext {
  locale: LocaleContext;
}

const DEFAULT_CONTEXT: ComponentRenderContext = {
  locale: { lang: "en", dir: "ltr", locale: "en-US", timeZone: "UTC" },
};

function mermaidParts(source: string): { summary?: string; body: string } {
  const lines = source.trim().split("\n");
  const match = lines[0]?.match(/^%%\s*summary:\s*(.+)$/i);
  return { summary: match?.[1].trim(), body: match ? lines.slice(1).join("\n").trim() : source.trim() };
}

function issue(code: string, reason: string, nextAction: string): ComponentIssue[] {
  return [{ code, reason, nextAction }];
}

function recordEntries(value: unknown, kind: string): ComponentIssue[] {
  if (!Array.isArray(value)) return issue(`${kind}-shape`, "expected a JSON array", "provide the documented array schema");
  return value.flatMap((entry, index) =>
    asRecord(entry) === undefined
      ? issue(`${kind}-entry`, `entry ${index + 1} must be an object`, "replace non-object entries")
      : [],
  );
}

function requiredStrings(value: unknown[], kind: string, fields: string[]): ComponentIssue[] {
  const issues: ComponentIssue[] = [];
  for (const [index, entry] of value.entries()) {
    const item = asRecord(entry);
    if (!item) continue;
    for (const field of fields) {
      if (typeof item[field] !== "string" || item[field] === "") {
        issues.push(...issue(`${kind}-${field}`, `entry ${index + 1} requires string '${field}'`, `add ${field} to every ${kind} entry`));
      }
    }
  }
  return issues;
}

export function validateComponent(kind: ComponentKind, source: string): ComponentIssue[] {
  if (kind === "diff") return source.trim() === "" ? issue("diff-empty", "diff source is empty", "add unified diff lines") : [];
  if (kind === "mermaid") {
    if (source.trim() === "") return issue("mermaid-empty", "Mermaid source is empty", "add a Mermaid diagram");
    const parsed = mermaidParts(source);
    if (!parsed.summary) return issue("mermaid-summary", "Mermaid diagram needs a text summary", "start with %% summary: followed by the diagram's meaning");
    if (parsed.body === "") return issue("mermaid-empty", "Mermaid diagram body is empty", "add diagram syntax after the summary");
    return [];
  }
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return issue(`${kind}-json`, "component JSON is invalid", "provide valid JSON matching the documented schema");
  }
  if (["stats", "timeline", "findings", "compare"].includes(kind)) {
    const issues = recordEntries(value, kind);
    if (!Array.isArray(value)) return issues;
    const required = kind === "stats" ? ["label", "value"] : kind === "timeline" ? ["time", "title"] : ["title"];
    issues.push(...requiredStrings(value, kind, required));
    for (const [index, entry] of value.entries()) {
      const item = asRecord(entry);
      if (!item) continue;
      if (kind === "findings" && !SEVERITIES.includes(str(item, "severity") as typeof SEVERITIES[number])) {
        issues.push(...issue("findings-severity", `entry ${index + 1} needs an allowlisted severity`, "use critical, high, medium, or low"));
      }
      if (kind === "stats") {
        const direction = str(item, "direction");
        if (direction !== undefined && direction !== "up" && direction !== "down") {
          issues.push(...issue("stats-direction", `entry ${index + 1} direction must be up or down`, "correct or remove direction"));
        }
      }
      if (kind === "compare") {
        const annotations = item["annotations"];
        if (annotations !== undefined && (!Array.isArray(annotations) || annotations.some((note) => typeof note !== "string"))) {
          issues.push(...issue("compare-annotations", `entry ${index + 1} annotations must be strings`, "replace non-string annotations"));
        }
      }
    }
    return issues;
  }
  const item = asRecord(value);
  if (!item) return issue(`${kind}-shape`, "expected a JSON object", "provide the documented object schema");
  if (kind === "callout") {
    const tone = str(item, "tone");
    return tone !== undefined && !ITEM_TONES.includes(tone as typeof ITEM_TONES[number]) ? issue("callout-tone", "tone is not allowlisted", "use good, bad, warn, info, or neutral") : [];
  }
  if (kind === "progress") {
    const done = num(item, "done");
    const total = num(item, "total");
    return done === undefined || total === undefined || total <= 0 || done < 0 || done > total ? issue("progress-range", "done and total must describe a finite range", "use 0 <= done <= total and total > 0") : [];
  }
  if (kind === "copy") return typeof item["text"] !== "string" ? issue("copy-text", "copy text is missing", "add string 'text'") : [];
  if (kind === "decisions") {
    if (!Array.isArray(item["questions"])) return issue("decisions-questions", "questions must be an array", "add the documented questions array");
    const ids = new Set<string>();
    const issues: ComponentIssue[] = [];
    for (const [index, questionValue] of item["questions"].entries()) {
      const question = asRecord(questionValue);
      if (!question || !str(question, "id") || !str(question, "question") || !Array.isArray(question["options"])) {
        issues.push(...issue("decisions-question", `question ${index + 1} needs id, question, and options`, "complete every question object"));
        continue;
      }
      const id = str(question, "id")!;
      if (ids.has(id)) issues.push(...issue("decisions-id", `question id '${id}' is duplicated`, "assign stable unique ids"));
      ids.add(id);
      for (const [optionIndex, optionValue] of question["options"].entries()) {
        const option = asRecord(optionValue);
        if (!option || !str(option, "id") || !str(option, "label")) {
          issues.push(...issue("decisions-option", `question ${index + 1} option ${optionIndex + 1} needs id and label`, "complete every option object"));
        }
      }
    }
    return issues;
  }
  if (kind === "table") {
    if (!Array.isArray(item["columns"]) || !Array.isArray(item["rows"])) return issue("table-shape", "columns and rows must be arrays", "add both documented arrays");
    if (!str(item, "caption")) return issue("table-caption", "table caption is required", "add a concise caption describing the table");
    const keys = new Set<string>();
    const issues: ComponentIssue[] = [];
    const dateColumns: Array<{ key: string; type: "date" | "datetime" }> = [];
    for (const [index, columnValue] of item["columns"].entries()) {
      const column = asRecord(columnValue);
      const key = column && str(column, "key");
      if (!column || !key || !str(column, "label")) {
        issues.push(...issue("table-column", `column ${index + 1} needs key and label`, "complete every column object"));
        continue;
      }
      if (keys.has(key)) issues.push(...issue("table-key", `column key '${key}' is duplicated`, "assign unique column keys"));
      keys.add(key);
      const type = str(column, "type");
      if (type !== undefined && type !== "num" && type !== "date" && type !== "datetime") issues.push(...issue("table-type", `column ${index + 1} type is unsupported`, "use num, date, datetime, or omit type"));
      if (type === "date" || type === "datetime") dateColumns.push({ key, type });
    }
    for (const [index, row] of item["rows"].entries()) {
      const record = asRecord(row);
      if (record === undefined) {
        issues.push(...issue("table-row", `row ${index + 1} must be an object`, "replace non-object rows"));
        continue;
      }
      for (const column of dateColumns) {
        const value = record[column.key];
        if (value !== undefined && (typeof value !== "string" || !isZonedIsoTimestamp(value))) {
          issues.push(...issue("table-date", `row ${index + 1} '${column.key}' needs an ISO timestamp with time zone`, "use a timestamp ending in Z or an explicit offset"));
        }
      }
    }
    return issues;
  }
  return [];
}

function renderStats(spec: unknown): string {
  if (!Array.isArray(spec)) return errorBox("stats", "expected a JSON array");
  const cards = spec.map((entry) => {
    const item = asRecord(entry);
    if (!item) return errorBox("stats", "entries must be objects");
    const label = str(item, "label") ?? "";
    const value = str(item, "value") ?? "";
    const delta = str(item, "delta");
    const direction = str(item, "direction");
    const tone = toneClass("tone", str(item, "tone"), STAT_TONES);
    const emphasis = item["emphasis"] === true ? " stat-emphasis" : "";
    const arrow = direction === "up" ? "▲ " : direction === "down" ? "▼ " : "";
    const pill =
      delta !== undefined
        ? `<span class="delta${toneClass("delta", str(item, "tone"), STAT_TONES)}">${arrow}${escapeHtmlText(delta)}</span>`
        : "";
    return `<div class="stat${tone}${emphasis}"><div class="stat-value">${escapeHtmlText(value)}</div><div class="stat-label">${escapeHtmlText(label)}</div>${pill}</div>`;
  });
  return `<div class="stat-grid">${cards.join("")}</div>`;
}

function renderTimeline(spec: unknown): string {
  if (!Array.isArray(spec)) return errorBox("timeline", "expected a JSON array");
  const items = spec.map((entry) => {
    const item = asRecord(entry);
    if (!item) return errorBox("timeline", "entries must be objects");
    const tone = toneClass("dot", str(item, "tone"), ITEM_TONES);
    const time = str(item, "time");
    const title = str(item, "title") ?? "";
    const detail = str(item, "detail");
    return [
      `<li class="tl-item"><span class="tl-dot${tone}"></span>`,
      time !== undefined ? `<span class="tl-time">${escapeHtmlText(time)}</span>` : "",
      `<div class="tl-body"><div class="tl-title">${escapeHtmlText(title)}</div>`,
      detail !== undefined ? `<div class="tl-detail">${escapeHtmlText(detail)}</div>` : "",
      "</div></li>",
    ].join("");
  });
  return `<ol class="timeline">${items.join("")}</ol>`;
}

function renderFindings(spec: unknown): string {
  if (!Array.isArray(spec)) return errorBox("findings", "expected a JSON array");
  const rows = spec.map((entry) => {
    const item = asRecord(entry);
    if (!item) return errorBox("findings", "entries must be objects");
    const severityRaw = str(item, "severity") ?? "info";
    const severity = (SEVERITIES as readonly string[]).includes(severityRaw) ? severityRaw : "medium";
    const title = str(item, "title") ?? "";
    const location = str(item, "location");
    const detail = str(item, "detail");
    return [
      `<div class="finding"><span class="sev sev-${severity}">${escapeHtmlText(severityRaw.toUpperCase())}</span>`,
      `<div class="finding-body"><div class="finding-title">${escapeHtmlText(title)}</div>`,
      location !== undefined
        ? `<code class="finding-loc">${escapeHtmlText(location)}</code>`
        : "",
      detail !== undefined
        ? `<div class="finding-detail">${escapeHtmlText(detail)}</div>`
        : "",
      "</div></div>",
    ].join("");
  });
  return `<div class="findings">${rows.join("")}</div>`;
}

function renderCompare(spec: unknown): string {
  if (!Array.isArray(spec)) return errorBox("compare", "expected a JSON array");
  const cards = spec.map((entry) => {
    const item = asRecord(entry);
    if (!item) return errorBox("compare", "entries must be objects");
    const title = str(item, "title") ?? "";
    const pill = toneClass("pill", str(item, "pill"), ["bad", "info", "warn", "good", "neutral"]);
    const annotations = Array.isArray(item["annotations"]) ? item["annotations"] : [];
    const notes = annotations
      .map((note) => `<li>${escapeHtmlText(typeof note === "string" ? note : String(note))}</li>`)
      .join("");
    const tradeoff = str(item, "tradeoff");
    return [
      `<div class="variant"><span class="pill${pill}">${escapeHtmlText(title)}</span>`,
      notes.length > 0 ? `<ol class="annotations">${notes}</ol>` : "",
      tradeoff !== undefined
        ? `<p class="tradeoff">${escapeHtmlText(tradeoff)}</p>`
        : "",
      "</div>",
    ].join("");
  });
  return `<div class="compare-grid">${cards.join("")}</div>`;
}

function renderCallout(spec: unknown): string {
  const item = asRecord(spec);
  if (!item) return errorBox("callout", "expected a JSON object");
  const tone = toneClass("callout", str(item, "tone"), ITEM_TONES);
  const title = str(item, "title");
  const body = str(item, "body");
  return [
    `<div class="callout${tone}">`,
    title !== undefined ? `<div class="callout-title">${escapeHtmlText(title)}</div>` : "",
    body !== undefined ? `<div class="callout-body">${escapeHtmlText(body)}</div>` : "",
    "</div>",
  ].join("");
}

function renderProgress(spec: unknown): string {
  const item = asRecord(spec);
  if (!item) return errorBox("progress", "expected a JSON object");
  const done = num(item, "done");
  const total = num(item, "total");
  if (done === undefined || total === undefined || total <= 0) {
    return errorBox("progress", "expected numeric 'done' and a positive 'total'");
  }
  const label = str(item, "label");
  const percent = Math.min(100, Math.round((done / total) * 100));
  return [
    `<div class="progress" role="progressbar" aria-label="${escapeHtmlText(label ?? "Progress")}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}">`,
    `<div class="progress-label">${escapeHtmlText(label ?? "Progress")} — ${done}/${total}</div>`,
    `<div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>`,
    "</div>",
  ].join("");
}

function renderDiff(source: string): string {
  const rows = source.split("\n").map((line) => {
    const escaped = escapeHtmlText(line);
    if (line.startsWith("## note:")) {
      return `<div class="dl dl-note">${escapeHtmlText(line.slice("## note:".length).trim())}</div>`;
    }
    if (line.startsWith("@@")) return `<div class="dl dl-hunk">${escaped}</div>`;
    if (line.startsWith("+")) return `<div class="dl dl-add">${escaped}</div>`;
    if (line.startsWith("-")) return `<div class="dl dl-del">${escaped}</div>`;
    return `<div class="dl dl-ctx">${escaped === "" ? " " : escaped}</div>`;
  });
  return `<div class="diff">${rows.join("")}</div>`;
}

function renderCopy(spec: unknown, id: string | undefined): string {  const item = asRecord(spec);
  if (!item) return errorBox("copy", "expected a JSON object");
  const text = str(item, "text");
  if (text === undefined) return errorBox("copy", "missing 'text'");
  const target = id ?? "copy-0";
  const label = str(item, "label") ?? "Copy";
  return [
    `<span class="copy-wrap"><button type="button" class="copy-btn" data-copy-target="${escapeHtmlText(target)}">${escapeHtmlText(label)}</button>`,
    `<template id="${escapeHtmlText(target)}">${escapeHtmlText(text)}</template>`,
    '<span class="copy-note" aria-live="polite"></span></span>',
  ].join("");
}

function renderMermaid(source: string): string {
  const parsed = mermaidParts(source);
  if (!parsed.summary || parsed.body === "") return errorBox("mermaid", "missing summary or diagram source");
  return `<figure class="diagram-frame"><pre class="mermaid" role="img" aria-label="${escapeHtmlText(parsed.summary)}">${escapeHtmlText(parsed.body)}</pre><figcaption class="diagram-summary">${escapeHtmlText(parsed.summary)}</figcaption></figure>`;
}

function renderDecisions(spec: unknown): string {
  const item = asRecord(spec);
  if (!item) return errorBox("decisions", "expected a JSON object");
  const questions = item["questions"];
  if (!Array.isArray(questions)) return errorBox("decisions", "missing 'questions' array");

  const blocks = questions.map((entry, questionIndex) => {
    const question = asRecord(entry);
    if (!question) return errorBox("decisions", "questions must be objects");
    const qid = str(question, "id") ?? "q";
    const text = str(question, "question") ?? "";
    const options = Array.isArray(question["options"]) ? question["options"] : [];
    const groupId = `decision-question-${questionIndex}`;
    const buttons = options
      .map((optEntry, optionIndex) => {
        const opt = asRecord(optEntry);
        if (!opt) return "";
        const oid = str(opt, "id") ?? "opt";
        const label = str(opt, "label") ?? "";
        const note = str(opt, "note");
        return [
          `<button type="button" class="decision-opt" role="radio" aria-checked="false" tabindex="${optionIndex === 0 ? "0" : "-1"}" data-question="${escapeHtmlText(qid)}" data-option="${escapeHtmlText(oid)}">`,
          `<span class="decision-label">${escapeHtmlText(label)}</span>`,
          note !== undefined
            ? `<span class="decision-note">${escapeHtmlText(note)}</span>`
            : "",
          "</button>",
        ].join("");
      })
      .join("");
    return [
      '<div class="decision">',
      `<div class="decision-question" id="${groupId}">${escapeHtmlText(text)}</div>`,
      `<div class="decision-options" role="radiogroup" aria-labelledby="${groupId}">${buttons}</div>`,
      "</div>",
    ].join("");
  });

  const title = str(item, "title");
  return [
    '<div class="decisions">',
    title !== undefined ? `<div class="decisions-title">${escapeHtmlText(title)}</div>` : "",
    blocks.join(""),
    '<div class="decisions-hint">Selections are saved on this page; when served, they persist for the session to read back.</div>',
    "</div>",
  ].join("");
}

function renderTable(spec: unknown, context: ComponentRenderContext, id: string | undefined): string {
  const item = asRecord(spec);
  if (!item) return errorBox("table", "expected a JSON object");
  const columns = item["columns"];
  const rows = item["rows"];
  if (!Array.isArray(columns) || !Array.isArray(rows)) {
    return errorBox("table", "expected 'columns' and 'rows' arrays");
  }

  const cols = columns.map((entry) => {
    const col = asRecord(entry);
    if (!col) return undefined;
    const key = str(col, "key");
    const label = str(col, "label");
    if (!key || !label) return undefined;
    const rawType = str(col, "type");
    const type = rawType === "num" || rawType === "date" || rawType === "datetime" ? rawType : "text";
    return { key, label, type };
  });
  if (cols.some((c) => c === undefined)) {
    return errorBox("table", "each column needs 'key' and 'label'");
  }

  const head = cols
    .map(
      (c) =>
        `<th scope="col" aria-sort="none" data-type="${c!.type}"${c!.type === "num" ? ' class="num"' : ""}><button type="button" class="th-sort" aria-label="Sort by ${escapeHtmlText(c!.label)}">${escapeHtmlText(c!.label)}</button></th>`,
    )
    .join("");

  const body = rows
    .map((row) => {
      const record = asRecord(row) ?? {};
      const cells = cols
        .map((c) => {
          const raw = record[c!.key];
          const isNum = c!.type === "num" && typeof raw === "number" && Number.isFinite(raw);
          const isDate = (c!.type === "date" || c!.type === "datetime") && typeof raw === "string";
          const formattedDate = isDate ? formatZonedTimestamp(raw, context.locale, c!.type === "datetime") : undefined;
          const display = isNum
            ? new Intl.NumberFormat(context.locale.locale).format(raw)
            : formattedDate !== undefined
              ? `<time datetime="${escapeHtmlText(String(raw))}">${escapeHtmlText(formattedDate)}</time>`
              : escapeHtmlText(raw === undefined || raw === null ? "—" : String(raw));
          const dataV = isNum ? ` data-v="${raw}"` : ` data-v="${escapeHtmlText(String(raw ?? ""))}"`;
          return `<td${c!.type === "num" ? ' class="num"' : ""}${dataV}>${display}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("\n");

  const caption = str(item, "caption");
  const tableId = escapeHtmlText(id ?? "table-0");
  const countId = `${tableId}-count`;
  return [
    '<div class="table-wrap">',
    `<label class="sr-only" for="${tableId}-filter">Filter ${escapeHtmlText(caption ?? "table")} rows</label>`,
    `<input id="${tableId}-filter" class="table-filter" type="search" placeholder="Filter rows…" aria-describedby="${countId}">`,
    `<div class="table-scroll"><table class="data-table" aria-describedby="${countId}"><caption>${escapeHtmlText(caption ?? "Table")}</caption><thead><tr>${head}</tr></thead>`,
    `<tbody>${body}</tbody></table></div>`,
    `<div class="table-meta"><span id="${countId}" class="table-count" role="status" aria-live="polite">${rows.length} rows</span></div>`,
    "</div>",
  ].join("\n");
}

export function renderComponent(kind: ComponentKind, json: string, id?: string, context: ComponentRenderContext = DEFAULT_CONTEXT): string {
  const issues = validateComponent(kind, json);
  if (issues.length > 0) return errorBox(kind, issues[0].reason);
  if (kind === "diff") return renderDiff(json);
  if (kind === "mermaid") return renderMermaid(json);
  let spec: unknown;
  try {
    spec = JSON.parse(json);
  } catch (err) {
    return errorBox(kind, err instanceof Error ? err.message : String(err));
  }
  switch (kind) {
    case "stats":
      return renderStats(spec);
    case "timeline":
      return renderTimeline(spec);
    case "findings":
      return renderFindings(spec);
    case "compare":
      return renderCompare(spec);
    case "callout":
      return renderCallout(spec);
    case "progress":
      return renderProgress(spec);
    case "copy":
      return renderCopy(spec, id);
    case "decisions":
      return renderDecisions(spec);
    case "table":
      return renderTable(spec, context, id);
  }
}
