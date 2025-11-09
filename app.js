(function(){
  // ------- Helpers -------
  const $ = id => document.getElementById(id);
  const clean = v => String(v ?? '').replace(/[^\d.]/g,'');
  const toInt = v => { const m = clean(v).match(/^\d+/); return m? parseInt(m[0],10):0; };
  const toNum = v => { const m = clean(v).match(/^\d+(?:\.\d+)?/); return m? parseFloat(m[0]):0; };
  const fmt = n => Number(n).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2});
  const nowISO = () => new Date().toISOString().replace('T',' ').slice(0,19);

  const MIN = 1000;
  const TIERS = [
    {min:8000, rate:700},
    {min:4000, rate:750},
    {min:1000, rate:800}
  ];
  const BASE_REF = 900;

  // ------- Elements -------
  const diasIn=$('dias'), phpIn=$('phpIn'), serverIn=$('serverIn');
  const rateOut=$('rateOut'), saveOut=$('saveOut'), warn=$('warn'), buyBtn=$('buyBtn');
  const buyPopup=$('buyPopup'), closePop=$('closePop'), buyOrderId=$('buyOrderId'), countDownEl=$('countDown');
  const gcashRow=$('gcashRow'), gcashPopup=$('gcashPopup'), gcashOk=$('gcashOk');
  const showQR=$('showQR'), qrPopup=$('qrPopup'), qrOk=$('qrOk');
  const stockChip=$('stockChip'), stockIcon=$('stockIcon'), stockTotalEl=$('stockTotal');
  const stockModal=$('stockModal'), stockList=$('stockList'), btnCloseStock=$('btnCloseStock'), btnSaveStock=$('btnSaveStock'), btnAddServer=$('btnAddServer'), srvSearch=$('srvSearch');
  const secretLogo=$('secretLogo');

  // ------- Storage Keys -------
  const STOCK_KEY='ymir_stock_by_server';
  const ORDERS_KEY='ymir_orders_map';

  // ------- State (unique) -------
  let adminMode=false, dirty=false, filter='';
  let tap5=0, tapTimer=null;     // 5 taps on 📦 for admin
  let tap6=0, tap6Timer=null;    // 6 taps on logo for Delivered

  // ------- Stock -------
  const defaultServers=[...Array.from({length:30},(_,i)=>`ASIA-${String(i+1).padStart(3,'0')}`),'HOF1','HOF2','HOF3','HOF4','HOF5'];
  let stockMap = loadStock();

  function loadStock(){
    try{
      const raw=localStorage.getItem(STOCK_KEY);
      let obj= raw? JSON.parse(raw): {};
      if(!obj || typeof obj!=='object') obj={};
      defaultServers.forEach(s=>{ if(!(s in obj)) obj[s]=0; });
      if(!raw) localStorage.setItem(STOCK_KEY, JSON.stringify(obj));
      renderTotals();
      return obj;
    }catch(_){
      const obj = Object.fromEntries(defaultServers.map(s=>[s,0]));
      localStorage.setItem(STOCK_KEY, JSON.stringify(obj));
      renderTotals();
      return obj;
    }
  }
  function saveStock(){ try{ localStorage.setItem(STOCK_KEY, JSON.stringify(stockMap)); }catch(_){} renderTotals(); }
  function renderTotals(){ const total=Object.values(stockMap).reduce((a,b)=>a+(parseInt(b,10)||0),0); stockTotalEl.textContent=total.toLocaleString(); }

  // ------- Orders -------
  function loadOrders(){ try{ return JSON.parse(localStorage.getItem(ORDERS_KEY)||'{}'); }catch(_){ return {}; } }
  function saveOrders(map){ try{ localStorage.setItem(ORDERS_KEY, JSON.stringify(map)); }catch(_){} }

  // ------- Rates / Calculator -------
  function getRate(qty){ if(!qty || qty<MIN) return null; for(const t of TIERS){ if(qty>=t.min) return t.rate; } return null; }
  function recalcFromDias(){
    const q=toInt(diasIn.value); const r=getRate(q);
    if(!r){ rateOut.textContent='—'; saveOut.textContent='—'; }
    else{
      rateOut.textContent=`₱${r.toFixed(0)} / 1,000`;
      const save=Math.max(0,(q/1000)*(BASE_REF-r)); saveOut.textContent=`₱${fmt(save)}`;
    }
    validate();
  }
  function recalcFromPHP(){
    const p=toNum(phpIn.value); if(!p){ validate(); return; }
    let bestQ=0, bestR=null;
    for(const t of TIERS){
      const q=Math.floor((p/t.rate)*1000);
      if(q>=t.min && q>bestQ){ bestQ=q; bestR=t.rate; }
    }
    if(bestQ>=MIN && bestR){
      diasIn.value=String(bestQ);
      rateOut.textContent=`₱${bestR.toFixed(0)} / 1,000`;
      const save=Math.max(0,(bestQ/1000)*(BASE_REF-bestR)); saveOut.textContent=`₱${fmt(save)}`;
    }
    validate();
  }
  function validate(){
    const q=toInt(diasIn.value), s=(serverIn.value||'').trim();
    const ok=q>=MIN && !!s;
    warn.style.display=ok?'none':'block';
    buyBtn.disabled=!ok;
  }
  diasIn.addEventListener('input',recalcFromDias);
  phpIn.addEventListener('input',recalcFromPHP);
  serverIn.addEventListener('input',validate);

  // ------- GCash UI -------
  gcashRow.addEventListener('click', ()=>{ const num=$('gcashNumber').innerText; navigator.clipboard?.writeText(num).catch(()=>{}); gcashPopup.hidden=false; });
  gcashOk.addEventListener('click', ()=> gcashPopup.hidden=true);
  showQR.addEventListener('click', ()=> qrPopup.hidden=false);
  qrOk.addEventListener('click', ()=> qrPopup.hidden=true);

  // ------- Buy flow (15s + Messenger redirect) -------
  buyBtn.addEventListener('click', ()=>{
    const qty=toInt(diasIn.value), srv=(serverIn.value||'').trim(), rate=getRate(qty);
    if(!rate) return;
    const totalPhp=(qty/1000)*rate;
    const id='YMIR-'+Date.now().toString(36).toUpperCase();
    const orders=loadOrders();
    orders[id]={id, qty, server:srv, rate, total:totalPhp, status:'Pending', created:nowISO()};
    saveOrders(orders);

    const msg=[`ORDER: ${id}`,`Server: ${srv}`,`Diamonds: ${qty} 💎`,`Rate: ₱${rate.toFixed(0)}/1,000`,`Total: ₱${fmt(totalPhp)}`,`Buyer: I Paid (after sending)`].join('\n');
    navigator.clipboard?.writeText(msg).catch(()=>{});
    $('buyOrderId').textContent=id;

    buyPopup.hidden=false;
    let t=15; $('countDown').textContent=String(t);
    const iv=setInterval(()=>{ t--; $('countDown').textContent=String(t); if(t<=0){ clearInterval(iv); window.location.href='https://m.me/mbitonio'; } },1000);
    closePop.onclick=()=>{ clearInterval(iv); buyPopup.hidden=true; };
  });

  // ------- Tracking -------
  const trackBtn=$('trackBtn'), trackIn=$('trackIn'), trackOut=$('trackOut'), trackNone=$('trackNone');
  const t_id=$('t_id'), t_status=$('t_status'), t_server=$('t_server'), t_qty=$('t_qty'), t_rate=$('t_rate'), t_total=$('t_total'), t_time=$('t_time');
  const btnPaid=$('btnPaid');

  function renderTrack(o){
    if(!o){ trackOut.style.display='none'; trackNone.style.display='block'; return; }
    trackNone.style.display='none'; trackOut.style.display='block';
    t_id.textContent=o.id||'—'; t_status.textContent=`• ${o.status||'—'}`;
    t_server.textContent=o.server||'—'; t_qty.textContent=(o.qty||0).toLocaleString();
    t_rate.textContent=o.rate?`₱${o.rate.toFixed(0)}/1,000`:'—';
    t_total.textContent=o.total?`₱${fmt(o.total)}`:'—';
    t_time.textContent=o.created||'—';
  }
  trackBtn.addEventListener('click', ()=>{ const id=(trackIn.value||'').trim(); const map=loadOrders(); renderTrack(map[id]); });
  btnPaid.addEventListener('click', ()=>{ const id=(t_id.textContent||'').trim(); if(!id) return; const map=loadOrders(); if(!map[id]) return; map[id].status='Buyer Paid'; saveOrders(map); renderTrack(map[id]); alert('Status set to "Buyer Paid"'); });

  // ------- Secret Delivered (6 taps on logo) with auto-deduct -------
  function onLogoTap(){
    tap6++; clearTimeout(tap6Timer); tap6Timer=setTimeout(()=>tap6=0,1200);
    if(tap6>=6){
      tap6=0;
      const id=prompt('Enter Order ID to mark DELIVERED:'); if(!id) return;
      const map=loadOrders(); const o=map[id]; if(!o){ alert('Order not found.'); return; }
      if(o.status==='Delivered'){ alert('Already delivered.'); return; }
      const srv=o.server; const have=parseInt((stockMap[srv]||0),10);
      stockMap[srv]=Math.max(0, have-(parseInt(o.qty,10)||0));
      saveStock();
      o.status='Delivered'; saveOrders(map);
      alert('Marked Delivered. Stock auto-deducted ✔');
      if(($('t_id').textContent||'')===id){ renderTrack(o); }
    }
  }
  secretLogo.addEventListener('click', onLogoTap);

  // ------- Stock modal (view) + Admin (5 taps on 📦) -------
  function openStock(readOnly=true){
    stockModal.hidden=false; adminMode=!readOnly; dirty=false; btnSaveStock.disabled=true; filter=''; if(srvSearch) srvSearch.value='';
    renderStockList();
  }
  function closeStock(){ stockModal.hidden=true; }
  function renderStockList(){
    stockList.innerHTML='';
    const names=Object.keys(stockMap).sort((a,b)=>a.localeCompare(b,'en',{numeric:true,sensitivity:'base'})).filter(n=>!filter || n.toLowerCase().includes(filter.toLowerCase()));
    if(!names.length){ const d=document.createElement('div'); d.style.cssText='padding:20px;text-align:center;color:#ccb9c1'; d.textContent='No servers found.'; stockList.appendChild(d); return; }
    names.forEach(name=>{
      const row=document.createElement('div'); row.className='srvRow';

      // name cell
      let nameCell;
      if(adminMode){
        nameCell=document.createElement('div');
        const nameInput=document.createElement('input'); nameInput.className='nameEdit'; nameInput.value=name; nameCell.appendChild(nameInput);
        const renameBtn=document.createElement('button'); renameBtn.className='btnTiny btnGhost'; renameBtn.textContent='Rename';
        renameBtn.onclick=()=>{ const newName=(nameInput.value||'').trim(); if(!newName || newName===name) return;
          if(stockMap[newName]!=null) return alert('Name already exists.');
          stockMap[newName]=stockMap[name]; delete stockMap[name]; dirty=true; btnSaveStock.disabled=false; renderTotals(); renderStockList(); };
        nameCell.appendChild(renameBtn);
      }else{
        const h=document.createElement('h4'); h.textContent=name; nameCell=h;
      }

      // count cell
      let countCell;
      if(adminMode){
        countCell=document.createElement('div'); countCell.className='srvCnt edit';
        const input=document.createElement('input'); input.type='number'; input.min='0'; input.step='1'; input.value=String(stockMap[name]||0);
        input.addEventListener('input', ()=>{ stockMap[name]=Math.max(0, parseInt(input.value||'0',10)||0); dirty=true; btnSaveStock.disabled=false; renderTotals(); });
        countCell.appendChild(input);
      }else{
        countCell=document.createElement('div'); countCell.className='srvCnt'; countCell.textContent=(stockMap[name]||0).toLocaleString();
      }

      const act=document.createElement('div'); act.style.cssText='text-align:right;display:flex;gap:8px;justify-content:flex-end';
      if(adminMode){ const del=document.createElement('button'); del.className='btnTiny btnGhost'; del.textContent='Remove';
        del.onclick=()=>{ if(confirm(`Remove server "${name}"?`)){ delete stockMap[name]; dirty=true; btnSaveStock.disabled=false; renderTotals(); renderStockList(); } };
        act.appendChild(del);
      }

      row.appendChild(nameCell); row.appendChild(countCell); row.appendChild(act); stockList.appendChild(row);
    });
  }
  stockChip.addEventListener('click', ()=> openStock(true));  // viewer for buyers
  stockIcon.addEventListener('click', (e)=>{                  // admin: 5 taps on 📦
    e.stopPropagation();
    tap5++; clearTimeout(tapTimer); tapTimer=setTimeout(()=>tap5=0,1200);
    if(tap5>=5){ tap5=0; openStock(false); }
  });
  btnCloseStock.addEventListener('click', closeStock);
  btnSaveStock.addEventListener('click', ()=>{ saveStock(); dirty=false; btnSaveStock.disabled=true; alert('Stocks saved ✔'); });
  btnAddServer.addEventListener('click', ()=>{ if(!adminMode) return alert('Open Admin mode first (tap 📦 5x).');
    const name=prompt('New server name (e.g., ASIA-031 or HOF6):'); if(!name) return; const key=name.trim();
    if(!/^[\w\-]+$/i.test(key)) return alert('Invalid server name.');
    if(stockMap[key]!=null) return alert('Server already exists.');
    const qty=Math.max(0, parseInt(prompt('Initial stock (gold/💎):')||'0',10)||0);
    stockMap[key]=qty; dirty=true; btnSaveStock.disabled=false; renderTotals(); renderStockList();
  });
  srvSearch.addEventListener('input', ()=>{ filter=srvSearch.value||''; renderStockList(); });

  // ------- Init -------
  renderTotals();
})();
