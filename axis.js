/* Shared Operations Lounge shell. Product content and API handlers remain per page. */
(function(){
'use strict';
installTextReveal();
var page=location.pathname.split('/').pop()||'index.html';if(page==='login.html')return;
function stored(key){try{return JSON.parse(sessionStorage.getItem(key)||localStorage.getItem(key)||'null');}catch(e){return null;}}
var user=stored('sn_user');if(!user)return;document.body.classList.add('axis-lounge');
var root=document.createElement('div');root.id='sn-axis-demo';
root.innerHTML='<div class="sn-app sn-horizontal"><header class="sn-top"><div class="sn-brand sn-display">SN ERP<small>THE PERFORMANCE ARCHITECT</small></div><div class="sn-meta"><span class="sn-date"></span><span class="sn-avatar" aria-label="ผู้ใช้"></span><button type="button" class="sn-action" data-logout>ออก</button></div></header><div class="sn-shell"><nav class="sn-side" aria-label="เมนู SN ERP"></nav><main class="sn-main"><div class="sn-heading"><div><div class="sn-eyebrow">OPERATIONS / <span data-breadcrumb></span></div><h2 class="sn-display" data-title></h2><p data-subtitle></p></div><button type="button" class="sn-action primary" data-primary hidden></button></div></main></div></div>';
var main=root.querySelector('main'),nav=root.querySelector('nav'),app=root.querySelector('.sn-app');
// Preserve dialogs as body-level overlays. Only visible page content enters the shell.
Array.from(document.body.children).forEach(function(el){if(['SCRIPT','DIALOG'].indexOf(el.tagName)>=0||el.classList.contains('modal-bg')||el.classList.contains('confirm-overlay')||el.id==='confirm-overlay'||el.id==='deleteConfirm'||el.classList.contains('auth-bar'))return;main.appendChild(el);});
document.body.appendChild(root);document.querySelectorAll('.bottom-nav,.bnav').forEach(function(el){el.hidden=true;});
var titles={index:['OPERATIONS LOUNGE','ภาพรวมการผลิต สต็อก และกระแสเงินสด','OVERVIEW'],hub:['OPERATIONS LOUNGE','ภาพรวมการดำเนินงาน','OVERVIEW'],production:['PRODUCTION','ติดตาม Batch และลำดับการผลิต','PRODUCTION'],inventory:['INVENTORY','สต็อก การเติมสินค้า และใบสั่งซื้อ','INVENTORY'],finance:['FINANCE','กระแสเงินสด รายรับรายจ่าย และใบแจ้งหนี้','FINANCE'],cost:['COST ANALYSIS','ต้นทุนวัสดุและราคาขายตามโมเดล','COST'],ceo:['EXECUTIVE','ภาพรวมผู้บริหาร · ROI · ROAS · กระแสเงินสด','EXECUTIVE'],qr:['QR STATION','สแกน Batch และอัปเดตสถานีงาน','QR'],report:['REPORTS','รายงานการผลิต สต็อก และการเงิน','REPORTS'],admin:['ACCESS CONTROL','จัดการผู้ใช้และสิทธิ์เข้าถึงหน้า','ADMIN']};
var info=titles[page.replace('.html','')]||titles.index;root.querySelector('[data-title]').textContent=info[0];root.querySelector('[data-subtitle]').textContent=info[1];root.querySelector('[data-breadcrumb]').textContent=info[2];
root.querySelector('.sn-date').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',year:'numeric'}).format(new Date()).toUpperCase();root.querySelector('.sn-avatar').textContent=(user.name||user.username||'SN').slice(0,2).toUpperCase();root.querySelector('.sn-avatar').setAttribute('aria-label',user.name||user.username||'ผู้ใช้');
/* Mirror backend permDefaults_ exactly. ceo.html is NOT a default for any role:
   it stays admin-only until an admin grants it per-role in Access Control. */
var defaults={production:['production.html','qr.html','report.html','inventory.html'],finance:['finance.html','cost.html','report.html'],marketing:['report.html','cost.html'],manager:['production.html','inventory.html','qr.html','report.html','cost.html'],operator:['production.html','qr.html']};
var items=[['index.html','ภาพรวม'],['production.html','การผลิต'],['inventory.html','คลังสินค้า'],['finance.html','การเงิน'],['cost.html','ต้นทุน'],['ceo.html','ผู้บริหาร'],['qr.html','QR Station'],['report.html','รายงาน'],['admin.html','ผู้ใช้และสิทธิ์']];
function renderNav(){user=stored('sn_user')||user;var p=stored('sn_perms')||defaults,allowed=p[user.role]||[];nav.replaceChildren();items.forEach(function(item){if(item[0]!=='index.html'&&user.role!=='admin'&&allowed.indexOf(item[0])<0)return;var a=document.createElement('a');a.className='sn-nav';a.href=item[0];a.textContent=item[1];a.dataset.page=item[0];var active=item[0]===page||(item[0]==='index.html'&&page==='hub.html');a.setAttribute('aria-pressed',String(active));if(active)a.setAttribute('aria-current','page');nav.appendChild(a);});}
renderNav();window.addEventListener('focus',renderNav);window.addEventListener('sn:auth',renderNav);window.addEventListener('storage',renderNav);
var primary=root.querySelector('[data-primary]');if(page==='index.html'&&(user.role==='admin'||(stored('sn_perms')||defaults)[user.role]?.indexOf('production.html')>=0)){primary.hidden=false;primary.textContent='สร้าง Batch';primary.addEventListener('click',function(){location.href='production.html?create=1';});}
if(page==='finance.html'){primary.hidden=false;primary.textContent='บันทึกรายจ่าย';primary.addEventListener('click',function(){window.switchTab('payments');window.showPaymentForm();document.getElementById('payType').value='expense';if(window.onPayTypeChange)window.onPayTypeChange();document.getElementById('payFormArea').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});});}
if(page==='production.html'){primary.hidden=false;primary.textContent='สร้าง Batch';primary.addEventListener('click',function(){window.openCreateBatch();});if(new URLSearchParams(location.search).get('create')==='1')window.openCreateBatch();}
root.querySelector('[data-logout]').addEventListener('click',function(){if(window.snLogout){window.snLogout();return;}var token=sessionStorage.getItem('sn_token')||localStorage.getItem('sn_token');if(window.API||window.API_URL)snFetch(window.API||window.API_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'auth_logout',token:token})}).catch(function(){});['sn_token','sn_user','sn_perms','sn_me_ts'].forEach(function(key){sessionStorage.removeItem(key);localStorage.removeItem(key);});location.href='login.html';});

