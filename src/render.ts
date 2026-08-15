import { compile as compileVegaLite } from "vega-lite";
import { parseDocument, type ChartSpec, type Frontmatter } from "./markdown.ts";
import { renderComponent } from "./components.ts";
import { runtimeBundle, type RuntimeName } from "./runtime.ts";
import { escapeHtmlText, slugify } from "./text.ts";

export { escapeHtmlText } from "./text.ts";

export const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
export const FOOTER_PLACEHOLDER = "<!--artifact:footer-->";

export class ArtifactTooLargeError extends Error {
  readonly bytes: number;
  readonly maxBytes: number;
  constructor(bytes: number, maxBytes: number) {
    super(`artifact is ${bytes} bytes, exceeding the ${maxBytes}-byte cap`);
    this.name = "ArtifactTooLargeError";
    this.bytes = bytes;
    this.maxBytes = maxBytes;
  }
}

export interface RenderOptions {
  maxBytes?: number;
}

export interface RenderedArtifact {
  html: string;
  meta: Frontmatter;
  chartCount: number;
}

type ResolvedKind = "vega" | "echarts";

interface ResolvedChart {
  kind: ResolvedKind;
  spec?: unknown;
  error?: string;
}

export const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "connect-src 'none'",
].join("; ");

export const ARTIFACT_CSS = `:root{color-scheme:light dark;
--page-bg:#e9edf2;--card-bg:#ffffff;--ink:#111827;--ink-2:#4b5563;--ink-3:#9ca3af;--line:#e5e7eb;
--accent:#6d6bd6;--good:#2f9e6e;--good-bg:#e4f4ec;--bad:#d64550;--bad-bg:#fdeeee;
--warn:#b45309;--warn-bg:#fdf0dc;--info:#33526e;--info-bg:#dce6f2;
--card-info-bg:#e3eaf4;--card-warn-bg:#fdeccd;--code-bg:#f3f4f6;
--radius:16px;--shadow:0 1px 3px rgb(15 23 42/.06)}
@media (prefers-color-scheme: dark){:root{
--page-bg:#151a21;--card-bg:#1f2630;--ink:#e5e7eb;--ink-2:#9ca3af;--ink-3:#6b7280;--line:#333d4d;
--good:#4ade80;--good-bg:#14312a;--bad:#f87171;--bad-bg:#3a2226;--warn:#fbbf24;--warn-bg:#3a2f16;
--info:#7ea4c7;--info-bg:#1e2c3d;--card-info-bg:#1e2c3d;--card-warn-bg:#3a2f16;--code-bg:#262e3a;
--shadow:0 1px 3px rgb(0 0 0/.4)}}
body{margin:0;background:var(--page-bg);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.6}
.artifact-header{display:flex;align-items:center;gap:.6rem;padding:.9rem 1.5rem;background:var(--card-bg);border-bottom:1px solid var(--line)}
.artifact-header h1{font-size:1.1rem;margin:0;letter-spacing:-.01em}
.artifact-icon{font-size:1.25rem}
.artifact-body{max-width:1080px;margin:0 auto;padding:1.5rem 1.5rem 3rem}
.artifact-body>*:first-child{margin-top:0}
.artifact-footer{max-width:1080px;margin:0 auto;padding:1rem 1.5rem 2rem;font-size:.8rem;color:var(--ink-3)}
.artifact-footer a{color:inherit}
.section-card{background:var(--card-bg);border-radius:var(--radius);box-shadow:var(--shadow);padding:1.5rem 1.75rem;margin:1.25rem 0}
.section-card> :first-child{margin-top:0}
h2{font-size:1.35rem;font-weight:700;letter-spacing:-.015em;margin:0 0 1rem}
h3{font-size:1.05rem;margin:1.25rem 0 .5rem}
p{margin:.6rem 0}
pre{background:var(--code-bg);padding:.75rem 1rem;overflow:auto;border-radius:10px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em}
p code,li code,td code{background:var(--code-bg);padding:.1em .35em;border-radius:5px}
.chart{margin:1rem 0;min-height:320px}
.chart-error{padding:.75rem 1rem;border:1px solid var(--bad);border-radius:10px;color:var(--bad);background:var(--bad-bg);margin:1rem 0}
table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:.92rem}
th{text-align:left;background:var(--code-bg);font-weight:600}
td,th{border:1px solid var(--line);padding:.45rem .7rem}
img{max-width:100%}
a{color:var(--accent)}
blockquote{margin:1rem 0;padding:.25rem 1rem;border-left:3px solid var(--line);color:var(--ink-2)}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin:1.25rem 0}
.stat{background:var(--card-bg);border-radius:var(--radius);box-shadow:var(--shadow);padding:1.1rem 1.25rem}
.stat-emphasis.tone-bad{background:var(--bad-bg)}
.stat-emphasis.tone-good{background:var(--good-bg)}
.stat-value{font-size:1.75rem;font-weight:750;letter-spacing:-.02em;line-height:1.15}
.stat-label{margin-top:.15rem;font-size:.68rem;font-weight:600;letter-spacing:.08em;color:var(--ink-2)}
.delta{display:inline-block;margin-top:.5rem;padding:.15rem .6rem;border-radius:999px;font-size:.72rem;font-weight:600;background:var(--code-bg);color:var(--ink-2)}
.delta-good{background:var(--good-bg);color:var(--good)}
.delta-bad{background:var(--bad-bg);color:var(--bad)}
.delta-warn{background:var(--warn-bg);color:var(--warn)}
.timeline{list-style:none;margin:1rem 0;padding:0}
.tl-item{display:flex;gap:.9rem;position:relative;padding:0 0 1.1rem .25rem}
.tl-item::before{content:"";position:absolute;left:.68rem;top:1.1rem;bottom:-.1rem;width:2px;background:var(--line)}
.tl-item:last-child::before{display:none}
.tl-dot{flex:none;width:.85rem;height:.85rem;border-radius:50%;background:var(--ink-3);margin-top:.35rem;z-index:1}
.dot-bad{background:var(--bad)}.dot-good{background:var(--good)}.dot-warn{background:var(--warn)}.dot-info{background:var(--info)}
.tl-time{flex:none;width:4.2rem;font-family:ui-monospace,Menlo,monospace;font-size:.82rem;color:var(--ink-2);padding-top:.1rem}
.tl-title{font-weight:600}
.tl-detail{font-size:.9rem;color:var(--ink-2)}
.findings{display:flex;flex-direction:column;gap:.75rem;margin:1rem 0}
.finding{display:flex;gap:.9rem;background:var(--card-bg);border:1px solid var(--line);border-radius:12px;padding:.9rem 1.1rem}
.section-card .finding{background:var(--page-bg)}
.sev{flex:none;align-self:flex-start;padding:.15rem .55rem;border-radius:999px;font-size:.68rem;font-weight:700;letter-spacing:.05em}
.sev-critical{background:var(--bad-bg);color:var(--bad)}
.sev-high{background:var(--bad-bg);color:var(--bad)}
.sev-medium{background:var(--warn-bg);color:var(--warn)}
.sev-low{background:var(--info-bg);color:var(--info)}
.finding-title{font-weight:600}
.finding-loc{font-size:.8rem;color:var(--ink-2)}
.finding-detail{font-size:.9rem;color:var(--ink-2);margin-top:.15rem}
.compare-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;margin:1.25rem 0}
.variant{background:var(--card-bg);border-radius:var(--radius);box-shadow:var(--shadow);padding:1.1rem 1.25rem;display:flex;flex-direction:column}
.section-card .variant{background:var(--page-bg)}
.pill{align-self:flex-start;padding:.25rem .8rem;border-radius:999px;font-size:.78rem;font-weight:650;background:var(--code-bg);color:var(--ink)}
.pill-bad{background:var(--bad-bg);color:var(--bad)}
.pill-info{background:var(--info-bg);color:var(--info)}
.pill-warn{background:var(--warn-bg);color:var(--warn)}
.pill-good{background:var(--good-bg);color:var(--good)}
.annotations{margin:.9rem 0 0;padding:0;list-style:none;counter-reset:note}
.annotations li{counter-increment:note;position:relative;padding-left:1.6rem;margin:.4rem 0;font-size:.9rem}
.annotations li::before{content:counter(note);position:absolute;left:0;top:.1rem;width:1.05rem;height:1.05rem;border-radius:50%;background:var(--ink);color:var(--card-bg);font-size:.65rem;font-weight:700;display:flex;align-items:center;justify-content:center}
.tradeoff{margin:.9rem 0 0;font-size:.85rem;font-style:italic;color:var(--ink-2);border-top:1px solid var(--line);padding-top:.6rem}
.callout{border-radius:var(--radius);padding:1.25rem 1.5rem;margin:1.25rem 0;background:var(--card-info-bg)}
.callout-warn{background:var(--card-warn-bg)}
.callout-bad{background:var(--bad-bg)}
.callout-good{background:var(--good-bg)}
.callout-neutral{background:var(--code-bg)}
.callout-title{font-size:1.15rem;font-weight:700;letter-spacing:-.01em}
.callout-body{margin-top:.35rem;font-size:.95rem}
.alert{border-radius:10px;padding:.75rem 1rem;margin:1rem 0;border:1px solid var(--line);background:var(--card-bg)}
.alert p{margin:.25rem 0}
.alert-title{font-weight:650;font-size:.85rem}
.alert-info{border-color:var(--info);background:var(--info-bg)}
.alert-good{border-color:var(--good);background:var(--good-bg)}
.alert-warn{border-color:var(--warn);background:var(--warn-bg)}
.alert-bad{border-color:var(--bad);background:var(--bad-bg)}
li.task{list-style:none}
li.task input{margin-right:.45rem;accent-color:var(--accent)}
.copy-wrap{display:inline-flex;align-items:center;gap:.55rem;margin:.25rem 0}
.copy-btn{background:var(--accent);color:#fff;border:none;border-radius:8px;padding:.45rem 1rem;font-size:.85rem;font-weight:600;cursor:pointer}
.copy-btn:hover{filter:brightness(1.08)}
.copy-note{font-size:.8rem;color:var(--good)}
pre.mermaid{background:var(--card-bg);border:1px solid var(--line);border-radius:10px;padding:1rem;text-align:center}
.section-card pre.mermaid{background:var(--page-bg)}
.decisions{margin:1.25rem 0}
.decisions-title{font-weight:700;font-size:1.05rem;margin-bottom:.75rem}
.decision{margin:0 0 1rem}
.decision-question{font-weight:600;margin-bottom:.5rem}
.decision-options{display:flex;flex-direction:column;gap:.5rem}
.decision-opt{display:flex;flex-direction:column;gap:.15rem;text-align:left;background:var(--card-bg);border:1px solid var(--line);border-radius:10px;padding:.7rem 1rem;font-size:.92rem;color:var(--ink);cursor:pointer}
.section-card .decision-opt{background:var(--page-bg)}
.decision-opt:hover{border-color:var(--accent)}
.decision-opt.selected{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.decision-opt.selected .decision-label{font-weight:650;color:var(--accent)}
.decision-note{font-size:.82rem;color:var(--ink-2)}
.decisions-hint{font-size:.78rem;color:var(--ink-3);margin-top:.5rem}
.comments-dock{position:fixed;right:1rem;bottom:1rem;width:300px;max-height:45vh;overflow:auto;background:var(--card-bg);border:1px solid var(--line);border-radius:12px;box-shadow:0 6px 24px rgb(15 23 42/.14);padding:.75rem .9rem;z-index:10;font-size:.85rem}
.comments-title{font-weight:700;margin-bottom:.4rem}
.comment{border-top:1px solid var(--line);padding:.45rem 0}
.comment-quote{font-size:.75rem;color:var(--ink-3);border-left:2px solid var(--accent);padding-left:.45rem;margin-bottom:.2rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.comment-text{white-space:pre-wrap}
.comment-empty{color:var(--ink-3);font-size:.78rem}
.comment-resolve{margin-top:.3rem;background:none;border:1px solid var(--line);border-radius:6px;padding:.15rem .55rem;font-size:.75rem;cursor:pointer;color:var(--ink-2)}
.comment-resolve:hover{border-color:var(--good);color:var(--good)}
.comment-pop{z-index:20;background:var(--accent);color:#fff;border:none;border-radius:999px;padding:.3rem .8rem;font-size:.78rem;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgb(15 23 42/.2)}
.comment-form{position:fixed;right:1rem;bottom:1rem;width:320px;background:var(--card-bg);border:1px solid var(--line);border-radius:12px;box-shadow:0 6px 24px rgb(15 23 42/.14);padding:.9rem;z-index:21}
.comment-input{width:100%;min-height:4.5rem;margin:.5rem 0;border:1px solid var(--line);border-radius:8px;padding:.45rem;font:inherit;background:var(--page-bg);color:var(--ink)}
.comment-save{background:var(--accent);color:#fff;border:none;border-radius:8px;padding:.35rem .9rem;font-weight:600;cursor:pointer}
.comment-cancel{background:none;border:1px solid var(--line);border-radius:8px;padding:.35rem .9rem;margin-left:.4rem;cursor:pointer;color:var(--ink-2)}
.progress{margin:1.25rem 0}
.progress-label{font-size:.85rem;font-weight:600;margin-bottom:.4rem}
.progress-track{height:.55rem;border-radius:999px;background:var(--code-bg);overflow:hidden}
.progress-fill{height:100%;border-radius:999px;background:var(--accent)}
.diff{background:var(--code-bg);border-radius:10px;overflow:auto;margin:1rem 0;font-family:ui-monospace,Menlo,monospace;font-size:.82rem;line-height:1.5}
.dl{padding:0 .9rem;white-space:pre}
.dl-add{background:var(--good-bg);color:var(--good)}
.dl-del{background:var(--bad-bg);color:var(--bad)}
.dl-hunk{color:var(--ink-3);padding-top:.4rem}
.dl-note{background:var(--info-bg);color:var(--info);font-style:italic;padding:.35rem .9rem}
.gallery{max-width:1080px;margin:0 auto;padding:1.5rem;display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.card{display:block;background:var(--card-bg);border-radius:var(--radius);box-shadow:var(--shadow);padding:1rem 1.25rem;text-decoration:none;color:inherit}
.card:hover{box-shadow:0 4px 14px rgb(15 23 42/.12)}
.card h2{margin:.2rem 0 .4rem;font-size:1.05rem}
.card .meta{font-size:.8rem;color:var(--ink-2)}
.card .desc{font-size:.85rem;color:var(--ink-2);margin:.1rem 0 .4rem}
.card .icon{font-size:1.6rem}
.gallery-empty{color:var(--ink-3);text-align:center;padding:3rem 0}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media print{body{background:#fff}.section-card,.stat,.variant,.card{box-shadow:none;border:1px solid #ddd}}`;

