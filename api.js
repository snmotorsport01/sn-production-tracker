/* Shared bounded transport. Only explicitly allowlisted GETs may retry/dedupe. */
(function(){
'use strict';
var nativeFetch=window.fetch.bind(window),pending=new Map();
var reads=new Set(['hubBundle','financeBundle','ceoBundle','costBundle','listBatches','getBatch','getStats','listInventory','listBOM','listPODrafts','listPayments','getCashFlow','listCashflow','listInvoices','getInvoice','cashflowSummary','getProducts','getCostData','getPermissions','authMe','authVerify','authListUsers','batchHistory','n8nHealth','n8nGetAll','n8nGetChanges','n8nSyncStatus']);
window.snApiMetrics=[];
window.snFetch=function(input,options){
  options=options||{};var url=new URL(typeof input==='string'?input:input.url,location.href),method=(options.method||'GET').toUpperCase(),api=url.searchParams.get('api')||'';
  var backend=url.hostname==='script.google.com',read=backend&&method==='GET'&&reads.has(api),key=method+' '+url.href;
  if(read&&pending.has(key))return pending.get(key).then(function(r){return r.clone();});
  var started=performance.now(),attempts=0;
  async function request(){
    while(true){
      attempts++;var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},read?12000:(backend?25000:6000));
      var abort=function(){controller.abort();};if(options.signal){if(options.signal.aborted)controller.abort();else options.signal.addEventListener('abort',abort,{once:true});}
      try{
        var config=Object.assign({},options,{signal:controller.signal});if(backend)config.cache='no-store';
        var response=await nativeFetch(input,config);
        if(!response.ok){var http=new Error('HTTP '+response.status);http.transient=response.status===429||response.status>=500;throw http;}
        if(backend){var payload;try{payload=await response.clone().json();}catch(jsonError){throw Object.assign(new Error('Server returned an invalid response'),{permanent:true});}if(read&&payload&&payload.success===false&&(payload.code===429||payload.code>=500))throw Object.assign(new Error(payload.error||'Service unavailable'),{transient:true});}
        return response;
      }catch(err){
        var cancelled=options.signal&&options.signal.aborted;
        if(!read||attempts>=2||cancelled||err.permanent||(err.transient===false)||(/^HTTP /.test(err.message)&&!err.transient))throw err.name==='AbortError'?new Error('Request timed out'):err;
      }finally{clearTimeout(timer);if(options.signal)options.signal.removeEventListener('abort',abort);}
    }
  }
  var promise=request().finally(function(){pending.delete(key);window.snApiMetrics.push({api:api||url.hostname,method:method,attempts:attempts,ms:Math.round(performance.now()-started)});if(window.snApiMetrics.length>100)window.snApiMetrics.shift();});
  if(read)pending.set(key,promise);
  return promise.then(function(r){return r.clone();});
};
window.snApiGet=async function(name,params){
  var base=window.API||window.API_URL,url=new URL(base);url.searchParams.set('api',name);Object.keys(params||{}).forEach(function(k){if(params[k]!==undefined&&params[k]!==null)url.searchParams.set(k,params[k]);});
  var response=await window.snFetch(url.href),data=await response.json();
  if(data&&data.success===false||data&&data.error)throw Object.assign(new Error(data.error||'Data unavailable'),{code:data.code});return data;
};
function readUser(){try{return JSON.parse(sessionStorage.getItem('sn_user')||localStorage.getItem('sn_user')||'null');}catch(e){return null;}}
window.snAuthReady=(async function(){
  var page=location.pathname.split('/').pop()||'index.html';if(page==='login.html')return null;
  var token=sessionStorage.getItem('sn_token')||localStorage.getItem('sn_token'),user=readUser();if(!token||!user)return null;
  if(Date.now()-Number(sessionStorage.getItem('sn_me_ts')||0)<300000&&sessionStorage.getItem('sn_perms'))return user;
  try{
    var url='https://script.google.com/macros/s/AKfycbzMqTc5rY4oi2jelEuuMZhybmbx-_13zaG0zDDrjvjC09Bx3sloUEa4c1V8Cv3fTtZW/exec?api=authMe&token='+encodeURIComponent(token);
    var r=await window.snFetch(url),d=await r.json();
    if(!d.success){if([401,403,404].includes(d.code)){sessionStorage.clear();['sn_token','sn_user','sn_perms','sn_me_ts'].forEach(function(k){localStorage.removeItem(k);});location.replace('login.html');}return null;}
    var keep=!!localStorage.getItem('sn_token');sessionStorage.setItem('sn_user',JSON.stringify(d.user));if(keep)localStorage.setItem('sn_user',JSON.stringify(d.user));
    if(!d.permissions){var pr=await window.snFetch(url.split('?')[0]+'?api=getPermissions');var legacy=await pr.json();if(!legacy.permissions||legacy.success===false)throw new Error('Permissions unavailable');d.permissions=legacy.permissions;} // legacy backend only
    if(d.permissions){var raw=JSON.stringify(d.permissions);sessionStorage.setItem('sn_perms',raw);if(keep)localStorage.setItem('sn_perms',raw);}
    sessionStorage.setItem('sn_me_ts',String(Date.now()));
    if(d.user.role!=='admin'&&!['index.html','hub.html'].includes(page)&&!(d.permissions&&d.permissions[d.user.role]||[]).includes(page)){location.replace('index.html');return null;}
    window.dispatchEvent(new Event('sn:auth'));return d.user;
  }catch(err){return null;} // keep snapshots on transient failure; do not mark auth fresh
})();
})();
