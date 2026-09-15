/* HomeFlow · 智能家居用户端
   设备数据来自 assets/js/shared-data.js（与管理端共享同一套 IoT 数据模型） */

const $ = (s) => document.querySelector(s);
const grid = $('#device-grid');
const toast = $('#toast');
const modal = $('#device-modal');

let devices = IoTShared.getHomeDevices();
let active = null;
let room = '全部';

const ROOMS = (IoTShared.HOME_ROOMS || []).slice();

const ICONS = {
  aircon:'❄', light:'☼', curtain:'▤', tv:'▭', console:'⬢', av:'♪',
  camera:'◎', hub:'⌗', sensor:'◈', lock:'⌑', health:'◕', alarm:'⚠',
  appliance:'◚', waterheater:'◐', toilet:'⊙', fan:'✦', irrigation:'≈',
  outdoor:'⌣', heating:'♨', freshair:'◌', air:'◌', humidifier:'◔',
  vacuum:'◍', meter:'⌗', power:'⊞', pet:'✿'
};

const ROOM_ICONS = {
  '客厅':'◒', '餐厅':'◑', '主卧':'☾', '次卧':'☽', '书房':'▤',
  '厨房':'⌁', '卫生间':'◦', '阳台':'☁', '玄关':'⌂', '全屋':'⌗'
};

/* 有开关能力的类型 */
const SWITCHABLE = [
  'aircon','light','curtain','tv','console','av','appliance','vacuum',
  'irrigation','fan','freshair','heating','humidifier','waterheater',
  'toilet','air','pet','outdoor'
];

/* ───────── 工具 ───────── */

function showToast(text){
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove('show'), 2200);
}

const byType = (t) => devices.filter(d => d.type === t);
const inRoom = (r) => devices.filter(d => r === '全部' || d.room === r);
const bulk = (pred, patch) => devices.filter(pred).forEach(d => IoTShared.updateDevice(d.id, patch));

/* ───────── 读数 ───────── */

function reading(d){
  switch (d.type){
    case 'aircon': case 'heating': case 'waterheater': case 'toilet':
      return { v: (d.temp != null ? d.temp : '--') + '°', l: d.type === 'aircon' ? '设定温度' : (d.type === 'toilet' ? '座温' : '出水温度') };
    case 'light':
      return { v: d.on ? (d.brightness || 0) + '%' : '关闭', l: '亮度' };
    case 'curtain':
      return { v: (d.pos != null ? d.pos : 0) + '%', l: '开合度' };
    case 'lock':
      return { v: d.locked ? '已锁' : '已开', l: '门锁状态' };
    case 'tv': case 'av':
      return { v: d.on ? (d.volume != null ? d.volume : 0) : '关闭', l: d.on ? '音量' : '待机' };
    case 'console':
      return { v: d.on ? '运行中' : '待机', l: (d.hours || 0) + ' 小时' };
    case 'vacuum':
      return { v: (d.battery != null ? d.battery : 0) + '%', l: d.mode || '状态' };
    case 'freshair':
      return { v: (d.level || 1) + ' 档', l: 'CO₂ ' + (d.co2 != null ? d.co2 : '--') };
    case 'fan':
      return { v: d.on ? (d.level || 1) + ' 档' : '关闭', l: '档位' };
    case 'humidifier':
      return { v: (d.target != null ? d.target : 55) + '%', l: '目标湿度' };
    case 'air':
      return { v: 'AQI ' + (d.aqi != null ? d.aqi : '--'), l: '空气质量' };
    case 'appliance':
      return { v: d.on ? '运行' : '待机', l: d.mode || '模式' };
    case 'irrigation':
      return { v: d.on ? '运行中' : '待机', l: d.schedule || '定时' };
    case 'sensor':
      return { v: (d.value != null ? d.value : (d.temp != null ? d.temp : '--')) + (d.unit || ''), l: d.humidity ? '湿度 ' + d.humidity + '%' : '采集数值' };
    case 'alarm':
      return { v: d.alert ? '告警' : (d.state || '正常'), l: '探测状态' };
    case 'meter':
      return { v: (d.power != null ? d.power : 0) + ' kW', l: '今日 ' + (d.total != null ? d.total : 0) + ' kWh' };
    case 'power':
      return { v: (d.value && d.value !== '--') ? d.value + (d.unit || '') : (d.state || '--'), l: '运行状态' };
    case 'hub':
      return { v: d.devices ? d.devices + ' 台' : '在线', l: '接入设备' };
    case 'camera':
      return { v: d.privacy ? '已遮蔽' : '录制中', l: '在线状态' };
    case 'health': case 'pet': case 'outdoor':
      return { v: (d.value != null ? d.value : '--') + (d.unit || ''), l: '最新记录' };
  }
  return { v: '--', l: '状态' };
}

