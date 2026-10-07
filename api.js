/* Shared bounded transport. Only explicitly allowlisted GETs may retry/dedupe. */
(function(){
'use strict';
var nativeFetch=window.fetch.bind(window),pending=new Map();
var reads=new Set(['hubBundle','financeBundle','ceoBundle','costBundle','listBatches','getBatch','getStats','listInventory','listBOM','listPODrafts','listPayments','getCashFlow','listCashflow','listInvoices','getInvoice','cashflowSummary','getProducts','getCostData','getPermissions','authMe','authVerify','authListUsers','batchHistory','listWarranties','getWarranty','sync','n8nHealth','n8nGetAll','n8nGetChanges','n8nSyncStatus']);
window.snApiMetrics=[];
/* Latency instrumentation (best-effort; must never affect a request). Persisted
   ring buffer across page loads so p50/p95/cold-warm can be read over several
   periods: snMetrics.table() in the console. No tokens/PINs/payloads are stored. */
var snSeen={},SN_MBUF='sn_metrics_v1',SN_MCAP=600;
function snMRead(){try{return JSON.parse(localStorage.getItem(SN_MBUF)||'[]');}catch(e){return[];}}
function snMWrite(a){try{if(a.length>SN_MCAP)a=a.slice(a.length-SN_MCAP);localStorage.setItem(SN_MBUF,JSON.stringify(a));}catch(e){}}
function snMRecord(api,method,ms,outcome,attempts){
  var cold=!snSeen[api];snSeen[api]=true;
  window.snApiMetrics.push({api:api,method:method,ms:ms,outcome:outcome,attempts:attempts,cold:cold});if(window.snApiMetrics.length>100)window.snApiMetrics.shift();
  try{var b=snMRead();b.push({a:api,m:ms,o:outcome,c:cold?1:0,n:attempts,t:Date.now()});snMWrite(b);}catch(e){}
}
function snPct(a,p){if(!a.length)return null;var s=a.slice().sort(function(x,y){return x-y;});return s[Math.min(s.length-1,Math.floor(p/100*s.length))];}
window.snMetrics={
  summary:function(sinceHours){
    var since=sinceHours?Date.now()-sinceHours*3600000:0,buf=snMRead().filter(function(s){return s.t>=since;}),by={};
    buf.forEach(function(s){var g=by[s.a]||(by[s.a]={ok:[],cold:[],warm:[],n:0,to:0,er:0});g.n++;if(s.o==='timeout')g.to++;else if(s.o==='error')g.er++;else{g.ok.push(s.m);(s.c?g.cold:g.warm).push(s.m);}});
    var out={};Object.keys(by).forEach(function(a){var g=by[a];out[a]={count:g.n,okP50:snPct(g.ok,50),okP95:snPct(g.ok,95),coldP95:snPct(g.cold,95),warmP95:snPct(g.warm,95),timeoutRate:+(g.to/g.n).toFixed(3),errorRate:+(g.er/g.n).toFixed(3)};});
    return out;
  },
  table:function(h){try{console.table(window.snMetrics.summary(h));}catch(e){console.log(JSON.stringify(window.snMetrics.summary(h),null,1));}return 'ok';},
  raw:function(){return snMRead();},
  clear:function(){try{localStorage.removeItem(SN_MBUF);}catch(e){}window.snApiMetrics=[];return 'cleared';}
};
window.snFetch=function(input,options){
  options=options||{};
  var isStr=(typeof input==='string');
  var url=new URL(isStr?input:input.url,location.href),method=(options.method||(isStr?'GET':(input.method||'GET'))).toUpperCase(),api=url.searchParams.get('api')||'';
  var backend=url.hostname==='script.google.com';
  // Auto-attach the session token to OUR Apps Script exec only (never third parties),
  // so pages never rely on each call remembering it. GET -> query, POST JSON -> body.
  // login/register stay anonymous; existing explicit tokens are left untouched.
  if(url.origin==='https://script.google.com' && url.pathname==='/macros/s/AKfycbzMqTc5rY4oi2jelEuuMZhybmbx-_13zaG0zDDrjvjC09Bx3sloUEa4c1V8Cv3fTtZW/exec'){
    var _tk=null;try{_tk=sessionStorage.getItem('sn_token')||localStorage.getItem('sn_token');}catch(e){}
    if(_tk){
      if(method==='GET'){
        if(!url.searchParams.get('token')){url.searchParams.set('token',_tk);input=isStr?url.href:new Request(url.href,input);}
      }else if(typeof options.body==='string' && /^\s*\{/.test(options.body)){
        try{var _b=JSON.parse(options.body);if(_b&&typeof _b==='object'&&_b.token===undefined&&_b.action!=='auth_login'&&_b.action!=='auth_register'){_b.token=_tk;options=Object.assign({},options,{body:JSON.stringify(_b)});}}catch(e){}
      }else if(!isStr && method==='POST' && typeof options.body!=='string'){
        // Request-object POST: read its body async, then re-enter as string form so the branch above injects the token (no loop — string path checks token presence).
        return input.clone().text().then(function(_bt){var _h={};try{input.headers.forEach(function(v,k){_h[k]=v;});}catch(e){}return window.snFetch(url.href,Object.assign({},options,{method:'POST',headers:_h,body:_bt}));});
      }
    }
  }
  var read=backend&&method==='GET'&&reads.has(api),key=method+' '+url.href;
  if(read&&pending.has(key))return pending.get(key).then(function(r){return r.clone();});
  var started=performance.now(),attempts=0;
  async function request(){
    while(true){
      attempts++;var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},read?30000:(backend?30000:6000));
      var abort=function(){controller.abort();};if(options.signal){if(options.signal.aborted)controller.abort();else options.signal.addEventListener('abort',abort,{once:true});}
      try{
        var config=Object.assign({},options,{signal:controller.signal});if(backend)config.cache='no-store';
        var response=await nativeFetch(input,config);
        if(!response.ok){var http=new Error('HTTP '+response.status);http.transient=response.status===429||response.status>=500;throw http;}
        if(backend){var payload;try{payload=await response.clone().json();}catch(jsonError){throw Object.assign(new Error('Server returned an invalid response'),{permanent:true});}if(read&&payload&&payload.success===false&&(payload.code===429||payload.code>=500))throw Object.assign(new Error(payload.error||'Service unavailable'),{transient:true});}
        return response;
      }catch(err){
        var cancelled=options.signal&&options.signal.aborted;
        if(!read||attempts>=2||cancelled||err.name==='AbortError'||err.permanent||(err.transient===false)||(/^HTTP /.test(err.message)&&!err.transient))throw err.name==='AbortError'?new Error('Request timed out'):err;
      }finally{clearTimeout(timer);if(options.signal)options.signal.removeEventListener('abort',abort);}
    }
  }
  var promise=request().then(function(r){snMRecord(api||url.hostname,method,Math.round(performance.now()-started),'ok',attempts);return r;},function(e){snMRecord(api||url.hostname,method,Math.round(performance.now()-started),/timed out/i.test(e&&e.message||'')?'timeout':'error',attempts);throw e;}).finally(function(){pending.delete(key);});
  if(read)pending.set(key,promise);
  return promise.then(function(r){return r.clone();});
};
window.snApiGet=async function(name,params){
  var base=window.API||window.API_URL||'https://script.google.com/macros/s/AKfycbzMqTc5rY4oi2jelEuuMZhybmbx-_13zaG0zDDrjvjC09Bx3sloUEa4c1V8Cv3fTtZW/exec',url=new URL(base);url.searchParams.set('api',name);Object.keys(params||{}).forEach(function(k){if(params[k]!==undefined&&params[k]!==null)url.searchParams.set(k,params[k]);});
  var response=await window.snFetch(url.href),data=await response.json();
  if(data&&data.success===false||data&&data.error)throw Object.assign(new Error(data.error||'Data unavailable'),{code:data.code});return data;
};
function readUser(){try{return JSON.parse(sessionStorage.getItem('sn_user')||localStorage.getItem('sn_user')||'null');}catch(e){return null;}}
window.snAuthReady=(async function(){
  var page=location.pathname.split('/').pop()||'index.html';if(page==='login.html')return null;
  var token=sessionStorage.getItem('sn_token')||localStorage.getItem('sn_token'),user=readUser();if(!token||!user)return null;
  if(page==='finance.html')window.snFinanceReady=window.snApiGet('financeBundle',{token:token});
  if(page!=='finance.html'&&Date.now()-Number(sessionStorage.getItem('sn_me_ts')||0)<300000&&sessionStorage.getItem('sn_perms'))return user;
  try{
    var url='https://script.google.com/macros/s/AKfycbzMqTc5rY4oi2jelEuuMZhybmbx-_13zaG0zDDrjvjC09Bx3sloUEa4c1V8Cv3fTtZW/exec?api=authMe&token='+encodeURIComponent(token);
    var d;
    if(page==='finance.html'){var initial=await window.snFinanceReady;d=initial.auth;}
    if(!d){var r=await window.snFetch(url);d=await r.json();} // supports backend v30 during rollout
    if(!d.success){if([401,403,404].includes(d.code)){sessionStorage.clear();['sn_token','sn_user','sn_perms','sn_me_ts'].forEach(function(k){localStorage.removeItem(k);});location.replace('login.html');}return null;}
    var keep=!!localStorage.getItem('sn_token');sessionStorage.setItem('sn_user',JSON.stringify(d.user));if(keep)localStorage.setItem('sn_user',JSON.stringify(d.user));
    if(!d.permissions){var pr=await window.snFetch(url.split('?')[0]+'?api=getPermissions');var legacy=await pr.json();if(!legacy.permissions||legacy.success===false)throw new Error('Permissions unavailable');d.permissions=legacy.permissions;} // legacy backend only
    if(d.permissions){var raw=JSON.stringify(d.permissions);sessionStorage.setItem('sn_perms',raw);if(keep)localStorage.setItem('sn_perms',raw);}
    sessionStorage.setItem('sn_me_ts',String(Date.now()));
    if(d.user.role!=='admin'&&!['index.html','hub.html'].includes(page)&&!(d.permissions&&d.permissions[d.user.role]||[]).includes(page)){location.replace('index.html');return null;}
    window.dispatchEvent(new Event('sn:auth'));return d.user;
  }catch(err){if(err.code===403){location.replace('index.html');return null;}if([401,404].includes(err.code)){sessionStorage.clear();['sn_token','sn_user','sn_perms','sn_me_ts'].forEach(function(k){localStorage.removeItem(k);});location.replace(err.code===403?'index.html':'login.html');}return null;} // keep snapshots on transient failure; do not mark auth fresh
})();
})();
