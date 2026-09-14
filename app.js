const devices = Array.from({ length: 1000 }, (_, index) => {
  const number = String(index + 1).padStart(4, "0");
  const type = ["温度传感器", "电表", "门磁", "网关", "泵站控制器"][index % 5];
  const patterns = [
    { status: "online", minutes: index % 4 }, { status: "online", minutes: 5 + (index % 5) },
    { status: "warning", minutes: 2 + (index % 5) }, { status: "offline", minutes: 11 + (index % 30) },
    { status: "offline", minutes: 25 + (index % 90) }
  ];
  const pattern = patterns[index % patterns.length];
  const zone = ["A 区温室", "B 区冷库", "C 区仓库", "D 区泵站", "E 区配电房"][index % 5];
  const reasons = [
    ["网络连接中断", "最近一次心跳后没有收到设备响应，可能是现场网络或网关连接异常。"],
    ["设备电量过低", "模拟电量已降至告警阈值以下，设备可能因低电量停止通信。"],
    ["网关无响应", "设备所在区域的网关没有返回心跳，建议先检查网关电源与网络。"],
    ["信号质量过差", "最近通信质量持续下降，可能存在弱信号、天线或现场遮挡问题。"]
  ];
  const reason = reasons[index % reasons.length];
  return {
    name: `${type} ${number}`, id: `IOT-${number}`, status: pattern.status,
    signal: pattern.status === "offline" ? "--" : pattern.status === "warning" ? "较弱" : "良好",
    rssi: pattern.status === "offline" ? null : -48 - (index % 48),
    temperature: type === "电表" || type === "门磁" ? null : +(22 + (index % 130) / 10).toFixed(1),
    minutesSinceSeen: pattern.minutes, zone, x: 7 + ((index * 17) % 86), y: 9 + ((index * 31) % 80),
    offlineReason: reason[0], offlineReasonDetail: reason[1], battery: 35 + ((index * 13) % 66), restartCount: index % 3,
    history: Array.from({ length: 8 }, (_, i) => ({ time: `${8 + i}:00`, temperature: type === "电表" || type === "门磁" ? null : +(22 + ((index + i * 3) % 80) / 10).toFixed(1) }))
  };
});

const statusText = { online: "在线", offline: "离线", warning: "异常" };
const list = document.querySelector("#device-list"), search = document.querySelector("#search"), filter = document.querySelector("#status-filter");
const alerts = document.querySelector("#alerts"), map = document.querySelector("#device-map"), modal = document.querySelector("#detail-modal");
const reasonBox = document.querySelector("#offline-reason"), actionMessage = document.querySelector("#action-message"), historyPanel = document.querySelector("#history-panel");
let activeDeviceId = null;

