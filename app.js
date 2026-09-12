const devices = Array.from({ length: 1000 }, (_, index) => {
  const number = String(index + 1).padStart(4, "0");
  const type = ["温度传感器", "电表", "门磁", "网关", "泵站控制器"][index % 5];
  const patterns = [
    { status: "online", minutes: index % 4 },
    { status: "online", minutes: 5 + (index % 5) },
    { status: "warning", minutes: 2 + (index % 5) },
    { status: "offline", minutes: 11 + (index % 30) },
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
    name: `${type} ${number}`,
    id: `IOT-${number}`,
    status: pattern.status,
    signal: pattern.status === "offline" ? "--" : pattern.status === "warning" ? "较弱" : "良好",
    temperature: type === "电表" || type === "门磁" ? "--" : `${(22 + (index % 130) / 10).toFixed(1)}°C`,
    minutesSinceSeen: pattern.minutes,
    zone,
    x: 9 + ((index * 17) % 82),
    y: 10 + ((index * 31) % 78),
    offlineReason: reason[0],
    offlineReasonDetail: reason[1],
    battery: 35 + ((index * 13) % 66),
    restartCount: index % 3,
    history: Array.from({ length: 8 }, (_, i) => ({
      time: `${8 + i}:00`,
      temperature: type === "电表" || type === "门磁" ? null : +(22 + ((index + i * 3) % 80) / 10).toFixed(1)
    }))
  };
});

const statusText = { online: "在线", offline: "离线", warning: "异常" };
const list = document.querySelector("#device-list");
const search = document.querySelector("#search");
const filter = document.querySelector("#status-filter");
const alerts = document.querySelector("#alerts");
const map = document.querySelector("#device-map");
const modal = document.querySelector("#detail-modal");
const reasonBox = document.querySelector("#offline-reason");
const actionMessage = document.querySelector("#action-message");
const historyPanel = document.querySelector("#history-panel");
let activeDeviceId = null;

function formatLastSeen(minutes) {
  if (minutes <= 0) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  return `${Math.floor(minutes / 60)} 小时前`;
}

