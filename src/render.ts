import { compile as compileVegaLite } from "vega-lite";
import { parseDocument, type ChartSpec, type CompositionKind, type Frontmatter } from "./markdown.ts";
import { renderComponent } from "./components.ts";
import { runtimeBundle, type RuntimeName } from "./runtime.ts";
import { escapeHtmlText, headingSlugify } from "./text.ts";
import { resolvePortableAssets, type AssetLimits, type PortableAssets } from "./assets.ts";
import { resolveDesignTokens, type ResolvedDesignTokens } from "./design-tokens.ts";
import { resolveLocaleContext, type LocaleContext } from "./locale.ts";

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
  assets?: PortableAssets;
  designTokens?: ResolvedDesignTokens;
}

export interface PortableRenderOptions extends AssetLimits {
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
  summary?: string;
}

export const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
  "connect-src 'none'",
].join("; ");

export const ARTIFACT_CSS = `:root{color-scheme:light;
--page-bg:#e9edf2;--card-bg:#ffffff;--ink:#111827;--ink-2:#4b5563;--ink-3:#9ca3af;--line:#e5e7eb;
--accent:#5f5dbf;--accent-ink:#ffffff;--good:#237a52;--good-bg:#e4f4ec;--bad:#b42335;--bad-bg:#fdeeee;
--warn:#92400e;--warn-bg:#fdf0dc;--info:#33526e;--info-bg:#dce6f2;
--card-info-bg:#e3eaf4;--card-warn-bg:#fdeccd;--code-bg:#f3f4f6;
--radius:16px;--shadow:0 1px 3px rgb(15 23 42/.06);
--artifact-font:system-ui,-apple-system,"Segoe UI",sans-serif;--artifact-heading-font:var(--artifact-font);
--body-pad:1.5rem;--body-pad-bottom:3rem;--section-gap:1.25rem;--section-pad-y:1.5rem;--section-pad-x:1.75rem;--table-font-size:.86rem}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark;
--page-bg:#151a21;--card-bg:#1f2630;--ink:#e5e7eb;--ink-2:#9ca3af;--ink-3:#6b7280;--line:#333d4d;
--accent:#a8a6ff;--accent-ink:#111827;
--good:#4ade80;--good-bg:#14312a;--bad:#f87171;--bad-bg:#3a2226;--warn:#fbbf24;--warn-bg:#3a2f16;
--info:#7ea4c7;--info-bg:#1e2c3d;--card-info-bg:#1e2c3d;--card-warn-bg:#3a2f16;--code-bg:#262e3a;
--shadow:0 1px 3px rgb(0 0 0/.4)}}
:root[data-theme="dark"]{color-scheme:dark;
--page-bg:#151a21;--card-bg:#1f2630;--ink:#e5e7eb;--ink-2:#9ca3af;--ink-3:#6b7280;--line:#333d4d;
--accent:#a8a6ff;--accent-ink:#111827;
--good:#4ade80;--good-bg:#14312a;--bad:#f87171;--bad-bg:#3a2226;--warn:#fbbf24;--warn-bg:#3a2f16;
--info:#7ea4c7;--info-bg:#1e2c3d;--card-info-bg:#1e2c3d;--card-warn-bg:#3a2f16;--code-bg:#262e3a;
--shadow:0 1px 3px rgb(0 0 0/.4)}
html{overflow-wrap:anywhere}body{margin:0;background:var(--page-bg);color:var(--ink);font-family:var(--artifact-font);line-height:1.6}
.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.skip-link{position:fixed;z-index:100;inset-block-start:.5rem;inset-inline-start:.5rem;padding:.55rem .8rem;background:var(--card-bg);color:var(--ink);border:2px solid var(--accent);border-radius:8px;transform:translateY(-160%)}
.skip-link:focus{transform:none}
.artifact-header{display:flex;align-items:center;gap:.6rem;padding:.9rem 1.5rem;background:var(--card-bg);border-bottom:1px solid var(--line)}
.theme-toggle{flex:none;white-space:nowrap;margin-inline-start:auto;min-height:2rem;background:none;border:1px solid var(--line);border-radius:999px;padding:.25rem .8rem;font-size:.75rem;font-weight:600;color:var(--ink-2);cursor:pointer}
.theme-toggle:hover{border-color:var(--accent);color:var(--accent)}
.artifact-header h1{min-width:0;font-size:1.1rem;margin:0;letter-spacing:-.01em}
.artifact-icon{font-size:1.25rem}
.artifact-body{max-width:1080px;margin:0 auto;padding:var(--body-pad) var(--body-pad) var(--body-pad-bottom)}
.artifact-body>*:first-child{margin-top:0}
.artifact-intro{margin:0 0 var(--section-gap)}
.artifact-intro>p:first-child{max-width:64ch;font-size:clamp(1rem,1.7vw,1.2rem);line-height:1.55;color:var(--ink-2)}
.composition-narrative{max-width:920px}.composition-narrative .section-card:first-of-type{padding-block:clamp(1.5rem,4vw,3rem)}
.composition-narrative .section-card:first-of-type h2{font-size:clamp(1.6rem,3vw,2.35rem);max-width:22ch}
.composition-dashboard,.composition-full{max-width:1240px}.composition-dashboard{--section-gap:1rem}
.composition-split{max-width:1240px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--section-gap)}
.composition-split .artifact-intro{grid-column:1/-1;margin:0}.composition-split .section-card{margin:0;min-width:0}
.composition-split .section-visual,.composition-split .section-data{grid-column:1/-1}
.composition-split .section-card:last-child:nth-of-type(odd){grid-column:1/-1}
.composition-dense{max-width:1240px;--section-gap:.75rem;--section-pad-y:1rem;--section-pad-x:1.15rem;--table-font-size:.8rem}
.composition-quiet{max-width:820px;--section-gap:2rem}.composition-quiet .section-card{box-shadow:none;border-block-start:1px solid var(--line);border-radius:0;padding-inline:0}
.composition-full{max-width:1440px}.composition-full .section-visual{padding-inline:clamp(1rem,3vw,3rem)}
.section-visual .chart-frame,.section-visual .diagram-frame{width:100%}.section-visual .chart{height:clamp(320px,42vw,560px)}
.section-insight{background:var(--card-info-bg)}
.artifact-footer{max-width:1080px;margin:0 auto;padding:1rem 1.5rem 2rem;font-size:.8rem;color:var(--ink-3)}
.artifact-footer a{color:inherit}
.section-card{background:var(--card-bg);border-radius:var(--radius);box-shadow:var(--shadow);padding:var(--section-pad-y) var(--section-pad-x);margin:var(--section-gap) 0}
.section-card> :first-child{margin-top:0}
.section-card p,.section-card li{max-width:68ch}
td,.stat-value,.tl-time,.progress-label,.delta{font-variant-numeric:tabular-nums}
h2{font-size:1.35rem;font-weight:700;letter-spacing:-.015em;margin:0 0 1rem}
h3{font-size:1.05rem;margin:1.25rem 0 .5rem}
p{margin:.6rem 0}
pre{background:var(--code-bg);padding:.75rem 1rem;overflow:auto;border-radius:10px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em}
p code,li code,td code{background:var(--code-bg);padding:.1em .35em;border-radius:5px}
.chart-frame,.diagram-frame{margin:1rem 0}.chart{display:block;width:100%;margin:0;min-height:320px;max-width:100%;overflow:hidden}
.chart-summary,.diagram-summary{margin:.5rem 0 0;color:var(--ink-2);font-size:.88rem}
.diagram-frame svg{display:block;width:auto!important;max-width:100%!important;max-height:560px;height:auto!important;margin-inline:auto}
.visual-frame{display:grid;grid-template-columns:minmax(0,1fr) minmax(12rem,.32fr);gap:1rem;margin:1rem 0;align-items:start}.frame-surface{min-width:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--code-bg);box-shadow:var(--shadow)}.frame-bar{display:flex;gap:.75rem;align-items:center;padding:.55rem .8rem;border-bottom:1px solid var(--line);background:var(--card-bg);font-size:.8rem}.frame-bar span{color:var(--ink-3);letter-spacing:.15em}.frame-content{min-height:12rem;margin:0;border-radius:0;white-space:pre-wrap}.frame-annotations{margin:0;padding-inline-start:1.6rem;border-inline-start:2px solid var(--accent)}.frame-annotations li{margin:0 0 .75rem}.visual-frame figcaption{grid-column:1/-1;color:var(--ink-2);font-size:.88rem}.frame-media .frame-content{font-family:var(--artifact-font);font-size:1rem;display:flex;align-items:center;justify-content:center;text-align:center}.frame-code .frame-content{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.chart-error{padding:.75rem 1rem;border:1px solid var(--bad);border-radius:10px;color:var(--bad);background:var(--bad-bg);margin:1rem 0}
table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:.92rem}
th{text-align:start;background:var(--code-bg);font-weight:600}
td,th{border:1px solid var(--line);padding:.45rem .7rem}
img{max-width:100%}
a{color:var(--accent)}
blockquote{margin:1rem 0;padding:.25rem 1rem;border-inline-start:3px solid var(--line);color:var(--ink-2)}
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
.tl-item::before{content:"";position:absolute;inset-inline-start:.68rem;top:1.1rem;bottom:-.1rem;width:2px;background:var(--line)}
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
.annotations li{counter-increment:note;position:relative;padding-inline-start:1.6rem;margin:.4rem 0;font-size:.9rem}
.annotations li::before{content:counter(note);position:absolute;inset-inline-start:0;top:.1rem;width:1.05rem;height:1.05rem;border-radius:50%;background:var(--ink);color:var(--card-bg);font-size:.65rem;font-weight:700;display:flex;align-items:center;justify-content:center}
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
li.task input{margin-inline-end:.45rem;accent-color:var(--accent)}
.copy-wrap{display:inline-flex;align-items:center;gap:.55rem;margin:.25rem 0}
.copy-btn{background:var(--accent);color:var(--accent-ink);border:none;border-radius:8px;padding:.45rem 1rem;font-size:.85rem;font-weight:600;cursor:pointer}
.copy-btn:hover{filter:brightness(1.08)}
.copy-note{font-size:.8rem;color:var(--good)}
pre.mermaid{display:grid;place-items:center;min-height:clamp(240px,42vw,560px);background:var(--card-bg);border:1px solid var(--line);border-radius:10px;padding:1rem;text-align:center}
.section-card pre.mermaid{background:var(--page-bg)}
.decisions{margin:1.25rem 0}
.decisions-title{font-weight:700;font-size:1.05rem;margin-bottom:.75rem}
.decision{margin:0 0 1rem}
.decision-question{font-weight:600;margin-bottom:.5rem}
.decision-options{display:flex;flex-direction:column;gap:.5rem}
.decision-opt{display:flex;flex-direction:column;gap:.15rem;text-align:start;min-height:2.75rem;background:var(--card-bg);border:1px solid var(--line);border-radius:10px;padding:.7rem 1rem;font-size:.92rem;color:var(--ink);cursor:pointer}
.section-card .decision-opt{background:var(--page-bg)}
.decision-opt:hover{border-color:var(--accent)}
.decision-opt.selected{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.decision-opt.selected .decision-label{font-weight:650;color:var(--accent)}
.decision-note{font-size:.82rem;color:var(--ink-2)}
.decisions-hint{font-size:.78rem;color:var(--ink-3);margin-top:.5rem}
.artifact-state-notice{position:fixed;left:50%;top:1rem;transform:translateX(-50%);z-index:30;max-width:min(92vw,640px);padding:.7rem 1rem;border:1px solid var(--warn);border-radius:10px;background:var(--card-warn-bg);color:var(--ink);box-shadow:0 6px 24px rgb(15 23 42/.18);font-size:.86rem}
.artifact-state-notice[data-scope="comments"]{top:5rem}
.artifact-state-notice[data-tone="error"]{border-color:var(--bad);background:var(--bad-bg)}
.table-wrap{margin:1rem 0}
.table-filter{width:100%;max-width:320px;padding:.45rem .8rem;border:1px solid var(--line);border-radius:8px;background:var(--card-bg);color:var(--ink);font:inherit;font-size:.88rem;margin-bottom:.5rem}
.table-scroll{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
.data-table caption{text-align:start;padding:.55rem;font-weight:650;color:var(--ink);background:var(--code-bg)}
.data-table{margin:0;font-size:var(--table-font-size)}
.data-table th{padding:.35rem .55rem;white-space:nowrap}
.data-table td{padding:.3rem .55rem}
.th-sort{background:none;border:none;padding:0;font:inherit;font-weight:600;color:inherit;cursor:pointer}
.th-sort::after{content:"↕";margin-inline-start:.35rem;opacity:.35;font-size:.75em}
th[data-dir="asc"] .th-sort::after{content:"↑";opacity:1;color:var(--accent)}
th[data-dir="desc"] .th-sort::after{content:"↓";opacity:1;color:var(--accent)}
.data-table .num{text-align:right}
.table-meta{display:flex;justify-content:space-between;font-size:.78rem;color:var(--ink-3);margin-top:.35rem}
.comments-dock{position:fixed;inset-inline-end:1rem;bottom:4rem;width:300px;max-width:calc(100vw - 2rem);max-height:45vh;overflow:auto;background:var(--card-bg);border:1px solid var(--line);border-radius:12px;box-shadow:0 6px 24px rgb(15 23 42/.14);padding:.75rem .9rem;z-index:10;font-size:.85rem}
.comments-title{font-weight:700;margin-bottom:.4rem}
.comment{border-top:1px solid var(--line);padding:.45rem 0}
.comment-quote{font-size:.75rem;color:var(--ink-3);border-inline-start:2px solid var(--accent);padding-inline-start:.45rem;margin-bottom:.2rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.comment-text{white-space:pre-wrap}
.comment-empty{color:var(--ink-3);font-size:.78rem}
.comment-resolve{margin-top:.3rem;min-height:2rem;background:none;border:1px solid var(--line);border-radius:6px;padding:.15rem .55rem;font-size:.75rem;cursor:pointer;color:var(--ink-2)}
.comment-resolve:hover{border-color:var(--good);color:var(--good)}
.comment-pop{z-index:20;background:var(--accent);color:var(--accent-ink);border:none;border-radius:999px;padding:.3rem .8rem;font-size:.78rem;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgb(15 23 42/.2)}
.comment-launcher{position:fixed;inset-inline-end:1rem;bottom:1rem;z-index:19;min-height:2.75rem;background:var(--accent);color:var(--accent-ink);border:2px solid var(--card-bg);border-radius:999px;padding:.5rem 1rem;font:inherit;font-size:.82rem;font-weight:650;cursor:pointer;box-shadow:0 2px 8px rgb(15 23 42/.2)}
.comment-form{position:fixed;inset-inline-end:1rem;bottom:1rem;width:320px;max-width:calc(100vw - 2rem);background:var(--card-bg);border:1px solid var(--line);border-radius:12px;box-shadow:0 6px 24px rgb(15 23 42/.14);padding:.9rem;z-index:21}
.comment-input{width:100%;min-height:4.5rem;margin:.5rem 0;border:1px solid var(--line);border-radius:8px;padding:.45rem;font:inherit;background:var(--page-bg);color:var(--ink)}
.comment-save{min-height:2.75rem;background:var(--accent);color:var(--accent-ink);border:none;border-radius:8px;padding:.35rem .9rem;font-weight:600;cursor:pointer}
.comment-cancel{min-height:2.75rem;background:none;border:1px solid var(--line);border-radius:8px;padding:.35rem .9rem;margin-inline-start:.4rem;cursor:pointer;color:var(--ink-2)}
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
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
@media (max-width:600px){.artifact-header{padding:.75rem 1rem}.artifact-body{--body-pad:1rem;--body-pad-bottom:2rem}.section-card{--section-pad-y:1rem;--section-pad-x:1rem}.tl-item{gap:.55rem}.tl-time{width:3.6rem}.comments-dock,.comment-form{inset-inline:1rem;width:auto}.stat-grid,.compare-grid{grid-template-columns:1fr}.composition-split{display:block}.composition-split .section-card{margin:var(--section-gap) 0}.section-visual .chart{height:clamp(280px,100vw,420px)}.visual-frame{grid-template-columns:1fr}.frame-annotations{border-inline-start:0!important;border-block-start:1px solid var(--line);padding-inline-start:0!important;padding-block-start:.75rem}}
@media (max-width:700px){.comments-dock{position:static;margin:1rem;max-width:none;width:auto}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
@page{margin:15mm}@media print{body{background:#fff;color:#000}.skip-link,.theme-toggle,.copy-btn,.copy-note,.table-filter,.comments-dock,.comment-pop,.comment-launcher,.comment-form{display:none!important}.section-card,.stat,.variant,.card,.finding,.callout{box-shadow:none!important;break-inside:avoid;border:1px solid #bbb}.chart-frame,.diagram-frame,.table-wrap{break-inside:avoid}.table-scroll{overflow:visible}.data-table{font-size:9pt}a{color:inherit;text-decoration:underline}}`;

