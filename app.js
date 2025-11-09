/* ===== Helper ===== */
const $ = (id)=>document.getElementById(id);
const diasIn = $('dias'), serverIn = $('serverIn');
const rateOut = $('rateOut'), totalOut = $('totalOut');
const buyBtn = $('buyBtn'), hint = $('hint');

const R1 = 0.80, R2 = 0.75, R3 = 0.70; // 1k–3999, 4k–7999, 8k+
const onlyInt = (v)=>v.replace(/[^\d]/g,'');
const fmt = (n)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const activeRate = (q)=> q>=8000?R3 : q>=4000?R2 : R1;

/* ===== Inputs ===== */
diasIn.addEventListener('input', ()=>{
  const raw = onlyInt(diasIn.value);
  diasIn.value = raw; // no auto-min; exact digits user typed
  const q = parseInt(raw||'0',10);

  if(q>0){
    const rt = activeRate(q);
    rateOut.textContent = '₱'+rt.toFixed(2);
    totalOut.textContent = '₱'+fmt(q*rt);
  }else{
    rateOut.textContent = '₱0.80';
    totalOut.textContent = '—';
  }
  validate();
});

serverIn.addEventListener('input', validate);

function validate(){
  const q = parseInt(diasIn.value||'0',10);
  const ok = q>=1000 && serverIn.value.trim().length>0;
  buyBtn.disabled = !ok;
  hint.textContent = ok ? 'Ready to order.' : 'Enter at least 1,000 dias, then type your server.';
}

/* ===== QR Modals ===== */
$('showGCQR').onclick = ()=>{$('qrGCash').style.display='grid'};
$('showGoQR').onclick  = ()=>{$('qrGo').style.display='grid'};
window.closeModals = ()=>['qrGCash','qrGo','buyInfo'].forEach(id=>$(id).style.display='none');

/* ===== Buy flow: copy + 15s popup + Messenger ===== */
buyBtn.addEventListener('click', ()=>{
  const q = parseInt(diasIn.value||'0',10);
  const rt = activeRate(q);
  const total = (q*rt).toFixed(2);

  const order = [
    'ORDER — Legend of Ymir 💎',
    'Buyer: MOISES BITONIO',
    'Server: '+serverIn.value.trim(),
    'Diamonds: '+q.toLocaleString()+' 💎',
    'Rate: ₱'+rt.toFixed(2),
    'Total: ₱'+total,
    'Note: Paste this in Messenger and send.'
  ].join('\n');

  try{ navigator.clipboard.writeText(order);}catch(_){}

  $('buyInfo').style.display='grid';
  let s = 15; const cd = $('countdown');
  const url = 'https://m.me/mbitonio?text='+encodeURIComponent(order);
  cd.textContent = 'Redirecting to Messenger in '+s+'s…';
  const iv = setInterval(()=>{
    s--; cd.textContent = 'Redirecting to Messenger in '+s+'s…';
    if(s<=0){ clearInterval(iv); window.location.href = url; }
  },1000);
  $('goNow').onclick = ()=>{ clearInterval(iv); window.location.href = url; };
});