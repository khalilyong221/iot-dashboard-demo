(() => {
  const shared = window.IoTShared;
  const devices = shared?.getFieldDevices?.() || Array.from({length:1000},(_,i)=>({id:`FD-${String(i+1).padStart(4,'0')}`,status:i%17===0?'warning':i%31===0?'offline':'online',zone:['A 区温室','B 区冷库','C 区仓库','D 区泵站','E 区配电房'][i%5]}));
  const $=id=>document.getElementById(id);
  const zones=['A 区温室','B 区冷库','C 区仓库','D 区泵站','E 区配电房'];
  const windows={'24h':{label:'Today',points:24},'7d':{label:'Last 7 days',points:14},'30d':{label:'Last 30 days',points:15}};
  let current='24h';
  function filtered(){const z=$('zone').value;return z==='all'?devices:devices.filter(d=>d.zone===z)}
  function pct(v){return `${v.toFixed(1)}%`}
  function metrics(){const list=filtered();const online=list.filter(d=>d.status!=='offline').length;const warning=list.filter(d=>d.status==='warning').length;const availability=list.length?online/list.length*100:0;const oee=Math.max(0,availability-5.8-warning/list.length*8);const mtbf=Math.round(310+(availability-95)*9-warning*1.4);$('availability').textContent=pct(availability);$('oee').textContent=pct(oee);$('mtbf').textContent=`${mtbf}h`}
  function line(){const el=$('availability-chart');const n=windows[current].points;const vals=Array.from({length:n},(_,i)=>91+Math.sin(i*.62)*2.2+(i/n)*4+((i*7)%5)*.22);const w=760,h=220;const pts=vals.map((v,i)=>`${(i/(n-1))*w},${h-((v-85)/15)*h}`).join(' ');el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5"/><polyline points="${pts} ${w},${h} 0,${h}" fill="currentColor" opacity=".08"/></svg>`}
  function bars(){const el=$('energy-chart');const n=current==='24h'?12:current==='7d'?7:10;const max=100;el.innerHTML='';for(let i=0;i<n;i++){const actual=48+((i*17)%42),target=62;const g=document.createElement('div');g.className='bar-group';g.innerHTML=`<span class="bar" style="height:${actual/max*100}%"></span><span class="bar target" style="height:${target/max*100}%"></span>`;el.appendChild(g)}}
  function table(){const list=filtered();const rows=zones.map(z=>{const a=devices.filter(d=>d.zone===z);const online=a.filter(d=>d.status!=='offline').length;const warn=a.filter(d=>d.status==='warning').length;const avail=a.length?online/a.length*100:0;const energy=Math.round(310+(z.charCodeAt(0)-65)*74+warn*2.4);return `<div class="asset-row"><div class="asset-main"><i class="zone-dot"></i><strong>${z}</strong></div><div><div class="meter"><em style="width:${avail}%"></em></div><small>${pct(avail)}</small></div><div class="value">${pct(a.length?warn/a.length*100:0)}</div><div class="value">${energy} kWh</div></div>`}).join('');$('asset-table').innerHTML=`<div class="asset-row head"><div>区域</div><div>在线率</div><div>异常率</div><div>今日能耗</div></div>${rows}`}
  function render(){metrics();line();bars();table();$('window-label').textContent=windows[current].label}
  document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');current=b.dataset.window;render()}));
  $('zone').addEventListener('change',render);$('refresh').addEventListener('click',render);render();
})();
