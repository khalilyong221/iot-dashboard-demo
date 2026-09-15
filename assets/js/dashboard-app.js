const statusText={online:'在线',offline:'离线',warning:'异常'};
const list=document.querySelector('#device-list'),search=document.querySelector('#search'),statusFilter=document.querySelector('#status-filter');
const alerts=document.querySelector('#alerts'),map=document.querySelector('#device-map'),modal=document.querySelector('#detail-modal');
const reasonBox=document.querySelector('#offline-reason'),actionMessage=document.querySelector('#action-message');
try{const q=new URLSearchParams(location.search).get('scene');if(q)IoTShared.setScene(q)}catch(e){}
let devices=IoTShared.getSceneDevices(),activeDeviceId=null;
function safe(fn){try{fn()}catch(e){console.warn('[render]',e)}}function renderAll(){safe(renderSceneSwitch);safe(renderMapChrome);safe(renderSummary);safe(renderMap);safe(renderAlerts);safe(renderTable);safe(renderTelemetry);if(typeof window.renderRisk==='function')safe(window.renderRisk);if(typeof window.renderHealthChart==='function')safe(window.renderHealthChart);if(typeof window.renderEnergy==='function')safe(window.renderEnergy);if(typeof window.enhanceTable==='function')safe(window.enhanceTable);}
function refreshModel(){devices=IoTShared.getSceneDevices();renderAll();if(activeDeviceId)openDetail(activeDeviceId)}
window.addEventListener('iot-model-change',refreshModel);
function formatLastSeen(minutes){if(minutes<=0)return '刚刚';if(minutes<60)return `${minutes} 分钟前`;return `${Math.floor(minutes/60)} 小时前`}
function riskScore(d){let s=d.status==='offline'?88:d.status==='warning'?68:22;if(d.rssi&&d.rssi<-80)s+=9;if(d.battery<20)s+=5;return Math.min(99,s)}
function renderSummary(){const total=devices.length,online=devices.filter(d=>d.status==='online').length,offline=devices.filter(d=>d.status==='offline').length,warning=devices.filter(d=>d.status==='warning').length,active=devices.filter(d=>d.status!=='online').length;document.querySelector('#total').textContent=total.toLocaleString();document.querySelector('#online').textContent=online.toLocaleString();const offlineEl=document.querySelector('#offline');if(offlineEl)offlineEl.textContent=offline.toLocaleString();document.querySelector('#warning').textContent=warning.toLocaleString();document.querySelector('#timeout').textContent=active.toLocaleString();document.querySelector('#online-rate').textContent=`${((online/total)*100).toFixed(1)}% 在线率`;document.querySelector('#critical-rate').textContent=`${offline} 离线 / ${warning} 异常`;document.querySelector('#nav-alert-count').textContent=active;document.querySelector('#nav-device-count').textContent=total;document.querySelector('#alert-count').textContent=`${active} ACTIVE`;document.querySelector('#last-updated').textContent=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});document.querySelector('#network-health').textContent=`${((online/total)*100).toFixed(1)}%`;document.querySelector('#health-bar').style.width=`${(online/total)*100}%`;document.querySelector('#availability').textContent=`${(98.7+((online/total)*1.1)).toFixed(1)}%`;document.querySelector('#map-health').textContent=`网络健康 ${((online/total)*100).toFixed(1)}%`;const critical=devices.filter(d=>d.status==='offline'&&d.minutesSinceSeen>60).length,high=devices.filter(d=>d.status==='offline'&&d.minutesSinceSeen<=60).length,normal=warning;document.querySelector('#sev-critical').textContent=critical;document.querySelector('#sev-high').textContent=high;document.querySelector('#sev-normal').textContent=normal}
function renderMap(){map.querySelectorAll('.map-pin').forEach(x=>x.remove());const pinStep=Math.max(1,Math.round(devices.length/70));devices.filter((_,i)=>i%pinStep===0).forEach(d=>{const pin=document.createElement('button');pin.className=`map-pin ${d.status}`;pin.style.left=`${d.x}%`;pin.style.top=`${d.y}%`;pin.title=`${d.name} · ${statusText[d.status]}`;pin.setAttribute('aria-label',`查看 ${d.name}`);pin.addEventListener('click',()=>openDetail(d.id));map.appendChild(pin)})}
function renderAlerts(){const items=devices.filter(d=>d.status!=='online').sort((a,b)=>riskScore(b)-riskScore(a)).slice(0,6);alerts.innerHTML=items.map(d=>`<div class="alert-item ${d.status}" data-id="${d.id}"><div class="alert-icon">${d.status==='offline'?'!':'△'}</div><div><strong>${d.name}</strong><span>${d.zone} · ${d.status==='offline'?formatLastSeen(d.minutesSinceSeen)+' · 超时未上报':'遥测异常 · 风险 '+riskScore(d)+'/100'}</span></div><b class="alert-arrow">›</b></div>`).join('')||'<div class="empty">暂无活动事件</div>';alerts.querySelectorAll('.alert-item').forEach(x=>x.addEventListener('click',()=>openDetail(x.dataset.id)))}
function signalHTML(d){if(!d.rssi)return '<span>--</span>';const level=Math.max(1,Math.min(5,Math.ceil((d.rssi+100)/10)));return `<div class="signal"><span class="signal-bars">${[1,2,3,4,5].map(i=>`<i style="height:${i*2+3}px;opacity:${i<=level?1:.2}"></i>`).join('')}</span><span>${d.rssi} dBm</span></div>`}
function batteryHTML(d){if(d.status==='offline')return '--';return `<div class="battery"><span class="battery-track"><i style="width:${d.battery}%"></i></span><span>${d.battery}%</span></div>`}
function renderTable(){const keyword=search.value.trim().toLowerCase(),selected=statusFilter.value;const filtered=devices.filter(d=>`${d.name} ${d.id} ${d.zone} ${d.gateway||''}`.toLowerCase().includes(keyword)&&(selected==='all'||d.status===selected));list.innerHTML=filtered.slice(0,200).map(d=>`<tr data-id="${d.id}" tabindex="0"><td><div class="device-name">${d.name}</div><div class="device-id">${d.id} · ${d.zone} · ${d.gateway||'Gateway-A01'}</div></td><td><span class="badge ${d.status}">${statusText[d.status]}</span></td><td>${signalHTML(d)}</td><td>${d.temperature===null?'--':`${d.temperature.toFixed(1)}°C`}</td><td>${batteryHTML(d)}</td><td>${formatLastSeen(d.minutesSinceSeen)}${d.status!=='online'?' ⚠':''}</td><td><span class="health-pill ${riskScore(d)>70?'danger':riskScore(d)>45?'warn':'good'}">${100-riskScore(d)}</span></td><td class="row-action">›</td></tr>`).join('')||'<tr><td colspan="8" class="empty">没有找到匹配设备</td></tr>';document.querySelector('#shown-count').textContent=Math.min(filtered.length,200);document.querySelector('#filtered-count').textContent=filtered.length;list.querySelectorAll('tr[data-id]').forEach(row=>{row.addEventListener('click',()=>openDetail(row.dataset.id));row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetail(row.dataset.id)}})})}
function renderTrend(d){document.querySelector('#trend-bars').innerHTML=(d.history||[]).map(x=>{const v=x.temperature===null?45:Math.max(20,Math.min(95,42+x.temperature*2));return `<div class="trend-bar" style="height:${v}%" title="${x.temperature===null?'无温度数据':`${x.temperature}°C`}"></div>`}).join('')}
function renderTimeline(d){const events=d.history||[];document.querySelector('#timeline').innerHTML=events.slice(-5).reverse().map((x,i)=>`<div class="timeline-item"><i class="timeline-dot ${i===0&&d.status!=='online'?'bad':'ok'}"></i><div><strong>${i===0&&d.status!=='online'?'异常状态':'遥测上报'}</strong><span>${x.time} · ${x.temperature===null?'无温度':x.temperature+'°C'}</span></div></div>`).join('')}
function renderHistory(d){const p=document.querySelector('#history-panel');p.innerHTML=`<h3>最近历史数据</h3><div class="history-list">${(d.history||[]).map(x=>`<div class="history-row"><span>${x.time}</span><strong>${x.temperature===null?'--':`${x.temperature}°C`}</strong></div>`).join('')}</div><p class="history-note">演示数据；真实版可接入时序数据库。</p>`;p.classList.remove('hidden')}
function openDetail(id){const d=IoTShared.getDevice(id);if(!d)return;activeDeviceId=id;document.querySelector('#modal-name').textContent=d.name;document.querySelector('#modal-id').textContent=`${d.id} · ${d.zone}`;document.querySelector('#modal-status').textContent=statusText[d.status];document.querySelector('#modal-signal').textContent=d.rssi?`${d.rssi} dBm`:d.signal;document.querySelector('#modal-temperature').textContent=d.temperature===null?'--':`${d.temperature.toFixed(1)}°C`;document.querySelector('#modal-battery').textContent=`${d.battery}%`;document.querySelector('#modal-type').textContent=d.type||'IoT Sensor';document.querySelector('#modal-gateway').textContent=d.gateway||'Gateway-A01';document.querySelector('#modal-protocol').textContent=d.protocol||'MQTT';document.querySelector('#modal-firmware').textContent=d.firmware||'v2.4.1';const badge=document.querySelector('#modal-status-badge');badge.className=`status-badge ${d.status}`;badge.textContent=d.status.toUpperCase();if(d.status==='offline'){reasonBox.classList.remove('hidden');document.querySelector('#reason-main').textContent=d.offlineReason||'通信链路异常';document.querySelector('#reason-detail').textContent=`${d.offlineReasonDetail||'建议检查网关与无线链路'} 当前电量：${d.battery}%。`}else reasonBox.classList.add('hidden');actionMessage.textContent='';document.querySelector('#history-panel').classList.add('hidden');renderTrend(d);renderTimeline(d);modal.classList.remove('hidden')}
function getActive(){return activeDeviceId?IoTShared.getDevice(activeDeviceId):null}
function reconnect(){const d=getActive();if(!d)return;if(d.status!=='offline'){actionMessage.textContent='设备当前不是离线状态，无需重新连接。';return}actionMessage.textContent='正在重新连接……';setTimeout(()=>{IoTShared.updateFieldDevice(d.id,{status:'online',signal:'良好',rssi:-66,minutesSinceSeen:0});actionMessage.textContent='✓ 连接恢复，事件状态已更新。';openDetail(d.id)},700)}
function restart(){const d=getActive();if(!d)return;actionMessage.textContent='正在发送远程重启指令……';setTimeout(()=>{const nextStatus=d.status==='offline'?'online':d.status;IoTShared.updateFieldDevice(d.id,{restartCount:(d.restartCount||0)+1,minutesSinceSeen:0,status:nextStatus,signal:nextStatus==='online'?'一般':d.signal,rssi:nextStatus==='online'?-66:d.rssi});actionMessage.textContent=`✓ 设备重启完成，累计执行 ${(d.restartCount||0)+1} 次。`;openDetail(d.id)},700)}
function renderTelemetry(){const values=devices.filter(d=>d.temperature!==null).slice(0,60).map(d=>d.temperature);const avg=values.reduce((a,b)=>a+b,0)/values.length;document.querySelector('#avg-temp').textContent=`${avg.toFixed(1)}°C`;document.querySelector('#activity-count').textContent=(1120+(devices.filter(d=>d.status==='online').length%400)).toLocaleString();document.querySelector('#activity-bars').innerHTML=Array.from({length:18},(_,i)=>`<i style="height:${8+((i*13)%25)}px"></i>`).join('');document.querySelector('#energy-bars').innerHTML=Array.from({length:18},(_,i)=>`<i style="height:${18+((i*19)%42)}%"></i>`).join('');document.querySelector('#health-chart').innerHTML=Array.from({length:32},(_,i)=>`<i style="height:${42+((i*17)%34)}%"></i>`).join('');document.querySelector('#risk-ranking').innerHTML=[...devices].sort((a,b)=>riskScore(b)-riskScore(a)).slice(0,5).map((d,i)=>`<div class="risk-row" data-id="${d.id}"><span class="rank">0${i+1}</span><div><strong>${d.name}</strong><small>${d.zone} · ${statusText[d.status]}</small></div><b>${riskScore(d)}</b></div>`).join('');document.querySelectorAll('.risk-row').forEach(x=>x.addEventListener('click',()=>openDetail(x.dataset.id)))}
function aiAnswer(q){const text=q.toLowerCase();const target=text.match(/[a-z]+-?\d{3,5}/i);const named=target?devices.find(x=>x.id.toLowerCase()===target[0].toLowerCase()):null;/* 编号不在模型里时退回到当前风险最高的设备，而不是直接回一句"没找到" */const d=named||[...devices].sort((a,b)=>riskScore(b)-riskScore(a))[0];if(text.includes('区域')||text.includes('网络')){const groups={};devices.forEach(x=>{groups[x.zone]??={bad:0,total:0};groups[x.zone].total++;if(x.status!=='online'||(x.rssi&&x.rssi<-80))groups[x.zone].bad++});const best=Object.entries(groups).sort((a,b)=>b[1].bad/b[1].total-a[1].bad/b[1].total)[0];return `<div class="ai-summary"><b>区域网络诊断</b><span>${best[0]} 区风险最高：${Math.round(best[1].bad/best[1].total*100)}% 设备存在异常信号或状态。</span></div><div class="ai-grid"><div><small>判断</small><strong>网络侧优先排查</strong></div><div><small>依据</small><strong>${best[1].bad} / ${best[1].total} 台异常</strong></div></div><p>建议优先检查该区域网关覆盖、RSSI 分布与最近网络事件，再判断是否存在设备侧故障。</p>`}if(!d)return '<p>当前场景没有可分析的设备。</p>';const score=riskScore(d);const cause=d.status==='offline'?(d.rssi&&d.rssi<-80?'无线信号弱 / 网关链路异常':'设备通信超时'):(d.rssi&&d.rssi<-80?'信号质量下降':'遥测波动');return `<div class="ai-summary"><b>${d.id} · ${d.name}</b><span>当前风险 ${score}/100 · ${statusText[d.status]}</span></div><div class="ai-grid"><div><small>主要原因</small><strong>${cause}</strong></div><div><small>置信度</small><strong>${d.status==='offline'?'72%':'64%'}</strong></div><div><small>信号</small><strong>${d.rssi||'--'} dBm</strong></div><div><small>最近上报</small><strong>${formatLastSeen(d.minutesSinceSeen)}</strong></div></div><p><b>建议动作：</b>先检查 ${d.gateway||'Gateway-A01'} 的通信状态；若同网关设备同步异常，优先处理网关；若仅单设备异常，再检查设备供电、无线环境与固件。</p>`}
function runAI(q){const box=document.querySelector('#ai-result');box.innerHTML='<div class="ai-loading">正在聚合设备状态、网络指标与历史事件……</div>';setTimeout(()=>{box.innerHTML=aiAnswer(q||'找出今天风险最高的设备')},500)}
document.querySelector('#close-modal').addEventListener('click',()=>{modal.classList.add('hidden');activeDeviceId=null});document.querySelector('#reconnect-btn').addEventListener('click',reconnect);document.querySelector('#restart-btn').addEventListener('click',restart);document.querySelector('#history-btn').addEventListener('click',()=>{const d=getActive();if(d)renderHistory(d)});modal.addEventListener('click',e=>{if(e.target===modal){modal.classList.add('hidden');activeDeviceId=null}});document.addEventListener('keydown',e=>{if(e.key==='Escape'){modal.classList.add('hidden');activeDeviceId=null}});search.addEventListener('input',renderTable);statusFilter.addEventListener('change',renderTable);document.querySelector('#refresh-btn').addEventListener('click',renderAll);document.querySelector('#show-alerts').addEventListener('click',()=>{statusFilter.value='offline';renderTable();document.querySelector('#devices').scrollIntoView({behavior:'smooth'})});document.querySelector('#ai-run').addEventListener('click',()=>runAI(document.querySelector('#ai-input').value));document.querySelector('#ai-input').addEventListener('keydown',e=>{if(e.key==='Enter')runAI(e.target.value)});document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{document.querySelector('#ai-input').value=b.dataset.prompt;runAI(b.dataset.prompt)}));renderAll();
window.renderAll=renderAll;window.openDetail=openDetail;window.openDeviceDetail=openDetail;

