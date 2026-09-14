/* 云枢 IoT 设备监控中心 —— 演示应用逻辑
 * 全部数据由浏览器本地模拟生成，不连接任何真实设备或后端。
 */
(function () {
  'use strict';

  /* ================= 工具 ================= */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var walk = function (v, step, lo, hi) { return clamp(v + rnd(-step, step), lo, hi); };
  var pad2 = function (n) { return n < 10 ? '0' + n : '' + n; };
  var fmtHM = function (ts) { var d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  var fmtHMS = function (ts) { var d = new Date(ts); return fmtHM(ts) + ':' + pad2(d.getSeconds()); };
  var fmtAgo = function (ts) {
    var s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return s + ' 秒前';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    return Math.floor(s / 3600) + ' 小时前';
  };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var TOK = {
    text: '#A7B7CE', muted: '#6B7C95', grid: 'rgba(167,183,206,0.12)',
    s1: '#3B82F6', s2: '#22D3EE', s3: '#A78BFA', s4: '#F472B6', s5: '#34D399', s6: '#FBBF24',
    ok: '#34D399', warn: '#FBBF24', bad: '#F87171', off: '#7C8CA5'
  };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= 元数据 ================= */
  var TYPES = {
    th: { name: '温湿度传感器', icon: '🌡️', unit: '℃ / %RH' },
    em: { name: '智能电表', icon: '⚡', unit: 'kW' },
    fl: { name: '超声波流量计', icon: '🌊', unit: 'm³/h' },
    aq: { name: '空气质量监测', icon: '🍃', unit: 'PM2.5' },
    gw: { name: '智能网关', icon: '📡', unit: '台' },
    wd: { name: '水浸传感器', icon: '💧', unit: '' },
    ac: { name: '空调控制器', icon: '❄️', unit: '℃' },
    lt: { name: '智能照明', icon: '💡', unit: '%' }
  };
  var AREAS = ['A栋·办公楼', 'B栋·厂房', 'C栋·数据中心', '园区'];

  /* ================= 设备数据（模拟） ================= */
  function dev(id, name, type, area, status, extra) {
    return Object.assign({
      id: id, name: name, type: type, area: area, status: status,
      signal: Math.round(rnd(58, 98)), battery: type === 'gw' || type === 'ac' ? null : Math.round(rnd(18, 100)),
      protocol: type === 'th' || type === 'wd' ? 'RS485' : (type === 'ac' || type === 'lt' ? 'BACnet' : 'MQTT'),
      firmware: 'v' + (1 + Math.floor(rnd(0, 4))) + '.' + Math.floor(rnd(0, 9)) + '.' + Math.floor(rnd(0, 9)),
      lastSeen: Date.now() - Math.floor(rnd(2, 90)) * 1000,
      installDate: '202' + Math.floor(rnd(3, 6)) + '-0' + Math.floor(rnd(1, 9)) + '-1' + Math.floor(rnd(0, 9)),
      control: null, hist: []
    }, extra || {});
  }
  var devices = [
    dev('TH-A101', '办公楼大堂温湿度', 'th', AREAS[0], 'online', { v: { temp: 24.2, hum: 55 } }),
    dev('TH-A102', '办公楼 3F 办公区温湿度', 'th', AREAS[0], 'online', { v: { temp: 25.1, hum: 52 } }),
    dev('TH-A103', '办公楼 8F 会议室温湿度', 'th', AREAS[0], 'warning', { v: { temp: 27.6, hum: 61 }, battery: 14 }),
    dev('EM-A101', '办公楼总进线电表', 'em', AREAS[0], 'online', { v: { power: 86.4, energy: 1204.5 } }),
    dev('AC-A201', '办公楼 VRV 空调机组 1', 'ac', AREAS[0], 'online', { v: { temp: 24.5, power: 12.2 }, control: { power: true, mode: 'cool', target: 24 } }),
    dev('AC-A202', '办公楼 VRV 空调机组 2', 'ac', AREAS[0], 'online', { v: { temp: 24.8, power: 10.8 }, control: { power: true, mode: 'cool', target: 25 } }),
    dev('LT-A301', '办公楼大堂智能照明', 'lt', AREAS[0], 'online', { v: { brightness: 72, power: 3.1 }, control: { power: true, brightness: 72 } }),
    dev('TH-B101', '厂房 1F 生产区温湿度', 'th', AREAS[1], 'online', { v: { temp: 27.2, hum: 63 } }),
    dev('TH-B102', '厂房 2F 仓储区温湿度', 'th', AREAS[1], 'online', { v: { temp: 25.8, hum: 58 } }),
    dev('FL-B101', '厂房冷却水流量计', 'fl', AREAS[1], 'alarm', { v: { flow: 8.2 } }),
    dev('AQ-B201', '厂房焊接工位空气质量', 'aq', AREAS[1], 'warning', { v: { pm25: 68, co2: 940 } }),
    dev('AQ-B202', '厂房喷涂车间空气质量', 'aq', AREAS[1], 'online', { v: { pm25: 32, co2: 620 } }),
    dev('EM-B101', '厂房动力配电电表', 'em', AREAS[1], 'online', { v: { power: 152.7, energy: 3856.2 } }),
    dev('TH-C101', '数据中心冷通道 A 温湿度', 'th', AREAS[2], 'online', { v: { temp: 22.4, hum: 45 } }),
    dev('TH-C102', '数据中心热通道 B 温湿度', 'th', AREAS[2], 'alarm', { v: { temp: 29.8, hum: 42 } }),
    dev('EM-C101', '数据中心 UPS 进线电表', 'em', AREAS[2], 'online', { v: { power: 210.3, energy: 8930.7 } }),
    dev('WD-C101', '数据中心机房水浸探测', 'wd', AREAS[2], 'online', { v: { leak: 0 } }),
    dev('AC-C201', '精密空调 1 号机组', 'ac', AREAS[2], 'online', { v: { temp: 22.6, power: 38.5 }, control: { power: true, mode: 'cool', target: 22 } }),
    dev('AC-C202', '精密空调 2 号机组', 'ac', AREAS[2], 'offline', { v: { temp: 24.1, power: 0 }, control: { power: false, mode: 'cool', target: 22 } }),
    dev('GW-001', 'A 栋边缘采集网关', 'gw', AREAS[0], 'online', { v: { conn: 7, latency: 12 } }),
    dev('GW-002', 'B 栋边缘采集网关', 'gw', AREAS[1], 'online', { v: { conn: 6, latency: 18 } }),
    dev('GW-003', 'C 栋边缘采集网关', 'gw', AREAS[2], 'online', { v: { conn: 6, latency: 9 } }),
    dev('LT-P001', '园区东门景观照明', 'lt', AREAS[3], 'online', { v: { brightness: 55, power: 1.8 }, control: { power: true, brightness: 55 } }),
    dev('LT-P002', '园区主干道路灯组', 'lt', AREAS[3], 'offline', { v: { brightness: 0, power: 0 }, control: { power: false, brightness: 40 }, battery: 9 }),
    dev('EM-P001', '园区光伏并网电表', 'em', AREAS[3], 'online', { v: { power: -42.6, energy: 35621.4 } }),
    dev('TH-P001', '园区室外气象站温湿度', 'th', AREAS[3], 'online', { v: { temp: 26.9, hum: 71 }, battery: 63 })
  ];

  /* ================= 历史数据（24h / 5min 间隔） ================= */
  var HIST_N = 288, HIST_STEP = 5 * 60 * 1000;
  var histTimes = [];
  (function () {
    var t = Date.now() - (HIST_N - 1) * HIST_STEP;
    for (var i = 0; i < HIST_N; i++) { histTimes.push(t + i * HIST_STEP); }
  })();
  function genHist(base, amp, lo, hi, dayCurve) {
    var out = [], v = base;
    for (var i = 0; i < HIST_N; i++) {
      var hour = new Date(histTimes[i]).getHours() + new Date(histTimes[i]).getMinutes() / 60;
      var curve = dayCurve ? Math.cos((hour - 14) / 24 * Math.PI * 2) * amp * 0.5 : 0;
      v = walk(v + curve * 0.15, amp * 0.35, lo, hi);
      out.push(Math.round(v * 10) / 10);
    }
    return out;
  }
  devices.forEach(function (d) {
    if (d.type === 'th') { d.hist = genHist(d.v.temp, 1.4, 16, 31, true); }
    else if (d.type === 'em') { d.hist = genHist(Math.abs(d.v.power), 8, 5, 260, true); }
    else if (d.type === 'ac') { d.hist = genHist(d.v.temp, 0.8, 18, 28, false); }
    else if (d.type === 'aq') { d.hist = genHist(d.v.co2, 90, 400, 1200, true); }
    else { d.hist = genHist(d.v.flow || d.v.latency || d.v.brightness || 20, 2, 0, 100, false); }
  });

  /* ================= 告警系统 ================= */
  var ALARM_SEQ = 1000;
  var alarms = [];
  function addAlarm(devId, severity, msg, ts, status) {
    var d = byId(devId);
    var a = { id: 'AL-' + (++ALARM_SEQ), devId: devId, devName: d ? d.name : devId, area: d ? d.area : '-',
      severity: severity, msg: msg, ts: ts || Date.now(), status: status || 'active' };
    alarms.unshift(a);
    if (alarms.length > 200) alarms.pop();
    return a;
  }
  var T0 = Date.now();
  addAlarm('TH-C102', 'critical', '热通道温度 29.8℃，超过高温阈值 28℃（持续 12 分钟）', T0 - 42 * 60000);
  addAlarm('AC-C202', 'critical', '精密空调 2 号机组通信中断，冷通道 B 制冷冗余下降', T0 - 25 * 60000);
  addAlarm('FL-B101', 'major', '冷却水流量 8.2 m³/h，低于下限 12 m³/h', T0 - 18 * 60000);
  addAlarm('TH-A103', 'minor', '传感器电量 14%，请尽快更换电池', T0 - 9 * 60000, 'acked');
  addAlarm('AQ-B201', 'major', '焊接工位 CO₂ 浓度 940ppm，接近预警阈值', T0 - 6 * 60000, 'acked');
  addAlarm('LT-P002', 'major', '主干道路灯组离线超过 30 分钟', T0 - 33 * 60000);
  addAlarm('EM-A101', 'minor', '瞬时功率波动超过 15%', T0 - 55 * 60000, 'resolved');
  addAlarm('TH-B101', 'minor', '生产区温度短时越限，已自动恢复', T0 - 120 * 60000, 'resolved');
  addAlarm('GW-002', 'minor', '网关延迟升高至 45ms', T0 - 150 * 60000, 'resolved');

  function byId(id) { for (var i = 0; i < devices.length; i++) if (devices[i].id === id) return devices[i]; return null; }
  function sevName(s) { return { critical: '严重', major: '重要', minor: '一般' }[s] || s; }
  function stName(s) { return { online: '在线', offline: '离线', alarm: '告警', warning: '预警' }[s] || s; }

  /* ================= 状态 ================= */
  var state = {
    view: 'overview', paused: false, msgCount: 37650, msgRate: 0,
    devFilter: { q: '', status: '', type: '', area: '' }, devSort: { key: '', dir: 1 },
    alarmTab: 'active', alarmSev: '',
    trendRange: '24h', trendMetric: 'temp',
    drawerDev: null, cmdLogs: {}, lastAlarmShake: {}
  };

  /* ================= Toast / Modal ================= */
  var toastBox = $('#toasts');
  var TOAST_ICON = {
    success: '<svg class="icon" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    warn: '<svg class="icon" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    danger: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  function toast(kind, title, sub) {
    var el = document.createElement('div');
    el.className = 'toast t-' + kind;
    el.innerHTML = TOAST_ICON[kind || 'info'] + '<div><b>' + esc(title) + '</b>' + (sub ? '<div style="color:var(--muted);font-size:12px;margin-top:2px">' + esc(sub) + '</div>' : '') + '</div>';
    toastBox.appendChild(el);
    while (toastBox.children.length > 4) toastBox.removeChild(toastBox.firstChild);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 350); }, 4200);
  }
  var modalVeil = $('#modalVeil'), modalOk = $('#modalOk'), modalCb = null;
  function confirmModal(title, body, okText, cb) {
    $('#modalTitleText').textContent = title;
    $('#modalBody').innerHTML = body;
    modalOk.textContent = okText || '确认执行';
    modalCb = cb; modalVeil.classList.add('open'); modalOk.focus();
  }
  modalOk.addEventListener('click', function () { modalVeil.classList.remove('open'); if (modalCb) { var f = modalCb; modalCb = null; f(); } });
  $('#modalCancel').addEventListener('click', function () { modalVeil.classList.remove('open'); modalCb = null; });
  modalVeil.addEventListener('click', function (e) { if (e.target === modalVeil) { modalVeil.classList.remove('open'); modalCb = null; } });

  /* ================= 视图切换 ================= */
  var VIEW_META = {
    overview: ['监控总览', '园区全域设备实时状态'],
    devices: ['设备管理', '设备台账 · 搜索 · 筛选 · 详情与控制'],
    alarms: ['告警中心', '告警全生命周期处理'],
    trends: ['趋势分析', '历史遥测数据可视化']
  };
  $$('.nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () { switchView(btn.dataset.view); });
  });
  function switchView(v) {
    state.view = v;
    $$('.nav-item').forEach(function (b) {
      if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $$('.view').forEach(function (s) { s.classList.toggle('active', s.id === 'view-' + v); });
    $('#viewTitle').textContent = VIEW_META[v][0];
    $('#viewSub').textContent = VIEW_META[v][1];
    if (v === 'devices') renderDevices();
    if (v === 'alarms') renderAlarms();
    if (v === 'trends') renderTrends();
    if (v === 'overview') renderOverview();
    requestAnimationFrame(resizeAll);
  }
  $('#gotoAlarms').addEventListener('click', function () { switchView('alarms'); });
  $('#btnBell').addEventListener('click', function () { switchView('alarms'); });

  /* ================= 图表基座 ================= */
  var charts = {};
  function mkChart(id) {
    var el = document.getElementById(id);
    if (!el || !window.echarts) return null;
    if (charts[id]) return charts[id];
    var c = echarts.init(el, null, { renderer: 'svg' });
    charts[id] = c; return c;
  }
  function resizeAll() { Object.keys(charts).forEach(function (k) { charts[k].resize(); }); }
  window.addEventListener('resize', resizeAll);
  function axisBase() {
    return {
      axisLine: { lineStyle: { color: '#2A3B5C' } }, axisLabel: { color: TOK.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: TOK.grid } }, axisTick: { show: false }
    };
  }
  function tipBase() {
    return { trigger: 'axis', backgroundColor: '#14203A', borderColor: '#2A3B5C',
      textStyle: { color: '#E7EEF9', fontSize: 12 }, appendToBody: true };
  }

  /* ================= 总览渲染 ================= */
  function counts() {
    var c = { online: 0, offline: 0, alarm: 0, warning: 0 };
    devices.forEach(function (d) { c[d.status]++; });
    c.total = devices.length; return c;
  }
  function activeAlarms() { return alarms.filter(function (a) { return a.status === 'active'; }); }

  function renderKPIs() {
    var c = counts(), act = activeAlarms();
    $('#kpiTotal').textContent = c.total;
    $('#kpiOnline').textContent = Math.round(c.online / c.total * 100);
    $('#kpiOnlineSub').textContent = c.online + ' 台在线 · ' + c.offline + ' 台离线';
    $('#kpiAlarms').textContent = act.length;
    $('#kpiAlarmSub').textContent = '其中严重 ' + act.filter(function (a) { return a.severity === 'critical'; }).length + ' 条';
    $('#kpiAlarmCard').classList.toggle('danger', act.some(function (a) { return a.severity === 'critical'; }));
    $('#kpiMsgs').textContent = state.msgCount.toLocaleString();
    $('#kpiMsgSub').textContent = '速率 ' + state.msgRate.toFixed(1) + ' 条/秒';
    var badge = act.length;
    var nb = $('#navAlarmBadge'), bb = $('#bellBadge');
    nb.hidden = bb.hidden = badge === 0;
    nb.textContent = bb.textContent = badge > 99 ? '99+' : badge;
    var devBadge = $('#navDevBadge');
    var offAl = c.offline + c.alarm;
    devBadge.hidden = offAl === 0; devBadge.textContent = offAl;
  }

  function renderStatusChart() {
    var c = counts(), ch = mkChart('chartStatus');
    if (!ch) return;
    ch.setOption({
      animation: !reduceMotion,
      tooltip: Object.assign(tipBase(), { trigger: 'item', formatter: '{b}: {c} 台 ({d}%)' }),
      legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: TOK.text, fontSize: 12 } },
      series: [{
        type: 'pie', radius: ['52%', '74%'], center: ['50%', '44%'],
        itemStyle: { borderColor: '#101A2E', borderWidth: 3 },
        label: { show: true, position: 'center', formatter: function () { return c.total + '\n设备总数'; },
          color: '#E7EEF9', fontSize: 20, fontWeight: 700, lineHeight: 26 },
        emphasis: { scaleSize: 6 },
        data: [
          { value: c.online, name: '在线', itemStyle: { color: TOK.ok } },
          { value: c.warning, name: '预警', itemStyle: { color: TOK.warn } },
          { value: c.alarm, name: '告警', itemStyle: { color: TOK.bad } },
          { value: c.offline, name: '离线', itemStyle: { color: TOK.off } }
        ].filter(function (d) { return d.value > 0; })
      }]
    });
  }

  var liveBuf = { t: [], temp: [], hum: [], power: [] };
  (function seedLive() {
    var now = Date.now();
    for (var i = 59; i >= 0; i--) {
      liveBuf.t.push(now - i * 60000);
      liveBuf.temp.push(24 + Math.sin(i / 8) * 1.2 + rnd(-0.3, 0.3));
      liveBuf.hum.push(54 + Math.cos(i / 10) * 5 + rnd(-1, 1));
      liveBuf.power.push(120 + Math.sin(i / 6) * 22 + rnd(-6, 6));
    }
  })();
  function renderLiveChart() {
    var ch = mkChart('chartLive');
    if (!ch) return;
    ch.setOption({
      animation: false,
      tooltip: Object.assign(tipBase(), { valueFormatter: function (v) { return Array.isArray(v) ? v[1] : v; } }),
      legend: { top: 0, right: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 3, textStyle: { color: TOK.text, fontSize: 11.5 } },
      grid: { left: 44, right: 46, top: 34, bottom: 26 },
      xAxis: Object.assign(axisBase(), { type: 'category', boundaryGap: false,
        data: liveBuf.t.map(function (t) { return fmtHM(t); }),
        axisLabel: Object.assign(axisBase().axisLabel, { interval: 11 }) }),
      yAxis: [
        Object.assign(axisBase(), { type: 'value', name: '℃ / %', nameTextStyle: { color: TOK.muted }, max: 80 }),
        Object.assign(axisBase(), { type: 'value', name: 'kW', nameTextStyle: { color: TOK.muted }, splitLine: { show: false } })
      ],
      series: [
        { name: '平均温度', type: 'line', smooth: true, symbol: 'none', data: liveBuf.temp, lineStyle: { width: 2, color: TOK.s1 }, areaStyle: { color: 'rgba(59,130,246,0.10)' } },
        { name: '平均湿度', type: 'line', smooth: true, symbol: 'none', data: liveBuf.hum, lineStyle: { width: 2, color: TOK.s2 } },
        { name: '园区总功率', type: 'line', smooth: true, symbol: 'none', yAxisIndex: 1, data: liveBuf.power.map(function (v) { return Math.round(v); }), lineStyle: { width: 2, color: TOK.s6 } }
      ]
    });
  }

  function renderMiniAlarms() {
    var list = alarms.filter(function (a) { return a.status !== 'resolved'; }).slice(0, 5);
    var box = $('#miniAlarms');
    if (!list.length) { box.innerHTML = '<li class="empty">暂无未恢复告警，系统运行正常</li>'; return; }
    box.innerHTML = list.map(function (a) {
      return '<li><span class="sev ' + a.severity + '">' + sevName(a.severity) + '</span>' +
        '<div style="min-width:0"><div class="msg">' + esc(a.msg) + '</div>' +
        '<div class="dev mono">' + esc(a.devId) + ' · ' + esc(a.area) + (a.status === 'acked' ? ' · 已确认' : '') + '</div></div>' +
        '<span class="t">' + fmtHM(a.ts) + '</span></li>';
    }).join('');
  }

  function renderAreaGrid() {
    var box = $('#areaGrid');
    box.innerHTML = AREAS.map(function (area) {
      var ds = devices.filter(function (d) { return d.area === area; });
      var c = counts(); var ca = { online: 0, warning: 0, alarm: 0, offline: 0 };
      ds.forEach(function (d) { ca[d.status]++; });
      var total = ds.length || 1;
      function seg(n, color) { return n > 0 ? '<i style="width:' + (n / total * 100) + '%;background:' + color + '"></i>' : ''; }
      return '<div class="area-card"><div class="area-top">' +
        '<span class="area-name">' + esc(area) + '</span><span class="area-count">' + ca.online + '/' + ds.length + ' 在线</span></div>' +
        '<div class="area-bars">' + seg(ca.online, TOK.ok) + seg(ca.warning, TOK.warn) + seg(ca.alarm, TOK.bad) + seg(ca.offline, TOK.off) + '</div>' +
        '<div class="area-legend">' +
        '<span><i style="background:' + TOK.ok + '"></i>在线 ' + ca.online + '</span>' +
        '<span><i style="background:' + TOK.warn + '"></i>预警 ' + ca.warning + '</span>' +
        '<span><i style="background:' + TOK.bad + '"></i>告警 ' + ca.alarm + '</span>' +
        '<span><i style="background:' + TOK.off + '"></i>离线 ' + ca.offline + '</span></div></div>';
    }).join('');
  }

  function renderOverview() {
    renderKPIs(); renderStatusChart(); renderLiveChart(); renderMiniAlarms(); renderAreaGrid();
  }

  /* ================= 设备管理 ================= */
  function valueText(d) {
    var v = d.v;
    if (d.type === 'th') return v.temp.toFixed(1) + '<span class="u">℃</span> / ' + Math.round(v.hum) + '<span class="u">%</span>';
    if (d.type === 'em') return (v.power >= 0 ? '+' : '') + v.power.toFixed(1) + '<span class="u">kW</span>';
    if (d.type === 'fl') return v.flow.toFixed(1) + '<span class="u">m³/h</span>';
    if (d.type === 'aq') return Math.round(v.pm25) + '<span class="u">μg</span> / ' + Math.round(v.co2) + '<span class="u">ppm</span>';
    if (d.type === 'gw') return v.conn + '<span class="u">台</span> / ' + Math.round(v.latency) + '<span class="u">ms</span>';
    if (d.type === 'wd') return v.leak ? '检测到漏水' : '正常干燥';
    if (d.type === 'ac') return v.temp.toFixed(1) + '<span class="u">℃</span> · ' + v.power.toFixed(1) + '<span class="u">kW</span>';
    if (d.type === 'lt') return (v.power > 0 ? '开启 ' + Math.round(v.brightness) + '%' : '关闭');
    return '-';
  }
  function primaryMetric(d) {
    if (d.type === 'th') return d.v.temp;
    if (d.type === 'em') return Math.abs(d.v.power);
    if (d.type === 'fl') return d.v.flow;
    if (d.type === 'aq') return d.v.co2;
    if (d.type === 'gw') return d.v.latency;
    if (d.type === 'wd') return d.v.leak;
    if (d.type === 'ac') return d.v.temp;
    if (d.type === 'lt') return d.v.brightness;
    return 0;
  }
  function sigBars(s) {
    var bars = s >= 80 ? 4 : s >= 60 ? 3 : s >= 40 ? 2 : 1;
    var out = '';
    for (var i = 1; i <= 4; i++) {
      out += '<i style="display:inline-block;width:3px;height:' + (3 + i * 2.2) + 'px;margin-right:2px;border-radius:1px;background:' +
        (i <= bars ? 'var(--success)' : 'var(--rule-strong)') + '"></i>';
    }
    return out;
  }

  function filteredDevices() {
    var f = state.devFilter, q = f.q.trim().toLowerCase();
    return devices.filter(function (d) {
      if (q && (d.name + d.id + d.area).toLowerCase().indexOf(q) < 0) return false;
      if (f.status && d.status !== f.status) return false;
      if (f.type && d.type !== f.type) return false;
      if (f.area && d.area !== f.area) return false;
      return true;
    });
  }
  function renderDevices() {
    var list = filteredDevices();
    var k = state.devSort.key, dir = state.devSort.dir;
    if (k) {
      list.sort(function (a, b) {
        var va, vb;
        if (k === 'value') { va = primaryMetric(a); vb = primaryMetric(b); }
        else if (k === 'lastSeen') { va = a.lastSeen; vb = b.lastSeen; }
        else { va = a[k] === null ? -1 : a[k]; vb = b[k] === null ? -1 : b[k]; }
        return (va - vb) * dir;
      });
    }
    $('#devCount').innerHTML = '共 <b>' + devices.length + '</b> 台 · 筛选结果 <b>' + list.length + '</b> 台';
    $('#devEmpty').hidden = list.length > 0;
    $('#devTbody').innerHTML = list.map(function (d) {
      var battHtml = d.battery === null
        ? '<span style="color:var(--muted)">—</span>'
        : '<span class="batt ' + (d.battery < 20 ? 'low' : 'ok') + '">' + d.battery + '%</span>';
      return '<tr data-id="' + d.id + '" tabindex="0" role="button" aria-label="查看 ' + esc(d.name) + ' 详情">' +
        '<td data-l="设备"><span class="dev-name">' + esc(d.name) + '</span><br><span class="dev-id">' + d.id + '</span></td>' +
        '<td data-l="类型"><span class="tag">' + TYPES[d.type].name + '</span></td>' +
        '<td data-l="位置">' + esc(d.area) + '</td>' +
        '<td data-l="状态"><span class="st ' + d.status + '">' + stName(d.status) + '</span></td>' +
        '<td data-l="实时读数"><span class="val">' + valueText(d) + '</span></td>' +
        '<td data-l="信号"><span class="sig">' + sigBars(d.signal) + Math.round(d.signal) + '</span></td>' +
        '<td data-l="电量">' + battHtml + '</td>' +
        '<td data-l="最后上报" class="mono" style="color:var(--muted)">' + fmtAgo(d.lastSeen) + '</td></tr>';
    }).join('');
    $$('#devTbody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { openDrawer(tr.dataset.id); });
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(tr.dataset.id); } });
    });
  }
  ['devSearch', 'fltStatus', 'fltType', 'fltArea'].forEach(function (id) {
    $('#' + id).addEventListener('input', function () {
      state.devFilter.q = $('#devSearch').value;
      state.devFilter.status = $('#fltStatus').value;
      state.devFilter.type = $('#fltType').value;
      state.devFilter.area = $('#fltArea').value;
      renderDevices();
    });
  });
  Object.keys(TYPES).forEach(function (t) {
    var o = document.createElement('option'); o.value = t; o.textContent = TYPES[t].name;
    $('#fltType').appendChild(o);
  });
  AREAS.forEach(function (a) {
    var o = document.createElement('option'); o.value = a; o.textContent = a;
    $('#fltArea').appendChild(o);
  });
  $$('th.sortable').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.dataset.sort;
      if (state.devSort.key === k) state.devSort.dir *= -1; else { state.devSort.key = k; state.devSort.dir = 1; }
      $$('th.sortable .arr').forEach(function (a) { a.textContent = ''; });
      th.querySelector('.arr').textContent = state.devSort.dir > 0 ? '▲' : '▼';
      renderDevices();
    });
  });
  $('#globalSearch').addEventListener('input', function () {
    var v = this.value;
    $('#devSearch').value = v;
    state.devFilter.q = v;
    if (state.view !== 'devices') switchView('devices');
    else renderDevices();
  });

  /* ================= 告警中心 ================= */
  $$('.alarm-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      state.alarmTab = tab.dataset.tab;
      $$('.alarm-tab').forEach(function (t) { t.setAttribute('aria-selected', String(t === tab)); });
      renderAlarms();
    });
  });
  $('#fltSeverity').addEventListener('change', function () { state.alarmSev = this.value; renderAlarms(); });

  function renderAlarmStats() {
    var act = activeAlarms();
    $('#alStatCritical').textContent = act.filter(function (a) { return a.severity === 'critical'; }).length;
    $('#alStatMajor').textContent = act.filter(function (a) { return a.severity === 'major'; }).length;
    $('#alStatMinor').textContent = act.filter(function (a) { return a.severity === 'minor'; }).length;
    $('#alStatResolved').textContent = alarms.filter(function (a) { return a.status === 'resolved' && a.ts > Date.now() - 86400000; }).length;
  }
  function renderAlarms() {
    renderAlarmStats();
    var list = alarms.filter(function (a) {
      if (state.alarmTab === 'active') return a.status === 'active';
      if (state.alarmTab === 'acked') return a.status === 'acked';
      if (state.alarmTab === 'resolved') return a.status === 'resolved';
      return true;
    });
    if (state.alarmSev) list = list.filter(function (a) { return a.severity === state.alarmSev; });
    $('#alarmEmpty').hidden = list.length > 0;
    $('#alarmList').innerHTML = list.map(function (a) {
      var acts = '';
      if (a.status === 'active') acts = '<button class="btn btn-sm" data-act="ack" data-id="' + a.id + '">确认</button>';
      if (a.status === 'acked') acts = '<button class="btn btn-sm" data-act="resolve" data-id="' + a.id + '">标记恢复</button>';
      if (a.status === 'active' || a.status === 'acked') acts += ' <button class="btn btn-sm btn-danger-ghost" data-act="resolve" data-id="' + a.id + '">强制闭环</button>';
      return '<li class="alarm-item ' + (a.status === 'resolved' ? 'resolved' : '') + '">' +
        '<span class="sev ' + a.severity + '">' + sevName(a.severity) + '</span>' +
        '<div class="alarm-main"><div class="alarm-msg">' + esc(a.msg) + '</div>' +
        '<div class="alarm-meta"><span class="mono">' + esc(a.devId) + ' · ' + esc(a.devName) + '</span>' +
        '<span>' + esc(a.area) + '</span><span class="mono">' + fmtHMS(a.ts) + '</span>' +
        '<span>编号 <span class="mono">' + a.id + '</span></span></div></div>' +
        '<div class="alarm-acts">' + (acts || '<span class="tag">已闭环</span>') + '</div></li>';
    }).join('');
    $$('#alarmList [data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = alarms.filter(function (x) { return x.id === btn.dataset.id; })[0];
        if (!a) return;
        if (btn.dataset.act === 'ack') { a.status = 'acked'; toast('info', '告警已确认', a.devId + ' · ' + a.msg.slice(0, 18) + '…'); }
        else {
          a.status = 'resolved'; a.resolvedAt = Date.now();
          toast('success', '告警已闭环', a.devId + ' 恢复正常监控');
          var d = byId(a.devId);
          if (d && d.status === 'alarm') d.status = 'online';
        }
        renderAlarms(); renderKPIs();
      });
    });
  }

  /* ================= 趋势分析 ================= */
  $$('.seg [data-range]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.trendRange = btn.dataset.range;
      $$('.seg [data-range]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      renderTrends();
    });
  });
  $('#trendMetric').addEventListener('change', function () { state.trendMetric = this.value; renderTrends(); });

  var METRIC_META = {
    temp: { name: '温度', unit: '℃', get: function (d) { return d.type === 'th' || d.type === 'ac' ? d.hist : null; }, lo: 16, hi: 32 },
    humidity: { name: '湿度', unit: '%RH', get: function (d) { return d.type === 'th' ? d.hist.map(function (v) { return Math.round(clamp(58 + (v - 24) * -1.5, 35, 80)); }) : null; }, lo: 30, hi: 85 },
    power: { name: '功率', unit: 'kW', get: function (d) { return d.type === 'em' ? d.hist : null; }, lo: 0, hi: 260 }
  };
  function sliceByRange(arr) {
    var n = { '1h': 12, '6h': 72, '24h': 288 }[state.trendRange] || 288;
    return arr.slice(-n);
  }
  function renderTrends() {
    var m = METRIC_META[state.trendMetric];
    var times = sliceByRange(histTimes);
    var step = Math.max(1, Math.floor(times.length / 8));

    var byArea = {};
    AREAS.forEach(function (area) {
      var seriesArr = devices.filter(function (d) { return d.area === area && m.get(d); });
      if (!seriesArr.length) return;
      byArea[area] = times.map(function (_, i) {
        var sum = 0, n = 0;
        seriesArr.forEach(function (d) { var h = m.get(d); if (h) { sum += h[h.length - times.length + i]; n++; } });
        return n ? Math.round(sum / n * 10) / 10 : null;
      });
    });
    var chA = mkChart('chartTrendA');
    if (chA) {
      chA.setOption({
        animation: !reduceMotion,
        tooltip: Object.assign(tipBase(), { valueFormatter: function (v) { return v == null ? '-' : v + ' ' + m.unit; } }),
        legend: { top: 0, right: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 3, textStyle: { color: TOK.text, fontSize: 11.5 } },
        grid: { left: 44, right: 20, top: 36, bottom: 26 },
        xAxis: Object.assign(axisBase(), { type: 'category', boundaryGap: false,
          data: times.map(function (t) { return fmtHM(t); }),
          axisLabel: Object.assign(axisBase().axisLabel, { interval: Math.max(0, step - 1) }) }),
        yAxis: Object.assign(axisBase(), { type: 'value', min: m.lo, max: m.hi, name: m.unit, nameTextStyle: { color: TOK.muted } }),
        series: Object.keys(byArea).map(function (area, i) {
          var colors = [TOK.s1, TOK.s2, TOK.s3, TOK.s5];
          return { name: area, type: 'line', smooth: true, symbol: 'none', data: byArea[area],
            lineStyle: { width: 2, color: colors[i] }, itemStyle: { color: colors[i] } };
        })
      }, true);
    }

    var picks = devices.filter(function (d) { return m.get(d); }).slice(0, 4);
    var chB = mkChart('chartTrendB');
    if (chB) {
      chB.setOption({
        animation: !reduceMotion,
        tooltip: Object.assign(tipBase(), { valueFormatter: function (v) { return v == null ? '-' : v + ' ' + m.unit; } }),
        legend: { top: 0, right: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 3, textStyle: { color: TOK.text, fontSize: 11.5 } },
        grid: { left: 44, right: 20, top: 36, bottom: 26 },
        xAxis: Object.assign(axisBase(), { type: 'category', boundaryGap: false,
          data: times.map(function (t) { return fmtHM(t); }) }),
        yAxis: Object.assign(axisBase(), { type: 'value', scale: true, name: m.unit, nameTextStyle: { color: TOK.muted } }),
        series: picks.map(function (d, i) {
          var colors = [TOK.s1, TOK.s2, TOK.s4, TOK.s6];
          return { name: d.id, type: 'line', smooth: true, symbol: 'none', data: sliceByRange(m.get(d)),
            lineStyle: { width: 1.8, color: colors[i], opacity: 0.9 }, itemStyle: { color: colors[i] },
            emphasis: { lineStyle: { width: 2.6 } } };
        })
      }, true);
    }
    $('#trendTitleA').textContent = m.name + '历史趋势 · 按楼宇均值';
    $('#trendTitleB').textContent = m.name + '历史趋势 · 单设备对比';
  }

  /* ================= 设备详情抽屉 ================= */
  var drawer = $('#drawer'), drawerVeil = $('#drawerVeil'), sparkChart = null;
  function disposeSpark() { if (sparkChart) { sparkChart.dispose(); sparkChart = null; } }
  function openDrawer(id) {
    var d = byId(id); if (!d) return;
    state.drawerDev = d;
    renderDrawer(d);
    drawer.classList.add('open'); drawerVeil.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    $('#drawerClose').focus();
  }
  function closeDrawer() {
    drawer.classList.remove('open'); drawerVeil.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    disposeSpark();
    state.drawerDev = null;
  }
  $('#drawerClose').addEventListener('click', closeDrawer);
  drawerVeil.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (modalVeil.classList.contains('open')) { modalVeil.classList.remove('open'); modalCb = null; return; }
      if (drawer.classList.contains('open')) closeDrawer();
    }
  });

  function ctrlSection(d) {
    if (!d.control) return '';
    var c = d.control;
    var isAC = d.type === 'ac', isLT = d.type === 'lt';
    var modes = isAC ? [['cool', '制冷'], ['heat', '制热'], ['fan', '送风'], ['auto', '自动']] : [];
    var html = '<div class="dsec-title">设备控制</div><div>';
    if (d.status === 'offline') {
      html += '<p class="empty">设备离线，控制指令暂不可用</p></div>'; return html;
    }
    html += '<div class="ctrl-row"><div>运行开关<span class="desc">' + (isAC ? '机组启停' : '照明回路') + '</span></div>' +
      '<button class="switch" role="switch" aria-checked="' + c.power + '" aria-label="运行开关" data-ctrl="power"></button></div>';
    if (isAC) {
      html += '<div class="ctrl-row"><div>运行模式</div><div class="mode-seg" role="group" aria-label="运行模式">' +
        modes.map(function (m) { return '<button data-ctrl="mode" data-val="' + m[0] + '" aria-pressed="' + (c.mode === m[0]) + '">' + m[1] + '</button>'; }).join('') +
        '</div></div>';
      html += '<div class="ctrl-row"><div>目标温度</div><div class="slider-row" style="flex:1;max-width:220px">' +
        '<input type="range" min="16" max="30" step="0.5" value="' + c.target + '" data-ctrl="target" aria-label="目标温度">' +
        '<span class="slider-val" id="targetVal">' + c.target.toFixed(1) + '℃</span></div></div>';
    }
    if (isLT) {
      html += '<div class="ctrl-row"><div>调光<span class="desc">0 – 100%</span></div><div class="slider-row" style="flex:1;max-width:220px">' +
        '<input type="range" min="0" max="100" step="5" value="' + c.brightness + '" data-ctrl="brightness" aria-label="亮度">' +
        '<span class="slider-val" id="targetVal">' + c.brightness + '%</span></div></div>';
    }
    html += '</div>';
    return html;
  }

  function renderDrawer(d) {
    $('#drawerTitle').textContent = d.name;
    $('#drawerId').textContent = d.id + ' · ' + TYPES[d.type].name;
    var vals = '';
    if (d.type === 'th') vals = lv('温度', d.v.temp.toFixed(1), '℃') + lv('湿度', Math.round(d.v.hum), '%RH');
    else if (d.type === 'em') vals = lv('有功功率', d.v.power.toFixed(1), 'kW') + lv('累计电量', d.v.energy.toFixed(1), 'kWh');
    else if (d.type === 'fl') vals = lv('瞬时流量', d.v.flow.toFixed(1), 'm³/h');
    else if (d.type === 'aq') vals = lv('PM2.5', Math.round(d.v.pm25), 'μg/m³') + lv('CO₂', Math.round(d.v.co2), 'ppm');
    else if (d.type === 'gw') vals = lv('在线子设备', d.v.conn, '台') + lv('上报时延', Math.round(d.v.latency), 'ms');
    else if (d.type === 'wd') vals = lv('水浸状态', d.v.leak ? '漏水' : '干燥', '');
    else if (d.type === 'ac') vals = lv('回风温度', d.v.temp.toFixed(1), '℃') + lv('运行功率', d.v.power.toFixed(1), 'kW') + lv('目标温度', d.control ? d.control.target.toFixed(1) : '-', '℃');
    else if (d.type === 'lt') vals = lv('亮度', Math.round(d.v.brightness), '%') + lv('功率', d.v.power.toFixed(1), 'kW');
    function lv(l, v, u) { return '<div class="lv"><b>' + v + '<span class="u">' + u + '</span></b><span>' + l + '</span></div>'; }

    var logs = state.cmdLogs[d.id] || [];
    $('#drawerBody').innerHTML =
      '<div class="dsec-title">实时状态</div>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<span class="st ' + d.status + '">' + stName(d.status) + '</span>' +
        '<span class="tag">' + d.protocol + '</span><span class="tag">固件 ' + d.firmware + '</span>' +
        '<span class="tag mono" style="margin-left:auto">更新于 ' + fmtHMS(d.lastSeen) + '</span></div>' +
      '<div class="dsec-title">实时读数</div><div class="live-vals">' + vals + '</div>' +
      '<div class="spark" id="drawerSpark" role="img" aria-label="主指标迷你趋势图"></div>' +
      '<div class="dsec-title">基础信息</div>' +
      '<dl class="kv">' +
        '<dt>设备编号</dt><dd class="mono">' + d.id + '</dd>' +
        '<dt>设备类型</dt><dd>' + TYPES[d.type].name + '</dd>' +
        '<dt>安装位置</dt><dd>' + esc(d.area) + '</dd>' +
        '<dt>通信协议</dt><dd>' + d.protocol + '</dd>' +
        '<dt>信号强度</dt><dd class="mono">' + Math.round(d.signal) + ' dBm 等效</dd>' +
        '<dt>电池电量</dt><dd>' + (d.battery === null ? '外接供电' : d.battery + '%') + '</dd>' +
        '<dt>安装日期</dt><dd class="mono">' + d.installDate + '</dd>' +
      '</dl>' +
      ctrlSection(d) +
      '<div class="dsec-title">指令日志</div>' +
      (logs.length ? '<ul class="cmd-log">' + logs.map(function (l) {
        return '<li><span class="t">' + l.t + '</span><span>' + esc(l.text) + '</span><span class="cmd-' + l.s + '">' + l.sTxt + '</span></li>';
      }).join('') + '</ul>' : '<p class="empty">暂无下发指令</p>');

    var sparkEl = $('#drawerSpark');
    if (sparkEl && window.echarts) {
      disposeSpark();
      var ch = sparkChart = echarts.init(sparkEl, null, { renderer: 'svg' });
      ch.setOption({
        animation: false, grid: { left: 4, right: 4, top: 6, bottom: 4 },
        xAxis: { type: 'category', show: false, data: d.hist.slice(-40).map(function (_, i) { return i; }) },
        yAxis: { type: 'value', show: false, scale: true },
        tooltip: Object.assign(tipBase(), { trigger: 'axis', formatter: function (p) { return p[0].value; } }),
        series: [{ type: 'line', smooth: true, symbol: 'none', data: d.hist.slice(-40),
          lineStyle: { width: 1.8, color: TOK.s2 }, areaStyle: { color: 'rgba(34,211,238,0.12)' } }]
      });
      setTimeout(function () { ch.resize(); }, 60);
    }
    bindCtrl(d);
  }

  function bindCtrl(d) {
    $$('#drawerBody [data-ctrl]').forEach(function (el) {
      if (el.tagName === 'INPUT') {
        el.addEventListener('input', function () {
          var lab = $('#targetVal');
          if (lab) lab.textContent = el.value + (d.type === 'ac' ? '℃' : '%');
        });
        el.addEventListener('change', function () {
          var val = parseFloat(el.value);
          sendCmd(d, d.type === 'ac' ? '设定目标温度 ' + val.toFixed(1) + '℃' : '调节亮度至 ' + val + '%',
            function () {
              if (d.type === 'ac') d.control.target = val; else { d.control.brightness = val; d.v.brightness = val; }
            });
        });
        return;
      }
      el.addEventListener('click', function () {
        if (el.dataset.ctrl === 'power') {
          var next = el.getAttribute('aria-checked') !== 'true';
          var act = next ? '开机' : (d.area === AREAS[2] ? '停机（数据中心机组）' : '停机');
          var run = function () { sendCmd(d, act, function () { d.control.power = next; if (!next && d.type === 'ac') d.v.power = 0; }); };
          if (!next && d.area === AREAS[2]) {
            confirmModal('高风险操作确认',
              '即将对 <b class="mono">' + esc(d.id) + '</b>（' + esc(d.name) + '）执行<b style="color:var(--danger)">停机</b>。' +
              '该机组位于数据中心，停机将降低机房制冷冗余，可能触发高温告警。确认继续？', '确认停机', run);
          } else run();
        } else if (el.dataset.ctrl === 'mode') {
          var val = el.dataset.val;
          var nameMap = { cool: '制冷', heat: '制热', fan: '送风', auto: '自动' };
          sendCmd(d, '切换模式 → ' + nameMap[val], function () { d.control.mode = val; });
        }
      });
    });
  }

  function sendCmd(d, text, apply) {
    var log = { t: fmtHMS(Date.now()), text: text + ' → ' + d.id, s: 'pending', sTxt: '下发中' };
    (state.cmdLogs[d.id] = state.cmdLogs[d.id] || []).unshift(log);
    if (state.cmdLogs[d.id].length > 12) state.cmdLogs[d.id].pop();
    if (state.drawerDev === d) { renderDrawer(d); }
    toast('info', '指令已下发', text + ' · ' + d.id);
    setTimeout(function () {
      var ok = Math.random() > 0.06;
      log.s = ok ? 'ok' : 'fail';
      log.sTxt = ok ? '执行成功' : '执行失败';
      if (ok) apply();
      toast(ok ? 'success' : 'danger', ok ? '指令执行成功' : '指令执行失败', text + ' · ' + d.id + (ok ? '' : '（设备忙，请重试）'));
      if (state.drawerDev === d) renderDrawer(d);
      renderDevices();
    }, 900 + Math.random() * 800);
  }

  /* ================= 实时模拟引擎 ================= */
  function tickValues() {
    devices.forEach(function (d) {
      var v = d.v;
      if (d.status === 'offline') return;
      if (d.type === 'th') { v.temp = walk(v.temp, 0.25, 16, 32); v.hum = walk(v.hum, 1.2, 30, 85); }
      else if (d.type === 'em') { v.power = walk(v.power, 3.5, -60, 260); v.energy += Math.abs(v.power) / 1800; }
      else if (d.type === 'fl') { v.flow = walk(v.flow, 0.5, 0, 40); }
      else if (d.type === 'aq') { v.pm25 = Math.round(walk(v.pm25, 4, 5, 120)); v.co2 = Math.round(walk(v.co2, 25, 400, 1200)); }
      else if (d.type === 'gw') { v.conn = clamp(Math.round(walk(v.conn, 0.4, 3, 8)), 3, 8); v.latency = Math.round(walk(v.latency, 3, 4, 60)); }
      else if (d.type === 'ac') { if (d.control && d.control.power) v.power = walk(v.power, 1.2, 4, 42); v.temp = walk(v.temp, 0.2, 18, 31); }
      else if (d.type === 'lt') { if (d.control && d.control.power) v.power = walk(v.power, 0.3, 0.4, 5); }
      d.lastSeen = Date.now() - Math.floor(rnd(0, 8)) * 1000;
      d.hist.push(Math.round(primaryMetric(d) * 10) / 10);
      if (d.hist.length > HIST_N) d.hist.shift();
      checkThresholds(d);
    });
    state.msgRate = rnd(3.2, 6.8);
    state.msgCount += Math.round(state.msgRate * 2 + rnd(0, 6));
  }

  function checkThresholds(d) {
    var now = Date.now();
    function raise(sev, msg, key) {
      if (state.lastAlarmShake[key] && now - state.lastAlarmShake[key] < 300000) return;
      state.lastAlarmShake[key] = now;
      d.status = 'alarm';
      var a = addAlarm(d.id, sev, msg);
      toast(sev === 'critical' ? 'danger' : 'warn', '新告警 · ' + sevName(sev), d.name + '：' + msg.slice(0, 24) + '…');
      renderKPIs(); renderMiniAlarms();
      if (state.view === 'alarms') renderAlarms();
    }
    if (d.type === 'th' || d.type === 'ac') {
      if (d.v.temp > 28.5) raise(d.area === AREAS[2] ? 'critical' : 'major', (d.type === 'ac' ? '回风' : '') + '温度 ' + d.v.temp.toFixed(1) + '℃，超过阈值 28℃', d.id + '-temp');
      else if (d.v.temp > 27.5 && d.status === 'online') { d.status = 'warning'; }
    }
    if (d.type === 'aq') {
      if (d.v.co2 > 1100) raise('major', 'CO₂ 浓度 ' + d.v.co2 + 'ppm，超过阈值 1100ppm', d.id + '-co2');
      else if (d.v.pm25 > 90) raise('major', 'PM2.5 达 ' + d.v.pm25 + 'μg/m³，超过阈值 90μg/m³', d.id + '-pm');
      else if (d.status === 'online' && (d.v.co2 > 900 || d.v.pm25 > 60)) d.status = 'warning';
    }
    if (d.battery !== null && d.battery < 15 && d.status !== 'alarm') d.status = 'warning';
  }

  function tickEvents() {
    if (Math.random() < 0.10) {
      var cands = devices.filter(function (d) { return d.type !== 'gw'; });
      var d = cands[Math.floor(Math.random() * cands.length)];
      if (d.status === 'offline') {
        d.status = 'online'; d.lastSeen = Date.now();
        toast('success', '设备恢复上线', d.name + '（' + d.id + '）');
        var open = alarms.filter(function (a) { return a.devId === d.id && a.status === 'active'; });
        open.forEach(function (a) { a.status = 'resolved'; a.resolvedAt = Date.now(); });
      } else if (d.status === 'online') {
        d.status = 'offline';
        addAlarm(d.id, 'major', '设备通信中断，超过 3 个心跳周期未上报');
        toast('warn', '设备离线', d.name + '（' + d.id + '）失去连接');
        renderKPIs(); renderMiniAlarms();
        if (state.view === 'alarms') renderAlarms();
      }
    }
  }

  function tickLive() {
    liveBuf.t.push(Date.now());
    var ths = devices.filter(function (d) { return (d.type === 'th') && d.status !== 'offline'; });
    var temp = 0, hum = 0;
    ths.forEach(function (d) { temp += d.v.temp; hum += d.v.hum; });
    var ems = 0;
    devices.forEach(function (d) { if (d.type === 'em' && d.status !== 'offline') ems += Math.abs(d.v.power); });
    var n = ths.length || 1;
    liveBuf.temp.push(Math.round(temp / n * 10) / 10);
    liveBuf.hum.push(Math.round(hum / n));
    liveBuf.power.push(Math.round(ems));
    ['t', 'temp', 'hum', 'power'].forEach(function (k) { if (liveBuf[k].length > 60) liveBuf[k].shift(); });
    if (state.view === 'overview') renderLiveChart();
  }

  var tickCount = 0;
  function tick() {
    if (!state.paused) {
      tickCount++;
      tickValues();
      if (tickCount % 3 === 0) tickEvents();
      if (tickCount % 15 === 0) tickLive();
      if (state.view === 'overview') { renderKPIs(); }
      if (state.view === 'devices') renderDevices();
      if (state.view === 'overview' && tickCount % 5 === 0) { renderStatusChart(); renderAreaGrid(); }
    }
  }

  $('#btnPause').addEventListener('click', function () {
    state.paused = !state.paused;
    var label = this.querySelector('span'), dot = $('#sysDot'), txt = $('#sysText');
    if (state.paused) {
      label.textContent = '恢复实时';
      dot.className = 'dot paused'; txt.textContent = '实时引擎已暂停';
      $('#liveTag').textContent = 'PAUSED';
      toast('info', '实时模拟已暂停', '数据快照保持当前状态');
    } else {
      label.textContent = '暂停实时';
      dot.className = 'dot on'; txt.textContent = '实时引擎运行中';
      $('#liveTag').textContent = 'LIVE';
      toast('success', '实时模拟已恢复', '设备数据继续刷新');
    }
  });

  /* ================= 时钟 ================= */
  function tickClock() {
    $('#clock').textContent = fmtHMS(Date.now());
  }
  setInterval(tickClock, 1000);

  /* ================= 启动 ================= */
  renderOverview();
  renderDevices();
  renderAlarms();
  renderTrends();
  setInterval(tick, 2000);
  setTimeout(function () {
    toast('info', '欢迎使用云枢 IoT 监控中心', '全部数据为本地演示模拟，2 秒周期自动刷新');
  }, 700);
})();
