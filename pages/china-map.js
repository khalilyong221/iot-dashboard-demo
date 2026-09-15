/* ============================================================================
   中国地图 · 省 / 市 / 县 三级设备分布下钻
   ----------------------------------------------------------------------------
   数据源
     边界  assets/data/geo/china.js  +  assets/data/geo/p{adcode}.js（按需加载）
           来源：阿里 DataV.GeoAtlas 官方行政区划轮廓数据
     设备  IoTShared.getSceneDevices(scene) —— 与驾驶舱共享同一份数据模型，
           场景切换（工业 / 楼宇 / 家居 / 全域）在此页同样生效
   ----------------------------------------------------------------------------
   为什么要绕这么一圈：本演示是本地双击打开的（file:// 协议），浏览器会硬性
   拦截该协议下的 fetch()；而 <script src> 不受同源策略限制，所以边界数据
   以 .js 形式挂到 window.__IOT_GEO__ 上，用动态 <script> 加载。
   ========================================================================= */
(function () {
  'use strict';

  var GEO_DIR = '../assets/data/geo/';
  var SCENES = { field: '工业互联网', building: '楼宇自控', home: '智慧家居', all: '全域设备' };
  var STATUS_COLOR = { online: '#34d399', warning: '#fbbf24', offline: '#ff5f6d' };
  var STATUS_TEXT = { online: '在线', warning: '异常', offline: '离线' };
  /* 省级业务权重：体现真实业务落点，同时保证全国均匀铺开（每个省级行政区至少 3 台） */
  var PROV_WEIGHT = {
    '440000': 100, '320000': 94, '330000': 88, '370000': 82, '410000': 66,
    '510000': 62, '420000': 56, '350000': 52, '430000': 50, '130000': 48,
    '340000': 46, '310000': 44, '110000': 43, '610000': 40, '210000': 38,
    '360000': 36, '500000': 34, '450000': 32, '530000': 30, '140000': 28,
    '120000': 27, '520000': 25, '230000': 24, '150000': 22, '650000': 20,
    '220000': 19, '620000': 18, '460000': 16, '640000': 12, '630000': 10,
    '540000': 8, '710000': 6, '810000': 4, '820000': 2
  };
  var RAMP = [[13, 26, 42], [17, 48, 76], [24, 92, 142], [56, 148, 208], [140, 208, 248]];

  /* ────────────────────────────── 确定性伪随机 ────────────────────────────── */
  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ────────────────────────────── 几何工具 ────────────────────────────── */
  function outerRings(geom) {
    if (!geom) return [];
    if (geom.type === 'Polygon') return [geom.coordinates[0]].filter(Boolean);
    if (geom.type === 'MultiPolygon') return geom.coordinates.map(function (p) { return p[0]; }).filter(Boolean);
    return [];
  }
  function bbox(ring) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (var i = 0; i < ring.length; i++) {
      var p = ring[i];
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    return [x0, y0, x1, y1];
  }
  function pointInRing(pt, ring) {
    var inside = false, x = pt[0], y = pt[1];
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  /* 在多边形内部随机取点（按面积加权选环，射线法校验），失败则退化为包围盒中心抖动 */
  function randomPointInFeature(feature, rng) {
    var rings = outerRings(feature.geometry);
    if (!rings.length) return null;
    var picks = [], total = 0;
    rings.forEach(function (r) {
      var b = bbox(r);
      var a = Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
      total += a; picks.push({ r: r, b: b, a: a });
    });
    if (total <= 0) return null;
    for (var attempt = 0; attempt < 26; attempt++) {
      var t = rng() * total, chosen = picks[picks.length - 1];
      for (var i = 0; i < picks.length; i++) { t -= picks[i].a; if (t <= 0) { chosen = picks[i]; break; } }
      var b2 = chosen.b;
      var pt = [b2[0] + rng() * (b2[2] - b2[0]), b2[1] + rng() * (b2[3] - b2[1])];
      if (pointInRing(pt, chosen.r)) return pt;
    }
    var b3 = picks[0].b;
    return [(b3[0] + b3[2]) / 2 + (rng() - 0.5) * 0.06, (b3[1] + b3[3]) / 2 + (rng() - 0.5) * 0.06];
  }

  /* ────────────────────────────── 地图数据按需加载 ────────────────────────────── */
  /* 约定：文件名与 window.__IOT_GEO__ 的键名一致 —— 全国为 "china"，省级为 "p{adcode}" */
  var pending = {};
  function geoFileName(key) { return key === 'china' ? 'china' : 'p' + key; }
  function loadGeo(key) {
    var file = geoFileName(key);
    return new Promise(function (resolve) {
      if (window.__IOT_GEO__ && window.__IOT_GEO__[file]) return resolve(window.__IOT_GEO__[file]);
      if (pending[file]) { pending[file].push(resolve); return; }
      pending[file] = [resolve];
      var s = document.createElement('script');
      s.src = GEO_DIR + file + '.js';
      s.onload = function () {
        var d = (window.__IOT_GEO__ || {})[file] || null;
        (pending[file] || []).forEach(function (fn) { fn(d); });
        pending[file] = null;
      };
      s.onerror = function () {
        (pending[file] || []).forEach(function (fn) { fn(null); });
        pending[file] = null;
      };
      document.head.appendChild(s);
    });
  }

  /* ────────────────────────────── 颜色 ────────────────────────────── */
  function ramp(t) {
    t = Math.max(0, Math.min(1, t || 0));
    var x = t * (RAMP.length - 1), i = Math.floor(x), f = x - i;
    var a = RAMP[i], b = RAMP[Math.min(RAMP.length - 1, i + 1)];
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' +
      Math.round(a[1] + (b[1] - a[1]) * f) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * f) + ')';
  }
  function n2(v) { return String(v == null ? '--' : v); }

  /* ────────────────────────────── 状态 ────────────────────────────── */
  var state = {
    level: 0,            // 0 全国 / 1 省 / 2 市
    path: [],            // [{adcode,name,level}]
    scene: 'field',
    devices: [],
    geo: {},             // 已加载的地图数据
    nameOf: {},          // adcode -> 中文名
    pool: null,          // 当前省的 { cities, counties }
    counts: {},          // 当前层级的聚合统计
    active: null,        // 当前选中的设备
    statusFilter: 'all',
    ready: false
  };
  var chart = null;

  /* shared-data.js 用 const 声明 IoTShared，全局 const 不会成为 window 的属性，
     所以必须用 typeof 做安全探测，直接读 window.IoTShared 会拿到 undefined */
  function SHARED() {
    try { if (typeof IoTShared !== 'undefined' && IoTShared) return IoTShared; } catch (e) { /* noop */ }
    return window.IoTShared || null;
  }

  /* ────────────────────────────── 分配算法 ────────────────────────────── */
  /* 按权重铺开：先保底 MIN 台/组，再按权重补足，洗牌后精确裁剪 —— 保证均匀又不失真 */
  function buildSlots(n, groups, rng) {
    var slots = [];
    if (!groups.length) return slots;
    var MIN = Math.min(3, Math.floor(n / groups.length));
    groups.forEach(function (g) { for (var i = 0; i < MIN; i++) slots.push(g.key); });
    var remain = Math.max(0, n - slots.length);
    var totalW = groups.reduce(function (s, g) { return s + (g.weight || 1); }, 0);
    groups.forEach(function (g) {
      var c = Math.round(remain * (g.weight || 1) / totalW);
      for (var i = 0; i < c; i++) slots.push(g.key);
    });
    while (slots.length < n) slots.push(groups[Math.floor(rng() * groups.length)].key);
    shuffle(slots, rng);
    slots.length = n;
    return slots;
  }

  function provFeatures() {
    var cn = state.geo.china;
    if (!cn) return [];
    return cn.features.filter(function (f) {
      return /^\d{6}$/.test(String(f.properties.adcode));
    });
  }
  function citiesOfProv() {
    var d = state.geo[state.path[0].adcode];
    if (!d) return [];
    var c = (d.cities && d.cities.features) || [];
    return c.length ? c : ((d.counties && d.counties.features) || []);
  }
  function countiesUnder(parent) {
    var d = state.geo[state.path[0].adcode];
    if (!d) return [];
    return ((d.counties && d.counties.features) || []).filter(function (f) {
      return String(f.properties.parent) === String(parent);
    });
  }

  /* 把设备分配到一组下级行政区，并在其多边形内落点 */
  function assignTo(devices, features, seedPrefix) {
    var groups = features.map(function (f) {
      return { key: String(f.properties.adcode), name: f.properties.name, weight: 1, feature: f };
    });
    var byKey = {};
    groups.forEach(function (g) { byKey[g.key] = g; state.nameOf[g.key] = g.name; });
    var rng = mulberry32(hashSeed(seedPrefix));
    var slots = buildSlots(devices.length, groups, rng);
    devices.forEach(function (d, i) {
      var g = byKey[slots[i]];
      if (!g) return;
      d[seedPrefix] = g.key;
      d[seedPrefix + 'Name'] = g.name;
      var pt = randomPointInFeature(g.feature, mulberry32(hashSeed(d.id + '@' + g.key)));
      if (pt) { d._lng = pt[0]; d._lat = pt[1]; }
    });
  }

  /* 全国视图：省级分配（只用省级重心作粗略坐标，不铺点） */
  function assignProvinces() {
    var groups = provFeatures().map(function (f) {
      var code = String(f.properties.adcode);
      state.nameOf[code] = f.properties.name;
      var c = f.properties.centroid || f.properties.center || [0, 0];
      return { key: code, name: f.properties.name, weight: PROV_WEIGHT[code] || 10, c: c };
    });
    var byKey = {};
    groups.forEach(function (g) { byKey[g.key] = g; });
    var rng = mulberry32(hashSeed('prov@2026'));
    var slots = buildSlots(state.devices.length, groups, rng);
    state.devices.forEach(function (d, i) {
      var g = byKey[slots[i]];
      if (!g) return;
      d._prov = g.key; d._provName = g.name;
      d._lng = g.c[0] + (rng() - 0.5) * 1.2;
      d._lat = g.c[1] + (rng() - 0.5) * 1.0;
    });
    /* 深拷贝一份省级归属，下钻后回退到全国仍然一致 */
    state.provAssign = {};
    state.devices.forEach(function (d) { state.provAssign[d.id] = { adcode: d._prov, name: d._provName, lng: d._lng, lat: d._lat }; });
  }

  /* ────────────────────────────── 聚合统计 ────────────────────────────── */
  function groupStat(devices, keyFn) {
    var map = {};
    devices.forEach(function (d) {
      var k = keyFn(d);
      if (!k) return;
      var c = map[k] || (map[k] = { total: 0, online: 0, warning: 0, offline: 0 });
      c.total++; c[d.status] = (c[d.status] || 0) + 1;
    });
    return map;
  }

  /* ────────────────────────────── 渲染 ────────────────────────────── */
  function devicesInView() {
    var lv = state.level, path = state.path;
    return state.devices.filter(function (d) {
      if (lv === 0) return true;
      if (String(d._prov) !== String(path[0].adcode)) return false;
      if (lv === 1) return true;
      if (String(d._city) !== String(path[1].adcode)) return false;
      return true;
    });
  }

  function buildContext() {
    var lv = state.level, path = state.path;
    var ctx = { level: lv, regions: [], points: [], rows: [], mapName: 'china', geoFC: null, max: 1 };

    if (lv === 0) {
      var cn = state.geo.china;
      ctx.geoFC = cn; ctx.mapName = 'china';
      var counted = provFeatures();
      ctx.counts = groupStat(state.devices, function (d) { return d._prov; });
      ctx.max = Math.max(1, Math.max.apply(null, counted.map(function (f) {
        var c = ctx.counts[String(f.properties.adcode)];
        return c ? c.total : 0;
      })));
      ctx.regions = counted.map(function (f) {
        var code = String(f.properties.adcode);
        var c = ctx.counts[code] || { total: 0, online: 0, warning: 0, offline: 0 };
        var t = Math.pow(c.total / ctx.max, 0.55);
        return {
          name: f.properties.name,
          itemStyle: { areaColor: c.total ? ramp(t) : '#0b1524' },
          label: { formatter: function () { return c.total ? String(c.total) : ''; } },
          _code: code, _stat: c, _c: f.properties.centroid || f.properties.center || null
        };
      });
      ctx.rows = counted.map(function (f) {
        var code = String(f.properties.adcode);
        var c = ctx.counts[code] || { total: 0, online: 0, warning: 0, offline: 0 };
        return { adcode: code, name: f.properties.name, stat: c, children: true };
      }).sort(function (a, b) { return b.stat.total - a.stat.total; });
      ctx.hint = '点击省份下钻到市级';
      ctx.tipText = '全国 ' + counted.length + ' 个省级行政区 · ' + state.devices.length + ' 台设备';

    } else if (lv === 1) {
      var data = state.geo[path[0].adcode];
      var kids = citiesOfProv();
      ctx.geoFC = { type: 'FeatureCollection', features: kids };
      ctx.mapName = 'prov-' + path[0].adcode;
      var inProv = devicesInView();
      ctx.points = inProv;
      ctx.counts = groupStat(inProv, function (d) { return d._city; });
      ctx.max = 1;
      kids.forEach(function (f) {
        var c = ctx.counts[String(f.properties.adcode)];
        if (c && c.total > ctx.max) ctx.max = c.total;
      });
      ctx.regions = kids.map(function (f) {
        var code = String(f.properties.adcode);
        var c = ctx.counts[code] || { total: 0, online: 0, warning: 0, offline: 0 };
        return {
          name: f.properties.name,
          itemStyle: { areaColor: ramp(Math.pow(c.total / ctx.max, 0.5)) },
          label: { formatter: function () { return c.total ? (f.properties.name + ' ' + c.total) : ''; } },
          _code: code, _stat: c, _c: f.properties.centroid || f.properties.center || null
        };
      });
      ctx.rows = kids.map(function (f) {
        var code = String(f.properties.adcode);
        var c = ctx.counts[code] || { total: 0, online: 0, warning: 0, offline: 0 };
        return { adcode: code, name: f.properties.name, stat: c, children: countiesUnder(code).length > 0 };
      }).sort(function (a, b) { return b.stat.total - a.stat.total; });
      ctx.hint = '点击地市下钻到区县';
      ctx.tipText = path[0].name + ' · ' + inProv.length + ' 台设备 · ' + kids.length + ' 个下级行政区';

    } else {
      var pid = path[0].adcode, cid = path[1].adcode;
      var kids2 = countiesUnder(cid);
      var curCity = citiesOfProv().filter(function (f) { return String(f.properties.adcode) === String(cid); })[0];
      /* 直筒子市 / 省直辖县级市：自身没有下级，用市域轮廓兜底 */
      if (!kids2.length && curCity) kids2 = [curCity];
      ctx.geoFC = { type: 'FeatureCollection', features: kids2 };
      ctx.mapName = 'city-' + cid;
      var inCity = devicesInView();
      ctx.points = inCity;
      ctx.counts = groupStat(inCity, function (d) { return d._county; });
      ctx.max = 1;
      kids2.forEach(function (f) {
        var c = ctx.counts[String(f.properties.adcode)];
        if (c && c.total > ctx.max) ctx.max = c.total;
      });
      ctx.regions = kids2.map(function (f) {
        var code = String(f.properties.adcode);
        var c = ctx.counts[code] || { total: 0, online: 0, warning: 0, offline: 0 };
        return {
          name: f.properties.name,
          itemStyle: { areaColor: ramp(Math.pow(c.total / ctx.max, 0.5)) },
          label: { formatter: function () { return c.total ? (f.properties.name + ' ' + c.total) : ''; } },
          _code: code, _stat: c, _c: f.properties.centroid || f.properties.center || null
        };
      });
      ctx.rows = kids2.map(function (f) {
        var code = String(f.properties.adcode);
        var c = ctx.counts[code] || { total: 0, online: 0, warning: 0, offline: 0 };
        return { adcode: code, name: f.properties.name, stat: c, children: false };
      }).sort(function (a, b) { return b.stat.total - a.stat.total; });
      ctx.hint = kids2.length > 1 ? '点击区县查看设备清单' : '该市为省直辖，已到最细一级';
      ctx.tipText = path[1].name + ' · ' + inCity.length + ' 台设备 · 已下钻到区县';
    }
    return ctx;
  }

  function optionOf(ctx) {
    var regions = ctx.regions;
    var labelShow = state.level < 2 ? true : (regions.length <= 30);
    var points = ctx.points.filter(function (d) {
      if (d._lng == null || d._lat == null) return false;
      return state.statusFilter === 'all' || d.status === state.statusFilter;
    });

    var normalPts = points.filter(function (d) { return d.status !== 'offline' && d.status !== 'warning'; });
    var alarmPts = points.filter(function (d) { return d.status === 'offline' || d.status === 'warning'; });

    function ptData(arr) {
      return arr.map(function (d) {
        return {
          name: d.name, value: [d._lng, d._lat], _d: d,
          symbolSize: d.status === 'offline' ? 8 : d.status === 'warning' ? 7 : 5.5,
          itemStyle: { color: STATUS_COLOR[d.status] || '#7fa8ca', borderColor: 'rgba(6,13,23,.85)', borderWidth: 1 }
        };
      });
    }

    var series = [];

    /* geo 组件的区域不响应点击，因此在每个区域中心铺一个透明气泡作为命中热区，
       点击热区即可下钻 —— 这是本页交互的可靠来源 */
    var hotspots = [];
    regions.forEach(function (r) {
      if (!r._c) return;
      hotspots.push({ name: r.name, value: r._c, _drill: true });
    });
    if (hotspots.length) {
      series.push({
        type: 'scatter', coordinateSystem: 'geo', geoIndex: 0, z: 6,
        symbol: 'circle', symbolSize: 30, animation: false,
        itemStyle: { color: 'rgba(0,0,0,0)' },
        emphasis: { scale: 1, itemStyle: { color: 'rgba(0,0,0,0)' } },
        tooltip: { show: false },
        data: hotspots
      });
    }

    if (points.length) {
      series.push({
        type: 'scatter', coordinateSystem: 'geo', geoIndex: 0, z: 12,
        data: ptData(normalPts), silent: false,
        emphasis: { scale: 1.8 },
        tooltip: { formatter: function (p) { return tipOf(p.data._d); } }
      });
      series.push({
        type: 'effectScatter', coordinateSystem: 'geo', geoIndex: 0, z: 13,
        data: ptData(alarmPts),
        rippleEffect: { brushType: 'stroke', scale: 3, period: 3.4 },
        emphasis: { scale: 1.8 },
        tooltip: { formatter: function (p) { return tipOf(p.data._d); } }
      });
    }

    return {
      backgroundColor: 'transparent',
      animationDuration: 420,
      tooltip: {
        trigger: 'item', backgroundColor: 'rgba(9,18,30,.96)', borderColor: '#1d3247',
        textStyle: { color: '#dbe7f2', fontSize: 11 }, extraCssText: 'border-radius:7px;padding:9px 11px;'
      },
      geo: {
        map: ctx.mapName,
        roam: true,
        zoom: ctx.level === 0 ? 1.16 : 1.05,
        center: undefined,
        scaleLimit: { min: 0.8, max: 12 },
        itemStyle: {
          areaColor: '#0d1a2a', borderColor: '#28486a', borderWidth: 0.9,
          shadowColor: 'rgba(20,70,120,.5)', shadowBlur: 16, shadowOffsetY: 4
        },
        label: {
          show: labelShow, color: '#8fb2d2', fontSize: 9, fontWeight: 600,
          textBorderColor: '#060d17', textBorderWidth: 2
        },
        emphasis: {
          itemStyle: { areaColor: '#1e4a72' },
          label: { show: true, color: '#ffffff', fontSize: 10 }
        },
        select: { disabled: true },
        regions: regions
      },
      series: series
    };
  }

  function tipOf(d) {
    if (!d) return '';
    return '<b style="color:#eaf4ff">' + d.name + '</b><br/>' +
      '编号 ' + d.id + '<br/>' +
      '状态 ' + (STATUS_TEXT[d.status] || d.status) + ' · ' + n2(d.type) + '<br/>' +
      '网关 ' + n2(d.gateway) + ' · ' + n2(d.protocol) +
      '<br/><span style="color:#6f93b4">点击查看设备详情</span>';
  }

  /* ────────────────────────────── 侧栏 ────────────────────────────── */
  function renderSummary(ctx) {
    var box = document.getElementById('cn-summary');
    var lv = state.level;
    var total = 0, on = 0, warn = 0, off = 0;
    var src = lv === 0 ? state.devices : devicesInView();
    src.forEach(function (d) {
      total++;
      if (d.status === 'online') on++; else if (d.status === 'warning') warn++; else off++;
    });
    var rate = total ? (on / total * 100).toFixed(1) : '0.0';
    var scope = lv === 0 ? '全国' : (lv === 1 ? state.path[0].name : state.path[1].name);
    box.innerHTML =
      '<div class="cn-sum-head"><p class="eyebrow">SCOPE SUMMARY</p><h3>' + scope + '</h3>' +
      '<span class="cn-scene-chip">' + (SCENES[state.scene] || '全域设备') + '</span></div>' +
      '<div class="cn-sum-grid">' +
      '<div class="cn-sum-cell"><span>设备总数</span><strong>' + total + '</strong><small>逻辑设备</small></div>' +
      '<div class="cn-sum-cell"><span>在线</span><strong style="color:#34d399">' + on + '</strong><small>' + rate + '% 在线率</small></div>' +
      '<div class="cn-sum-cell"><span>异常</span><strong style="color:#fbbf24">' + warn + '</strong><small>需关注</small></div>' +
      '<div class="cn-sum-cell"><span>离线</span><strong style="color:#ff7c82">' + off + '</strong><small>待恢复</small></div>' +
      '</div>' +
      statusBar(on, warn, off, total) +
      '<div class="cn-sum-foot"><span>在线率 <b style="color:#34d399">' + rate + '%</b></span>' +
      '<span>异常率 <b style="color:#fbbf24">' + (total ? ((warn + off) / total * 100).toFixed(1) : '0.0') + '%</b></span></div>';
  }

  function renderRank(ctx) {
    var box = document.getElementById('cn-rank');
    var rows = ctx.rows.slice(0, 12);
    var title = state.level === 0 ? '省份设备分布 TOP 12' :
      state.level === 1 ? '地市设备分布' : '区县设备分布';
    if (!rows.length) { box.innerHTML = '<div class="cn-empty">该范围暂无设备</div>'; return; }
    var max = rows[0].stat.total || 1;
    var html = '<div class="cn-block-head"><p class="eyebrow">DISTRIBUTION</p><h3>' + title + '</h3></div><div class="cn-rank-list">';
    rows.forEach(function (r, i) {
      var c = r.stat;
      var onlineRate = c.total ? Math.round(c.online / c.total * 100) : 0;
      var cls = c.offline ? 'bad' : c.warning ? 'warn' : 'ok';
      html += '<div class="cn-rank-row" data-adcode="' + r.adcode + '" data-drill="' + (r.children ? '1' : '0') + '">' +
        '<span class="cn-rank-no">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<div class="cn-rank-main"><div class="cn-rank-name"><strong>' + r.name + '</strong>' +
        '<em class="' + cls + '">' + c.total + ' 台 · ' + onlineRate + '%</em></div>' +
        '<div class="cn-rank-bar"><i style="width:' + Math.max(3, Math.round(c.total / max * 100)) + '%"></i></div>' +
        statusBar(c.online, c.warning, c.offline, c.total) + '</div>' +
        (r.children ? '<span class="cn-rank-arrow">›</span>' : '') +
        '</div>';
    });
    box.innerHTML = html + '</div>';
    box.querySelectorAll('.cn-rank-row').forEach(function (el) {
      el.addEventListener('click', function () { drillByAdcode(el.getAttribute('data-adcode')); });
    });
  }

  function renderDeviceList(ctx) {
    var box = document.getElementById('cn-devices');
    if (state.level === 0) {
      box.innerHTML = '<div class="cn-block-head"><p class="eyebrow">DEVICE FEED</p><h3>设备清单</h3></div>' +
        '<div class="cn-empty">下钻到省 / 市 / 区县后，这里会列出该范围内的设备，可直接进入详情页。</div>';
      return;
    }
    var list = devicesInView().slice().sort(function (a, b) {
      var w = { offline: 0, warning: 1, online: 2 };
      return (w[a.status] - w[b.status]) || a.id.localeCompare(b.id);
    });
    var head = '<div class="cn-block-head"><p class="eyebrow">DEVICE FEED</p><h3>设备清单 <b>' + list.length + '</b></h3></div>';
    if (!list.length) { box.innerHTML = head + '<div class="cn-empty">该范围暂无设备</div>'; return; }
    var html = head + '<div class="cn-dev-list">';
    list.slice(0, 120).forEach(function (d) {
      html += '<a class="cn-dev-row" href="' + detailHref(d) + '" data-id="' + d.id + '">' +
        '<i class="cn-dev-dot ' + d.status + '"></i>' +
        '<div class="cn-dev-main"><strong>' + d.name + '</strong>' +
        '<small>' + d.id + ' · ' + n2(d.type) + ' · ' + n2(d.gateway) + '</small></div>' +
        '<span class="cn-dev-loc">' + (d._countyName || d._cityName || d._provName || '') + '</span>' +
        '<span class="cn-dev-arrow">›</span></a>';
    });
    box.innerHTML = html + '</div>' +
      (list.length > 120 ? '<div class="cn-more">仅显示前 120 台，可继续下钻缩小范围</div>' : '');
  }

  function renderCrumb() {
    var box = document.getElementById('crumb');
    var html = '<a data-lv="0" class="' + (state.level === 0 ? 'cur' : '') + '">中国</a>';
    if (state.path[0]) html += '<span>›</span><a data-lv="1" class="' + (state.level === 1 ? 'cur' : '') + '">' + state.path[0].name + '</a>';
    if (state.path[1]) html += '<span>›</span><a data-lv="2" class="cur">' + state.path[1].name + '</a>';
    box.innerHTML = html;
    box.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { goto(parseInt(a.getAttribute('data-lv'), 10)); });
    });
    document.getElementById('cn-up').disabled = state.level === 0;
  }

  /* ────────────────────────────── 主渲染 ────────────────────────────── */
  /* ECharts 必须先 registerMap 才能被 geo.map 引用；同一张地图只注册一次 */
  var registered = {};
  function ensureMap(name, fc) {
    if (!fc || registered[name]) return;
    echarts.registerMap(name, fc);
    registered[name] = true;
  }

  function render() {
    if (!state.ready) return;
    try {
      var ctx = buildContext();
      ensureMap(ctx.mapName, ctx.geoFC);
      chart.setOption(optionOf(ctx), true);
      document.getElementById('cn-tip').textContent = ctx.tipText + ' · ' + ctx.hint;
      renderSummary(ctx);
      renderRank(ctx);
      renderDeviceList(ctx);
      renderCrumb();
    } catch (err) {
      /* 渲染链任一环出错都不该让整页失去反馈，把原因直接暴露到提示条 */
      window.__IOT_MAP_ERROR__ = String((err && err.stack) || err);
      var tip = document.getElementById('cn-tip');
      if (tip) tip.textContent = '渲染异常：' + (err && err.message ? err.message : err);
    }
  }

  /* ────────────────────────────── 下钻 / 回退 ────────────────────────────── */
  async function drillByAdcode(adcode) {
    if (state.level === 0) return gotoProvince(adcode);
    if (state.level === 1) return gotoCity(adcode);
    scrollDevice(adcode);
  }

  async function gotoProvince(adcode) {
    var f = provFeatures().filter(function (x) { return String(x.properties.adcode) === String(adcode); })[0];
    if (!f) return;
    var data = await loadGeo(adcode);
    if (!data) { document.getElementById('cn-tip').textContent = '该地区边界数据加载失败'; return; }
    state.geo[adcode] = data;
    var kids = (data.cities && data.cities.features || []).length ? data.cities.features : (data.counties.features || []);
    kids.forEach(function (x) { state.nameOf[String(x.properties.adcode)] = x.properties.name; });
    var sub = state.devices.filter(function (d) { return String(d._prov) === String(adcode); });
    assignTo(sub, kids, '_city');
    state.path = [{ adcode: adcode, name: f.properties.name }];
    state.level = 1;
    closeCard();
    render();
  }

  async function gotoCity(adcode) {
    var kids = countiesUnder(adcode);
    var cur = citiesOfProv().filter(function (x) { return String(x.properties.adcode) === String(adcode); })[0];
    if (!kids.length) kids = cur ? [cur] : [];
    if (!kids.length) return;
    kids.forEach(function (x) { state.nameOf[String(x.properties.adcode)] = x.properties.name; });
    var kidCode = String(kids[0].properties.adcode);
    /* 直筒子市：没有真正的下级，直接用市域兜底，设备归到市自身 */
    if (String(kidCode) === String(adcode)) {
      state.devices.forEach(function (d) {
        if (String(d._city) !== String(adcode)) return;
        d._county = adcode; d._countyName = state.nameOf[adcode] || '';
      });
    } else {
      var sub = state.devices.filter(function (d) { return String(d._city) === String(adcode); });
      assignTo(sub, kids, '_county');
    }
    state.path = [state.path[0], { adcode: adcode, name: state.nameOf[adcode] || '' }];
    state.level = 2;
    closeCard();
    render();
  }

  function goto(level) {
    if (level === state.level) return;
    if (level === 0) {
      state.level = 0; state.path = [];
      state.devices.forEach(function (d) {
        var a = state.provAssign[d.id];
        if (a) { d._lng = a.lng; d._lat = a.lat; }
      });
    } else if (level === 1) {
      state.level = 1; state.path = [state.path[0]];
    } else if (level === 2) {
      state.level = 2;
    }
    closeCard();
    render();
  }

  function scrollDevice(adcode) {
    var el = document.querySelector('.cn-rank-row[data-adcode="' + adcode + '"]');
    if (el) el.classList.add('flash');
  }

  /* ────────────────────────────── 设备卡片 ────────────────────────────── */
  function openCard(d) {
    state.active = d;
    var card = document.getElementById('cn-card');
    var county = d._countyName || '', city = d._cityName || '', prov = d._provName || '';
    var loc = [prov, city, county].filter(Boolean).join(' / ') || '--';
    var site = siteOf(d);
    card.innerHTML =
      '<button class="cn-card-x" id="cn-card-x">×</button>' +
      '<div class="cn-card-top"><i class="cn-dev-dot ' + d.status + '"></i>' +
      '<div><strong>' + d.name + '</strong><small>' + d.id + ' · ' + n2(d.type) + '</small></div>' +
      '<em class="cn-badge ' + d.status + '">' + (STATUS_TEXT[d.status] || d.status) + '</em></div>' +
      '<div class="cn-card-site"><span>所属站点</span><strong>' + site + '</strong></div>' +
      '<div class="cn-card-kv">' +
      kv('归属地区', loc) +
      kv('接入网关', n2(d.gateway)) +
      kv('通信协议', n2(d.protocol)) +
      kv('信号强度', d.rssi != null ? d.rssi + ' dBm' : '--') +
      kv('设备电量', d.battery != null ? d.battery + '%' : '--') +
      kv('固件版本', n2(d.firmware)) +
      (d.temperature != null ? kv('当前温度', d.temperature + ' °C') : '') +
      kv('最近上报', d.minutesSinceSeen != null ? d.minutesSinceSeen + ' 分钟前' : '--') +
      '</div>' +
      (d.offlineReason ? '<div class="cn-card-reason"><span>异常原因</span><p>' + d.offlineReason + '：' + (d.offlineReasonDetail || '') + '</p></div>' : '') +
      '<div class="cn-card-actions">' +
      '<a class="cn-btn primary" href="' + detailHref(d) + '">查看设备详情 →</a>' +
      '<button class="cn-btn" id="cn-card-loc">定位到所属区县</button>' +
      '</div>';
    card.hidden = false;
    var cls = document.getElementById('cn-card-x');
    if (cls) cls.addEventListener('click', closeCard);
    var locBtn = document.getElementById('cn-card-loc');
    if (locBtn) locBtn.addEventListener('click', function () {
      var code = d._county || d._city;
      if (code) { var el = document.querySelector('.cn-rank-row[data-adcode="' + code + '"]'); if (el) el.scrollIntoView({ block: 'center' }); }
    });
  }
  function kv(k, v) { return '<div class="cn-kv"><span>' + k + '</span><strong>' + v + '</strong></div>'; }
  /* 把设备的省 / 市 / 县拼成 URL 参数，详情页据此还原「所属站点」 */
  function locOf(d) {
    return [d._provName || '', d._cityName || '', d._countyName || ''].join('|');
  }
  /* file:// 下带 query 的本地路径在部分浏览器加载失败，故一律使用 hash 传参 */
  function detailHref(d) {
    return 'device-detail.html#id=' + encodeURIComponent(d.id) +
      '&scene=' + encodeURIComponent(state.scene) +
      '&loc=' + encodeURIComponent(locOf(d));
  }
  function siteOf(d) {
    var county = d._countyName || '', city = d._cityName || '';
    var base = county || city || d._provName || '';
    if (d.domain === 'building') return base + '智能楼宇 · ' + (d.zone || '机电层');
    if (d.domain === 'home') return base + '示范家庭 · ' + (d.zone || '全屋');
    return base + '智慧工业园区 · ' + (d.zone || '生产区');
  }
  function closeCard() {
    var card = document.getElementById('cn-card');
    if (card) card.hidden = true;
    state.active = null;
  }

  /* ────────────────────────────── 异常聚合条 / 范围名 ────────────────────────────── */
  /* 每个区域下面挂一条三段比例条（在线 / 异常 / 离线），让「问题集中在哪」一眼可见 */
  function barSeg(n, total, cls) {
    var t = total || 1, w = (n || 0) / t * 100;
    return w > 0 ? '<i class="' + cls + '" style="width:' + w.toFixed(2) + '%"></i>' : '';
  }
  function statusBar(on, warn, off, total) {
    return '<div class="cn-status-bar">' + barSeg(on, total, 'on') +
      barSeg(warn, total, 'warn') + barSeg(off, total, 'off') + '</div>';
  }
  function scopeName() {
    if (state.level === 0) return '全国';
    if (state.level === 1) return (state.path[0] && state.path[0].name) || '省级';
    return (state.path[1] && state.path[1].name) || '市级';
  }

  /* ────────────────────────────── 设备搜索（跨层级直达） ────────────────────────────── */
  function matchDevices(key, limit) {
    var k = String(key || '').trim();
    if (!k) return [];
    var up = k.toUpperCase();
    var list = state.devices || [];
    var exact = list.filter(function (d) { return String(d.id).toUpperCase() === up; });
    var byId = list.filter(function (d) { return String(d.id).toUpperCase().indexOf(up) >= 0; });
    var byName = list.filter(function (d) { return String(d.name || '').indexOf(k) >= 0; });
    var seen = {}, out = [];
    exact.concat(byId, byName).forEach(function (d) {
      if (seen[d.id]) return; seen[d.id] = 1; out.push(d);
    });
    return limit ? out.slice(0, limit) : out;
  }

  function renderSearchPop(q) {
    var pop = document.getElementById('cn-search-pop');
    var xb = document.getElementById('cn-search-x');
    if (!pop) return;
    var key = String(q || '').trim();
    if (xb) xb.hidden = !key;
    if (!key) { pop.hidden = true; pop.innerHTML = ''; return; }
    var hits = matchDevices(key, 8);
    if (!hits.length) {
      pop.innerHTML = '<div class="cn-search-empty">未找到匹配设备</div>';
      pop.hidden = false;
      return;
    }
    pop.innerHTML = hits.map(function (d, i) {
      return '<div class="cn-search-item" data-id="' + d.id + '">' +
        '<span class="cn-search-idx">' + (i + 1) + '</span>' +
        '<i class="cn-dev-dot ' + d.status + '"></i>' +
        '<div><strong>' + d.name + '</strong><small>' + d.id + ' · ' + n2(d.type) +
        ' · ' + n2(d.gateway) + '</small></div>' +
        '<span class="cn-search-badge ' + d.status + '">' + (STATUS_TEXT[d.status] || d.status) + '</span></div>';
    }).join('');
    pop.hidden = false;
    pop.querySelectorAll('.cn-search-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-id');
        closeSearch();
        locateDevice(id);
      });
    });
  }

  function closeSearch() {
    var pop = document.getElementById('cn-search-pop');
    var inp = document.getElementById('cn-search-input');
    var xb = document.getElementById('cn-search-x');
    if (pop) { pop.hidden = true; pop.innerHTML = ''; }
    if (inp) inp.value = '';
    if (xb) xb.hidden = true;
  }

  /* 从全国一路下钻到该设备所在的省 / 市 / 区县，再打开设备卡片 */
  async function locateDevice(idOrName) {
    var key = String(idOrName || '').trim();
    if (!key) return null;
    var hit = matchDevices(key, 1)[0];
    if (!hit) {
      var tip = document.getElementById('cn-tip');
      if (tip) tip.textContent = '未找到设备「' + key + '」';
      return null;
    }
    if (!state.provAssign[hit.id]) assignProvinces();
    var a = state.provAssign[hit.id];
    if (a && a.adcode && (!state.path[0] || String(state.path[0].adcode) !== String(a.adcode))) {
      await gotoProvince(String(a.adcode));
    }
    if (hit._city && state.level === 1) {
      await gotoCity(String(hit._city));
    }
    render();
    openCard(hit);
    var row = document.querySelector('.cn-dev-row[data-id="' + hit.id + '"]');
    if (row) {
      row.classList.add('flash');
      row.scrollIntoView({ block: 'center' });
      setTimeout(function () { row.classList.remove('flash'); }, 1600);
    }
    return hit;
  }

  /* ────────────────────────────── 导出当前视图 ────────────────────────────── */
  function exportImage() {
    if (!chart) return;
    try {
      var url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#060d17' });
      var a = document.createElement('a');
      a.href = url;
      var d = new Date();
      var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      a.download = '全国设备分布-' + scopeName() + '-' + stamp + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) {
      var tip = document.getElementById('cn-tip');
      if (tip) tip.textContent = '导出失败：' + (e && e.message ? e.message : e);
    }
  }

  /* ────────────────────────────── 交互绑定 ────────────────────────────── */
  function bind() {
    chart.on('click', function (p) {
      if (p.componentType === 'series' && p.data && p.data._d) { openCard(p.data._d); return; }
      var name = p.name || (p.region && p.region.name);
      if (!name) return;
      var lv = state.level;
      if (lv === 0) {
        var f = provFeatures().filter(function (x) { return x.properties.name === name; })[0];
        if (f) gotoProvince(String(f.properties.adcode));
      } else if (lv === 1) {
        var c = citiesOfProv().filter(function (x) { return x.properties.name === name; })[0];
        if (c) gotoCity(String(c.properties.adcode));
      } else {
        var k = countiesUnder(state.path[1].adcode).filter(function (x) { return x.properties.name === name; })[0];
        if (k) scrollDevice(String(k.properties.adcode));
      }
    });

    document.getElementById('cn-up').addEventListener('click', function () { goto(Math.max(0, state.level - 1)); });
    document.getElementById('cn-reset').addEventListener('click', function () {
      chart.setOption(optionOf(buildContext()), true);
      goto(0);
    });
    document.querySelectorAll('#cn-scene [data-scene]').forEach(function (b) {
      b.addEventListener('click', function () { switchScene(b.getAttribute('data-scene')); });
    });
    document.querySelectorAll('#cn-filter [data-status]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.statusFilter = b.getAttribute('data-status');
        document.querySelectorAll('#cn-filter [data-status]').forEach(function (x) { x.classList.toggle('on', x === b); });
        render();
      });
    });
    var sInp = document.getElementById('cn-search-input');
    if (sInp) {
      sInp.addEventListener('input', function () { renderSearchPop(sInp.value); });
      sInp.addEventListener('focus', function () { if (sInp.value) renderSearchPop(sInp.value); });
      sInp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          if (sInp.value.trim()) { closeSearch(); locateDevice(sInp.value); }
          e.preventDefault();
        } else if (e.key === 'Escape') {
          closeSearch();
          e.stopPropagation();
        }
      });
    }
    var sX = document.getElementById('cn-search-x');
    if (sX) sX.addEventListener('click', closeSearch);
    document.addEventListener('click', function (e) {
      var wrap = document.querySelector('.cn-search');
      if (wrap && !wrap.contains(e.target)) closeSearch();
    });
    var exBtn = document.getElementById('cn-export');
    if (exBtn) exBtn.addEventListener('click', exportImage);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (state.active) closeCard(); else goto(Math.max(0, state.level - 1)); }
    });
  }

  function switchScene(scene) {
    state.scene = scene;
    var S = SHARED();
    try { if (S) S.setScene(scene); } catch (e) { /* 忽略 */ }
    document.querySelectorAll('#cn-scene [data-scene]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-scene') === scene);
    });
    loadDevices();
    resetToNation();
    var u = new URL(location.href);
    u.searchParams.set('scene', scene);
    history.replaceState(null, '', u.toString());
  }

  function loadDevices() {
    var S = SHARED();
    state.devices = S && S.getSceneDevices ? S.getSceneDevices(state.scene) : [];
  }

  function resetToNation() {
    state.level = 0; state.path = []; state.active = null;
    state.geo = { china: state.geo.china };
    assignProvinces();
    closeCard();
    render();
  }

  /* ────────────────────────────── 启动 ────────────────────────────── */
  async function boot() {
    chart = echarts.init(document.getElementById('cn-map'), null, { renderer: 'canvas' });
    window.addEventListener('resize', function () { chart.resize(); });

    var cn = await loadGeo('china');
    if (!cn) {
      document.getElementById('cn-tip').textContent = '地图边界数据缺失：请确认 assets/data/geo/china.js 已生成';
      return;
    }
    state.geo.china = cn;

    var q = new URLSearchParams(location.search);
    /* file:// 下带 query 的本地路径在部分浏览器会加载失败，因此同时支持 #prov= 形式的 hash 深链 */
    var h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    var P = function (k) { return q.get(k) || h.get(k); };
    var S = SHARED();
    var scene = P('scene') || (S && S.getScene ? S.getScene() : 'field');
    state.scene = SCENES[scene] ? scene : 'field';
    document.querySelectorAll('#cn-scene [data-scene]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-scene') === state.scene);
    });

    loadDevices();
    state.ready = true;
    resetToNation();
    bind();

    var qProv = P('prov'), qCity = P('city');
    if (qProv) {
      gotoProvince(qProv).then(function () { if (qCity) return gotoCity(qCity); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.ChinaMap = { goto: goto, gotoProvince: gotoProvince, gotoCity: gotoCity, openCard: openCard, closeCard: closeCard, locateDevice: locateDevice, exportImage: exportImage, search: matchDevices, state: state, render: render };
})();