const THEME_CSS: Record<string, string> = {
  report: `:root{color-scheme:light;--page-bg:#f6f0e4;--card-bg:#fffdf7;--ink:#2b251a;--ink-2:#6b5f49;--ink-3:#a29378;--line:#e3d9c4;--accent:#8f3f13;--code-bg:#f1e9d8;--artifact-heading-font:Georgia,Charter,"Times New Roman",serif}
h2,.callout-title,.stat-value{font-family:var(--artifact-heading-font)}`,
  ops: `:root{color-scheme:dark;--page-bg:#0f140f;--card-bg:#171f17;--ink:#d5e5cf;--ink-2:#8fa389;--ink-3:#5c6b57;--line:#263026;--accent:#4ade80;--accent-ink:#0f140f;--code-bg:#131c13;--good:#4ade80;--good-bg:#14311f;--bad:#f87171;--bad-bg:#3a1d1d;--warn:#fbbf24;--warn-bg:#3a2f16;--info:#7ea4c7;--info-bg:#1c2a38;--card-info-bg:#1c2a38;--card-warn-bg:#33290f;--artifact-heading-font:ui-monospace,SFMono-Regular,Menlo,monospace}
h2,.callout-title{font-family:var(--artifact-heading-font);letter-spacing:0}`,
  editorial: `:root{color-scheme:light;--page-bg:#fafafa;--card-bg:#ffffff;--ink:#141414;--ink-2:#525252;--ink-3:#a3a3a3;--line:#e5e5e5;--accent:#141414;--code-bg:#f5f5f5;--radius:4px;--shadow:none;--artifact-heading-font:Georgia,Charter,"Times New Roman",serif}
h2{font-family:var(--artifact-heading-font);font-size:1.6rem;font-weight:500}
.section-card,.stat,.variant,.card{border:1px solid var(--line)}
.artifact-header h1{font-family:var(--artifact-heading-font);font-size:1.35rem;font-weight:500}`,
};