const THEME_CSS: Record<string, string> = {
  report: `:root{color-scheme:light;--page-bg:#f6f0e4;--card-bg:#fffdf7;--ink:#2b251a;--ink-2:#6b5f49;--ink-3:#a29378;--line:#e3d9c4;--accent:#b4541e;--code-bg:#f1e9d8}
h2,.callout-title,.stat-value{font-family:Georgia,Charter,"Times New Roman",serif}`,
  ops: `:root{color-scheme:dark;--page-bg:#0f140f;--card-bg:#171f17;--ink:#d5e5cf;--ink-2:#8fa389;--ink-3:#5c6b57;--line:#263026;--accent:#4ade80;--code-bg:#131c13;--good:#4ade80;--good-bg:#14311f;--bad:#f87171;--bad-bg:#3a1d1d;--warn:#fbbf24;--warn-bg:#3a2f16;--info:#7ea4c7;--info-bg:#1c2a38;--card-info-bg:#1c2a38;--card-warn-bg:#33290f}
h2,.callout-title{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0}`,
  editorial: `:root{color-scheme:light;--page-bg:#fafafa;--card-bg:#ffffff;--ink:#141414;--ink-2:#525252;--ink-3:#a3a3a3;--line:#e5e5e5;--accent:#141414;--code-bg:#f5f5f5;--radius:4px;--shadow:none}
h2{font-family:Georgia,Charter,"Times New Roman",serif;font-size:1.6rem;font-weight:500}
.section-card,.stat,.variant,.card{border:1px solid var(--line)}
.artifact-header h1{font-family:Georgia,Charter,"Times New Roman",serif;font-size:1.35rem;font-weight:500}`,
};

