# -*- coding: utf-8 -*-
"""构建中国行政区划 GeoJSON 数据（省 / 市 / 县 三级），供 ECharts geo 地图下钻使用。

数据源：阿里 DataV.GeoAtlas —— https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json
        官方公开数据，仅行政区划轮廓，CORS: *，无商业地图 SDK 依赖。

输出：assets/data/geo/*.js
      包装成 window.__IOT_GEO__ 字典。之所以不直接存 .json，是因为本演示通过
      file:// 协议本地打开，浏览器会硬性拦截该协议下的 fetch()；
      而 <script src> 不受同源策略限制，可正常加载同目录资源。

压缩策略：
  1) 坐标保留 3 位小数（约 100m 精度，一屏看一个省/市/县足够）
  2) Douglas-Peucker 抽稀，容差 EPS 度
  3) 剥离全部无关属性，只留 name / adcode / center / centroid / level / parent
  4) 外环永不舍弃（含南海诸岛九段线）；仅丢弃面积过小的内环（湖中岛之类）
"""

import json
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = r"D:\设计空间\iot-dashboard-demo"
OUT_DIR = os.path.join(ROOT, "assets", "data", "geo")
CACHE_DIR = r"C:\Users\pc\wb_shots\datav_cache"

BASE = "https://geo.datav.aliyun.com/areas_v3/bound/{}.json"
ND = 3           # 坐标保留小数位
EPS = 0.004      # DP 抽稀容差（度）；0.004° ≈ 440m
MIN_RING_AREA = 0.00003   # 内环最小包围盒面积（度²），低于此值的湖心岛直接丢

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

KEEP_PROPS = ("name", "adcode", "center", "centroid", "level", "parent", "childrenNum")


