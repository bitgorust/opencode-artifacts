import { writeFile } from "node:fs/promises";

interface WebDriverResponse<T> {
  value: T;
}

interface BrowserLog {
  level: string;
  message: string;
  timestamp: number;
}

interface PerformanceLog {
  message: string;
}

interface AxNode {
  role?: { value?: string };
  name?: { value?: string };
  ignored?: boolean;
}

const endpoint = process.argv[2] ?? "http://127.0.0.1:4444";
const pageUrl = process.argv[3];
const screenshotPath = process.argv[4];
const reportPath = process.argv[5];
const viewportWidth = Number(process.argv[6] ?? 1440);
const viewportHeight = Number(process.argv[7] ?? 1200);
const colorScheme = process.argv[8] ?? "light";
const reducedMotion = process.argv[9] ?? "no-preference";
const zoomPercent = Number(process.argv[10] ?? 100);

if (!pageUrl || !screenshotPath || !reportPath) {
  throw new Error("usage: accessibility-browser-evidence <webdriver-url> <page-url> <screenshot-path> <report-path> [width] [height] [light|dark] [reduce|no-preference] [100|200]");
}
if (!Number.isInteger(viewportWidth) || !Number.isInteger(viewportHeight) || viewportWidth < 320 || viewportHeight < 480) throw new Error("viewport is invalid");
if (!new Set(["light", "dark"]).has(colorScheme)) throw new Error("color scheme is invalid");
if (!new Set(["reduce", "no-preference"]).has(reducedMotion)) throw new Error("reduced motion is invalid");
if (!new Set([100, 200]).has(zoomPercent)) throw new Error("zoom must be 100 or 200");

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
  capabilities: {
    alwaysMatch: {
      browserName: "chrome",
      "goog:loggingPrefs": { browser: "ALL", performance: "ALL" },
      "goog:chromeOptions": {
        args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
      },
    },
  },
});
const route = `/session/${session.sessionId}`;

async function script<T>(source: string): Promise<T> {
  return request<T>("POST", `${route}/execute/sync`, { script: source, args: [] });
}

async function keys(values: string[]): Promise<void> {
  await request("POST", `${route}/actions`, {
    actions: [{
      type: "key",
      id: "keyboard",
      actions: values.flatMap((value) => [{ type: "keyDown", value }, { type: "keyUp", value }]),
    }],
  });
}

async function focused(selector: string): Promise<boolean> {
  return script<boolean>(`const node=document.querySelector(${JSON.stringify(selector)});if(node)node.focus();return !!node;`);
}

