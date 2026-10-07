/* SN ERP local-first layer: persistent IndexedDB snapshots + epoch sync client.
   Fully defensive — every path degrades to a safe no-op if IndexedDB/sync is
   unavailable, so pages keep working (just without persistence) and never show
   fake zeros. Snapshots are isolated per account; cleared on logout. */
(function(){
'use strict';
var DB_NAME='sn-erp', STORE='snap', VER=1, dbp=null;
var API_FALLBACK='https://script.google.com/macros/s/AKfycbzMqTc5rY4oi2jelEuuMZhybmbx-_13zaG0zDDrjvjC09Bx3sloUEa4c1V8Cv3fTtZW/exec';

function openDB(){
  if(dbp)return dbp;
  dbp=new Promise(function(res){
    try{
      if(!('indexedDB'in window)||!window.indexedDB){res(null);return;}
      var req=indexedDB.open(DB_NAME,VER);
      req.onupgradeneeded=function(e){var db=e.target.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);};
      req.onsuccess=function(e){res(e.target.result);};
      req.onerror=function(){res(null);};
      req.onblocked=function(){res(null);};
    }catch(e){res(null);}
  });
  return dbp;
}
function account(){try{var u=JSON.parse(sessionStorage.getItem('sn_user')||localStorage.getItem('sn_user')||'null');return (u&&(u.username||u.name))||'anon';}catch(e){return 'anon';}}
function keyFor(name){return account()+'::'+name;}
function idbGet(k){return openDB().then(function(db){if(!db)return null;return new Promise(function(res){try{var r=db.transaction(STORE,'readonly').objectStore(STORE).get(k);r.onsuccess=function(){res(r.result||null);};r.onerror=function(){res(null);};}catch(e){res(null);}});});}
function idbPut(k,v){return openDB().then(function(db){if(!db)return;return new Promise(function(res){try{var r=db.transaction(STORE,'readwrite').objectStore(STORE).put(v,k);r.onsuccess=function(){res();};r.onerror=function(){res();};}catch(e){res();}});});}
function idbClearPrefix(prefix){return openDB().then(function(db){if(!db)return;return new Promise(function(res){try{var os=db.transaction(STORE,'readwrite').objectStore(STORE),cur=os.openCursor();cur.onsuccess=function(e){var c=e.target.result;if(!c){res();return;}if(String(c.key).indexOf(prefix)===0)c.delete();c.continue();};cur.onerror=function(){res();};}catch(e){res();}});});}

// Snapshot store. get()->{data,epochs,savedAt}|null ; put(name,data,epochs) ; clearAccount()
window.snStore={
  get:function(name){return idbGet(keyFor(name));},
  put:function(name,data,epochs){return idbPut(keyFor(name),{data:data,epochs:epochs||null,savedAt:Date.now()});},
  clearAccount:function(u){return idbClearPrefix((u||account())+'::');}
};

// Epoch sync client. epochs()->{epochs,serverTime,reconcileAfterMs}|null (null = unknown, caller must fall back to TTL, NEVER treat as "no change"). Single-flight + brief memo to coalesce bursts.
var syncP=null, syncAt=0, syncVal=null;
window.snSync={
  epochs:function(force){
    var now=Date.now();
    if(!force && syncVal && now-syncAt<15000) return Promise.resolve(syncVal);
    if(syncP) return syncP;
    var tok=sessionStorage.getItem('sn_token')||localStorage.getItem('sn_token');
    if(!tok) return Promise.resolve(null);
    var base=window.API||window.API_URL||API_FALLBACK;
    var url=base+'?api=sync&token='+encodeURIComponent(tok);
    var p=window.snFetch?window.snFetch(url):fetch(url,{cache:'no-store'});
    syncP=Promise.resolve(p)
      .then(function(r){return r.json();})
      .then(function(d){if(d&&d.success&&d.epochs){syncVal={epochs:d.epochs,serverTime:d.serverTime,reconcileAfterMs:d.reconcileAfterMs||60000};syncAt=Date.now();return syncVal;}return null;})
      .catch(function(){return null;})
      .finally(function(){syncP=null;});
    return syncP;
  },
  // Decide if a cached snapshot for `domain` is stale. Uses epochs when reliable,
  // else TTL (reconcileAfterMs) so direct-sheet edits still reconcile over time.
  isStale:function(snap, domain){
    if(!snap||!snap.data)return true;
    return window.snSync.epochs().then(function(sy){
      if(sy&&sy.epochs){
        if(!snap.epochs||!(domain in snap.epochs))return true;      // no stored epoch -> refetch once
        if(snap.epochs[domain]!==sy.epochs[domain])return true;     // changed -> refetch
        var ttl=sy.reconcileAfterMs||60000;
        return (Date.now()-(snap.savedAt||0))>Math.max(ttl,300000); // periodic safety refresh for off-router sheet edits
      }
      return (Date.now()-(snap.savedAt||0))>60000;                  // sync unavailable -> TTL fallback
    });
  }
};
})();