/* AI 助手的问题示例同样不能写死设备号：原先写的是 A-1032，资产表里没有这个编号，
   点一下「为什么 A-1032 最近频繁掉线」只会得到一句"没有找到对应设备"。
   加载时用真实的离线设备号把 __CASE__ 占位填掉。 */
function fillCaseTokens(){
  const d=IoTShared.getDemoCase?IoTShared.getDemoCase('field'):null;
  if(!d)return;
  ['data-prompt','placeholder'].forEach(function(attr){
    document.querySelectorAll('['+attr+'*="__CASE__"]').forEach(function(el){
      el.setAttribute(attr,el.getAttribute(attr).split('__CASE__').join(d.id));
      if(attr==='data-prompt'&&el.textContent.indexOf('__CASE__')>=0)el.textContent=el.textContent.split('__CASE__').join(d.id);
    });
  });
}
fillCaseTokens();

/* ── 设备深链：index.html?device=IOT-0011（可带 #devices / #ai-section）──
   演示动线第 3 步「定位异常资产」和第 5 步「让 AI 给出解释」都从这里进；
   原先这个参数没人解析，点过去只会滚到锚点，看不到任何具体设备。 */
function deepLink(){
  let id='';
  try{ id=new URLSearchParams(location.search).get('device')||''; }catch(e){}
  if(!id||!IoTShared.getDevice(id))return;
  (window.openDetail||openDetail)(id);
  if(/ai/i.test(location.hash||''))setTimeout(()=>window.IoTAIDiagnosis?.open(id),80);
}
/* 延后一点执行：dashboard-enhance.js 会包一层 openDetail 往档案卡片里补「AI 根因分析」按钮 */
setTimeout(deepLink,120);

