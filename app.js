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
  return {
    name: `${type} ${number}`,
    id: `IOT-${number}`,
    status: pattern.status,
    signal: pattern.status === "offline" ? "--" : pattern.status === "warning" ? "较弱" : "良好",
    temperature: type === "电表" || type === "门磁" ? "--" : `${(22 + (index % 130) / 10).toFixed(1)}°C`,
    minutesSinceSeen: pattern.minutes
  };
});

const statusText = { online: "在线", offline: "离线", warning: "异常" };
const list = document.querySelector("#device-list");
const search = document.querySelector("#search");
const filter = document.querySelector("#status-filter");

function formatLastSeen(minutes) {
  if (minutes <= 0) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  return `${Math.floor(minutes / 60)} 小时前`;
}

function render() {
  const keyword = search.value.trim().toLowerCase();
  const selected = filter.value;
  const filtered = devices.filter(device => {
    const matchesKeyword = `${device.name} ${device.id}`.toLowerCase().includes(keyword);
    const matchesStatus = selected === "all" || device.status === selected;
    return matchesKeyword && matchesStatus;
  });

  list.innerHTML = filtered.slice(0, 200).map(device => `
    <tr>
      <td><div class="device-name">${device.name}</div><div class="device-id">${device.id}</div></td>
      <td><span class="badge ${device.status}">${statusText[device.status]}</span></td>
      <td>${device.signal}</td>
      <td>${device.temperature}</td>
      <td>${formatLastSeen(device.minutesSinceSeen)}${device.status === "offline" && device.minutesSinceSeen > 10 ? " ⚠️ 超过10分钟" : ""}</td>
    </tr>
  `).join("") || `<tr><td colspan="5">没有找到匹配设备</td></tr>`;

  document.querySelector("#total").textContent = devices.length;
  document.querySelector("#online").textContent = devices.filter(d => d.status === "online").length;
  document.querySelector("#offline").textContent = devices.filter(d => d.status === "offline").length;
  document.querySelector("#warning").textContent = devices.filter(d => d.status === "warning").length;
  document.querySelector("#last-updated").textContent = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

search.addEventListener("input", render);
filter.addEventListener("change", render);
render();