const BOOT = `(function () {
  var charts = window.__ARTIFACT_CHARTS__ || [];
  charts.forEach(function (entry, i) {
    var el = document.querySelector('[data-chart-index="' + i + '"]');
    if (!el) return;
    function fail(message) {
      el.textContent = "";
      var box = document.createElement("div");
      box.className = "chart-error";
      box.textContent = "Chart failed to render: " + message;
      el.appendChild(box);
    }
    if (entry.error) { fail(entry.error); return; }
    try {
      if (entry.kind === "vega") {
        window.vegaEmbed(el, entry.spec, { actions: false, ast: true });
      } else if (entry.kind === "echarts") {
        var chart = window.echarts.init(el);
        chart.setOption(entry.spec);
        window.addEventListener("resize", function () { chart.resize(); });
      }
    } catch (err) {
      fail(err && err.message ? err.message : String(err));
    }
  });
  var mermaidEls = document.querySelectorAll("pre.mermaid");
  if (window.mermaid && mermaidEls.length > 0) {
    var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    window.mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral" });
    Promise.resolve(window.mermaid.run({ nodes: mermaidEls })).catch(function (err) {
      mermaidEls.forEach(function (el) {
        if (el.querySelector("svg")) return;
        el.textContent = "";
        var box = document.createElement("div");
        box.className = "chart-error";
        box.textContent = "Diagram failed to render: " + (err && err.message ? err.message : String(err));
        el.appendChild(box);
      });
    });
  }
  function feedback(note, msg) {
    if (!note) return;
    note.textContent = msg;
    setTimeout(function () { note.textContent = ""; }, 1600);
  }
  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest(".copy-btn") : null;
    if (btn) {
      var tpl = document.getElementById(btn.getAttribute("data-copy-target"));
      var wrap = btn.parentNode;
      var note = wrap ? wrap.querySelector(".copy-note") : null;
      if (!tpl) return;
      var text = (tpl.content ? tpl.content.textContent : tpl.textContent) || "";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { feedback(note, "Copied"); },
          function () { feedback(note, "Copy blocked - select manually"); },
        );
      } else {
        feedback(note, "Clipboard unavailable");
      }
      return;
    }
    var opt = ev.target && ev.target.closest ? ev.target.closest(".decision-opt") : null;
    if (!opt) return;
    var q = opt.getAttribute("data-question");
    var o = opt.getAttribute("data-option");
    var group = opt.parentNode;
    if (group) {
      var peers = group.querySelectorAll(".decision-opt");
      for (var i = 0; i < peers.length; i++) peers[i].classList.remove("selected");
    }
    opt.classList.add("selected");
    var stateKey = "artifact-decisions:" + location.pathname;
    var state = {};
    try { state = JSON.parse(localStorage.getItem(stateKey) || "{}"); } catch (e) {}
    state[q] = o;
    try { localStorage.setItem(stateKey, JSON.stringify(state)); } catch (e) {}
    if (window.__ARTIFACT_STATE_URL__) {
      var slug = decodeURIComponent(location.pathname.split("/").pop() || "").replace(/\.html$/, "");
      fetch(window.__ARTIFACT_STATE_URL__ + "/" + encodeURIComponent(slug), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: state }),
      }).catch(function () {});
    }
  });
  try {
    var saved = JSON.parse(localStorage.getItem("artifact-decisions:" + location.pathname) || "{}");
    Object.keys(saved).forEach(function (q) {
      var el = document.querySelector('.decision-opt[data-question="' + q + '"][data-option="' + saved[q] + '"]');
      if (el) el.classList.add("selected");
    });
  } catch (e) {}

  var commentsKey = "artifact-comments:" + location.pathname;
  function commentsUrl() { return window.__ARTIFACT_COMMENTS_URL__ || null; }
  var threads = [];
  var dock = null;
  var popBtn = null;
  var form = null;

  function slugFromPath() {
    return decodeURIComponent(location.pathname.split("/").pop() || "").replace(/\.html$/, "");
  }
  function make(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(commentsKey) || "[]"); } catch (e) { return []; }
  }
  function persist() {
    var url = commentsUrl();
    if (url) {
      fetch(url + "/" + encodeURIComponent(slugFromPath()), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threads: threads }),
      }).catch(function () {});
    } else {
      try { localStorage.setItem(commentsKey, JSON.stringify(threads)); } catch (e) {}
    }
  }
  function renderDock() {
    if (!dock) {
      dock = make("div", "comments-dock");
      document.body.appendChild(dock);
    }
    dock.textContent = "";
    var open = threads.filter(function (t) { return !t.resolved; });
    dock.appendChild(make("div", "comments-title", "Comments (" + open.length + ")"));
    open.forEach(function (t) {
      var item = make("div", "comment");
      item.appendChild(make("div", "comment-quote", t.quote));
      item.appendChild(make("div", "comment-text", t.text));
      var resolveBtn = make("button", "comment-resolve", "Resolve");
      resolveBtn.setAttribute("data-id", t.id);
      item.appendChild(resolveBtn);
      dock.appendChild(item);
    });
    if (open.length === 0) dock.appendChild(make("div", "comment-empty", "Select text on the page to comment."));
  }
  function hidePop() {
    if (popBtn && popBtn.parentNode) popBtn.parentNode.removeChild(popBtn);
    popBtn = null;
  }
  function closeForm() {
    if (form && form.parentNode) form.parentNode.removeChild(form);
    form = null;
  }
  document.addEventListener("mouseup", function () {
    setTimeout(function () {
      var sel = window.getSelection();
      var main = document.querySelector(".artifact-body");
      if (!sel || sel.isCollapsed || !main || !main.contains(sel.anchorNode)) { hidePop(); return; }
      var rect = sel.getRangeAt(0).getBoundingClientRect();
      hidePop();
      popBtn = make("button", "comment-pop", "Comment");
      popBtn.style.position = "fixed";
      popBtn.style.left = Math.min(rect.left, window.innerWidth - 90) + "px";
      popBtn.style.top = rect.bottom + 6 + "px";
      popBtn.setAttribute("data-quote", sel.toString().slice(0, 200));
      document.body.appendChild(popBtn);
    }, 10);
  });
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.classList) return;
    if (t.classList.contains("comment-pop")) {
      closeForm();
      form = make("div", "comment-form");
      form.appendChild(make("div", "comment-quote", t.getAttribute("data-quote") || ""));
      form.appendChild(make("textarea", "comment-input"));
      form.appendChild(make("button", "comment-save", "Save"));
      form.appendChild(make("button", "comment-cancel", "Cancel"));
      document.body.appendChild(form);
      var input = form.querySelector(".comment-input");
      if (input) input.focus();
      hidePop();
      return;
    }
    if (t.classList.contains("comment-save") && form) {
      var ta = form.querySelector(".comment-input");
      var q = form.querySelector(".comment-quote");
      var text = ta ? ta.value.trim() : "";
      if (text !== "") {
        threads.push({
          id: Date.now().toString(36),
          quote: q ? q.textContent : "",
          text: text,
          createdAt: new Date().toISOString(),
          resolved: false,
        });
        persist();
        renderDock();
      }
      closeForm();
      return;
    }
    if (t.classList.contains("comment-cancel")) { closeForm(); return; }
    if (t.classList.contains("comment-resolve")) {
      var id = t.getAttribute("data-id");
      threads.forEach(function (th) { if (th.id === id) th.resolved = true; });
      persist();
      renderDock();
    }
  });
  var initialCommentsUrl = commentsUrl();
  if (initialCommentsUrl) {
    fetch(initialCommentsUrl + "/" + encodeURIComponent(slugFromPath()))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && Array.isArray(data.threads)) {
          threads = data.threads;
          try { localStorage.setItem(commentsKey, JSON.stringify(threads)); } catch (e) {}
          renderDock();
        }
      })
      .catch(function () { threads = loadLocal(); renderDock(); });
  } else {
    threads = loadLocal();
    if (threads.some(function (t) { return !t.resolved; })) renderDock();
  }
})();`;

