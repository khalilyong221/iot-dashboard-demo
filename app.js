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
  return {
    name: `${type} ${number}`,
    id: `IOT-${number}`,
    status: pattern.status,
    signal: pattern.status === "offline" ? "--" : pattern.status === "warning" ? "较弱" : "良好",
    temperature: type === "电表" || type === "门磁" ? "--" : `${(22 + (index % 130) / 10).toFixed(1)}°C`,
    minutesSinceSeen: pattern.minutes,
    zone,
    x: 9 + ((index * 17) % 82),
    y: 10 + ((index * 31) % 78)
  };
});

const statusText = { online: "在线", offline: "离线", warning: "异常" };
const list = document.querySelector("#device-list");
const search = document.querySelector("#search");
const filter = document.querySelector("#status-filter");
const alerts = document.querySelector("#alerts");
const map = document.querySelector("#device-map");
const modal = document.querySelector("#detail-modal");

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
    <div class="alert-item">
      <div class="alert-icon">!</div>
      <div><strong>${device.name}</strong><span>${device.zone} · ${formatLastSeen(device.minutesSinceSeen)} · 超过 10 分钟未上报</span></div>
    </div>
  `).join("");
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

function openDetail(id) {
  const device = devices.find(d => d.id === id);
  if (!device) return;
  document.querySelector("#modal-name").textContent = device.name;
  document.querySelector("#modal-id").textContent = `${device.id} · ${device.zone}`;
  document.querySelector("#modal-status").textContent = statusText[device.status];
  document.querySelector("#modal-signal").textContent = device.signal;
  document.querySelector("#modal-temperature").textContent = device.temperature;
  document.querySelector("#modal-last-seen").textContent = formatLastSeen(device.minutesSinceSeen);
  const base = device.temperature === "--" ? 27 : parseFloat(device.temperature);
  document.querySelector("#trend-bars").innerHTML = Array.from({ length: 8 }, (_, i) => {
    const delta = ((i * 7 + device.id.charCodeAt(4)) % 19) - 9;
    const value = Math.max(25, Math.min(90, 55 + delta * 2 + base));
    return `<div class="trend-bar" style="height:${value}%" title="${(base + delta / 10).toFixed(1)}°C"></div>`;
  }).join("");
  modal.classList.remove("hidden");
}

function closeDetail() { modal.classList.add("hidden"); }

document.querySelector("#close-modal").addEventListener("click", closeDetail);
modal.addEventListener("click", event => { if (event.target === modal) closeDetail(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeDetail(); });
search.addEventListener("input", renderTable);
filter.addEventListener("change", renderTable);

function refreshDemo() {
  devices.forEach((device, index) => {
    if (device.status === "online" && index % 37 === 0) device.minutesSinceSeen = (device.minutesSinceSeen + 1) % 8;
  });
  renderSummary();
  renderAlerts();
  renderTable();
}

renderSummary();
renderMap();
renderAlerts();
renderTable();
setInterval(refreshDemo, 30000);