/* ── 侧栏高亮跟随页内锚点 ──
   总览 / 设备 / AI 助手是同一页里的三段，点过去只发生滚动，`.active` 一直钉在「总览」上，
   看起来像一张静态图。这里只接管以 # 开头的导航项，跨页链接（告警/分析/拓扑…）不动。 */
function syncNavActive(){
  const hash=(location.hash||'').replace('#','');
  document.querySelectorAll('.nav-item').forEach(function(a){
    const href=a.getAttribute('href')||'';
    if(href.charAt(0)!=='#')return;
    a.classList.toggle('active',href.slice(1)===(hash||'overview'));
  });
}
window.addEventListener('hashchange',syncNavActive);
syncNavActive();

/* ── 场景切换：工业互联网 / 楼宇自控 / 智慧家居 / 全部设备 ── */
function renderSceneSwitch(){
  const host=document.querySelector('#scene-tabs');if(!host)return;
  const cur=IoTShared.getScene();
  host.innerHTML=IoTShared.SCENES.map(s=>`<button class="scene-tab${s.key===cur?' active':''}" type="button" data-scene="${s.key}" aria-pressed="${s.key===cur}"><span class="scene-icon">${s.icon}</span><span class="scene-text"><strong>${s.label}</strong><small>${s.sub}</small></span></button>`).join('');
  host.querySelectorAll('.scene-tab').forEach(btn=>btn.addEventListener('click',()=>switchScene(btn.dataset.scene)));
  /* 全国设备分布地图入口：带上当前场景，进入后地图与驾驶舱保持同一视角 */
  const g=document.querySelector('#map-global');if(g)g.href='pages/china-map.html?scene='+encodeURIComponent(cur);
}

