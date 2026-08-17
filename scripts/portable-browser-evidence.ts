import { writeFile } from "node:fs/promises";

interface WebDriverResponse<T> {
  value: T;
}

const endpoint = process.argv[2] ?? "http://127.0.0.1:4444";
const pageUrl = process.argv[3];
const screenshotPath = process.argv[4];
const reportPath = process.argv[5];
if (!pageUrl || !screenshotPath || !reportPath) {
  throw new Error("usage: portable-browser-evidence <webdriver-url> <page-url> <screenshot-path> <report-path>");
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`WebDriver ${method} ${path} failed (${response.status}): ${text.slice(0, 1000)}`);
  return (JSON.parse(text) as WebDriverResponse<T>).value;
}

const session = await request<{ sessionId: string }>("POST", "/session", {
  capabilities: {
    alwaysMatch: {
      browserName: "chrome",
      "goog:loggingPrefs": { browser: "ALL", performance: "ALL" },
      "goog:chromeOptions": {
        args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"],
      },
    },
  },
});
const sessionId = session.sessionId;
const route = `/session/${sessionId}`;

try {
  await request("POST", `${route}/window/rect`, { width: 1440, height: 1600, x: 0, y: 0 });
  await request("POST", `${route}/goog/cdp/execute`, {
    cmd: "Network.enable",
    params: {},
  });
  await request("POST", `${route}/goog/cdp/execute`, {
    cmd: "Network.emulateNetworkConditions",
    params: { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 },
  });
  const startedAt = Date.now();
  await request("POST", `${route}/url`, { url: pageUrl });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    ready = await request<boolean>("POST", `${route}/execute/sync`, {
      script: "return document.readyState === 'complete' && !!document.querySelector('.chart svg, .chart canvas');",
      args: [],
    });
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const usefulContentMs = Date.now() - startedAt;
  await request("POST", `${route}/execute/sync`, {
    script: "document.querySelector('.decision-opt').focus(); return true;",
    args: [],
  });
  await request("POST", `${route}/actions`, {
    actions: [{
      type: "key",
      id: "keyboard",
      actions: [
        { type: "keyDown", value: "\uE007" },
        { type: "keyUp", value: "\uE007" },
      ],
    }],
  });
  const observations = await request<Record<string, unknown>>("POST", `${route}/execute/sync`, {
    script: `
      const image = document.querySelector('img[data-asset-sha256]');
      const button = document.querySelector('.decision-opt');
      return {
        readyState: document.readyState,
        imageComplete: !!image && image.complete,
        imageNaturalWidth: image ? image.naturalWidth : 0,
        imageSource: image ? image.getAttribute('src').slice(0, 32) : null,
        imageHash: image ? image.dataset.assetSha256 : null,
        chartVisuals: document.querySelectorAll('.chart svg, .chart canvas').length,
        tables: document.querySelectorAll('table').length,
        tableCaptions: Array.from(document.querySelectorAll('table caption')).map((node) => node.textContent),
        decisionButtons: document.querySelectorAll('.decision-opt').length,
        keyboardSelected: !!button && button.classList.contains('selected'),
        activeElement: document.activeElement ? document.activeElement.className : null,
        csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content'),
        pageBytes: new TextEncoder().encode(document.documentElement.outerHTML).length,
      };
    `,
    args: [],
  });
  const browserLogs = await request<Array<{ level: string; message: string; timestamp: number }>>("POST", `${route}/log`, { type: "browser" });
  const performanceLogs = await request<Array<{ message: string }>>("POST", `${route}/log`, { type: "performance" });
  const rawRequestUrls = performanceLogs.flatMap((entry) => {
    const parsed = JSON.parse(entry.message) as { message?: { method?: string; params?: { request?: { url?: string } } } };
    const url = parsed.message?.method === "Network.requestWillBeSent" ? parsed.message.params?.request?.url : undefined;
    return url === undefined ? [] : [url];
  });
  const requestUrls = rawRequestUrls.map((url) => url.startsWith("data:") ? `${url.slice(0, url.indexOf(",") + 1)}[embedded]` : url);
  const screenshot = await request<string>("GET", `${route}/screenshot`);
  await writeFile(screenshotPath, Buffer.from(screenshot, "base64"));
  const report = {
    capturedAt: new Date().toISOString(),
    browser: "Chromium 151 via selenium/standalone-chromium",
    offlineEmulation: true,
    usefulContentMs,
    observations,
    browserLogs,
    requestUrls,
    networkRequestUrls: rawRequestUrls.filter((url) => /^https?:/i.test(url)),
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await request("DELETE", route);
}