/* ───────── 设备卡片 ───────── */

function cardHTML(d){
  const r = reading(d);
  const state = d.alert
    ? '<span class="device-state attention-state"><i></i>需要关注</span>'
    : '<span class="device-state"><i></i>' + (d.online ? '在线' : '离线') + '</span>';
  const open = '<button class="mini-control" data-action="open">›</button>';
  let action = open;
  if (d.type === 'lock')
    action = '<button class="mini-control ' + (d.locked ? 'active' : '') + '" data-action="lock">' + (d.locked ? '▣' : '□') + '</button>' + open;
  else if (SWITCHABLE.includes(d.type) && d.type !== 'curtain')
    action = '<button class="mini-control ' + (d.on ? 'active' : '') + '" data-action="toggle">' + (d.on ? '◉' : '○') + '</button>' + open;
  return '<article class="device-card" data-id="' + d.id + '">' +
    '<div class="device-head"><div class="device-icon">' + (d.icon || ICONS[d.type] || '◉') + '</div>' + state + '</div>' +
    '<h3>' + d.name + '</h3><p>' + d.desc + '</p>' +
    '<div class="device-reading"><strong>' + r.v + '</strong><span>' + r.l + '</span></div>' +
    '<div class="device-actions">' + action + '</div></article>';
}

function render(){
  const items = inRoom(room);
  grid.innerHTML = items.map(cardHTML).join('') ||
    '<p style="color:#8a8a85;font-size:13px;grid-column:1/-1">这个房间还没有设备。</p>';
  grid.querySelectorAll('.device-card').forEach(card => card.addEventListener('click', e => {
    const a = e.target.closest('[data-action]');
    const d = devices.find(x => x.id === card.dataset.id);
    if (!a || a.dataset.action === 'open'){ openDevice(d); return; }
    e.stopPropagation();
    quick(d, a.dataset.action);
  }));
  renderAttention();
  const n = devices.filter(d => d.alert).length;
  const badge = $('#nav-alerts');
  if (badge) badge.textContent = n;
}

function quick(d, action){
  if (!d) return;
  if (action === 'toggle'){
    const next = !d.on;
    IoTShared.executeCommand(d.id, { type:'power', value:next });
    showToast(d.name + ' 已' + (next ? '开启' : '关闭'));
  } else if (action === 'lock'){
    IoTShared.executeCommand(d.id, { type:'lock', value:!d.locked });
    showToast(d.name + ' 已' + (!d.locked ? '锁定' : '解锁'));
  }
}

/* ───────── 详情面板 ───────── */

function openDevice(d){
  if (!d) return;
  active = d;
  $('#modal-icon').textContent = d.icon || ICONS[d.type] || '◉';
  $('#modal-room').textContent = d.room;
  $('#modal-name').textContent = d.name;
  $('#modal-desc').textContent = d.desc;
  $('#modal-state').textContent = d.online ? '在线' : '离线';
  $('#modal-last').textContent = d.online ? '刚刚更新' : '暂时无法连接';
  $('#control-area').innerHTML = controlsFor(d);
  modal.classList.remove('hidden');
  bindControls(d);
}

const ph = (t) => '<div class="control-title">' + t + '</div>';
const tg = (name, on, c) => '<div class="toggle"><span>' + name + '</span><button class="power ' + (on ? 'on' : '') + '" data-cmd="' + c + '"><i></i></button></div>';
const tb = (name, val, minus, plus) => '<div class="temp-box" style="margin-top:12px"><div><small>' + name + '</small><strong>' + val + '</strong></div>' +
  (minus ? '<div class="temp-step"><button data-cmd="' + minus + '">−</button><button data-cmd="' + plus + '">＋</button></div>' : '') + '</div>';