const ALERT_TONES: Record<string, string> = {
  NOTE: "info",
  IMPORTANT: "info",
  TIP: "good",
  WARNING: "warn",
  CAUTION: "bad",
};

function alertDiv(kind: string, bodyHtml: string): string {
  const tone = ALERT_TONES[kind] ?? "info";
  const label = kind.charAt(0) + kind.slice(1).toLowerCase();
  return `<div class="alert alert-${tone}"><p class="alert-title">${label}</p>${bodyHtml}</div>`;
}

function enhanceBodyHtml(html: string): string {
  let out = html;

  out = out.replace(
    /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*<br\s*\/?>([\s\S]*?)<\/blockquote>/g,
    (_match, kind: string, body: string) => alertDiv(kind, body),
  );
  out = out.replace(
    /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*<\/p>([\s\S]*?)<\/blockquote>/g,
    (_match, kind: string, body: string) => alertDiv(kind, body),
  );
  out = out.replace(
    /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s+([\s\S]*?)<\/blockquote>/g,
    (_match, kind: string, body: string) => alertDiv(kind, `<p>${body}`),
  );

  out = out.replace(
    /<li>\[x\]\s*/gi,
    '<li class="task"><input type="checkbox" checked disabled> ',
  );
  out = out.replace(/<li>\[ \]\s*/g, '<li class="task"><input type="checkbox" disabled> ');

  out = out.replace(/<h([1-3])>([\s\S]*?)<\/h\1>/g, (_match, level: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "");
    return `<h${level} id="${slugify(text)}">${inner}</h${level}>`;
  });

  return out;
}

