const BRIDGE_SNIPPET = `<script>window.__ARTIFACT_STATE_URL__="/__state";window.__ARTIFACT_COMMENTS_URL__="/__comments";function oaSlug(){return decodeURIComponent(location.pathname.split("/").pop()||"").replace(/\\.html$/,"");}function oaJson(r){return r.json();}window.opencodeArtifacts={db:{get:function(col,id){return fetch("/__db/"+oaSlug()+"/"+col+"/"+id).then(function(r){return r.status===404?null:oaJson(r);});},list:function(col,query){var qs=query?("?"+new URLSearchParams(query).toString()):"";return fetch("/__db/"+oaSlug()+"/"+col+qs).then(oaJson);},set:function(col,id,doc){return fetch("/__db/"+oaSlug()+"/"+col+"/"+id,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(doc)}).then(oaJson);},remove:function(col,id){return fetch("/__db/"+oaSlug()+"/"+col+"/"+id,{method:"DELETE"}).then(function(r){return r.ok;});}},data:function(name){return fetch("/__data/"+oaSlug()+"/"+name).then(oaJson);}};</script>`;

const LIVE_RELOAD_SNIPPET = `<script>(function(){try{var es=new EventSource("/__sse");es.addEventListener("reload",function(){location.reload()});}catch(e){}})();</script>`;

export const NAME_RE = /^[a-z0-9-]+$/;

/**
 * Security invariant: the served copy relaxes connect-src to 'self' (the bridge and
 * live reload need it); the artifact file on disk keeps connect-src 'none'.
 */
export function prepareServedHtml(text: string, options: { liveReload?: boolean } = {}): string {
  const relaxed = text.replace("connect-src 'none'", "connect-src 'self'");
  const snippet =
    options.liveReload === false ? BRIDGE_SNIPPET : BRIDGE_SNIPPET + LIVE_RELOAD_SNIPPET;
  const at = relaxed.lastIndexOf("</body>");
  return at === -1 ? relaxed + snippet : relaxed.slice(0, at) + snippet + relaxed.slice(at);
}