const sr = (arr) => '<div class="select-row">' + arr.map(x => '<button class="' + (x[2] ? 'active' : '') + '" data-cmd="' + x[1] + '">' + x[0] + '</button>').join('') + '</div>';
const rr = (name, id, val, min, max, sfx) => '<div class="range-row"><span>' + name + '</span><input id="' + id + '" type="range" min="' + min + '" max="' + max + '" value="' + val + '"/><strong id="' + id + '-value">' + val + (sfx || '') + '</strong></div>';

const PANELS = {
  aircon: d => ph('AIR CONDITIONER') + tg('电源', d.on, 'power') + tb('目标温度', d.temp + ' °C', 'minus', 'plus') +
    sr([['制冷', 'cool', d.mode === '制冷'], ['除湿', 'dry', d.mode === '除湿'], ['自动风', 'auto', d.fan === '自动'], ['静音', 'quiet', d.fan === '静音']]),

  light: d => ph('LIGHTING') + tg('电源', d.on, 'power') + rr('亮度', 'brightness-range', d.brightness || 0, 0, 100, '%'),

  curtain: d => ph('CURTAIN') + rr('开合度', 'curtain-range', d.pos != null ? d.pos : 0, 0, 100, '%') +
    sr([['全开', 'open', d.pos === 100], ['一半', 'half', d.pos === 50], ['全关', 'close', d.pos === 0]]),

  lock: d => ph('SMART LOCK') + '<div class="temp-box"><div><small>当前状态</small><strong>' + (d.locked ? '已锁定' : '已解锁') + '</strong></div>' +
    '<div class="lock-actions"><button data-cmd="lock">' + (d.locked ? '解锁' : '上锁') + '</button><button class="secondary" data-cmd="history">记录</button></div></div>',

  tv: d => ph('TELEVISION') + tg('电源', d.on, 'power') + rr('音量', 'volume-range', d.volume || 0, 0, 40, '') +
    sr([['HDMI 1', 'in1', d.input === 'HDMI 1'], ['HDMI 2', 'in2', d.input === 'HDMI 2'], ['投屏', 'cast', d.input === '投屏'], ['数字电视', 'dtv', d.input === 'DTV']]),

  av: d => ph('AUDIO SYSTEM') + tg('电源', d.on, 'power') + rr('音量', 'volume-range', d.volume || 0, 0, 40, '') +
    sr([['影院', 'cinema', d.mode === '影院'], ['音乐', 'music', d.mode === '音乐'], ['夜间', 'night', d.mode === '夜间']]),

  console: d => ph('GAME CONSOLE') + tg('电源', d.on, 'power') +
    '<div class="temp-box" style="margin-top:12px"><div><small>累计运行</small><strong>' + (d.hours || 0) + ' 小时</strong></div><span style="font-size:11px">' + (d.on ? '运行中' : '待机') + '</span></div>',

  camera: d => ph('CAMERA') + tg('录制', d.on, 'power') + tg('在家遮蔽', d.privacy, 'privacy'),

  hub: d => ph('IoT HUB') + '<div class="temp-box"><div><small>接入设备</small><strong>' + (d.devices || 0) + ' 台</strong></div>' +
    '<button class="secondary" data-cmd="reboot">重启网关</button></div>',

  sensor: d => ph('ENVIRONMENT') + '<div class="temp-box"><div><small>采集数值</small><strong>' +
    (d.value != null ? d.value : (d.temp != null ? d.temp : '--')) + (d.unit || '') + '</strong></div>' +
    (d.humidity ? '<span>湿度 ' + d.humidity + '%</span>' : '<span>正常</span>') + '</div>',

  alarm: d => ph('ALARM') + tg('布防', d.armed !== false, 'arm') +
    '<div class="temp-box" style="margin-top:12px"><div><small>探测状态</small><strong>' + (d.alert ? '需要关注' : (d.state || '正常')) + '</strong></div></div>',

  meter: d => ph('METER') + '<div class="temp-box"><div><small>实时功率</small><strong>' + (d.power || 0) + ' kW</strong></div>' +
    '<span>今日累计 ' + (d.total || 0) + ' kWh</span></div>',

  power: d => ph('POWER EQUIPMENT') + '<div class="temp-box"><div><small>运行状态</small><strong>' + (d.state || '--') + '</strong></div>' +
    (d.value && d.value !== '--' ? '<span>' + d.value + (d.unit || '') + '</span>' : '<span>正常</span>') + '</div>',

  health: d => ph('HEALTH') + '<div class="temp-box"><div><small>最新记录</small><strong>' + (d.value || '--') + (d.unit || '') + '</strong></div>' +
    '<span>数据来源于设备历史记录</span></div>',

  pet: d => ph('PET CARE') + tg('设备', d.on, 'power') +
    '<div class="temp-box" style="margin-top:12px"><div><small>当前状态</small><strong>' + (d.value || '--') + (d.unit || '') + '</strong></div></div>',

  outdoor: d => ph('GARDEN') + tg('设备', d.on, 'power') +
    '<div class="temp-box" style="margin-top:12px"><div><small>运行数值</small><strong>' + (d.value || '--') + (d.unit || '') + '</strong></div></div>',

  appliance: d => ph('APPLIANCE') + tg('电源', d.on, 'power') +
    sr([['标准', 'std', d.mode === '标准洗'], ['强力', 'strong', d.mode === '强档'], ['节能', 'eco', d.mode === '节能'], ['待机', 'sleep', d.mode === '待机']]) +
    '<div class="temp-box" style="margin-top:12px"><div><small>剩余时间</small><strong>' + (d.remain || '--') + '</strong></div></div>',

  vacuum: d => ph('CLEANING ROBOT') + '<div class="temp-box"><div><small>剩余电量</small><strong>' + (d.battery || 0) + '%</strong></div>' +
    '<span>' + (d.mode || '') + '</span></div>' + sr([['开始清扫', 'start', false], ['暂停', 'pause', false], ['回充', 'dock', false]]),

  freshair: d => ph('FRESH AIR') + tg('电源', d.on, 'power') +
    sr([['一档', 'l1', d.level === 1], ['二档', 'l2', d.level === 2], ['三档', 'l3', d.level === 3]]) +
    '<div class="temp-box" style="margin-top:12px"><div><small>CO₂ 浓度</small><strong>' + (d.co2 != null ? d.co2 : '--') + ' ppm</strong></div></div>',

  fan: d => ph('FAN') + tg('电源', d.on, 'power') +
    sr([['一档', 'l1', d.level === 1], ['二档', 'l2', d.level === 2], ['三档', 'l3', d.level === 3]]),

  heating: d => ph('FLOOR HEATING') + tg('电源', d.on, 'power') + tb('供水温度', d.temp + ' °C', 'minus', 'plus'),

  humidifier: d => ph('HUMIDIFIER') + tg('电源', d.on, 'power') +
    rr('目标湿度', 'humidity-range', d.target != null ? d.target : 55, 30, 80, '%'),

  waterheater: d => ph('WATER HEATER') + tg('电源', d.on, 'power') + tb('出水温度', d.temp + ' °C', 'minus', 'plus'),

  toilet: d => ph('SMART TOILET') + tg('电源', d.on, 'power') + tb('座圈温度', d.temp + ' °C', 'minus', 'plus'),

  irrigation: d => ph('IRRIGATION') + tg('水泵', d.on, 'power') +
    sr([['定时灌溉', 'schedule', !d.on], ['手动运行', 'manual', d.on]]) +
    '<div class="temp-box" style="margin-top:12px"><div><small>灌溉计划</small><strong>' + (d.schedule || '--') + '</strong></div></div>',

  air: d => ph('AIR PURIFIER') + tg('自动模式', d.on, 'power') +
    '<div class="temp-box" style="margin-top:12px"><div><small>空气质量</small><strong>AQI ' + (d.aqi != null ? d.aqi : '--') + '</strong></div><span>' + ((d.aqi || 0) < 50 ? '优' : '良') + '</span></div>'
};