try {
  await request("POST", `${route}/window/rect`, { width: viewportWidth, height: viewportHeight, x: 0, y: 0 });
  await request("POST", `${route}/goog/cdp/execute`, { cmd: "Network.enable", params: {} });
  await request("POST", `${route}/goog/cdp/execute`, {
    cmd: "Emulation.setEmulatedMedia",
    params: {
      media: "screen",
      features: [
        { name: "prefers-color-scheme", value: colorScheme },
        { name: "prefers-reduced-motion", value: reducedMotion },
      ],
    },
  });

  const startedAt = Date.now();
  await request("POST", `${route}/url`, { url: pageUrl });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    ready = await script<boolean>("return document.readyState==='complete'&&!!document.querySelector('.chart canvas,.chart svg');");
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const usefulContentMs = Date.now() - startedAt;

  await script("document.activeElement&&document.activeElement.blur();return true;");
  await keys(["\uE004"]);
  const skipFocus = await script<string>("return document.activeElement?.className||'';");
  await keys(["\uE007"]);
  const skipTargetFocus = await script<string>("return document.activeElement?.id||'';");

  await focused(".decision-opt");
  await keys(["\uE014"]);
  const decisionTrace = await script<Record<string, unknown>>(`
    const selected=document.querySelector('.decision-opt[aria-checked="true"]');
    return {selected:selected?.getAttribute('data-option')||null,active:document.activeElement?.getAttribute('data-option')||null,checked:selected?.getAttribute('aria-checked')||null};
  `);

  await focused(".th-sort");
  await keys(["\uE007"]);
  const tableSortTrace = await script<Record<string, unknown>>(`
    const sorted=document.querySelector('th[aria-sort]:not([aria-sort="none"])');
    return {label:sorted?.textContent?.trim()||null,direction:sorted?.getAttribute('aria-sort')||null};
  `);

  await focused(".comment-launcher");
  await keys(["\uE007"]);
  const commentDialogFocus = await script<string>("return document.activeElement?.id||'';");
  await keys(["\uE00C"]);
  const commentEscapeFocus = await script<string>("return document.activeElement?.className||'';");
  await keys(["\uE007"]);
  await keys(Array.from("تعليق لوحة المفاتيح"));
  await keys(["\uE004", "\uE007"]);
  for (let attempt = 0; attempt < 40; attempt++) {
    const saved = await script<boolean>("return !!document.querySelector('.comment:not(.comment-empty)');");
    if (saved) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const commentSaveTrace = await script<Record<string, unknown>>(`return {
    count:document.querySelectorAll('.comment:not(.comment-empty)').length,
    active:document.activeElement?.className||'',
    dialogOpen:!!document.querySelector('[role="dialog"]')
  };`);

  await focused(".theme-toggle");
  await keys(["\uE007"]);
  const themeTrace = await script<Record<string, unknown>>(`return {
    state:document.documentElement.getAttribute('data-theme')||'system',
    pressed:document.querySelector('.theme-toggle')?.getAttribute('aria-pressed')||null,
    label:document.querySelector('.theme-toggle')?.getAttribute('aria-label')||null
  };`);

  const preZoomWidth = await script<number>("return innerWidth;");
  if (zoomPercent === 200) {
    await request("POST", `${route}/goog/cdp/execute`, {
      cmd: "Emulation.setDeviceMetricsOverride",
      params: {
        width: Math.floor(viewportWidth / 2),
        height: Math.floor(viewportHeight / 2),
        deviceScaleFactor: 2,
        mobile: false,
        screenWidth: viewportWidth,
        screenHeight: viewportHeight,
      },
    });
  }

  const observations = await script<Record<string, unknown>>(`
    const root=getComputedStyle(document.documentElement);
    const progress=document.querySelector('[role="progressbar"]');
    const chart=document.querySelector('.chart[role="img"]');
    const table=document.querySelector('table');
    const caption=table?.querySelector('caption');
    const radios=Array.from(document.querySelectorAll('[role="radio"]'));
    const visible=(selector)=>{const node=document.querySelector(selector);return !!node&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden';};
    const audit=[];
    if(document.documentElement.lang!=='ar')audit.push('html language');
    if(document.documentElement.dir!=='rtl')audit.push('html direction');
    if(!document.querySelector('main'))audit.push('main landmark');
    if(!document.querySelector('.skip-link'))audit.push('skip link');
    if(!chart?.getAttribute('aria-labelledby'))audit.push('chart description');
    if(!caption?.textContent?.trim())audit.push('table caption');
    if(!document.querySelector('label[for="component-1-filter"]'))audit.push('table filter label');
    if(!progress?.getAttribute('aria-valuenow'))audit.push('progress state');
    if(radios.some((node)=>!node.getAttribute('aria-checked')))audit.push('radio state');
    return {
      readyState:document.readyState,
      lang:document.documentElement.lang,
      dir:document.documentElement.dir,
      locale:document.documentElement.dataset.locale,
      timezone:document.documentElement.dataset.timezone,
      viewport:{width:innerWidth,height:innerHeight,devicePixelRatio:devicePixelRatio,preZoomWidth:${preZoomWidth},requestedZoom:${zoomPercent},method:${zoomPercent === 200 ? "'Chromium device metrics: half CSS viewport at 2 physical pixels per CSS pixel'" : "'native 100% viewport'"}},
      horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
      colorScheme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light',
      computedColors:{page:root.getPropertyValue('--page-bg').trim(),surface:root.getPropertyValue('--card-bg').trim(),text:root.getPropertyValue('--ink').trim(),accent:root.getPropertyValue('--accent').trim()},
      landmarks:{main:document.querySelectorAll('main').length,header:document.querySelectorAll('header').length,footer:document.querySelectorAll('footer').length,aside:document.querySelectorAll('aside').length},
      headings:Array.from(document.querySelectorAll('h1,h2,[role="heading"]')).map((node)=>({level:node.tagName==='H1'?1:node.tagName==='H2'?2:node.getAttribute('aria-level'),name:node.textContent?.trim()})),
      chartSummary:document.querySelector('.chart-summary')?.textContent?.trim()||null,
      tableCaption:caption?.textContent?.trim()||null,
      tableCount:document.querySelector('.table-count')?.textContent?.trim()||null,
      radioStates:radios.map((node)=>({name:node.textContent?.trim(),checked:node.getAttribute('aria-checked'),tabindex:node.getAttribute('tabindex')})),
      progress:{name:progress?.getAttribute('aria-label')||null,now:progress?.getAttribute('aria-valuenow')||null,max:progress?.getAttribute('aria-valuemax')||null},
      focusOutline:getComputedStyle(document.querySelector('.theme-toggle')).outlineStyle,
      animationDuration:getComputedStyle(document.querySelector('.progress-fill')).animationDuration,
      interactiveVisible:{theme:visible('.theme-toggle'),comments:visible('.comment-launcher'),filter:visible('.table-filter')},
      audit
    };
  `);

  const axResult = await request<{ nodes?: AxNode[] }>("POST", `${route}/goog/cdp/execute`, {
    cmd: "Accessibility.getFullAXTree",
    params: {},
  });
  const retainedRoles = new Set(["RootWebArea", "banner", "main", "contentinfo", "heading", "note", "figure", "image", "table", "caption", "progressbar", "radiogroup", "radio", "button", "textbox", "status"]);
  const accessibilityTree = (axResult.nodes ?? [])
    .filter((node) => !node.ignored && retainedRoles.has(node.role?.value ?? ""))
    .map((node) => ({ role: node.role?.value ?? "", name: node.name?.value ?? "" }))
    .slice(0, 120);

  const screenshot = await request<string>("GET", `${route}/screenshot`);
  await writeFile(screenshotPath, Buffer.from(screenshot, "base64"));

  await request("POST", `${route}/goog/cdp/execute`, { cmd: "Emulation.setEmulatedMedia", params: { media: "print" } });
  const printObservation = await script<Record<string, unknown>>(`
    const hidden=(selector)=>{const node=document.querySelector(selector);return !node||getComputedStyle(node).display==='none';};
    return {themeHidden:hidden('.theme-toggle'),commentsHidden:hidden('.comment-launcher'),filterHidden:hidden('.table-filter'),pageBackground:getComputedStyle(document.body).backgroundColor};
  `);

  const browserLogs = await request<BrowserLog[]>("POST", `${route}/log`, { type: "browser" });
  const performanceLogs = await request<PerformanceLog[]>("POST", `${route}/log`, { type: "performance" });
  const rawRequestUrls = performanceLogs.flatMap((entry) => {
    const parsed = JSON.parse(entry.message) as { message?: { method?: string; params?: { request?: { url?: string } } } };
    const url = parsed.message?.method === "Network.requestWillBeSent" ? parsed.message.params?.request?.url : undefined;
    return url === undefined ? [] : [url];
  });
  const origin = new URL(pageUrl).origin;
  const report = {
    capturedAt: new Date().toISOString(),
    browser: "Chromium 151 via selenium/standalone-chromium",
    fixture: pageUrl,
    requested: { viewportWidth, viewportHeight, colorScheme, reducedMotion, zoomPercent },
    usefulContentMs,
    keyboard: { skipFocus, skipTargetFocus, decisionTrace, tableSortTrace, commentDialogFocus, commentEscapeFocus, commentSaveTrace, themeTrace },
    observations,
    accessibilityTree,
    printObservation,
    browserLogs,
    requestUrls: rawRequestUrls,
    externalHttpRequests: rawRequestUrls.filter((url) => /^https?:/i.test(url) && new URL(url).origin !== origin),
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await request("DELETE", route);
}
