import { handleApiRequest, type KVStore } from "./handler.ts";
import { prepareServedHtml } from "../served-html.ts";

interface Env {
  ARTIFACTS_KV: KVStore;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const api = await handleApiRequest(request, env.ARTIFACTS_KV);
    if (api !== null) return api;

    const url = new URL(request.url);
    const target = url.pathname === "/" ? new URL("/index.html", request.url) : request.url;
    const asset = await env.ASSETS.fetch(new Request(target, request));
    const isHtml = asset.headers.get("content-type")?.includes("text/html") ?? false;
    if (!isHtml) return asset;

    const html = prepareServedHtml(await asset.text(), { liveReload: false });
    const headers = new Headers(asset.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    return new Response(html, { status: asset.status, headers });
  },
};