const DEFAULT_PANEL = d => ph('DEVICE') + '<div class="temp-box"><div><small>状态</small><strong>' + (d.online ? '在线' : '离线') + '</strong></div></div>';

const controlsFor = (d) => (PANELS[d.type] || DEFAULT_PANEL)(d);

function bindControls(d){
  document.querySelectorAll('#control-area [data-cmd]').forEach(btn => btn.addEventListener('click', () => {
    const c = btn.dataset.cmd;
    const C = (t, v) => IoTShared.executeCommand(d.id, { type: t, value: v });
    if (c === 'power') C('power', !d.on);
    else if (c === 'privacy'){ C('privacy', !d.privacy); showToast(d.name + (d.privacy ? ' 已解除遮蔽' : ' 已进入遮蔽')); }
    else if (c === 'plus') C('temperature', (d.temp || 20) + 1);
    else if (c === 'minus') C('temperature', (d.temp || 20) - 1);
    else if (c === 'cool') C('mode', '制冷');
    else if (c === 'dry') C('mode', '除湿');
    else if (c === 'auto') C('fan', '自动');
    else if (c === 'quiet') C('fan', '静音');
    else if (c === 'lock') C('lock', !d.locked);
    else if (c === 'open') C('curtain', 100);
    else if (c === 'half') C('curtain', 50);
    else if (c === 'close') C('curtain', 0);
    else if (c === 'l1' || c === 'l2' || c === 'l3') C('level', Number(c[1]));
    else if (c === 'in1') C('input', 'HDMI 1');
    else if (c === 'in2') C('input', 'HDMI 2');
    else if (c === 'cast') C('input', '投屏');
    else if (c === 'dtv') C('input', 'DTV');
    else if (c === 'cinema') C('mode', '影院');
    else if (c === 'music') C('mode', '音乐');
    else if (c === 'night') C('mode', '夜间');
    else if (c === 'start' || c === 'manual'){ C('power', true); showToast(d.name + ' 已启动'); }
    else if (c === 'pause'){ C('power', false); showToast(d.name + ' 已暂停'); }
    else if (c === 'dock'){ C('power', false); showToast(d.name + ' 已回充'); }
    else if (c === 'schedule') showToast('已切换到定时灌溉');
    else if (c === 'arm') C('arm', d.armed === false);
    else if (c === 'reboot') showToast(d.name + ' 重启指令已下发');
    else if (c === 'history') showToast('门锁记录将在真实版本接入后显示');
    else if (c === 'std' || c === 'strong' || c === 'eco' || c === 'sleep')
      C('mode', { std:'标准洗', strong:'强档', eco:'节能', sleep:'待机' }[c]);
    const latest = IoTShared.getDevice(d.id);
    if (latest) openDevice(latest);
  }));

  [['brightness-range', 'brightness', '%'], ['curtain-range', 'curtain', '%'],
   ['humidity-range', 'target', '%'], ['volume-range', 'volume', '']].forEach(function(pair){
    const el = document.querySelector('#' + pair[0]);
    if (!el) return;
    el.addEventListener('input', function(){
      IoTShared.executeCommand(d.id, { type: pair[1], value: Number(el.value) });
      const out = document.querySelector('#' + pair[0] + '-value');
      if (out) out.textContent = el.value + pair[2];
    });
  });
}