const BOOT = `(function () {
  function operationId() {
    return window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12);
  }
  var root = document.documentElement;
  var reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (!root.hasAttribute("data-page-theme")) {
    var header = document.querySelector(".artifact-header");
    if (header) {
      var toggle = document.createElement("button");
      toggle.className = "theme-toggle";
      toggle.type = "button";
      function paintToggle() {
        var t = root.getAttribute("data-theme");
        toggle.textContent = t === "dark" ? "Dark" : t === "light" ? "Light" : "Auto";
        toggle.setAttribute("aria-label", "Theme: " + (t || "system") + ". Activate to switch.");
      }
      try {
        var stored = localStorage.getItem("artifact-theme");
        if (stored === "dark" || stored === "light") root.setAttribute("data-theme", stored);
      } catch (e) {}
      toggle.addEventListener("click", function () {
        var t = root.getAttribute("data-theme");
        if (t === "dark") root.setAttribute("data-theme", "light");
        else if (t === "light") root.removeAttribute("data-theme");
        else root.setAttribute("data-theme", "dark");
        var now = root.getAttribute("data-theme");
        try {
          if (now) localStorage.setItem("artifact-theme", now);
          else localStorage.removeItem("artifact-theme");
        } catch (e) {}
        paintToggle();
      });
      paintToggle();
      header.appendChild(toggle);
    }
  }
  var charts = window.__ARTIFACT_CHARTS__ || [];
  charts.forEach(function (entry, i) {
    var el = document.querySelector('[data-chart-index="' + i + '"]');
    if (!el) return;
    function fail(message) {
      el.textContent = "";
      var box = document.createElement("div");
      box.className = "chart-error";
      box.setAttribute("role", "alert");
      box.textContent = "Chart failed to render: " + message;
      el.appendChild(box);
    }
    if (entry.error) { fail(entry.error); return; }
    try {
      if (entry.kind === "vega") {
        Promise.resolve(window.vegaEmbed(el, entry.spec, { actions: false, ast: true })).catch(function (err) {
          fail(err && err.message ? err.message : String(err));
        });
      } else if (entry.kind === "echarts") {
        var chart = window.echarts.init(el);
        if (reducedMotion && entry.spec && typeof entry.spec === "object") entry.spec.animation = false;
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
    Promise.resolve(window.mermaid.run({ nodes: mermaidEls })).then(function () {
      mermaidEls.forEach(function (el) {
        var svg = el.querySelector("svg");
        if (!svg || typeof svg.getBBox !== "function") return;
        try {
          var bounds = svg.getBBox();
          var pad = 16;
          if (bounds.width > 0 && bounds.height > 0) {
            svg.setAttribute("viewBox", [bounds.x - pad, bounds.y - pad, bounds.width + pad * 2, bounds.height + pad * 2].join(" "));
            svg.setAttribute("width", "100%");
            svg.removeAttribute("height");
          }
        } catch (_) {}
      });
    }).catch(function (err) {
      mermaidEls.forEach(function (el) {
        if (el.querySelector("svg")) return;
        el.textContent = "";
        var box = document.createElement("div");
        box.className = "chart-error";
        box.setAttribute("role", "alert");
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
  function stateNotice(scope, message, tone) {
    var id = "artifact-state-notice-" + scope;
    var notice = document.getElementById(id);
    if (!message) {
      if (notice && notice.parentNode) notice.parentNode.removeChild(notice);
      return;
    }
    if (!notice) {
      notice = document.createElement("div");
      notice.id = id;
      notice.className = "artifact-state-notice";
      notice.setAttribute("role", "alert");
      notice.setAttribute("aria-live", "assertive");
      notice.setAttribute("data-scope", scope);
      document.body.appendChild(notice);
    }
    notice.setAttribute("data-tone", tone || "warning");
    notice.textContent = message;
  }
  function stateFailureMessage(label, body) {
    var reason = body && (body.message || body.error) ? String(body.message || body.error) : "request refused";
    var next = body && body.nextAction ? " " + String(body.nextAction) : " Reload the page and retry.";
    return label + " were not saved: " + reason + "." + next;
  }
  var decisionStateMeta = { revision: 0, contentHash: null };
  function selectDecision(opt, moveFocus) {
    var group = opt ? opt.parentNode : null;
    if (!group) return;
    var peers = group.querySelectorAll(".decision-opt");
    for (var i = 0; i < peers.length; i++) {
      peers[i].classList.remove("selected");
      peers[i].setAttribute("aria-checked", "false");
      peers[i].setAttribute("tabindex", "-1");
    }
    opt.classList.add("selected");
    opt.setAttribute("aria-checked", "true");
    opt.setAttribute("tabindex", "0");
    if (moveFocus) opt.focus();
  }
  document.addEventListener("keydown", function (ev) {
    var opt = ev.target && ev.target.closest ? ev.target.closest(".decision-opt") : null;
    if (!opt || !["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(ev.key)) return;
    var peers = Array.prototype.slice.call(opt.parentNode.querySelectorAll(".decision-opt"));
    var at = peers.indexOf(opt);
    var next = ev.key === "Home" ? 0 : ev.key === "End" ? peers.length - 1
      : ev.key === "ArrowDown" || ev.key === "ArrowRight" ? (at + 1) % peers.length
      : (at - 1 + peers.length) % peers.length;
    ev.preventDefault();
    peers[next].click();
    peers[next].focus();
  });
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
    selectDecision(opt, false);
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
        body: JSON.stringify({ answers: state, expectedRevision: decisionStateMeta.revision, expectedHash: decisionStateMeta.contentHash || undefined, operationId: operationId() }),
      }).then(function (r) { return r.json().then(function (body) { return { ok: r.ok, status: r.status, body: body }; }); })
        .then(function (result) {
          if (result.ok) {
            decisionStateMeta.revision = result.body.revision;
            decisionStateMeta.contentHash = result.body.contentHash;
            document.documentElement.removeAttribute("data-artifact-state-conflict");
            stateNotice("decisions", "");
          } else if (result.status === 409) {
            decisionStateMeta.revision = result.body.revision;
            decisionStateMeta.contentHash = result.body.contentHash;
            document.documentElement.setAttribute("data-artifact-state-conflict", "decisions");
            stateNotice("decisions", "Decisions changed in another session. Reload to review the latest choices before retrying.");
          } else {
            stateNotice("decisions", stateFailureMessage("Decisions", result.body), "error");
          }
        }).catch(function () { stateNotice("decisions", "Decisions were not saved because the local service is unavailable. Check the server and retry.", "error"); });
    }
  });
  try {
    var saved = JSON.parse(localStorage.getItem("artifact-decisions:" + location.pathname) || "{}");
    Object.keys(saved).forEach(function (q) {
      var el = document.querySelector('.decision-opt[data-question="' + q + '"][data-option="' + saved[q] + '"]');
      if (el) selectDecision(el, false);
    });
  } catch (e) {}
  if (window.__ARTIFACT_STATE_URL__) {
    var initialStateSlug = decodeURIComponent(location.pathname.split("/").pop() || "").replace(/\.html$/, "");
    fetch(window.__ARTIFACT_STATE_URL__ + "/" + encodeURIComponent(initialStateSlug))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && typeof data.revision === "number") {
          decisionStateMeta.revision = data.revision;
          decisionStateMeta.contentHash = data.contentHash;
        }
      }).catch(function () {});
  }

  var commentsKey = "artifact-comments:" + location.pathname;
  function commentsUrl() { return window.__ARTIFACT_COMMENTS_URL__ || null; }
  var threads = [];
  var commentsStateMeta = { revision: 0, contentHash: null };
  var dock = null;
  var popBtn = null;
  var form = null;
  var commentLauncher = null;
  var formReturnFocus = null;

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
        body: JSON.stringify({ threads: threads, expectedRevision: commentsStateMeta.revision, expectedHash: commentsStateMeta.contentHash || undefined, operationId: operationId() }),
      }).then(function (r) { return r.json().then(function (body) { return { ok: r.ok, status: r.status, body: body }; }); })
        .then(function (result) {
          if (result.ok) {
            commentsStateMeta.revision = result.body.revision;
            commentsStateMeta.contentHash = result.body.contentHash;
            document.documentElement.removeAttribute("data-artifact-comments-conflict");
            stateNotice("comments", "");
          } else if (result.status === 409) {
            commentsStateMeta.revision = result.body.revision;
            commentsStateMeta.contentHash = result.body.contentHash;
            document.documentElement.setAttribute("data-artifact-comments-conflict", "reload-required");
            stateNotice("comments", "Comments changed in another session. Reload to review the latest thread before retrying.");
          } else {
            stateNotice("comments", stateFailureMessage("Comments", result.body), "error");
          }
        }).catch(function () { stateNotice("comments", "Comments were not saved because the local service is unavailable. Check the server and retry.", "error"); });
    } else {
      try { localStorage.setItem(commentsKey, JSON.stringify(threads)); } catch (e) {}
    }
  }
  function renderDock() {
    if (!dock) {
      dock = make("aside", "comments-dock");
      dock.setAttribute("aria-label", "Page comments");
      document.body.appendChild(dock);
    }
    dock.textContent = "";
    var open = threads.filter(function (t) { return !t.resolved; });
    var title = make("div", "comments-title", "Comments (" + open.length + ")");
    title.setAttribute("role", "heading");
    title.setAttribute("aria-level", "2");
    dock.appendChild(title);
    open.forEach(function (t) {
      var item = make("div", "comment");
      item.appendChild(make("div", "comment-quote", t.quote));
      item.appendChild(make("div", "comment-text", t.text));
      var resolveBtn = make("button", "comment-resolve", "Resolve");
      resolveBtn.type = "button";
      resolveBtn.setAttribute("data-id", t.id);
      resolveBtn.setAttribute("aria-label", "Resolve comment: " + String(t.quote || t.text).slice(0, 80));
      item.appendChild(resolveBtn);
      dock.appendChild(item);
    });
    if (open.length === 0) dock.appendChild(make("div", "comment-empty", "Select text on the page to comment."));
  }
  function hidePop() {
    if (popBtn && popBtn.parentNode) popBtn.parentNode.removeChild(popBtn);
    popBtn = null;
  }
  function closeForm(restoreFocus) {
    if (form && form.parentNode) form.parentNode.removeChild(form);
    form = null;
    if (restoreFocus && formReturnFocus && formReturnFocus.focus) formReturnFocus.focus();
    formReturnFocus = null;
  }
  function openCommentForm(quote, trigger) {
    closeForm(false);
    formReturnFocus = trigger || commentLauncher;
    form = make("div", "comment-form");
    form.setAttribute("role", "dialog");
    form.setAttribute("aria-labelledby", "artifact-comment-form-title");
    var title = make("div", "comments-title", "Add comment");
    title.id = "artifact-comment-form-title";
    form.appendChild(title);
    form.appendChild(make("div", "comment-quote", quote || "Page comment"));
    var label = make("label", "comment-label", "Comment");
    label.setAttribute("for", "artifact-comment-input");
    form.appendChild(label);
    var textarea = make("textarea", "comment-input");
    textarea.id = "artifact-comment-input";
    form.appendChild(textarea);
    var save = make("button", "comment-save", "Save");
    save.type = "button";
    form.appendChild(save);
    var cancel = make("button", "comment-cancel", "Cancel");
    cancel.type = "button";
    form.appendChild(cancel);
    document.body.appendChild(form);
    textarea.focus();
  }
  document.addEventListener("mouseup", function () {
    setTimeout(function () {
      var sel = window.getSelection();
      var main = document.querySelector(".artifact-body");
      if (!sel || sel.isCollapsed || !main || !main.contains(sel.anchorNode)) { hidePop(); return; }
      var rect = sel.getRangeAt(0).getBoundingClientRect();
      hidePop();
      popBtn = make("button", "comment-pop", "Comment");
      popBtn.type = "button";
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
    if (t.classList.contains("comment-launcher")) {
      openCommentForm("Page comment", t);
      return;
    }
    if (t.classList.contains("comment-pop")) {
      openCommentForm(t.getAttribute("data-quote") || "", commentLauncher || document.querySelector("#artifact-main"));
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
      closeForm(true);
      return;
    }
    if (t.classList.contains("comment-cancel")) { closeForm(true); return; }
    if (t.classList.contains("comment-resolve")) {
      var id = t.getAttribute("data-id");
      threads.forEach(function (th) { if (th.id === id) th.resolved = true; });
      persist();
      renderDock();
      return;
    }
    var sortBtn = t.closest ? t.closest(".th-sort") : null;
    if (sortBtn) {
      var th = sortBtn.parentNode;
      var table = th.closest("table");
      var tbody = table ? table.querySelector("tbody") : null;
      if (!th || !tbody) return;
      var colIndex = Array.prototype.indexOf.call(th.parentNode.children, th);
      var numeric = th.getAttribute("data-type") === "num";
      var asc = th.getAttribute("data-dir") !== "asc";
      var heads = table.querySelectorAll("th");
      for (var hi = 0; hi < heads.length; hi++) {
        heads[hi].removeAttribute("data-dir");
        heads[hi].setAttribute("aria-sort", "none");
      }
      th.setAttribute("data-dir", asc ? "asc" : "desc");
      th.setAttribute("aria-sort", asc ? "ascending" : "descending");
      var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
      rows.sort(function (a, b) {
        var av = a.children[colIndex].getAttribute("data-v") || "";
        var bv = b.children[colIndex].getAttribute("data-v") || "";
        var cmp = numeric
          ? (parseFloat(av) || 0) - (parseFloat(bv) || 0)
          : av.localeCompare(bv, root.getAttribute("data-locale") || "en-US");
        return asc ? cmp : -cmp;
      });
      rows.forEach(function (row) { tbody.appendChild(row); });
    }
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && form) {
      ev.preventDefault();
      closeForm(true);
    }
  });
  document.addEventListener("input", function (ev) {
    var input = ev.target && ev.target.closest ? ev.target.closest(".table-filter") : null;
    if (!input) return;
    var wrap = input.parentNode;
    var tbody = wrap ? wrap.querySelector("tbody") : null;
    var count = wrap ? wrap.querySelector(".table-count") : null;
    if (!tbody) return;
    var query = input.value.trim().toLowerCase();
    var rows = tbody.querySelectorAll("tr");
    var visible = 0;
    for (var i = 0; i < rows.length; i++) {
      var show = query === "" || rows[i].textContent.toLowerCase().indexOf(query) !== -1;
      rows[i].style.display = show ? "" : "none";
      if (show) visible++;
    }
    if (count) count.textContent = visible + " of " + rows.length + " rows";
  });
  var initialCommentsUrl = commentsUrl();
  if (initialCommentsUrl) {
    commentLauncher = make("button", "comment-launcher", "Add comment");
    commentLauncher.type = "button";
    document.body.appendChild(commentLauncher);
    fetch(initialCommentsUrl + "/" + encodeURIComponent(slugFromPath()))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && Array.isArray(data.threads)) {
          threads = data.threads;
          if (typeof data.revision === "number") commentsStateMeta.revision = data.revision;
          if (typeof data.contentHash === "string") commentsStateMeta.contentHash = data.contentHash;
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
  return `<aside class="alert alert-${tone}" role="note" aria-label="${label}"><p class="alert-title">${label}</p>${bodyHtml}</aside>`;
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

  out = out.replace(/<li>\[([ xX])\]\s*([\s\S]*?)<\/li>/g, (_match, marker: string, body: string) => {
    const label = body.replace(/<[^>]+>/g, "").trim();
    const checked = marker.toLowerCase() === "x" ? " checked" : "";
    return `<li class="task"><input type="checkbox"${checked} disabled aria-label="${escapeHtmlText(`${checked ? "Completed" : "Open"} task: ${label}`)}"> ${body}</li>`;
  });

  out = out.replace(/<h([1-3])>([\s\S]*?)<\/h\1>/g, (_match, level: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "");
    return `<h${level} id="${escapeHtmlText(headingSlugify(text))}">${inner}</h${level}>`;
  });

  return out;
}

function wrapSections(html: string, composition?: CompositionKind): string {
  const chunks = html.split(/(?=<h2\b)/);
  if (chunks.length < 2) return html;
  const [intro, ...sections] = chunks;
  const wrapped = sections.map((chunk) => {
    const classes = ["section-card"];
    if (/class="(?:chart-frame|diagram-frame|visual-frame)/.test(chunk)) classes.push("section-visual");
    if (chunk.includes('class="table-wrap"')) classes.push("section-data");
    if (chunk.includes('class="callout')) classes.push("section-insight");
    return `<section class="${classes.join(" ")}">${chunk}</section>`;
  });
  const leading = composition !== undefined && composition !== "standard" && intro.trim() !== ""
    ? `<div class="artifact-intro">${intro}</div>`
    : intro;
  return [leading, ...wrapped].join("\n");
}

export function emojiFaviconDataUri(icon: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">${escapeHtmlText(icon)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function validateChartSpec(chart: ChartSpec): ResolvedChart & { code?: string } {
  const kind: ResolvedKind = chart.kind === "echarts" ? "echarts" : "vega";
  try {
    const parsed: unknown = JSON.parse(chart.json);
    const record = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
    if (record === undefined) return { kind, code: `${chart.kind}-invalid`, error: "chart spec must be an object" };
    const description = record?.["description"];
    if (typeof description !== "string" || description.trim().length < 8) {
      return { kind, code: "chart-summary-missing", error: "chart needs a meaningful text description" };
    }
    const summary = description.trim();
    if (kind === "echarts") return { kind, spec: parsed, summary };
    if (chart.kind === "vega-lite") {
      const responsive = {
        ...record,
        width: record["width"] ?? "container",
        height: record["height"] ?? "container",
        autosize: record["autosize"] ?? { type: "fit", contains: "padding" },
      };
      const compiled = compileVegaLite(responsive as Parameters<typeof compileVegaLite>[0]);
      return { kind, spec: compiled.spec, summary };
    }
    return { kind, spec: parsed, summary };
  } catch (err) {
    return { kind, code: `${chart.kind}-invalid`, error: err instanceof Error ? err.message : String(err) };
  }
}

function resolveCharts(charts: ChartSpec[]): ResolvedChart[] {
  return charts.map((chart) => {
    return validateChartSpec(chart);
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
  assetCss?: string;
  designTokens?: ResolvedDesignTokens;
  locale: LocaleContext;
  composition?: CompositionKind;
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

  const themeAttr =
    input.theme !== undefined && THEME_CSS[input.theme] !== undefined
      ? ` data-page-theme="${input.theme}"`
      : input.designTokens?.fixesColorMode
        ? ' data-page-theme="tokens"'
      : "";
  const designAttr = input.designTokens?.active ? " data-design-tokens" : "";
  const designMetadata = input.designTokens?.active
    ? `<meta name="artifact-design-provenance" content="${escapeHtmlText(JSON.stringify(input.designTokens.provenance))}">`
    : "";
  const localeMetadata = escapeHtmlText(JSON.stringify({ locale: input.locale.locale, timeZone: input.locale.timeZone }));

  const parts: string[] = [
    "<!doctype html>",
    `<html lang="${escapeHtmlText(input.locale.lang)}" dir="${input.locale.dir}" data-locale="${escapeHtmlText(input.locale.locale)}" data-timezone="${escapeHtmlText(input.locale.timeZone)}"${themeAttr}${designAttr}>`,
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<link rel="icon" href="${emojiFaviconDataUri(input.icon)}">`,
    input.description !== undefined
      ? `<meta name="description" content="${escapeHtmlText(input.description)}">`
      : "",
    designMetadata,
    `<meta name="artifact-locale" content="${localeMetadata}">`,
    `<title>${escapeHtmlText(input.title)}</title>`,
    `<style>${ARTIFACT_CSS}${input.theme !== undefined ? (THEME_CSS[input.theme] ?? "") : ""}${input.designTokens?.css ?? ""}${input.assetCss ?? ""}</style>`,
    "</head>",
    "<body>",
    '<a class="skip-link" href="#artifact-main">Skip to main content</a>',
    `<header class="artifact-header"><span class="artifact-icon" aria-hidden="true">${escapeHtmlText(input.icon)}</span><h1>${escapeHtmlText(input.title)}</h1></header>`,
    `<main id="artifact-main" class="artifact-body${input.composition === undefined || input.composition === "standard" ? "" : ` composition-${input.composition}`}" tabindex="-1">${input.bodyHtml}</main>`,
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
  const doc = parseDocument(markdown, { assets: options.assets?.bySource });
  const locale = resolveLocaleContext(doc.meta);
  const inlineDesign = options.designTokens === undefined
    ? resolveDesignTokens(doc.meta.theme, undefined, doc.designTokens.map((block) => block.json))
    : undefined;
  const designTokens = options.designTokens ?? inlineDesign?.designTokens;

  let bodyHtml = doc.bodyHtml;
  if (inlineDesign !== undefined && inlineDesign.issues.length > 0) {
    const errors = inlineDesign.issues
      .map((item) => `<div class="chart-error">${escapeHtmlText(`Design tokens failed validation: ${item.reason}. ${item.nextAction}`)}</div>`)
      .join("");
    bodyHtml = `${errors}${bodyHtml}`;
  }
  let needsBoot = false;
  let needsMermaid = false;
  doc.components.forEach((block, index) => {
    const placeholder = `<div class="component" data-component-index="${index}"></div>`;
    bodyHtml = bodyHtml.replace(placeholder, renderComponent(block.kind, block.json, `component-${index}`, { locale }));
    if (block.kind === "copy" || block.kind === "decisions") needsBoot = true;
    if (block.kind === "mermaid") needsMermaid = true;
  });
  const resolved = resolveCharts(doc.charts);
  resolved.forEach((chart, index) => {
    if (!chart.summary) return;
    const placeholder = `<div class="chart" data-chart-index="${index}"></div>`;
    const summaryId = `chart-${index}-summary`;
    const accessible = `<figure class="chart-frame"><div class="chart" data-chart-index="${index}" role="img" aria-labelledby="${summaryId}"></div><figcaption id="${summaryId}" class="chart-summary">${escapeHtmlText(chart.summary)}</figcaption></figure>`;
    bodyHtml = bodyHtml.replace(placeholder, accessible);
  });
  bodyHtml = wrapSections(enhanceBodyHtml(bodyHtml), doc.meta.composition);

  const html = assemblePage({
    title: doc.meta.title ?? "Artifact",
    icon: doc.meta.icon ?? "📄",
    description: doc.meta.description,
    theme: doc.meta.theme,
    bodyHtml,
    resolved,
    needsBoot,
    needsMermaid,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
    assetCss: options.assets?.font === undefined
      ? undefined
      : `@font-face{font-family:"Artifact Project";src:url(${options.assets.font.dataUri}) format("${fontFormat(options.assets.font.mime)}");font-display:swap}:root{--artifact-font:"Artifact Project",system-ui,-apple-system,"Segoe UI",sans-serif;--artifact-heading-font:var(--artifact-font)}`,
    designTokens,
    locale,
    composition: doc.meta.composition,
  });
  return { html, meta: doc.meta, chartCount: doc.charts.length };
}

function fontFormat(mime: string): string {
  if (mime === "font/woff2") return "woff2";
  if (mime === "font/woff") return "woff";
  if (mime === "font/ttf") return "truetype";
  return "opentype";
}

export async function renderPortableArtifact(
  markdown: string,
  worktreeRoot: string,
  options: PortableRenderOptions = {},
): Promise<RenderedArtifact> {
  const assets = await resolvePortableAssets(markdown, worktreeRoot, options);
  return renderArtifact(markdown, { maxBytes: options.maxBytes, assets });
}

export function renderRawHtml(
  bodyHtml: string,
  meta: Frontmatter = {},
  options: RenderOptions = {},
): RenderedArtifact {
  const locale = resolveLocaleContext(meta);
  const html = assemblePage({
    title: meta.title ?? "Artifact",
    icon: meta.icon ?? "📄",
    bodyHtml,
    resolved: [],
    needsBoot: false,
    needsMermaid: false,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
    locale,
  });
  return { html, meta, chartCount: 0 };
}
