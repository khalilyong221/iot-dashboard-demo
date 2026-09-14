(() => {
  const shared=window.IoTShared;
  const devices=()=>shared?.getFieldDevices?.()||[];
  const $=id=>document.getElementById(id);
  const zones=['A 区温室','B 区冷库','C 区仓库','D 区泵站','E 区配电房'];
  const windows={
    '24h':{label:'Today',points:24,mult:1},
    '7d':{label:'Last 7 days',points:14,mult:.94},
    '30d':{label:'Last 30 days',points:15,mult:.88}
  };
  let current='24h';
  const filtered=()=>{const z=$('zone')?.value||'all';return z==='all'?devices():devices().filter(d=>d.zone===z)};
  const pct=v=>`${Number(v||0).toFixed(1)}%`;
  function metrics(){
    const list=filtered(), total=list.length||1;
    const online=list.filter(d=>d.status==='online').length;
    const warning=list.filter(d=>d.status==='warning').length;
    const offline=list.filter(d=>d.status==='offline').length;
    const availability=(online+warning*.45)/total*100;
    const oee=Math.max(70,Math.min(98,availability*.9-warning/total*100*.18+3));
    const mtbf=Math.max(28,Math.round(36+availability*2.5-offline*.08-warning*.03));
    const mttr=Math.max(12,Math.round(21-warning*.02-offline*.015));
    $('availability').textContent=pct(availability);
    $('oee').textContent=pct(oee);
    $('mtbf').textContent=`${mtbf}h`;
    const mttrEl=document.querySelector('.analytics-kpis .kpi:nth-child(4) strong');if(mttrEl)mttrEl.textContent=`${mttr}m`;
    const energyEl=document.querySelector('.analytics-kpis .kpi:nth-child(5) strong');
    if(energyEl){const base=current==='24h'?2480:current==='7d'?17120:71600;energyEl.textContent=Math.round(base*windows[current].mult).toLocaleString();}
    $('window-label').textContent=windows[current].label;
    return {total,online,warning,offline,availability,oee,mtbf,mttr};
  }
  function renderLine(m){
    const box=$('availability-chart'),n=windows[current].points,w=900,h=220,min=85,max=100;
    const vals=Array.from({length:n},(_,i)=>Math.max(min+1,Math.min(max,m.availability-0.7+Math.sin(i*.75)*.8+Math.cos(i*.31)*.35+i/(n-1)*1.05)));
    const pts=vals.map((v,i)=>`${(i/(n-1))*w},${h-((v-min)/(max-min))*h}`).join(' ');
    box.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${pts} ${w},${h} 0,${h}" fill="currentColor" opacity=".08"/></svg>`;
  }
  function renderBars(){
    const el=$('energy-chart'),n=current==='24h'?12:current==='7d'?7:10;el.innerHTML='';
    const list=filtered();const risk=list.filter(d=>d.status!=='online').length;
    for(let i=0;i<n;i++){const actual=Math.max(36,72-risk*.15+((i*17)%23)),target=64+(i%3)*2;const g=document.createElement('div');g.className='bar-group';g.innerHTML=`<span class="bar" style="height:${actual}%"></span><span class="bar target" style="height:${target}%"></span>`;el.appendChild(g)}
  }
  function renderTable(){
    const all=devices(), selected=$('zone')?.value||'all';
    const rows=zones.map((z,i)=>{const a=all.filter(d=>d.zone===z),online=a.filter(d=>d.status!=='offline').length,warn=a.filter(d=>d.status==='warning').length;const avail=a.length?online/a.length*100:0;const energy=Math.round(360+i*66+warn*2.1+(100-avail)*1.6);return {z,a,avail,warn,energy}}).filter(r=>selected==='all'||r.z===selected);
    $('asset-table').innerHTML=`<div class="asset-row head"><div>区域</div><div>在线率</div><div>异常率</div><div>今日能耗</div></div>`+rows.map(r=>`<div class="asset-row"><div class="asset-main"><i class="zone-dot"></i><strong>${r.z}</strong></div><div><div class="meter"><em style="width:${r.avail.toFixed(1)}%"></em></div><small>${pct(r.avail)}</small></div><div class="value">${pct(r.a.length?r.warn/r.a.length*100:0)}</div><div class="value">${r.energy} kWh</div></div>`).join('');
    return rows;
  }
  function renderReliability(m,rows){
    const worst=(rows||[]).slice().sort((a,b)=>a.avail-b.avail)[0];
    const values=[Math.max(95.2,99.4-m.offline*.07),Math.max(97,100-m.offline*.04),Math.max(97.4,99.7-m.warning*.025),Math.max(88,95-m.warning*.035)];
    const labels=['通信稳定度','网关健康','数据完整性','规则命中准确度'];
    document.querySelector('.reliability-list').innerHTML=values.map((v,i)=>`<div><span>${labels[i]}</span><b>${v.toFixed(1)}%</b><i><em style="width:${v.toFixed(1)}%"></em></i></div>`).join('');
    const title=document.querySelector('.insight strong'),copy=document.querySelector('.insight p');
    if(title&&copy){title.textContent=`${worst?.z||'网络'}是当前重点优化对象`;copy.textContent=`当前最弱区域在线率约 ${worst?.avail?.toFixed(1)||'--'}%。建议关联该区域网关、弱信号资产和近期告警，把分析结果直接转成预防性维护任务。`}
  }
  function render(){const m=metrics();renderLine(m);renderBars();const rows=renderTable();renderReliability(m,rows);}
  document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');current=b.dataset.window;render()}));
  $('zone')?.addEventListener('change',render);$('refresh')?.addEventListener('click',render);window.addEventListener('iot-model-change',render);render();
})();