/* ───────── 房间 ───────── */

function renderRooms(){
  const host = $('#room-grid');
  if (!host) return;
  const total = devices.length;
  let html = '<button class="room-card active" data-room="全部"><div class="room-icon living">⌂</div>' +
    '<div><strong>全部房间</strong><span>' + total + ' 台设备</span></div><b>' + total + '</b></button>';
  ROOMS.forEach(function(r){
    const n = devices.filter(d => d.room === r).length;
    if (!n) return;
    html += '<button class="room-card" data-room="' + r + '"><div class="room-icon">' + (ROOM_ICONS[r] || '◦') + '</div>' +
      '<div><strong>' + r + '</strong><span>' + n + ' 台设备</span></div><b>' + n + '</b></button>';
  });
  host.innerHTML = html;
  host.querySelectorAll('.room-card').forEach(btn => btn.addEventListener('click', function(){
    host.querySelectorAll('.room-card').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    room = btn.dataset.room;
    render();
  }));
  const badge = $('#room-total');
  if (badge) badge.textContent = total;
}

/* ───────── 场景 ───────── */

const SCENES = [
  { n:'回家', i:'⌂', d:'玄关灯 · 客厅灯 80% · 窗帘拉开 · 空调 24°', run(){
    bulk(d => d.type === 'light', { on:false });
    bulk(d => d.room === '玄关' && d.type === 'light', { on:true, brightness:60 });
    bulk(d => d.room === '客厅' && d.type === 'light', { on:true, brightness:80 });
    bulk(d => d.room === '客厅' && d.type === 'curtain', { pos:100 });
    bulk(d => d.type === 'aircon', { on:true, temp:24, mode:'制冷' });
    bulk(d => d.type === 'freshair', { on:true, level:2 });
    bulk(d => d.type === 'lock', { locked:false });
  }},
  { n:'离家', i:'↗', d:'全屋熄灯 · 关空调 · 关窗帘 · 上锁布防 · 清扫', run(){
    bulk(d => d.type === 'light', { on:false, brightness:0 });
    bulk(d => d.type === 'aircon', { on:false });
    bulk(d => d.type === 'curtain', { pos:0 });
    bulk(d => d.type === 'lock', { locked:true });
    bulk(d => d.type === 'alarm', { armed:true });
    bulk(d => d.type === 'vacuum', { on:true, mode:'清扫中' });
    bulk(d => d.type === 'camera', { on:true, privacy:false });
  }},
  { n:'晚安', i:'☾', d:'主卧窗帘关 · 空调 26° 静音 · 上锁', run(){
    bulk(d => d.type === 'light', { on:false });
    bulk(d => d.room === '主卧' && d.type === 'light', { on:true, brightness:20 });
    bulk(d => d.room === '主卧' && d.type === 'curtain', { pos:0 });
    bulk(d => d.room === '主卧' && d.type === 'aircon', { on:true, temp:26, fan:'静音', mode:'制冷' });
    bulk(d => d.type === 'lock', { locked:true });
    bulk(d => d.type === 'alarm', { armed:true });
  }},
  { n:'观影', i:'▶', d:'窗帘关闭 · 灯光 20% · 电视 + 影院音响', run(){
    bulk(d => d.room === '客厅' && d.type === 'curtain', { pos:0 });
    bulk(d => d.room === '客厅' && d.type === 'light', { on:true, brightness:20 });
    bulk(d => d.type === 'tv', { on:true, input:'HDMI 2', volume:22 });
    bulk(d => d.type === 'av', { on:true, mode:'影院' });
    bulk(d => d.room === '客厅' && d.type === 'aircon', { on:true, temp:25 });
  }},
  { n:'起床', i:'☀', d:'窗帘 30% · 灯光渐亮 · 热水预热 · 地暖', run(){
    bulk(d => d.room === '主卧' && d.type === 'curtain', { pos:30 });
    bulk(d => d.room === '主卧' && d.type === 'light', { on:true, brightness:40 });
    bulk(d => d.type === 'waterheater', { on:true, temp:48 });
    bulk(d => d.type === 'heating', { on:true, temp:32 });
    bulk(d => d.type === 'freshair', { on:true, level:2 });
  }},
  { n:'会客', i:'◇', d:'客厅全亮 · 窗帘半开 · 空调 24° · 音乐', run(){
    bulk(d => d.room === '客厅' && d.type === 'light', { on:true, brightness:100 });
    bulk(d => d.room === '客厅' && d.type === 'curtain', { pos:50 });
    bulk(d => d.type === 'aircon', { on:true, temp:24 });
    bulk(d => d.type === 'freshair', { on:true, level:3 });
    bulk(d => d.type === 'av', { on:true, mode:'音乐', volume:20 });
  }},
  { n:'游戏模式', i:'⬢', d:'书房灯光 · 窗帘关闭 · PS5 + 电视', run(){
    bulk(d => d.room === '书房' && d.type === 'light', { on:true, brightness:60 });
    bulk(d => d.room === '书房' && d.type === 'curtain', { pos:0 });
    bulk(d => d.room === '书房' && d.type === 'aircon', { on:true, temp:25 });
    bulk(d => d.type === 'console', { on:true });
    bulk(d => d.type === 'tv', { on:true, input:'HDMI 2', volume:25 });
  }},
  { n:'全屋节能', i:'◐', d:'空调 26° · 灯光减半 · 待机断电 · 新风一档', run(){
    bulk(d => d.type === 'aircon', { on:true, temp:26 });
    bulk(d => d.type === 'light', { brightness:40 });
    bulk(d => d.type === 'meter', {});
    bulk(d => d.type === 'appliance' && !d.on, { on:false });
    bulk(d => d.type === 'freshair', { on:true, level:1 });
    bulk(d => d.type === 'heating', { on:false });
    bulk(d => d.type === 'tv', { on:false });
  }},
  { n:'烹饪', i:'◚', d:'厨房灯光 · 油烟机强档 · 新风三档', run(){
    bulk(d => d.room === '厨房' && d.type === 'light', { on:true, brightness:100 });
    bulk(d => d.room === '餐厅' && d.type === 'light', { on:true, brightness:70 });
    bulk(d => d.room === '厨房' && d.type === 'appliance' && d.mode === '强档', { on:true });
    bulk(d => d.type === 'freshair', { on:true, level:3 });
  }},
  { n:'睡前阅读', i:'▤', d:'书房台灯 70% · 其余熄灯', run(){
    bulk(d => d.type === 'light', { on:false });
    bulk(d => d.room === '书房' && d.type === 'light' && d.name.indexOf('台灯') > -1, { on:true, brightness:70 });
    bulk(d => d.room === '客厅' && d.type === 'light', { on:false });
    bulk(d => d.type === 'aircon', { on:true, temp:26, fan:'静音' });
  }}
];

