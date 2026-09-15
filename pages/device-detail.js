/* ============================================================================
   设备详情页
   ----------------------------------------------------------------------------
   入口   pages/china-map.html 下钻后点击设备点位 / 设备清单
   参数   ?id=设备编号 & scene=场景 & loc=省|市|县
   数据   IoTShared.getSceneDevices('all') —— 与驾驶舱、分布地图同一份模型
   ========================================================================= */
(function () {
  'use strict';

  /* 同时支持 ?id= 与 #id=：file:// 下带 query 的本地路径在部分浏览器会加载失败 */
  var q = new URLSearchParams(location.search);
  var h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  function P(k) { return q.get(k) || h.get(k); }
  var DEV_ID = P('id') || '';
  var SCENE = P('scene') || 'field';
  var LOC = (P('loc') || '').split('|').filter(Boolean);
  var STATUS_TEXT = { online: '运行正常', warning: '状态异常', offline: '离线' };
  var DOMAIN_TEXT = { field: '工业互联网 · 现场设备', building: '楼宇自控 · 机电设备', home: '智慧家居 · 全屋设备' };
  var DOMAIN_ICON = { field: '⌬', building: '⌂', home: '◈' };
  var SCENE_TEXT = { field: '工业互联网', building: '楼宇自控', home: '智慧家居', all: '全域设备' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function nz(v, d) { return (v == null || v === '') ? (d == null ? '--' : d) : v; }

  function siteName(d) {
    var base = LOC[2] || LOC[1] || LOC[0] || '';
    if (d.domain === 'building') return base + '智能楼宇 · ' + nz(d.zone, '机电层');
    if (d.domain === 'home') return base + '示范家庭 · ' + nz(d.zone, '全屋');
    return base + '智慧工业园区 · ' + nz(d.zone, '生产区');
  }

  /* shared-data.js 用 const 声明 IoTShared，全局 const 不挂 window，需用 typeof 探测 */
  function SHARED() {
    try { if (typeof IoTShared !== 'undefined' && IoTShared) return IoTShared; } catch (e) { /* noop */ }
    return window.IoTShared || null;
  }

  function findDevice() {
    var S = SHARED();
    if (!S || !S.getSceneDevices) return null;
    var all = S.getSceneDevices('all') || [];
    for (var i = 0; i < all.length; i++) { if (all[i].id === DEV_ID) return all[i]; }
    return null;
  }

  function peersOf(d) {
    var S = SHARED();
    var all = (S && S.getSceneDevices && S.getSceneDevices('all')) || [];
    /* 同一业务线 + 同一站点分区 = 该站点（一个家庭 / 一栋楼宇 / 一座园区）的设备群 */
    var sameDomain = all.filter(function (x) { return x.domain === d.domain; });
    var pool = sameDomain.filter(function (x) { return x.zone === d.zone; });
    if (!pool.length) pool = sameDomain;
    return pool;
  }

  function renderMissing() {
    document.getElementById('dd-body').innerHTML =
      '<div class="dd-panel dd-missing">' +
      '<h1>未找到设备 ' + esc(DEV_ID || '（未指定编号）') + '</h1>' +
      '<p>请从全国设备分布地图下钻后点击具体设备进入，或在驾驶舱设备清单中选择。</p>' +
      '<div class="dd-actions" style="max-width:420px;margin:0 auto">' +
      '<a class="dd-act primary" href="china-map.html">打开全国分布地图</a>' +
      '<a class="dd-act" href="../index.html">返回驾驶舱</a>' +
      '</div></div>';
  }

  function render(d) {
    var st = d.status || 'online';
    var peers = peersOf(d);
    var onPeers = peers.filter(function (x) { return x.status === 'online'; }).length;
    var warnPeers = peers.filter(function (x) { return x.status === 'warning'; }).length;
    var offPeers = peers.filter(function (x) { return x.status === 'offline'; }).length;
    var health = d.status === 'online' ? 96 - (d.restartCount || 0) * 3 : d.status === 'warning' ? 68 : 24;
    var rssiPct = d.rssi != null ? Math.max(4, Math.min(100, Math.round((d.rssi + 100) / 50 * 100))) : 0;

    /* 面包屑 */
    var crumb = '<a href="../index.html">驾驶舱</a><span>›</span>' +
      '<a href="china-map.html?scene=' + encodeURIComponent(SCENE) + '">全国分布地图</a>';
    if (LOC[0]) crumb += '<span>›</span><a href="china-map.html?scene=' + encodeURIComponent(SCENE) + '">' + esc(LOC[0]) + '</a>';
    if (LOC[1]) crumb += '<span>›</span><a href="china-map.html?scene=' + encodeURIComponent(SCENE) + '">' + esc(LOC[1]) + '</a>';
    if (LOC[2]) crumb += '<span>›</span><a>' + esc(LOC[2]) + '</a>';
    crumb += '<span>›</span><a class="cur">' + esc(d.name) + '</a>';
    document.getElementById('dd-crumb').innerHTML = crumb;
    document.getElementById('dd-id').textContent = d.id;
    document.getElementById('dd-map').href = 'china-map.html?scene=' + encodeURIComponent(SCENE);

    var locHtml = '<div class="dd-loc">';
    var lv = [['省 / 直辖市', LOC[0]], ['地市 / 州', LOC[1]], ['区县', LOC[2]]];
    lv.forEach(function (row) {
      locHtml += '<div class="dd-loc-item"><i>' + row[0].slice(0, 1) + '</i><div>' +
        '<span>' + row[0] + '</span><strong>' + esc(row[1] || '未下沉到该级') + '</strong></div></div>';
    });
    locHtml += '<div class="dd-loc-item"><i>⌬</i><div><span>所属站点</span><strong>' +
      esc(siteName(d)) + '</strong></div></div></div>';

    var adviceHtml = '';
    if (d.status === 'offline') {
      adviceHtml =
        '<div class="dd-advice-item"><b>1</b><p>先在平台侧确认该设备所属网关 ' + esc(nz(d.gateway)) + ' 的在线状态，网关离线会连带整条链路失去心跳。</p></div>' +
        '<div class="dd-advice-item"><b>2</b><p>网关在线但设备离线时，检查现场供电与 ' + esc(nz(d.protocol)) + ' 链路终端电阻，必要时现场重启设备。</p></div>' +
        '<div class="dd-advice-item"><b>3</b><p>恢复后在运维驾驶舱确认连续 3 个上报周期正常，再关闭该条告警工单。</p></div>';
    } else if (d.status === 'warning') {
      adviceHtml =
        '<div class="dd-advice-item"><b>1</b><p>该设备上报了越限或异常读数，建议对照相邻点位数据判断是真实工况变化还是传感器漂移。</p></div>' +
        '<div class="dd-advice-item"><b>2</b><p>若为本月第 2 次以上出现，纳入预防性维护计划，安排现场校准。</p></div>';
    } else {
      adviceHtml =
        '<div class="dd-advice-item"><b>1</b><p>设备运行参数处于正常区间，无需干预。最近 24 小时上报 ' +
        Math.max(1, 288 - (d.restartCount || 0) * 12) + ' 次心跳，链路稳定。</p></div>' +
        '<div class="dd-advice-item"><b>2</b><p>下次例行巡检建议核对固件版本 ' + esc(nz(d.firmware)) + ' 是否有可用更新。</p></div>';
    }

    var peerRows = peers.slice(0, 40).map(function (x) {
      var loc = [x._countyName, x._cityName].filter(Boolean)[0] || nz(x.zone, '');
      return '<div class="dd-dev-row' + (x.id === d.id ? ' self' : '') + '" data-id="' + esc(x.id) + '">' +
        '<i class="dd-dot ' + x.status + '"></i>' +
        '<strong>' + esc(x.name) + '</strong>' +
        '<small>' + esc(x.id) + ' · ' + esc(loc) + '</small></div>';
    }).join('');

    document.getElementById('dd-body').innerHTML =
      '<div class="dd-grid">' +
      '<div class="dd-col">' +

      /* 头卡 */
      '<section class="dd-panel dd-hero">' +
      '<div class="dd-hero-mark">' + (DOMAIN_ICON[d.domain] || '◇') + '</div>' +
      '<div class="dd-hero-main">' +
      '<h1>' + esc(d.name) + '</h1>' +
      '<p>' + esc(DOMAIN_TEXT[d.domain] || 'IoT 设备') + ' · 编号 ' + esc(d.id) + '</p>' +
      '<div class="dd-hero-tags">' +
      '<span class="dd-tag domain">' + esc(SCENE_TEXT[SCENE] || '全域设备') + '</span>' +
      '<span class="dd-tag">' + esc(nz(d.type)) + '</span>' +
      '<span class="dd-tag">' + esc(nz(d.protocol)) + '</span>' +
      '<span class="dd-tag">网关 ' + esc(nz(d.gateway)) + '</span>' +
      '<span class="dd-tag">固件 ' + esc(nz(d.firmware)) + '</span>' +
      '</div></div>' +
      '<em class="dd-badge ' + st + '">' + (STATUS_TEXT[st] || st) + '</em>' +
      '</section>' +

      /* KPI */
      '<section class="dd-panel">' +
      '<div class="dd-head-row"><p class="eyebrow">LIVE TELEMETRY</p><h3>实时运行参数</h3></div>' +
      '<div class="dd-kpi">' +
      kpi('设备状态', STATUS_TEXT[st] || st, st === 'online' ? '#4fd6a6' : st === 'warning' ? '#e5b444' : '#ff7c82') +
      kpi('信号强度', d.rssi != null ? d.rssi + ' dBm' : '--', null) +
      kpi('设备电量', d.battery != null ? d.battery + '%' : '--', null) +
      (d.temperature != null ? kpi('当前温度', d.temperature + ' °C', null) : kpi('通信质量', nz(d.signal), null)) +
      kpi('最近上报', d.minutesSinceSeen != null ? d.minutesSinceSeen + ' 分钟前' : '--', null) +
      kpi('重启次数', nz(d.restartCount, 0) + ' 次', null) +
      '</div></section>' +

      /* 趋势 */
      '<section class="dd-panel">' +
      '<div class="dd-head-row"><p class="eyebrow">TREND · LAST 8 HOURS</p><h3>' +
      (d.temperature != null ? '温度趋势' : '心跳与信号趋势') + '</h3></div>' +
      '<div id="dd-chart"></div></section>' +

      /* 站点 */
      '<section class="dd-panel">' +
      '<div class="dd-head-row"><p class="eyebrow">SITE DEVICES</p><h3>同站点设备 <b style="color:#74bdff">' + peers.length + '</b></h3></div>' +
      '<div class="dd-site-head"><span>所属站点</span><strong>' + esc(siteName(d)) + '</strong>' +
      '<em>在线 ' + onPeers + ' · 异常 ' + warnPeers + ' · 离线 ' + offPeers + '</em></div>' +
      '<div class="dd-dev-list">' + peerRows + '</div>' +
      (peers.length > 40 ? '<div class="cn-more" style="padding:10px 4px 2px;color:#4e6479;font-size:9px">仅列出前 40 台，完整清单见分布地图</div>' : '') +
      '</section>' +

      '</div>' +
      '<aside class="dd-col">' +

      '<section class="dd-panel">' +
      '<div class="dd-head-row"><p class="eyebrow">GEO ATTRIBUTION</p><h3>地理归属</h3></div>' +
      locHtml + '</section>' +

      '<section class="dd-panel">' +
      '<div class="dd-head-row"><p class="eyebrow">HEALTH</p><h3>运行健康度</h3></div>' +
      '<div class="dd-health">' +
      healthRow('综合健康度', health + ' 分') +
      bar(health, health < 70) +
      '</div>' +
      '<div class="dd-health" style="margin-top:13px">' +
      healthRow('链路质量', d.rssi != null ? nz(d.signal) : '中断') +
      bar(rssiPct, rssiPct < 40) +
      healthRow('供电状态', d.battery != null ? (d.battery > 30 ? '正常' : '偏低') : '市电供电') +
      bar(d.battery != null ? d.battery : 100, (d.battery || 100) <= 30) +
      '</div>' +
      '<div class="dd-health" style="margin-top:13px">' +
      healthRow('接入网关', nz(d.gateway)) +
      healthRow('通信协议', nz(d.protocol)) +
      healthRow('固件版本', nz(d.firmware)) +
      '</div></section>' +

      '<section class="dd-panel">' +
      '<div class="dd-head-row"><p class="eyebrow">AI DIAGNOSIS</p><h3>诊断与处理建议</h3></div>' +
      (d.offlineReason ? '<div class="dd-reason"><strong>' + esc(d.offlineReason) + '</strong><p>' +
        esc(d.offlineReasonDetail || '') + '</p></div>' : '') +
      '<div class="dd-advice">' + adviceHtml + '</div>' +
      '</section>' +

      '<section class="dd-panel">' +
      '<div class="dd-actions">' +
      '<a class="dd-act primary" href="china-map.html?scene=' + encodeURIComponent(SCENE) + '">在分布地图中定位</a>' +
      '<a class="dd-act" href="alerts.html">查看关联告警</a>' +
      '<a class="dd-act" href="topology.html">设备拓扑</a>' +
      '<a class="dd-act" href="maintenance.html">转维修工单</a>' +
      '</div></section>' +

      '</aside></div>';

    document.querySelectorAll('.dd-dev-row[data-id]').forEach(function (el) {
      el.addEventListener('click', function () { location.href = 'device-detail.html?id=' + encodeURIComponent(el.getAttribute('data-id')) + '&scene=' + encodeURIComponent(SCENE) + '&loc=' + encodeURIComponent(LOC.join('|')); });
    });

    drawChart(d);
  }

  function kpi(label, value, color) {
    return '<div class="dd-kpi-cell"><span>' + esc(label) + '</span><strong' +
      (color ? ' style="color:' + color + '"' : '') + '>' + esc(value) + '</strong><small>&nbsp;</small></div>';
  }
  function healthRow(label, value) {
    return '<div class="dd-health-row"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';
  }
  function bar(pct, warn) {
    return '<div class="dd-bar"><i class="' + (warn ? 'warn' : '') + '" style="width:' + Math.max(2, Math.min(100, pct)) + '%"></i></div>';
  }

  function drawChart(d) {
    var el = document.getElementById('dd-chart');
    if (!el || !window.echarts) return;
    var hist = d.history || [];
    var times = hist.map(function (h) { return h.time; });
    var useTemp = d.temperature != null && hist.some(function (h) { return h.temperature != null; });
    var values = useTemp
      ? hist.map(function (h) { return h.temperature; })
      : hist.map(function (h, i) { return Math.max(-72, Math.min(-42, (d.rssi || -60) + Math.sin(i * 1.1) * 3)); });

    var chart = echarts.init(el, null, { renderer: 'canvas' });
    chart.setOption({
      backgroundColor: 'transparent',
      grid: { left: 42, right: 18, top: 22, bottom: 26 },
      tooltip: {
        trigger: 'axis', backgroundColor: 'rgba(9,18,30,.96)', borderColor: '#1d3247',
        textStyle: { color: '#dbe7f2', fontSize: 11 },
        formatter: function (p) {
          var v = p[0].value;
          return p[0].axisValue + '<br/>' + (useTemp ? '温度 ' + v + ' °C' : '信号 ' + v + ' dBm');
        }
      },
      xAxis: {
        type: 'category', boundaryGap: false, data: times,
        axisLine: { lineStyle: { color: '#1d3247' } },
        axisLabel: { color: '#5d7a92', fontSize: 9 },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value', scale: true,
        splitLine: { lineStyle: { color: '#12212f' } },
        axisLabel: { color: '#5d7a92', fontSize: 9, formatter: useTemp ? '{value}°' : '{value}' }
      },
      series: [{
        type: 'line', smooth: true, symbol: 'circle', symbolSize: 5,
        data: values,
        lineStyle: { width: 2, color: '#3da5f5' },
        itemStyle: { color: '#74bdff', borderColor: '#060d17', borderWidth: 1 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(61,165,245,.32)' },
            { offset: 1, color: 'rgba(61,165,245,0)' }
          ])
        },
        markLine: useTemp ? {
          silent: true, symbol: 'none',
          lineStyle: { color: '#2a4256', type: 'dashed' },
          data: [{ type: 'average', name: '均值' }],
          label: { color: '#5d7a92', fontSize: 9, formatter: '均值 {c}°' }
        } : undefined
      }]
    });
    window.addEventListener('resize', function () { chart.resize(); });
  }

  function boot() {
    var d = findDevice();
    if (!d) { renderMissing(); return; }
    render(d);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
