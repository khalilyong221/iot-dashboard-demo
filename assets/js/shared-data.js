const IoTShared = (() => {
  const storageKey = 'iot-dashboard-shared-model-v5';

  /* 确定性洗牌：用于打散"型号 / 状态"与 index 步长的同频关系。
     背景：原先 type、zone、status 都取 index % 5，三者被完全绑定 —— 同一片区型号单一，
     且该片区状态完全一致（例如 D 区泵站 200 台全是网关、且全部离线）；楼宇域则是
     同一协议的设备状态全同。用固定种子的洗牌可以既保持总体比例不变，又让三者相互独立。 */
  const mulberry32 = seed => () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const shuffledSlots = (length, period, seed) => {
    const a = Array.from({ length }, (_, i) => i % period), rnd = mulberry32(seed);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  /* 8 小时趋势：原先按固定步长线性递增，折线画出来是一条笔直的对角线（一眼就是假数据）。
     这里换成"每个点位不同相位的连续波形 + 少量确定性抖动"：既不是直线，也不会像取模那样
     在中途出现断崖式跳变。时间点仍是 8:00–15:00 */
  const trendOf = (base, span, index, step) => Array.from({ length: 8 }, (_, i) => {
    const phase = (index * 0.37) % (2 * Math.PI) + i * step * 0.09;
    const level = (span / 10) * (0.35 + 0.3 * Math.sin(phase));
    const jitter = ((((index * 7) + (i * 13)) % 7) - 3) * 0.09;
    return +(base + level + jitter).toFixed(1);
  });

  const HOME_ROOMS = ['客厅','餐厅','主卧','次卧','书房','厨房','卫生间','阳台','玄关','全屋'];

  const homeSeed = [
    /* ── 客厅 ── */
    { id:'U-001', name:'客厅空调',        room:'客厅',   type:'aircon',     icon:'❄', desc:'3 匹变频柜机 · 制冷中',        on:true,  temp:24,   mode:'制冷', fan:'自动' },
    { id:'U-002', name:'客厅主灯',        room:'客厅',   type:'light',      icon:'☼', desc:'磁吸主灯 · 亮度 80%',          on:true,  brightness:80, cct:4000 },
    { id:'U-003', name:'客厅窗帘',        room:'客厅',   type:'curtain',    icon:'▤', desc:'电动开合帘 · 全开',            pos:100 },
    { id:'U-004', name:'客厅电视',        room:'客厅',   type:'tv',         icon:'▭', desc:'75 英寸 4K · HDMI 2',          on:true,  volume:18, input:'HDMI 2' },
    { id:'U-005', name:'PS5 游戏主机',    room:'客厅',   type:'console',    icon:'⬢', desc:'次世代主机 · 待机',            on:false, hours:126 },
    { id:'U-006', name:'客厅回音壁',      room:'客厅',   type:'av',         icon:'♪', desc:'5.1.2 声道 · 影院模式',        on:true,  volume:22, mode:'影院' },
    { id:'U-007', name:'客厅智能音箱',    room:'客厅',   type:'av',         icon:'♫', desc:'语音中枢 · 在线',              on:true,  volume:15, mode:'音乐' },
    { id:'U-008', name:'客厅摄像头',      room:'客厅',   type:'camera',     icon:'◎', desc:'云台摄像头 · 在家遮蔽',        on:true,  privacy:true },
    { id:'U-009', name:'客厅智能网关',    room:'客厅',   type:'hub',        icon:'⌗', desc:'Zigbee 3.0 · 32 台设备在线',   devices:32 },
    { id:'U-010', name:'客厅人体传感器',  room:'客厅',   type:'sensor',     icon:'◈', desc:'毫米波雷达 · 有人',            value:'有人' },

    /* ── 餐厅 ── */
    { id:'U-011', name:'餐厅吊灯',        room:'餐厅',   type:'light',      icon:'☼', desc:'三头吊灯 · 关闭',              on:false, brightness:0, cct:3000 },
    { id:'U-012', name:'餐厅空调',        room:'餐厅',   type:'aircon',     icon:'❄', desc:'1.5 匹风管机 · 制冷中',        on:true,  temp:25,   mode:'制冷', fan:'自动' },
    { id:'U-013', name:'餐边柜灯带',      room:'餐厅',   type:'light',      icon:'☼', desc:'暖光灯带 · 关闭',              on:false, brightness:30, cct:2700 },

    /* ── 主卧 ── */
    { id:'U-014', name:'主卧空调',        room:'主卧',   type:'aircon',     icon:'❄', desc:'1.5 匹挂机 · 睡眠模式',        on:true,  temp:26,   mode:'制冷', fan:'静音' },
    { id:'U-015', name:'主卧吸顶灯',      room:'主卧',   type:'light',      icon:'☼', desc:'无极调光 · 关闭',              on:false, brightness:0, cct:3000 },
    { id:'U-016', name:'主卧窗帘',        room:'主卧',   type:'curtain',    icon:'▤', desc:'电动开合帘 · 关闭',            pos:0 },
    { id:'U-017', name:'主卧门锁',        room:'主卧',   type:'lock',       icon:'⌑', desc:'指纹锁 · 已上锁',              locked:true },
    { id:'U-018', name:'主卧温湿度计',    room:'主卧',   type:'sensor',     icon:'◈', desc:'环境监测 · 25.6°C',            value:'25.6', unit:'°C', temp:25.6, humidity:58 },
    { id:'U-019', name:'睡眠监测带',      room:'主卧',   type:'health',     icon:'◕', desc:'昨夜睡眠 7h12m · 深睡 24%',    value:'7h12m' },
    { id:'U-020', name:'智能电动床',      room:'主卧',   type:'health',     icon:'◕', desc:'零重力电动床 · 平躺',          value:'平躺' },
    { id:'U-021', name:'床头氛围灯',      room:'主卧',   type:'light',      icon:'☼', desc:'床头灯带 · 关闭',              on:false, brightness:20, cct:2700 },

    /* ── 次卧 ── */
    { id:'U-022', name:'次卧空调',        room:'次卧',   type:'aircon',     icon:'❄', desc:'1 匹挂机 · 关闭',              on:false, temp:26,   mode:'制冷', fan:'自动' },
    { id:'U-023', name:'次卧台灯',        room:'次卧',   type:'light',      icon:'☼', desc:'护眼台灯 · 关闭',              on:false, brightness:0, cct:4000 },
    { id:'U-024', name:'次卧窗帘',        room:'次卧',   type:'curtain',    icon:'▤', desc:'电动卷帘 · 全开',              pos:100 },
    { id:'U-025', name:'次卧体脂秤',      room:'次卧',   type:'health',     icon:'◕', desc:'八电极体脂秤 · 体脂 22.4%',    value:'22.4', unit:'%' },

    /* ── 书房 ── */
    { id:'U-026', name:'书房空调',        room:'书房',   type:'aircon',     icon:'❄', desc:'1.5 匹挂机 · 制冷中',          on:true,  temp:25,   mode:'制冷', fan:'自动' },
    { id:'U-027', name:'书房护眼台灯',    room:'书房',   type:'light',      icon:'☼', desc:'国 AA 级台灯 · 亮度 70%',      on:true,  brightness:70, cct:4500 },
    { id:'U-028', name:'书房窗帘',        room:'书房',   type:'curtain',    icon:'▤', desc:'电动卷帘 · 半开',              pos:50 },
    { id:'U-029', name:'显示器挂灯',      room:'书房',   type:'light',      icon:'☼', desc:'屏幕挂灯 · 开启',              on:true,  brightness:60, cct:5000 },
    { id:'U-030', name:'书房人体传感器',  room:'书房',   type:'sensor',     icon:'◈', desc:'毫米波雷达 · 有人',            value:'有人' },
    { id:'U-031', name:'电竞氛围灯',      room:'书房',   type:'light',      icon:'☼', desc:'RGB 灯带 · 关闭',              on:false, brightness:0, cct:6500 },

    /* ── 厨房 ── */
    { id:'U-032', name:'厨房顶灯',        room:'厨房',   type:'light',      icon:'☼', desc:'集成吊顶灯 · 关闭',            on:false, brightness:0, cct:4000 },
    { id:'U-033', name:'厨房烟雾报警器',  room:'厨房',   type:'alarm',      icon:'⚠', desc:'独立式烟感 · 布防中',          state:'正常' },
    { id:'U-034', name:'厨房燃气报警器',  room:'厨房',   type:'alarm',      icon:'⚠', desc:'燃气探测 · 联动电磁阀',        state:'正常' },
    { id:'U-035', name:'厨房冰箱',        room:'厨房',   type:'appliance',  icon:'◚', desc:'十字门 500L · 门未关严',       on:true,  mode:'智能', remain:'--', alert:true },
    { id:'U-036', name:'厨房洗碗机',      room:'厨房',   type:'appliance',  icon:'◚', desc:'13 套嵌入式 · 待机',           on:false, mode:'标准洗', remain:'--' },
    { id:'U-037', name:'厨房油烟机',      room:'厨房',   type:'appliance',  icon:'◚', desc:'侧吸变频 · 风量二档',          on:true,  mode:'强档', remain:'--' },
    { id:'U-038', name:'厨房净水器',      room:'厨房',   type:'appliance',  icon:'◚', desc:'RO 直饮 · 滤芯剩余 8%',        on:true,  mode:'制水', remain:'--', alert:true },
    { id:'U-039', name:'厨房蒸烤箱',      room:'厨房',   type:'appliance',  icon:'◚', desc:'嵌入式 60L · 待机',            on:false, mode:'蒸烤', remain:'--' },
    { id:'U-040', name:'垃圾处理器',      room:'厨房',   type:'appliance',  icon:'◚', desc:'厨余研磨 · 待机',              on:false, mode:'研磨', remain:'--' },
    { id:'U-041', name:'厨房消毒柜',      room:'厨房',   type:'appliance',  icon:'◚', desc:'高温消毒 · 待机',              on:false, mode:'消毒', remain:'--' },

    /* ── 卫生间 ── */
    { id:'U-042', name:'卫生间顶灯',      room:'卫生间', type:'light',      icon:'☼', desc:'防水筒灯 · 关闭',              on:false, brightness:0, cct:4000 },
    { id:'U-043', name:'卫生间热水器',    room:'卫生间', type:'waterheater',icon:'◐', desc:'燃气热水器 · 出水 48°C',       on:true,  temp:48 },
    { id:'U-044', name:'智能马桶',        room:'卫生间', type:'toilet',     icon:'⊙', desc:'一体式 · 座温 34°C',           on:true,  temp:34 },
    { id:'U-045', name:'除雾浴室镜',      room:'卫生间', type:'light',      icon:'☼', desc:'智能镜 · 关闭',                on:false, brightness:0, cct:5000 },
    { id:'U-046', name:'电热毛巾架',      room:'卫生间', type:'appliance',  icon:'◚', desc:'定时烘干 · 关闭',              on:false, mode:'定时', remain:'--' },
    { id:'U-047', name:'智能花洒',        room:'卫生间', type:'waterheater',icon:'◐', desc:'恒温花洒 · 42°C',              on:true,  temp:42 },
    { id:'U-048', name:'卫生间排风扇',    room:'卫生间', type:'fan',        icon:'✦', desc:'换气扇 · 关闭',                on:false, level:1 },
    { id:'U-049', name:'卫生间水浸传感器',room:'卫生间', type:'alarm',      icon:'⚠', desc:'漏水探测 · 正常',              state:'正常' },

    /* ── 阳台 ── */
    { id:'U-050', name:'阳台灌溉水泵',    room:'阳台',   type:'irrigation', icon:'≈', desc:'自动灌溉 · 每日 07:00',        on:false, schedule:'每日 07:00' },
    { id:'U-051', name:'阳台温湿度计',    room:'阳台',   type:'sensor',     icon:'◈', desc:'环境监测 · 28.1°C',            value:'28.1', unit:'°C', temp:28.1, humidity:63 },
    { id:'U-052', name:'电动晾衣架',      room:'阳台',   type:'appliance',  icon:'◚', desc:'升降 + 烘干 + 消毒 · 已升起',  on:false, mode:'升降', remain:'--' },
    { id:'U-053', name:'阳台种植机',      room:'阳台',   type:'outdoor',    icon:'⌣', desc:'水培种植 · 光照 68%',          on:true,  value:'68', unit:'%' },
    { id:'U-054', name:'阳台摄像头',      room:'阳台',   type:'camera',     icon:'◎', desc:'室外防水 · 录制中',            on:true,  privacy:false },

    /* ── 玄关 ── */
    { id:'U-055', name:'玄关感应灯',      room:'玄关',   type:'light',      icon:'☼', desc:'人体感应筒灯 · 关闭',          on:false, brightness:0, cct:3000 },
    { id:'U-056', name:'玄关智能门锁',    room:'玄关',   type:'lock',       icon:'⌑', desc:'人脸识别锁 · 已上锁',          locked:true },
    { id:'U-057', name:'可视猫眼',        room:'玄关',   type:'camera',     icon:'◎', desc:'门外 165° · 在线',             on:true,  privacy:false },
    { id:'U-058', name:'玄关人体传感器',  room:'玄关',   type:'sensor',     icon:'◈', desc:'红外感应 · 无人',              value:'无人' },
    { id:'U-059', name:'入户门磁',        room:'玄关',   type:'sensor',     icon:'◈', desc:'门磁 · 已关闭',                value:'已关闭' },

    /* ── 全屋 / 系统 ── */
    { id:'U-060', name:'全屋地暖',        room:'全屋',   type:'heating',    icon:'♨', desc:'水地暖 · 5 路分区',            on:false, temp:32 },
    { id:'U-061', name:'全屋新风主机',    room:'全屋',   type:'freshair',   icon:'◌', desc:'双向流全热交换 · 二档',        on:true,  level:2, co2:612 },
    { id:'U-062', name:'全屋空气净化器',  room:'全屋',   type:'air',        icon:'◌', desc:'CADR 600 · 自动模式',          on:true,  aqi:32 },
    { id:'U-063', name:'全屋加湿器',      room:'全屋',   type:'humidifier', icon:'◔', desc:'目标湿度 55% · 关闭',          on:false, humidity:55 },
    { id:'U-064', name:'全屋除湿机',      room:'全屋',   type:'humidifier', icon:'◔', desc:'梅雨季除湿 · 关闭',            on:false, humidity:50 },
    { id:'U-065', name:'全屋循环扇',      room:'全屋',   type:'fan',        icon:'✦', desc:'空气循环 · 关闭',              on:false, level:2 },
    { id:'U-066', name:'扫地机器人',      room:'全屋',   type:'vacuum',     icon:'◍', desc:'带集尘基站 · 充电中',          on:false, battery:88, mode:'回充' },
    { id:'U-067', name:'洗地机',          room:'全屋',   type:'vacuum',     icon:'◍', desc:'自清洁基站 · 待机',            on:false, battery:64, mode:'待机' },
    { id:'U-068', name:'擦窗机器人',      room:'全屋',   type:'vacuum',     icon:'◍', desc:'断电吸附保护 · 待机',          on:false, battery:72, mode:'待机' },
    { id:'U-069', name:'全屋洗衣机',      room:'全屋',   type:'appliance',  icon:'◚', desc:'洗烘一体 10kg · 待机',         on:false, mode:'标准洗', remain:'--' },
    { id:'U-070', name:'烘干机',          room:'全屋',   type:'appliance',  icon:'◚', desc:'热泵烘干 9kg · 待机',          on:false, mode:'烘干', remain:'--' },
    { id:'U-071', name:'智能垃圾桶',      room:'全屋',   type:'appliance',  icon:'◚', desc:'自动开盖打包 · 待机',          on:false, mode:'自动', remain:'--' },
    { id:'U-072', name:'空气消毒机',      room:'全屋',   type:'appliance',  icon:'◚', desc:'UV + 等离子 · 关闭',           on:false, mode:'消毒', remain:'--' },
    { id:'U-073', name:'智能电表',        room:'全屋',   type:'meter',      icon:'⌗', desc:'全屋总表 · 1.84 kW',           power:1.84, total:12.6 },
    { id:'U-074', name:'空调分项计量',    room:'全屋',   type:'meter',      icon:'⌗', desc:'空调回路 · 0.92 kW',           power:0.92, total:6.3 },
    { id:'U-075', name:'照明分项计量',    room:'全屋',   type:'meter',      icon:'⌗', desc:'照明回路 · 0.21 kW',           power:0.21, total:1.4 },
    { id:'U-076', name:'动力分项计量',    room:'全屋',   type:'meter',      icon:'⌗', desc:'动力回路 · 0.48 kW',           power:0.48, total:3.2 },
    { id:'U-077', name:'智能断路器',      room:'全屋',   type:'power',      icon:'⏻', desc:'总闸 · 已合闸',                state:'已合闸', value:'--' },
    { id:'U-078', name:'光伏逆变器',      room:'全屋',   type:'power',      icon:'☀', desc:'屋顶 6kW · 发电中',            state:'发电中', value:'2.35', unit:'kW' },
    { id:'U-079', name:'家用储能电池',    room:'全屋',   type:'power',      icon:'⛁', desc:'10kWh · SOC 76%',              state:'放电中', value:'76', unit:'%' },
    { id:'U-080', name:'电动车充电桩',    room:'全屋',   type:'power',      icon:'⌁', desc:'7kW 交流 · 空闲',              state:'空闲', value:'0', unit:'kW' },
    { id:'U-081', name:'智能水表',        room:'全屋',   type:'meter',      icon:'◉', desc:'今日用水 186L',                power:0, total:0.186 },
    { id:'U-082', name:'智能燃气表',      room:'全屋',   type:'meter',      icon:'⏣', desc:'今日用气 0.72m³',              power:0, total:0.72 },
    { id:'U-083', name:'Mesh 路由器',     room:'全屋',   type:'hub',        icon:'⌗', desc:'3 节点 · 28 台终端',           devices:28 },
    { id:'U-084', name:'全屋中控屏',      room:'全屋',   type:'hub',        icon:'▣', desc:'墙面 8 英寸 · 在线',           devices:0 },
    { id:'U-085', name:'语音中控',        room:'全屋',   type:'hub',        icon:'❖', desc:'语音助手 · 在线',              devices:0 },
    { id:'U-086', name:'NAS 私有云',      room:'全屋',   type:'hub',        icon:'▥', desc:'4 盘位 · 已用 62%',            devices:0 },
    { id:'U-087', name:'弱电箱监测',      room:'全屋',   type:'hub',        icon:'⎔', desc:'楼层配电 · 正常',              devices:0 },
    { id:'U-088', name:'宠物喂食器',      room:'全屋',   type:'pet',        icon:'✿', desc:'定时投喂 · 余粮 72%',          on:true,  value:'72', unit:'%' },
    { id:'U-089', name:'宠物饮水机',      room:'全屋',   type:'pet',        icon:'✿', desc:'循环过滤 · 水量 65%',          on:true,  value:'65', unit:'%' },
    { id:'U-090', name:'智能猫砂盆',      room:'全屋',   type:'pet',        icon:'✿', desc:'自动清理 · 今日 3 次',         on:true,  value:'3', unit:'次' },
    { id:'U-091', name:'鱼缸控制器',      room:'全屋',   type:'outdoor',    icon:'⌣', desc:'水温 26.5°C · 投喂已设',       on:true,  value:'26.5', unit:'°C' },
    { id:'U-092', name:'空气能热水机',    room:'全屋',   type:'waterheater',icon:'◐', desc:'全屋热水 · 水箱 55°C',         on:true,  temp:55 }
  ].map(d => Object.assign({ domain:'home', online:true, alert:false }, d));

  /* ── 楼宇自控（BMS）：商业楼宇暖通与机电设备 ── */
  const BUILDING_ZONES = ['B1 冷冻机房','1F 大堂','2F 办公区','3F 会议中心','4F 数据中心','RF 屋顶'];

  const buildingGatewayByZone = {
    'B1 冷冻机房':'BMS-B1',
    '1F 大堂':'BMS-1F',
    '2F 办公区':'BMS-2F',
    '3F 会议中心':'BMS-3F',
    '4F 数据中心':'BMS-4F',
    'RF 屋顶':'BMS-RF'
  };

  const BUILDING_TYPES = ['空调机组 AHU','新风机组','冷冻水泵','冷却塔','电梯','照明回路','智能电表','风机盘管','温湿度传感器','变频器'];
  const buildingPatternSlots = shuffledSlots(180, 5, 0x51c8f2a);

  const buildingSeed = Array.from({ length: 180 }, (_, index) => {
    const number = String(index + 1).padStart(4, '0');
    const type = BUILDING_TYPES[index % BUILDING_TYPES.length];
    const zone = BUILDING_ZONES[index % BUILDING_ZONES.length];
    // 楼宇机电可用率高于工业现场：离线约占 8%
    const ladder = [
      { status:'online',  minutes:index % 3 },
      { status:'online',  minutes:index % 2 },
      { status:'warning', minutes:3 + (index % 6) },
      { status:'online',  minutes:index % 4 },
      { status:'offline', minutes:14 + (index % 40) }
    ];
    /* 洗牌避免与 protocol 的 index % 5 同频（否则同一协议状态全同） */
    const pattern = ladder[buildingPatternSlots[index]];
    const reasons = [
      ['DDC 控制器失联','现场 DDC 未按时返回心跳，可能是控制器断电或总线短路。'],
      ['通信总线抖动','BACnet 总线误码率升高，建议检查终端电阻与线缆屏蔽层接地。'],
      ['冷冻水流量不足','机组进出水温差异常，可能是水泵频率偏低或过滤器堵塞。'],
      ['传感器读数漂移','温湿度读数与相邻点位偏差超阈值，建议现场校准。']
    ];
    const reason = reasons[index % reasons.length];
    const hasTemp = !['电梯','照明回路','智能电表','变频器'].includes(type);
    const mains = type === '电梯' || type === '照明回路';
    return {
      id:`BMS-${number}`,
      name:`${zone.split(' ')[0]} ${type} ${String((index % 30) + 1).padStart(2, '0')}`,
      domain:'building',
      type,
      zone,
      gateway:buildingGatewayByZone[zone],
      protocol:['BACnet/IP','Modbus RTU','KNX','MQTT','LonWorks'][index % 5],
      firmware:`v${2 + (index % 2)}.${index % 6}.${index % 9}`,
      status:pattern.status,
      signal:pattern.status === 'offline' ? '--' : pattern.status === 'warning' ? '较弱' : '良好',
      rssi:pattern.status === 'offline' ? null : -52 - (index % 36),
      temperature:hasTemp ? +(18 + (index % 120) / 10).toFixed(1) : null,
      minutesSinceSeen:pattern.minutes,
      x:9 + ((index * 23) % 82),
      y:12 + ((index * 41) % 74),
      offlineReason:reason[0],
      offlineReasonDetail:reason[1],
      battery:mains ? 100 : 46 + ((index * 11) % 54),
      restartCount:index % 4,
      history:trendOf(18, 110, index, 4).map((t, i) => ({ time:`${8 + i}:00`, temperature:hasTemp ? t : null }))
    };
  });

  /* ── 家居设备 → 运维视角字段适配（供驾驶舱按场景查看） ── */
  const HOME_TYPE_CN = {
    aircon:'空调', light:'灯光', curtain:'窗帘', tv:'电视', console:'游戏主机', av:'影音',
    camera:'摄像头', hub:'网关中枢', sensor:'传感器', lock:'智能锁', health:'健康设备',
    alarm:'报警器', appliance:'厨房家电', waterheater:'热水器', toilet:'智能马桶', fan:'风扇',
    irrigation:'灌溉', outdoor:'户外', heating:'地暖', freshair:'新风', air:'空气净化',
    humidifier:'加湿器', vacuum:'扫地机', meter:'计量表', power:'能源设备', pet:'宠物设备'
  };

  function toOpsShape(d, index){
    const i = index || 0;
    const offline = d.online === false;
    const warn = !offline && d.alert === true;
    const status = offline ? 'offline' : warn ? 'warning' : 'online';
    const hasTemp = typeof d.temp === 'number' && d.type !== 'waterheater';
    return {
      id:d.id,
      name:d.name,
      domain:'home',
      type:HOME_TYPE_CN[d.type] || d.type,
      zone:d.room,
      gateway:'HOME-GW-' + String(1 + (i % 3)).padStart(2, '0'),
      protocol:['Zigbee 3.0','Matter over Wi-Fi','Thread','蓝牙 Mesh'][i % 4],
      firmware:`v1.${i % 5}.${i % 9}`,
      status,
      signal:offline ? '--' : warn ? '较弱' : '良好',
      rssi:offline ? null : -46 - (i % 34),
      temperature:hasTemp ? d.temp : null,
      minutesSinceSeen:offline ? 12 + (i % 40) : i % 3,
      x:8 + ((i * 19) % 84),
      y:10 + ((i * 29) % 76),
      offlineReason:offline ? '网关未上报心跳' : warn ? '设备状态异常' : '',
      offlineReasonDetail:offline
        ? '该设备所属智能网关没有返回心跳，常见原因是网关断电或家庭网络中断。'
        : warn ? '设备上报了异常状态，可在用户端页面查看具体读数与建议。' : '',
      battery:(d.type === 'light' || d.type === 'aircon') ? 100 : 42 + ((i * 13) % 58),
      restartCount:i % 2,
      history:Array.from({length:8}, (_, k) => ({
        time:`${8 + k}:00`,
        temperature:hasTemp ? +(d.temp + ((k % 3) - 1) * 0.4).toFixed(1) : null
      })),
      _home:true
    };
  }

  const gatewayByZone = {
    'A 区温室':'Gateway-A03',
    'B 区冷库':'Gateway-B02',
    'C 区仓库':'Gateway-C02',
    'D 区泵站':'Gateway-D01',
    'E 区配电房':'Gateway-E04'
  };

  const FIELD_TYPES = ['温度传感器', '电表', '门磁', '网关', '泵站控制器'];
  const fieldTypeSlots = shuffledSlots(1000, FIELD_TYPES.length, 0x2b7d19e);
  const fieldPatternSlots = shuffledSlots(1000, 5, 0x1f3a5c7);

  const fieldSeed = Array.from({ length: 1000 }, (_, index) => {
    const number = String(index + 1).padStart(4, '0');
    const type = FIELD_TYPES[fieldTypeSlots[index]];
    const patterns = [
      { status:'online', minutes:index % 4 },
      { status:'online', minutes:5 + (index % 5) },
      { status:'warning', minutes:2 + (index % 5) },
      { status:'offline', minutes:11 + (index % 30) },
      { status:'offline', minutes:25 + (index % 90) }
    ];
    const pattern = patterns[fieldPatternSlots[index]];
    /* 片区保持 index % 5：详情页/地图页的"片区 → 站点"命名依赖它，不要改 */
    const zone = ['A 区温室', 'B 区冷库', 'C 区仓库', 'D 区泵站', 'E 区配电房'][index % 5];
    const reasons = [
      ['网络连接中断', '最近一次心跳后没有收到设备响应，可能是现场网络或网关连接异常。'],
      ['设备电量过低', '模拟电量已降至告警阈值以下，设备可能因低电量停止通信。'],
      ['网关无响应', '设备所在区域的网关没有返回心跳，建议先检查网关电源与网络。'],
      ['信号质量过差', '最近通信质量持续下降，可能存在弱信号、天线或现场遮挡问题。']
    ];
    const reason = reasons[index % reasons.length];
    return {
      id:`IOT-${number}`,
      name:`${type} ${number}`,
      domain:'field',
      type,
      zone,
      gateway:gatewayByZone[zone],
      protocol:['LoRaWAN','Modbus TCP','NB-IoT','MQTT'][index % 4],
      firmware:`v${1 + (index % 3)}.${index % 8}.${index % 10}`,
      status:pattern.status,
      signal:pattern.status === 'offline' ? '--' : pattern.status === 'warning' ? '较弱' : '良好',
      rssi:pattern.status === 'offline' ? null : -48 - (index % 48),
      temperature:type === '电表' || type === '门磁' ? null : +(22 + (index % 130) / 10).toFixed(1),
      minutesSinceSeen:pattern.minutes,
      x:7 + ((index * 17) % 86),
      y:9 + ((index * 31) % 80),
      offlineReason:reason[0],
      offlineReasonDetail:reason[1],
      battery:35 + ((index * 13) % 66),
      restartCount:index % 3,
      history:trendOf(22, 80, index, 3).map((t, i) => ({ time:`${8 + i}:00`, temperature:type === '电表' || type === '门磁' ? null : t }))
    };
  });

  const clone = value => structuredClone(value);
  const defaults = () => ({ version:5, devices:[...clone(fieldSeed), ...clone(buildingSeed), ...clone(homeSeed)], updatedAt:Date.now(), revision:1 });

  function read(){
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : defaults();
    } catch (error) {
      console.warn('IoTShared read fallback', error);
      return defaults();
    }
  }

  function write(model){
    const next = {...model, updatedAt:Date.now(), revision:(model.revision || 0) + 1};
    localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('iot-model-change', {detail:next}));
    return next;
  }

  function ensure(){
    const model = read();
    if(!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify(model));
    return model;
  }

  function getAll(domain){
    return ensure().devices.filter(device => !domain || device.domain === domain).map(clone);
  }

  function getDevice(id){
    return ensure().devices.find(device => device.id === id) || null;
  }

  function updateDevice(id, patch){
    const model = ensure();
    const device = model.devices.find(item => item.id === id);
    if(!device) return model;
    Object.assign(device, patch);
    return write(model);
  }

  function executeCommand(id, command){
    const model = ensure();
    const device = model.devices.find(item => item.id === id);
    if(!device) return model;
    if(command.type === 'power') device.on = !!command.value;
    if(command.type === 'brightness') { device.brightness = Math.max(0, Math.min(100, Number(command.value) || 0)); device.on = device.brightness > 0; }
    if(command.type === 'temperature') device.temp = Math.max(5, Math.min(70, Number(command.value) || 24));
    if(command.type === 'mode') device.mode = command.value;
    if(command.type === 'fan') device.fan = command.value;
    if(command.type === 'lock') device.locked = !!command.value;
    if(command.type === 'pump') device.on = !!command.value;
    if(command.type === 'curtain') device.pos = Math.max(0, Math.min(100, Number(command.value) || 0));
    if(command.type === 'level') device.level = Math.max(1, Math.min(3, Number(command.value) || 1));
    if(command.type === 'target') device.target = Math.max(30, Math.min(80, Number(command.value) || 55));
    if(command.type === 'volume') device.volume = Math.max(0, Math.min(100, Number(command.value) || 0));
    if(command.type === 'input') device.input = command.value;
    if(command.type === 'privacy') device.privacy = !!command.value;
    if(command.type === 'arm') device.armed = !!command.value;
    device.lastCommand = command.type;
    device.lastCommandAt = Date.now();
    return write(model);
  }

  function updateFieldDevice(id, patch){ return updateDevice(id, patch); }
  function getFieldDevices(){ return getAll('field'); }
  function getHomeDevices(){ return getAll('home'); }
  function getBuildingDevices(){ return getAll('building'); }

  /* ── 场景（业务线）切换：工业 / 楼宇 / 家居 / 全部 ── */
  const SCENES = [
    {
      key:'field', label:'工业互联网', sub:'园区 A–E 区', icon:'▦',
      mapTitle:'园区设备态势', zoneLabel:'区域',
      desc:'温室 / 冷库 / 仓库 / 泵站 / 配电房 · 1000 台逻辑设备 · LoRaWAN / Modbus TCP / NB-IoT / MQTT'
    },
    {
      key:'building', label:'楼宇自控', sub:'商业楼宇 B1–RF', icon:'⌸',
      mapTitle:'楼宇机电态势', zoneLabel:'楼层',
      desc:'空调机组 / 新风 / 冷冻水 / 冷却塔 / 电梯 / 照明 · 180 台设备 · BACnet / KNX / Modbus RTU / LonWorks'
    },
    {
      key:'home', label:'智慧家居', sub:'全屋 10 个房间', icon:'⌂',
      mapTitle:'全屋设备态势', zoneLabel:'房间',
      desc:'92 台设备 · 空调 / 灯光 / 窗帘 / 影音 / 厨电 / 安防 / 能源 / 网络中枢 · Zigbee / Matter / Thread'
    },
    {
      key:'all', label:'全部设备', sub:'三条业务线合并', icon:'◎',
      mapTitle:'全平台设备态势', zoneLabel:'分区',
      desc:'工业 1000 台 + 楼宇 180 台 + 家居 92 台，统一接入同一套运维视图'
    }
  ];

  let scene = 'field';

  function getScene(){ return scene; }
  function getSceneMeta(key){ return SCENES.find(item => item.key === (key || scene)) || SCENES[0]; }
  function setScene(key){
    if(SCENES.some(item => item.key === key)) scene = key;
    const meta = getSceneMeta(key);
    window.dispatchEvent(new CustomEvent('iot-scene-change', { detail:meta }));
    return meta;
  }

  function getSceneDevices(key){
    const target = key || scene;
    if(target === 'building') return getAll('building');
    if(target === 'home') return getAll('home').map((d, i) => toOpsShape(d, i));
    if(target === 'all') return getAll().map((d, i) => d.domain === 'home' ? toOpsShape(d, i) : d);
    return getAll('field');
  }

  function reset(){
    const model = defaults();
    localStorage.setItem(storageKey, JSON.stringify(model));
    window.dispatchEvent(new CustomEvent('iot-model-change', {detail:model}));
    return model;
  }

  window.addEventListener('storage', event => {
    if(event.key !== storageKey || !event.newValue) return;
    try { window.dispatchEvent(new CustomEvent('iot-model-change', {detail:JSON.parse(event.newValue)})); } catch(error) {}
  });

  return {storageKey, HOME_ROOMS, BUILDING_ZONES, BUILDING_TYPES, SCENES, ensure, read, write, getAll, getDevice, getFieldDevices, getBuildingDevices, getHomeDevices, getScene, getSceneMeta, setScene, getSceneDevices, toOpsShape, updateDevice, updateFieldDevice, executeCommand, reset};
})();
