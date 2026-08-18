import { writeFile } from "node:fs/promises";

interface WebDriverResponse<T> { value: T }
interface BrowserLog { level: string; message: string; timestamp: number }
interface PerformanceLog { message: string }
interface AxNode { role?: { value?: string }; name?: { value?: string }; ignored?: boolean }

const endpoint = process.argv[2] ?? "http://127.0.0.1:4444";
const pageUrl = process.argv[3];
const screenshotPath = process.argv[4];
const reportPath = process.argv[5];
const width = Number(process.argv[6]);
const height = Number(process.argv[7]);
const colorScheme = process.argv[8] ?? "light";
if (!pageUrl || !screenshotPath || !reportPath || !Number.isInteger(width) || !Number.isInteger(height)) {
  throw new Error("usage: page-quality-browser-evidence <webdriver> <page-url> <screenshot> <report> <width> <height> [light|dark]");
}
if (width < 320 || height < 480) throw new Error("viewport is below the supported evidence floor");
if (colorScheme !== "light" && colorScheme !== "dark") throw new Error("color scheme must be light or dark");

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`WebDriver ${method} ${path} failed (${response.status}): ${responseText.slice(0, 1000)}`);
  return (JSON.parse(responseText) as WebDriverResponse<T>).value;
}

const session = await request<{ sessionId: string }>("POST", "/session", {
  capabilities: { alwaysMatch: {
    browserName: "chrome",
    "goog:loggingPrefs": { browser: "ALL", performance: "ALL" },
    "goog:chromeOptions": { args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"] },
  } },
});
const route = `/session/${session.sessionId}`;

async function script<T>(source: string): Promise<T> {
  return request<T>("POST", `${route}/execute/sync`, { script: source, args: [] });
}

async function key(value: string): Promise<void> {
  await request("POST", `${route}/actions`, { actions: [{
    type: "key", id: "keyboard", actions: [{ type: "keyDown", value }, { type: "keyUp", value }],
  }] });
}

async function focus(selector: string): Promise<boolean> {
  return script<boolean>(`const n=document.querySelector(${JSON.stringify(selector)});if(n)n.focus();return !!n;`);
}

try {
  await request("POST", `${route}/window/rect`, { width, height, x: 0, y: 0 });
  await request("POST", `${route}/goog/cdp/execute`, { cmd: "Network.enable", params: {} });
  await request("POST", `${route}/goog/cdp/execute`, {
    cmd: "Page.addScriptToEvaluateOnNewDocument",
    params: { source: "window.__ARTIFACT_LAYOUT_SHIFT__=0;new PerformanceObserver(function(list){list.getEntries().forEach(function(entry){if(!entry.hadRecentInput)window.__ARTIFACT_LAYOUT_SHIFT__+=entry.value;});}).observe({type:'layout-shift',buffered:true});" },
  });
  await request("POST", `${route}/goog/cdp/execute`, {
    cmd: "Emulation.setEmulatedMedia",
    params: { media: "screen", features: [
      { name: "prefers-color-scheme", value: colorScheme },
      { name: "prefers-reduced-motion", value: width <= 390 ? "reduce" : "no-preference" },
    ] },
  });
  const startedAt = Date.now();
  await request("POST", `${route}/url`, { url: pageUrl });
  let ready = false;
  for (let attempt = 0; attempt < 160; attempt++) {
    ready = await script<boolean>(`return document.readyState==='complete'&&!document.querySelector('.component[data-component-index]')&&Array.from(document.querySelectorAll('.chart')).every(n=>n.querySelector('canvas,svg'))&&Array.from(document.querySelectorAll('pre.mermaid')).every(n=>n.querySelector('svg'));`);
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const usefulContentMs = Date.now() - startedAt;
  await new Promise((resolve) => setTimeout(resolve, 500));
  const initialScreenshot = await request<string>("GET", `${route}/screenshot`);

  await script("document.activeElement&&document.activeElement.blur();return true;");
  await key("\uE004");
  const firstTab = await script<Record<string, unknown>>(`return {tag:document.activeElement?.tagName||null,className:document.activeElement?.className||null,text:document.activeElement?.textContent?.trim()||null};`);
  const keyboard: Record<string, unknown> = { firstTab };
  if (await focus(".decision-opt")) {
    await key("\uE014");
    keyboard["decision"] = await script(`const n=document.querySelector('.decision-opt[aria-checked="true"]');return {selected:n?.dataset.option||null,active:document.activeElement?.dataset.option||null};`);
  }
  if (await focus(".th-sort")) {
    await key("\uE007");
    keyboard["table"] = await script(`const n=document.querySelector('th[aria-sort]:not([aria-sort="none"])');return {direction:n?.getAttribute('aria-sort')||null,label:n?.textContent?.trim()||null};`);
  }
  if (await focus('input[type="range"]')) {
    const before = await script<string>("return document.activeElement?.value||'';");
    await key("\uE014");
    const after = await script<string>("return document.activeElement?.value||'';");
    keyboard["range"] = { before, after };
  }
  if (await focus(".copy-btn")) {
    await key("\uE007");
    await new Promise((resolve) => setTimeout(resolve, 100));
    keyboard["copy"] = await script<string>("return document.querySelector('.copy-note')?.textContent?.trim()||'';");
  }

  const observations = await script<Record<string, unknown>>(`
    const main=document.querySelector('main');
    const sections=Array.from(document.querySelectorAll('.section-card')).map((section)=>{
      const visual=section.querySelector('.chart-frame,.diagram-frame,.visual-frame');
      const sr=section.getBoundingClientRect();const vr=visual?.getBoundingClientRect();
      return {heading:section.querySelector('h2')?.textContent?.trim()||null,width:Math.round(sr.width),visualWidth:vr?Math.round(vr.width):null,utilization:vr&&sr.width?Number((vr.width/sr.width).toFixed(3)):null,classes:section.className};
    });
    const clipped=Array.from(document.querySelectorAll('h1,h2,h3,.stat-label,.finding-title,.pill,.decision-label,figcaption,th,td')).flatMap((node)=>{
      const element=/** @type {HTMLElement} */(node);const style=getComputedStyle(element);
      return element.scrollWidth>element.clientWidth+1&&style.overflow!=='visible'?[element.textContent?.trim()?.slice(0,120)||element.tagName]:[];
    });
    const errors=Array.from(document.querySelectorAll('.chart-error,.asset-error')).map((n)=>n.textContent?.trim());
    return {
      readyState:document.readyState,
      viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},
      composition:Array.from(main?.classList||[]).find((name)=>name.startsWith('composition-'))||'standard',
      documentHorizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
      mainHorizontalOverflow:!!main&&main.scrollWidth>main.clientWidth,
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
      colorScheme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light',
      sections,clippedText:clipped,renderErrors:errors,
      headings:Array.from(document.querySelectorAll('h1,h2,h3')).map((n)=>n.textContent?.trim()),
      interactive:{buttons:document.querySelectorAll('button').length,ranges:document.querySelectorAll('input[type="range"]').length,radios:document.querySelectorAll('[role="radio"]').length},
      chartGeometry:Array.from(document.querySelectorAll('.chart')).map((chart)=>{const own=chart.getBoundingClientRect();const child=chart.querySelector('canvas,svg')?.getBoundingClientRect();return {width:own.width,height:own.height,childWidth:child?.width||0,childHeight:child?.height||0,markup:chart.innerHTML.slice(0,160)};}),
      diagramGeometry:Array.from(document.querySelectorAll('.diagram-frame svg')).map((svg)=>{const own=svg.getBoundingClientRect();const parent=svg.parentElement?.getBoundingClientRect();return {width:own.width,height:own.height,parentWidth:parent?.width||0,viewBox:svg.getAttribute('viewBox'),widthAttribute:svg.getAttribute('width'),style:svg.getAttribute('style')};}),
      layoutShift:window.__ARTIFACT_LAYOUT_SHIFT__||0
    };
  `);

  const ax = await request<{ nodes?: AxNode[] }>("POST", `${route}/goog/cdp/execute`, { cmd: "Accessibility.getFullAXTree", params: {} });
  const roles = new Set(["RootWebArea", "banner", "main", "contentinfo", "heading", "figure", "image", "table", "caption", "button", "slider", "radiogroup", "radio", "status"]);
  const accessibilityTree = (ax.nodes ?? []).filter((node) => !node.ignored && roles.has(node.role?.value ?? ""))
    .map((node) => ({ role: node.role?.value ?? "", name: node.name?.value ?? "" })).slice(0, 160);
  await writeFile(screenshotPath, Buffer.from(initialScreenshot, "base64"));
  const browserLogs = await request<BrowserLog[]>("POST", `${route}/log`, { type: "browser" });
  const performanceLogs = await request<PerformanceLog[]>("POST", `${route}/log`, { type: "performance" });
  const requestUrls = performanceLogs.flatMap((entry) => {
    const parsed = JSON.parse(entry.message) as { message?: { method?: string; params?: { request?: { url?: string } } } };
    const url = parsed.message?.method === "Network.requestWillBeSent" ? parsed.message.params?.request?.url : undefined;
    return url === undefined ? [] : [url];
  });
  const origin = new URL(pageUrl).origin;
  const report = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    browser: "Chromium 151 via selenium/standalone-chromium",
    fixture: pageUrl,
    requested: { width, height, colorScheme, reducedMotion: width <= 390 },
    usefulContentMs,
    ready,
    keyboard,
    observations,
    accessibilityTree,
    browserLogs,
    requestUrls,
    externalHttpRequests: requestUrls.filter((url) => /^https?:/i.test(url) && new URL(url).origin !== origin),
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ready, usefulContentMs, observations, browserLogCount: browserLogs.length, externalHttpRequests: report.externalHttpRequests }, null, 2));
} finally {
  await request("DELETE", route);
}