function wrapSections(html: string): string {
  const chunks = html.split(/(?=<h2\b)/);
  if (chunks.length < 2) return html;
  const [intro, ...sections] = chunks;
  const wrapped = sections.map((chunk) => `<section class="section-card">${chunk}</section>`);
  return [intro, ...wrapped].join("\n");
}

export function emojiFaviconDataUri(icon: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">${escapeHtmlText(icon)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function resolveCharts(charts: ChartSpec[]): ResolvedChart[] {
  return charts.map((chart) => {
    const kind: ResolvedKind = chart.kind === "echarts" ? "echarts" : "vega";
    try {
      const parsed: unknown = JSON.parse(chart.json);
      if (kind === "echarts") return { kind, spec: parsed };
      if (chart.kind === "vega-lite") {
        const compiled = compileVegaLite(parsed as Parameters<typeof compileVegaLite>[0]);
        return { kind, spec: compiled.spec };
      }
      return { kind, spec: parsed };
    } catch (err) {
      return { kind, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

interface AssembleInput {
  title: string;
  icon: string;
  description?: string;
  theme?: string;
  bodyHtml: string;
  resolved: ResolvedChart[];
  needsBoot: boolean;
  needsMermaid: boolean;
  maxBytes: number;
}

function assemblePage(input: AssembleInput): string {
  const runtimes = new Set<RuntimeName>();
  if (input.resolved.some((c) => c.kind === "vega")) {
    runtimes.add("vega");
    runtimes.add("vega-embed");
  }
  if (input.resolved.some((c) => c.kind === "echarts")) {
    runtimes.add("echarts");
  }

  const parts: string[] = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<link rel="icon" href="${emojiFaviconDataUri(input.icon)}">`,
    input.description !== undefined
      ? `<meta name="description" content="${escapeHtmlText(input.description)}">`
      : "",
    `<title>${escapeHtmlText(input.title)}</title>`,
    `<style>${ARTIFACT_CSS}${input.theme !== undefined ? (THEME_CSS[input.theme] ?? "") : ""}</style>`,
    "</head>",
    "<body>",
    `<header class="artifact-header"><span class="artifact-icon">${escapeHtmlText(input.icon)}</span><h1>${escapeHtmlText(input.title)}</h1></header>`,
    `<main class="artifact-body">${input.bodyHtml}</main>`,
    FOOTER_PLACEHOLDER,
  ];

  if (input.resolved.length > 0) {
    const payload = JSON.stringify(input.resolved).replace(/</g, "\\u003c");
    parts.push(`<script>window.__ARTIFACT_CHARTS__=${payload};</script>`);
    for (const name of ["vega", "vega-embed", "echarts"] as const) {
      if (runtimes.has(name)) parts.push(`<script>${runtimeBundle(name)}</script>`);
    }
  }
  if (input.needsMermaid) {
    parts.push(`<script>${runtimeBundle("mermaid")}</script>`);
  }
  parts.push(`<script>${BOOT}</script>`);

  parts.push("</body>", "</html>");
  const html = parts.join("\n");

  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > input.maxBytes) throw new ArtifactTooLargeError(bytes, input.maxBytes);

  return html;
}

export function renderArtifact(markdown: string, options: RenderOptions = {}): RenderedArtifact {
  const doc = parseDocument(markdown);

  let bodyHtml = doc.bodyHtml;
  let needsBoot = false;
  let needsMermaid = false;
  doc.components.forEach((block, index) => {
    const placeholder = `<div class="component" data-component-index="${index}"></div>`;
    bodyHtml = bodyHtml.replace(placeholder, renderComponent(block.kind, block.json, `component-${index}`));
    if (block.kind === "copy" || block.kind === "decisions") needsBoot = true;
    if (block.kind === "mermaid") needsMermaid = true;
  });
  bodyHtml = wrapSections(enhanceBodyHtml(bodyHtml));

  const html = assemblePage({
    title: doc.meta.title ?? "Artifact",
    icon: doc.meta.icon ?? "📄",
    description: doc.meta.description,
    theme: doc.meta.theme,
    bodyHtml,
    resolved: resolveCharts(doc.charts),
    needsBoot,
    needsMermaid,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
  });
  return { html, meta: doc.meta, chartCount: doc.charts.length };
}

export function renderRawHtml(
  bodyHtml: string,
  meta: Frontmatter = {},
  options: RenderOptions = {},
): RenderedArtifact {
  const html = assemblePage({
    title: meta.title ?? "Artifact",
    icon: meta.icon ?? "📄",
    bodyHtml,
    resolved: [],
    needsBoot: false,
    needsMermaid: false,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
  });
  return { html, meta, chartCount: 0 };
}