function renderScenes(){
  const host = $('#scene-grid');
  if (!host) return;
  host.innerHTML = SCENES.map(s => '<button class="scene-card" data-scene="' + s.n + '">' +
    '<span class="scene-icon">' + s.i + '</span><div><strong>' + s.n + '</strong><small>' + s.d + '</small></div><b>→</b></button>').join('');
  host.querySelectorAll('.scene-card').forEach(btn => btn.addEventListener('click', () => runScene(btn.dataset.scene)));
}

function runScene(name){
  const s = SCENES.find(x => x.n === name);
  if (!s) return;
  devices = IoTShared.getHomeDevices();
  s.run();
  devices = IoTShared.getHomeDevices();
  render();
  renderRooms();
  showToast('“' + name + '”场景已执行 · ' + s.d);
}

/* ───────── 顶栏与关注区 ───────── */

function renderHeader(){
  const online = devices.filter(d => d.online).length;
  const el = $('#hero-line');
  if (el) el.textContent = devices.length + ' 台设备接入 · ' + online + ' 台在线 · ' + ROOMS.length + ' 个房间';
}

function renderAttention(){
  const box = $('#attention-list');
  if (!box) return;
  const items = devices.filter(d => d.alert);
  box.innerHTML = items.length
    ? items.map(d => '<button class="attention danger" data-id="' + d.id + '"><span>⚠</span><div><strong>' + d.name +
        '</strong><small>' + (d.desc || '') + ' · 请确认设备状态</small></div><b>查看</b></button>').join('')
    : '<div class="attention"><span>✓</span><div><strong>暂无需要关注的设备</strong><small>当前共享 IoT 数据模型运行正常。</small></div></div>';
  box.querySelectorAll('[data-id]').forEach(x => x.addEventListener('click', () => openDevice(IoTShared.getDevice(x.dataset.id))));
}

/* ───────── 初始化 ───────── */

window.addEventListener('iot-model-change', function(){
  devices = IoTShared.getHomeDevices();
  render();
  renderRooms();
});

$('#modal-close').addEventListener('click', function(){ modal.classList.add('hidden'); active = null; });
modal.addEventListener('click', function(e){ if (e.target === modal){ modal.classList.add('hidden'); active = null; } });

const addBtn = $('#add-device');
if (addBtn) addBtn.addEventListener('click', () => showToast('添加设备功能已预留，真实版本可接入扫码 / BLE / Wi-Fi 配网'));
const energyBtn = $('#energy-detail');
if (energyBtn) energyBtn.addEventListener('click', () => showToast('今日 18.6 kWh · 空调回路占比最高（6.3 kWh）'));

renderRooms();
renderScenes();
render();
renderHeader();