// Animate visible text when it first appears or its content changes. Never
// scramble text or animate input fields; preserve readable DOM and reduced motion.
function installTextReveal(){
  var media=matchMedia('(prefers-reduced-motion: reduce)'),seen=new WeakMap(),queued=false;
  var selector='.sn-display,.sn-heading p,.sn-eyebrow,.sn-nav,.sn-kpi label,.sn-value,.sn-row strong,.sn-row small,.sn-panel h3,.brand .wm,.brand .sub,.eyebrow,h1,h2,h3,.stat-val,.form-group label,.axis-media-history p';
  function animate(el){if(media.matches)return;el.classList.remove('sn-text-enter');requestAnimationFrame(function(){el.classList.add('sn-text-enter');});}
  var io=typeof IntersectionObserver==='function'?new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){animate(entry.target);io.unobserve(entry.target);}});}):null;
  function scan(){queued=false;if(media.matches)return;document.querySelectorAll(selector).forEach(function(el){var value=el.textContent.trim();if(!value||seen.get(el)===value)return;seen.set(el,value);if(io)io.observe(el);else animate(el);});}
  new MutationObserver(function(){if(!queued){queued=true;requestAnimationFrame(scan);}}).observe(document.body,{subtree:true,childList:true,characterData:true});
  document.addEventListener('animationend',function(e){if(e.animationName==='sn-text-reveal')e.target.classList.remove('sn-text-enter');});
  scan();
}

})();