function switchScene(key){
  if(key===IoTShared.getScene())return;
  IoTShared.setScene(key);
  try{const u=new URL(location.href);u.searchParams.set('scene',key);history.replaceState(null,'',u)}catch(e){}
  activeDeviceId=null;
  if(modal)modal.classList.add('hidden');
  const searchEl=document.querySelector('#search'),filterEl=document.querySelector('#status-filter');
  if(searchEl)searchEl.value='';
  if(filterEl)filterEl.selectedIndex=0;
  refreshModel();
}

function renderMapChrome(){
  const meta=IoTShared.getSceneMeta();
  const title=document.querySelector('#map-title');if(title)title.textContent=meta.mapTitle;
  const desc=document.querySelector('#scene-desc');if(desc)desc.textContent=meta.desc;
  if(!map)return;
  map.querySelectorAll('.zone-label').forEach(el=>el.remove());
  const zones=[],gws=[];
  devices.forEach(d=>{if(d.zone&&zones.indexOf(d.zone)<0)zones.push(d.zone);if(d.gateway&&gws.indexOf(d.gateway)<0)gws.push(d.gateway)});
  const cols=Math.max(2,Math.ceil(Math.sqrt(zones.length))),rows=Math.max(1,Math.ceil(zones.length/cols));
  zones.forEach((z,i)=>{
    const el=document.createElement('div');
    el.className='zone-label';
    el.textContent=z;
    el.style.left=(7+(i%cols)*(86/cols)).toFixed(2)+'%';
    el.style.top=(9+Math.floor(i/cols)*(72/rows)).toFixed(2)+'%';
    map.appendChild(el);
  });
  const zoneEl=document.querySelector('#map-zones');if(zoneEl)zoneEl.textContent='● '+zones.length+' 个'+meta.zoneLabel;
  const gwEl=document.querySelector('#map-gateways');if(gwEl)gwEl.textContent='● '+gws.length+' 个网关';
  const totalEl=document.querySelector('#map-total');if(totalEl)totalEl.textContent='● '+devices.length.toLocaleString()+' 个逻辑设备';
}

window.renderSceneSwitch=renderSceneSwitch;window.switchScene=switchScene;