# ---------------------------------------------------------------- 抓取
def fetch(adcode, full=True, optional=False):
    key = "{}{}".format(adcode, "_full" if full else "")
    fn = os.path.join(CACHE_DIR, key + ".json")
    if os.path.exists(fn):
        try:
            with open(fn, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            os.remove(fn)
    url = BASE.format(key)
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            r = urllib.request.urlopen(req, timeout=25)
            data = r.read().decode("utf-8")
            with open(fn, "w", encoding="utf-8") as f:
                f.write(data)
            return json.loads(data)
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(0.6 * (attempt + 1))
    if not optional:
        print("  [fetch FAIL] {} -> {}".format(key, last))
    return None


# ---------------------------------------------------------------- 几何简化
def dp_simplify(points, eps):
    """迭代版 Douglas-Peucker，避免深递归。points: [[x,y], ...]"""
    n = len(points)
    if n < 4:
        return points
    keep = [False] * n
    keep[0] = keep[n - 1] = True
    stack = [(0, n - 1)]
    while stack:
        s, e = stack.pop()
        if e <= s + 1:
            continue
        x1, y1 = points[s]
        x2, y2 = points[e]
        dx, dy = x2 - x1, y2 - y1
        den = (dx * dx + dy * dy) ** 0.5
        best_d, best_i = -1.0, -1
        if den == 0.0:
            for i in range(s + 1, e):
                x0, y0 = points[i]
                d = ((x0 - x1) ** 2 + (y0 - y1) ** 2) ** 0.5
                if d > best_d:
                    best_d, best_i = d, i
        else:
            for i in range(s + 1, e):
                x0, y0 = points[i]
                d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / den
                if d > best_d:
                    best_d, best_i = d, i
        if best_d > eps and best_i > 0:
            keep[best_i] = True
            stack.append((s, best_i))
            stack.append((best_i, e))
    return [points[i] for i in range(n) if keep[i]]


def ring_area(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return (max(xs) - min(xs)) * (max(ys) - min(ys))


def tidy_ring(ring, eps, drop_thin=True):
    """精度截断 -> 去重 -> DP 抽稀 -> 闭合"""
    pts = []
    for pt in ring:
        p = [round(float(pt[0]), ND), round(float(pt[1]), ND)]
        if not pts or pts[-1] != p:
            pts.append(p)
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts.pop()
    if len(pts) < 3:
        return None
    pts = dp_simplify(pts, eps)
    if len(pts) < 3:
        return None
    if drop_thin and ring_area(pts) < MIN_RING_AREA:
        return None
    pts.append(pts[0][:])
    return pts


def simplify_geom(geom):
    if not geom:
        return None
    t = geom.get("type")
    c = geom.get("coordinates")
    if not c:
        return None

    def proc_poly(poly):
        rings = []
        for i, ring in enumerate(poly):
            r = tidy_ring(ring, EPS, drop_thin=(i > 0))
            if r:
                rings.append(r)
        return rings or None

    if t == "Polygon":
        r = proc_poly(c)
        return {"type": "Polygon", "coordinates": r} if r else None
    if t == "MultiPolygon":
        polys = [proc_poly(p) for p in c]
        polys = [p for p in polys if p]
        return {"type": "MultiPolygon", "coordinates": polys} if polys else None
    return None


def slim_feature(f):
    p = f.get("properties") or {}
    props = {}
    for k in KEEP_PROPS:
        if p.get(k) not in (None, ""):
            props[k] = p[k]
    g = simplify_geom(f.get("geometry"))
    if not g:
        return None
    return {"type": "Feature", "properties": props, "geometry": g}


def slim_fc(fc):
    if not fc:
        return None
    out = [slim_feature(f) for f in fc.get("features", [])]
    out = [f for f in out if f]
    return {"type": "FeatureCollection", "features": out}


# ---------------------------------------------------------------- 写盘
def write_js(name, payload, sizes):
    """输出 assets/data/geo/<name>.js —— 挂到 window.__IOT_GEO__["<name>"]"""
    js = (
        "/* 中国行政区划边界数据 —— 来源: 阿里 DataV.GeoAtlas (geo.datav.aliyun.com)\n"
        "   省级: {source} | 生成: {ts} | 仅含行政区划轮廓，无商业地图 SDK 依赖 */\n"
        "window.__IOT_GEO__=window.__IOT_GEO__||{{}};\n"
        "window.__IOT_GEO__[{idx}]={body};\n"
    ).format(
        source="geo.datav.aliyun.com/areas_v3/bound",
        ts=time.strftime("%Y-%m-%d %H:%M:%S"),
        idx=json.dumps(name, ensure_ascii=False),
        body=json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
    )
    path = os.path.join(OUT_DIR, name + ".js")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(js)
    sizes.append((name, os.path.getsize(path)))
    return sizes[-1][1]


# ---------------------------------------------------------------- 主流程
def main():
    sizes = []
    print("== 1/3 全国省级 ==")
    cn = fetch(100000, full=True)
    provs = [f for f in cn["features"]]
    # 去掉 adcode 含 JD 的南海诸岛单列 feature 之前先记录：它必须保留（九段线）
    slim_provs = slim_fc(cn)
    write_js("china", slim_provs, sizes)
    print("   省级 features = {}".format(len(slim_provs["features"])))

    real = [f for f in provs if str(f["properties"].get("adcode", "")).isdigit()
            and int(f["properties"]["adcode"]) % 10000 == 0]

    print("== 2/3 各省级的下级（市 / 区县）==")
    tasks = []
    for f in real:
        p = f["properties"]
        tasks.append((p["adcode"], p["name"]))

    def job(item):
        adcode, pname = item
        city_fc = fetch(adcode, full=True, optional=True)
        cities = []
        if city_fc:
            for cf in city_fc.get("features", []):
                cp = cf.get("properties") or {}
                cities.append((cp.get("adcode"), cp.get("name"), cp.get("level")))
        # 直辖市：level=district 直接就是区县
        counties = []
        city_levels = set()
        for c in cities:
            if c[2]:
                city_levels.add(c[2])

        # 逐个市拉下级
        sub_tasks = [c for c in cities if str(c[0]).isdigit()]
        def sub(city):
            cad = city[0]
            fc = fetch(cad, full=True, optional=True)
            feats = []
            if fc:
                for sf in fc.get("features", []):
                    sp = sf.get("properties") or {}
                    feats.append((sp.get("adcode"), sp.get("name")))
            if not feats:
                # 直筒子市（东莞/中山/嘉峪关…）或省直辖县级市：无下级，用自身边界兜底
                fc2 = fetch(cad, full=False, optional=True)
                if fc2:
                    for sf in fc2.get("features", []):
                        sp = sf.get("properties") or {}
                        feats.append((sp.get("adcode"), sp.get("name")))
            return cad, feats

        with ThreadPoolExecutor(max_workers=8) as ex:
            for cad, feats in ex.map(sub, sub_tasks):
                counties.append({"parent": cad, "items": feats})
        return adcode, pname, city_fc, counties, city_levels

    with ThreadPoolExecutor(max_workers=6) as ex:
        results = list(ex.map(job, tasks))

    print("== 3/3 简化 + 写盘 ==")
    for adcode, pname, city_fc, counties, levels in results:
        slim_cities = slim_fc(city_fc)
        # 把该省所有区县拍平成 FeatureCollection（含 parent 归属）
        feats = []
        # 直接复用原始数据，按 parent 归组简化
        # 为避免重复请求，这里从缓存再读一次各市的 _full
        for grp in counties:
            cad = grp["parent"]
            fc = fetch(cad, full=True, optional=True)
            if not fc or len(fc.get("features", [])) == 0:
                fc = fetch(cad, full=False, optional=True)
            s = slim_fc(fc)
            if s:
                for sf in s["features"]:
                    sf["properties"]["parent"] = cad
                    feats.append(sf)
        county_fc = {"type": "FeatureCollection", "features": feats}

        payload = {
            "name": pname,
            "adcode": adcode,
            "cities": slim_cities or {"type": "FeatureCollection", "features": []},
            "counties": county_fc,
        }
        sz = write_js("p{}".format(adcode), payload, sizes)
        print("   {} {} -> {:>7.1f} KB  (市 {} / 县 {})".format(
            adcode, pname, sz / 1024.0,
            len(payload["cities"]["features"]), len(feats)))

    total = sum(s for _, s in sizes)
    print("\n== 汇总 ==")
    for n, s in sizes:
        print("   {:<14} {:>8.1f} KB".format(n, s / 1024.0))
    print("   文件数 {}  合计 {:.2f} MB".format(len(sizes), total / 1024.0 / 1024.0))


if __name__ == "__main__":
    main()
