const BRIDGE_SNIPPET = `<script>window.__ARTIFACT_STATE_URL__="/__state";window.__ARTIFACT_COMMENTS_URL__="/__comments";function oaSlug(){return decodeURIComponent(location.pathname.split("/").pop()||"").replace(/\\.html$/,"");}function oaJson(r){return r.json();}function oaOp(){return crypto&&crypto.randomUUID?crypto.randomUUID():"00000000-0000-4000-8000-"+Math.random().toString(16).slice(2).padEnd(12,"0").slice(0,12);}function oaDoc(col,id){return "/__db/"+oaSlug()+"/"+col+"/"+id;}function oaConditional(col,id,method,doc){return fetch(oaDoc(col,id)).then(function(r){return r.json().then(function(body){return {status:r.status,body:body};});}).then(function(current){var missing=current.status===404;var body={expectedRevision:current.body.revision||0,expectedDocumentHash:missing?null:current.body.hash,operationId:oaOp()};if(method==="PUT")body.document=doc;return fetch(oaDoc(col,id),{method:method,headers:{"content-type":"application/json"},body:JSON.stringify(body)}).then(oaJson);});}window.opencodeArtifacts={db:{get:function(col,id){return fetch(oaDoc(col,id)).then(function(r){return r.status===404?null:oaJson(r);});},list:function(col,query){var qs=query?("?"+new URLSearchParams(query).toString()):"";return fetch("/__db/"+oaSlug()+"/"+col+qs).then(oaJson);},set:function(col,id,doc){return oaConditional(col,id,"PUT",doc);},remove:function(col,id){return oaConditional(col,id,"DELETE").then(function(){return true;});}},data:function(name){return fetch("/__data/"+oaSlug()+"/"+name).then(oaJson);}};</script>`;

const LIVE_RELOAD_SNIPPET = `<script>(function(){try{var es=new EventSource("/__sse");es.addEventListener("reload",function(){location.reload()});}catch(e){}})();</script>`;

export const NAME_RE = /^[a-z0-9-]+$/;

/**
 * Security invariant: the served copy relaxes connect-src to 'self' (the bridge and
 * live reload need it); the artifact file on disk keeps connect-src 'none'.
 */
export function prepareServedHtml(text: string, options: { liveReload?: boolean } = {}): string {
  const relaxed = text.replace("connect-src 'none'", "connect-src 'self'");
  const headEnd = relaxed.lastIndexOf("</head>");
  const bodyStart = relaxed.indexOf("<body", headEnd === -1 ? 0 : headEnd + 7);
  const bodyOpenEnd = bodyStart === -1 ? -1 : relaxed.indexOf(">", bodyStart);
  const bridged = bodyOpenEnd === -1
    ? BRIDGE_SNIPPET + relaxed
    : relaxed.slice(0, bodyOpenEnd + 1) + BRIDGE_SNIPPET + relaxed.slice(bodyOpenEnd + 1);
  if (options.liveReload === false) return bridged;
  const bodyEnd = bridged.lastIndexOf("</body>");
  return bodyEnd === -1
    ? bridged + LIVE_RELOAD_SNIPPET
    : bridged.slice(0, bodyEnd) + LIVE_RELOAD_SNIPPET + bridged.slice(bodyEnd);
}