function renderSummary() {
  const total = devices.length;
  const online = devices.filter(d => d.status === "online").length;
  const offline = devices.filter(d => d.status === "offline").length;
  const warning = devices.filter(d => d.status === "warning").length;
  const timeout = devices.filter(d => d.status === "offline" && d.minutesSinceSeen > 10).length;
  document.querySelector("#total").textContent = total;
  document.querySelector("#online").textContent = online;
  document.querySelector("#offline").textContent = offline;
  document.querySelector("#warning").textContent = warning;
  document.querySelector("#timeout").textContent = timeout;
  document.querySelector("#online-rate").textContent = `${((online / total) * 100).toFixed(1)}% 在线率`;
  document.querySelector("#last-updated").textContent = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function renderMap() {
  map.innerHTML = devices.filter((_, index) => index % 13 === 0).map(device => `
    <button class="map-pin ${device.status}" style="left:${device.x}%;top:${device.y}%" title="${device.name} · ${statusText[device.status]}" data-id="${device.id}" aria-label="查看 ${device.name}"></button>
  `).join("");
  map.querySelectorAll(".map-pin").forEach(pin => pin.addEventListener("click", () => openDetail(pin.dataset.id)));
}

function renderAlerts() {
  const items = devices.filter(d => d.status === "offline" && d.minutesSinceSeen > 10).slice(0, 6);
  alerts.innerHTML = items.map(device => `
    <div class="alert-item" data-id="${device.id}">
      <div class="alert-icon">!</div>
      <div><strong>${device.name}</strong><span>${device.zone} · ${formatLastSeen(device.minutesSinceSeen)} · 超过 10 分钟未上报</span></div>
    </div>
  `).join("");
  alerts.querySelectorAll(".alert-item").forEach(item => item.addEventListener("click", () => openDetail(item.dataset.id)));
}

function renderTable() {
  const keyword = search.value.trim().toLowerCase();
  const selected = filter.value;
  const filtered = devices.filter(device => {
    const matchesKeyword = `${device.name} ${device.id} ${device.zone}`.toLowerCase().includes(keyword);
    const matchesStatus = selected === "all" || device.status === selected;
    return matchesKeyword && matchesStatus;
  });
  list.innerHTML = filtered.slice(0, 200).map(device => `
    <tr data-id="${device.id}">
      <td><div class="device-name">${device.name}</div><div class="device-id">${device.id} · ${device.zone}</div></td>
      <td><span class="badge ${device.status}">${statusText[device.status]}</span></td>
      <td>${device.signal}</td>
      <td>${device.temperature}</td>
      <td>${formatLastSeen(device.minutesSinceSeen)}${device.status === "offline" && device.minutesSinceSeen > 10 ? " ⚠️ 超时" : ""}</td>
    </tr>
  `).join("") || `<tr><td colspan="5">没有找到匹配设备</td></tr>`;
  list.querySelectorAll("tr[data-id]").forEach(row => row.addEventListener("click", () => openDetail(row.dataset.id)));
}

function renderHistory(device) {
  const rows = device.history.map(item => `
    <div class="history-row"><span>${item.time}</span><strong>${item.temperature === null ? "--" : `${item.temperature}°C`}</strong></div>
  `).join("");
  historyPanel.innerHTML = `<h3>最近历史数据</h3><div class="history-list">${rows}</div><p class="history-note">当前为演示数据，真实版本可替换为数据库中的历史遥测。</p>`;
  historyPanel.classList.remove("hidden");
}

function openDetail(id) {
  const device = devices.find(d => d.id === id);
  if (!device) return;
  activeDeviceId = id;
  document.querySelector("#modal-name").textContent = device.name;
  document.querySelector("#modal-id").textContent = `${device.id} · ${device.zone}`;
  document.querySelector("#modal-status").textContent = statusText[device.status];
  document.querySelector("#modal-signal").textContent = device.signal;
  document.querySelector("#modal-temperature").textContent = device.temperature;
  document.querySelector("#modal-last-seen").textContent = formatLastSeen(device.minutesSinceSeen);

  if (device.status === "offline") {
    reasonBox.classList.remove("hidden");
    document.querySelector("#reason-main").textContent = device.offlineReason;
    document.querySelector("#reason-detail").textContent = `${device.offlineReasonDetail} 当前模拟电量：${device.battery}%。`;
  } else {
    reasonBox.classList.add("hidden");
  }

  actionMessage.textContent = "";
  historyPanel.classList.add("hidden");
  const base = device.temperature === "--" ? 27 : parseFloat(device.temperature);
  document.querySelector("#trend-bars").innerHTML = Array.from({ length: 8 }, (_, i) => {
    const value = device.history[i].temperature === null ? 55 : Math.max(25, Math.min(90, 45 + device.history[i].temperature));
    return `<div class="trend-bar" style="height:${value}%" title="${device.history[i].temperature === null ? "无温度数据" : `${device.history[i].temperature}°C`}"></div>`;
  }).join("");
  modal.classList.remove("hidden");
}

function getActiveDevice() { return devices.find(d => d.id === activeDeviceId); }

function simulateReconnect() {
  const device = getActiveDevice();
  if (!device) return;
  if (device.status !== "offline") {
    actionMessage.textContent = "设备当前不是离线状态，无需重新连接。";
    return;
  }
  actionMessage.textContent = "正在重新连接……";
  setTimeout(() => {
    const success = device.id.charCodeAt(device.id.length - 1) % 2 === 0;
    if (success) {
      device.status = "online";
      device.signal = "一般";
      device.minutesSinceSeen = 0;
      actionMessage.textContent = "✅ 重新连接成功，设备已恢复在线。";
    } else {
      actionMessage.textContent = "⚠️ 重新连接失败，建议检查现场网络或网关。";
    }
    renderSummary(); renderAlerts(); renderTable(); renderMap(); openDetail(device.id);
  }, 700);
}

function simulateRestart() {
  const device = getActiveDevice();
  if (!device) return;
  actionMessage.textContent = "正在发送重启指令……";
  setTimeout(() => {
    device.restartCount += 1;
    device.minutesSinceSeen = 0;
    device.signal = device.status === "offline" ? "一般" : device.signal;
    actionMessage.textContent = `✅ 重启指令已完成（第 ${device.restartCount} 次）。真实系统这里会调用设备控制 API。`;
    renderSummary(); renderAlerts(); renderTable(); renderMap(); openDetail(device.id);
  }, 700);
}

function closeDetail() { modal.classList.add("hidden"); activeDeviceId = null; }

document.querySelector("#close-modal").addEventListener("click", closeDetail);
document.querySelector("#reconnect-btn").addEventListener("click", simulateReconnect);
document.querySelector("#restart-btn").addEventListener("click", simulateRestart);
document.querySelector("#history-btn").addEventListener("click", () => {
  const device = getActiveDevice();
  if (device) renderHistory(device);
});
modal.addEventListener("click", event => { if (event.target === modal) closeDetail(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeDetail(); });
search.addEventListener("input", renderTable);
filter.addEventListener("change", renderTable);

function refreshDemo() {
  devices.forEach((device, index) => {
    if (device.status === "online" && index % 37 === 0) device.minutesSinceSeen = (device.minutesSinceSeen + 1) % 8;
  });
  renderSummary(); renderAlerts(); renderTable();
}

renderSummary();
renderMap();
renderAlerts();
renderTable();
setInterval(refreshDemo, 30000);