function formatLastSeen(minutes){ if(minutes<=0)return "刚刚"; if(minutes<60)return `${minutes} 分钟前`; return `${Math.floor(minutes/60)} 小时前`; }
function renderSummary(){
  const total=devices.length, online=devices.filter(d=>d.status==="online").length, offline=devices.filter(d=>d.status==="offline").length, warning=devices.filter(d=>d.status==="warning").length;
  const timeout=devices.filter(d=>d.status==="offline"&&d.minutesSinceSeen>10).length;
  ["total","online","offline","warning","timeout"].forEach((id,i)=>document.querySelector(`#${id}`).textContent=[total,online,offline,warning,timeout][i]);
  document.querySelector("#online-rate").textContent=`${((online/total)*100).toFixed(1)}% 在线率`;
  document.querySelector("#alert-count").textContent=`${timeout} ACTIVE`;
  document.querySelector("#nav-alert-count").textContent=timeout;
  document.querySelector("#last-updated").textContent=new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  document.querySelector("#network-health").textContent=`${((online/total)*100).toFixed(1)}%`;
  document.querySelector("#health-bar").style.width=`${(online/total)*100}%`;
}
function renderMap(){
  const old=map.querySelectorAll(".map-pin"); old.forEach(x=>x.remove());
  devices.filter((_,i)=>i%13===0).forEach(device=>{
    const pin=document.createElement("button"); pin.className=`map-pin ${device.status}`; pin.style.left=`${device.x}%`; pin.style.top=`${device.y}%`; pin.title=`${device.name} · ${statusText[device.status]}`; pin.setAttribute("aria-label",`查看 ${device.name}`); pin.dataset.id=device.id; pin.addEventListener("click",()=>openDetail(device.id)); map.appendChild(pin);
  });
}
function renderAlerts(){
  const items=devices.filter(d=>d.status==="offline"&&d.minutesSinceSeen>10).slice(0,6);
  alerts.innerHTML=items.map(d=>`<div class="alert-item" data-id="${d.id}"><div class="alert-icon">!</div><div><strong>${d.name}</strong><span>${d.zone} · ${formatLastSeen(d.minutesSinceSeen)} · 超时未上报</span></div></div>`).join("")||`<div class="empty">暂无活动告警</div>`;
  alerts.querySelectorAll(".alert-item").forEach(x=>x.addEventListener("click",()=>openDetail(x.dataset.id)));
}
function signalHTML(device){ if(!device.rssi)return `<span>--</span>`; const level=Math.max(1,Math.min(5,Math.ceil((device.rssi+100)/10))); return `<div class="signal"><span class="signal-bars">${[1,2,3,4,5].map(i=>`<i style="height:${i*2+3}px;opacity:${i<=level?1:.2}"></i>`).join("")}</span><span>${device.rssi} dBm</span></div>`; }
function batteryHTML(device){ if(device.status==="offline")return "--"; return `<div class="battery"><span class="battery-track"><i style="width:${device.battery}%"></i></span><span>${device.battery}%</span></div>`; }
function renderTable(){
  const keyword=search.value.trim().toLowerCase(), selected=filter.value;
  const filtered=devices.filter(d=>`${d.name} ${d.id} ${d.zone}`.toLowerCase().includes(keyword)&&(selected==="all"||d.status===selected));
  list.innerHTML=filtered.slice(0,200).map(d=>`<tr data-id="${d.id}" tabindex="0"><td><div class="device-name">${d.name}</div><div class="device-id">${d.id} · ${d.zone}</div></td><td><span class="badge ${d.status}">${statusText[d.status]}</span></td><td>${signalHTML(d)}</td><td>${d.temperature===null?"--":`${d.temperature.toFixed(1)}°C`}</td><td>${batteryHTML(d)}</td><td>${formatLastSeen(d.minutesSinceSeen)}${d.status==="offline"&&d.minutesSinceSeen>10?" ⚠":""}</td><td class="row-action">›</td></tr>`).join("")||`<tr><td colspan="7" class="empty">没有找到匹配设备</td></tr>`;
  document.querySelector("#shown-count").textContent=Math.min(filtered.length,200);
  list.querySelectorAll("tr[data-id]").forEach(row=>{row.addEventListener("click",()=>openDetail(row.dataset.id));row.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openDetail(row.dataset.id)}})});
}
function renderTrend(device){document.querySelector("#trend-bars").innerHTML=device.history.map(item=>{const value=item.temperature===null?55:Math.max(25,Math.min(90,45+item.temperature));return `<div class="trend-bar" style="height:${value}%" title="${item.temperature===null?"无温度数据":`${item.temperature}°C`}"></div>`}).join("");}
function renderHistory(device){historyPanel.innerHTML=`<h3>最近历史数据</h3><div class="history-list">${device.history.map(x=>`<div class="history-row"><span>${x.time}</span><strong>${x.temperature===null?"--":`${x.temperature}°C`}</strong></div>`).join("")}</div><p class="history-note">当前为演示数据，真实版本可替换为数据库中的历史遥测。</p>`;historyPanel.classList.remove("hidden")}
function openDetail(id){
  const d=devices.find(x=>x.id===id); if(!d)return; activeDeviceId=id;
  document.querySelector("#modal-name").textContent=d.name; document.querySelector("#modal-id").textContent=`${d.id} · ${d.zone}`; document.querySelector("#modal-status").textContent=statusText[d.status];
  document.querySelector("#modal-signal").textContent=d.rssi?`${d.rssi} dBm`:d.signal; document.querySelector("#modal-temperature").textContent=d.temperature===null?"--":`${d.temperature.toFixed(1)}°C`; document.querySelector("#modal-battery").textContent=`${d.battery}%`;
  const badge=document.querySelector("#modal-status-badge"); badge.className=`status-badge ${d.status}`; badge.textContent=d.status.toUpperCase();
  if(d.status==="offline"){reasonBox.classList.remove("hidden");document.querySelector("#reason-main").textContent=d.offlineReason;document.querySelector("#reason-detail").textContent=`${d.offlineReasonDetail} 当前模拟电量：${d.battery}%。`}else reasonBox.classList.add("hidden");
  actionMessage.textContent="";historyPanel.classList.add("hidden");renderTrend(d);modal.classList.remove("hidden");
}
function getActiveDevice(){return devices.find(d=>d.id===activeDeviceId)}
function refreshTelemetry(){
  const values=devices.filter(d=>d.temperature!==null).slice(0,30).map(d=>d.temperature); const avg=values.reduce((a,b)=>a+b,0)/values.length; document.querySelector("#avg-temp").textContent=`${avg.toFixed(1)}°C`;
  document.querySelector("#sparkline").style.background=`linear-gradient(165deg,transparent 45%,#3e87ae 46%,#3e87ae 49%,transparent 50%),linear-gradient(175deg,transparent 50%,#2d6588 51%,#2d6588 53%,transparent 54%)`;
  document.querySelector("#activity-count").textContent=(1120+(devices.filter(d=>d.status==="online").length%400)).toLocaleString();
  const bars=document.querySelector("#activity-bars");bars.innerHTML=Array.from({length:14},(_,i)=>`<i style="height:${10+((i*17)%24)}px"></i>`).join("");
}
function simulateReconnect(){const d=getActiveDevice();if(!d)return;if(d.status!=="offline"){actionMessage.textContent="设备当前不是离线状态，无需重新连接。";return}actionMessage.textContent="正在重新连接……";setTimeout(()=>{d.status="online";d.signal="一般";d.rssi=-66;d.minutesSinceSeen=0;actionMessage.textContent="✓ 重新连接成功，设备已恢复在线。";renderAll();openDetail(d.id)},700)}
function simulateRestart(){const d=getActiveDevice();if(!d)return;actionMessage.textContent="正在发送重启指令……";setTimeout(()=>{d.restartCount++;d.minutesSinceSeen=0;if(d.status==="offline"){d.status="online";d.signal="一般";d.rssi=-66}actionMessage.textContent=`✓ 重启完成，第 ${d.restartCount} 次重启。`;renderAll();openDetail(d.id)},700)}
function renderAll(){renderSummary();renderMap();renderAlerts();renderTable();refreshTelemetry()}
function closeDetail(){modal.classList.add("hidden");activeDeviceId=null}
document.querySelector("#close-modal").addEventListener("click",closeDetail);document.querySelector("#reconnect-btn").addEventListener("click",simulateReconnect);document.querySelector("#restart-btn").addEventListener("click",simulateRestart);document.querySelector("#history-btn").addEventListener("click",()=>{const d=getActiveDevice();if(d)renderHistory(d)});modal.addEventListener("click",e=>{if(e.target===modal)closeDetail()});document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDetail()});search.addEventListener("input",renderTable);filter.addEventListener("change",renderTable);document.querySelector("#refresh-btn").addEventListener("click",renderAll);document.querySelector("#show-alerts").addEventListener("click",()=>{filter.value="offline";renderTable();document.querySelector("#devices").scrollIntoView({behavior:"smooth"})});
function refreshDemo(){devices.forEach((d,i)=>{if(d.status==="online"&&i%37===0)d.minutesSinceSeen=(d.minutesSinceSeen+1)%8});renderAll()}
renderAll();setInterval(refreshDemo,30000);