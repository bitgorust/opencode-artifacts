import { escapeHtmlText } from "./text.ts";

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
  | "decisions";

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
  return `<div class="chart-error">${escapeHtmlText(`Component '${kind}' failed to render: ${reason}`)}</div>`;
}

function toneClass(prefix: string, tone: string | undefined, allowed: readonly string[]): string {
  return tone !== undefined && allowed.includes(tone) ? ` ${prefix}-${tone}` : "";
}

const STAT_TONES = ["good", "bad", "warn", "neutral"] as const;
const ITEM_TONES = ["good", "bad", "warn", "info", "neutral"] as const;
const SEVERITIES = ["critical", "high", "medium", "low"] as const;

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
    '<div class="progress">',
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
  const trimmed = source.trim();
  if (trimmed === "") return errorBox("mermaid", "empty diagram source");
  return `<pre class="mermaid">${escapeHtmlText(trimmed)}</pre>`;
}

function renderDecisions(spec: unknown): string {
  const item = asRecord(spec);
  if (!item) return errorBox("decisions", "expected a JSON object");
  const questions = item["questions"];
  if (!Array.isArray(questions)) return errorBox("decisions", "missing 'questions' array");

  const blocks = questions.map((entry) => {
    const question = asRecord(entry);
    if (!question) return errorBox("decisions", "questions must be objects");
    const qid = str(question, "id") ?? "q";
    const text = str(question, "question") ?? "";
    const options = Array.isArray(question["options"]) ? question["options"] : [];
    const buttons = options
      .map((optEntry) => {
        const opt = asRecord(optEntry);
        if (!opt) return "";
        const oid = str(opt, "id") ?? "opt";
        const label = str(opt, "label") ?? "";
        const note = str(opt, "note");
        return [
          `<button type="button" class="decision-opt" data-question="${escapeHtmlText(qid)}" data-option="${escapeHtmlText(oid)}">`,
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
      `<div class="decision-question">${escapeHtmlText(text)}</div>`,
      `<div class="decision-options" role="group">${buttons}</div>`,
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

export function renderComponent(kind: ComponentKind, json: string, id?: string): string {
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
  }
}
