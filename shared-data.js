const IoTShared = (() => {
  const storageKey = 'iot-dashboard-shared-model-v2';

  const homeSeed = [
    { id:'U-001', name:'客厅空调', room:'客厅', type:'aircon', icon:'❄', desc:'中央空调 · 最近连接正常', online:true, temp:24, mode:'制冷', fan:'自动', on:true, alert:false },
    { id:'U-002', name:'客厅主灯', room:'客厅', type:'light', icon:'☼', desc:'智能吸顶灯 · 亮度 80%', online:true, brightness:80, on:true, alert:false },
    { id:'U-003', name:'主卧空气净化器', room:'卧室', type:'air', icon:'◌', desc:'自动模式 · 空气优', online:true, aqi:28, on:true, alert:false },
    { id:'U-004', name:'主卧门锁', room:'卧室', type:'lock', icon:'⌑', desc:'指纹锁 · 3 小时前已锁', online:true, locked:true, alert:false },
    { id:'U-005', name:'厨房烟雾传感器', room:'厨房', type:'sensor', icon:'◈', desc:'环境监测 · 需要关注', online:true, alert:true, temp:31.8, humidity:null },
    { id:'U-006', name:'厨房顶灯', room:'厨房', type:'light', icon:'☼', desc:'智能射灯 · 关闭', online:true, brightness:0, on:false, alert:false },
    { id:'U-007', name:'阳台水泵', room:'阳台', type:'pump', icon:'≈', desc:'灌溉设备 · 定时运行', online:true, on:false, alert:false },
    { id:'U-008', name:'阳台温湿度计', room:'阳台', type:'sensor', icon:'⌁', desc:'26.4°C · 湿度 61%', online:true, temp:26.4, humidity:61, alert:false }
  ];

  const fieldSeed = Array.from({ length: 1000 }, (_, index) => {
    const number = String(index + 1).padStart(4, '0');
    const type = ['温度传感器', '电表', '门磁', '网关', '泵站控制器'][index % 5];
    const patterns = [
      { status:'online', minutes:index % 4 },
      { status:'online', minutes:5 + (index % 5) },
      { status:'warning', minutes:2 + (index % 5) },
      { status:'offline', minutes:11 + (index % 30) },
      { status:'offline', minutes:25 + (index % 90) }
    ];
    const pattern = patterns[index % patterns.length];
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
      history:Array.from({length:8}, (_, i) => ({ time:`${8 + i}:00`, temperature:type === '电表' || type === '门磁' ? null : +(22 + ((index + i * 3) % 80) / 10).toFixed(1) }))
    };
  });

  const clone = value => structuredClone(value);
  const defaults = () => ({ version:2, devices:[...clone(fieldSeed), ...clone(homeSeed)], updatedAt:Date.now(), revision:1 });

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
    if(command.type === 'temperature') device.temp = Math.max(16, Math.min(30, Number(command.value) || 24));
    if(command.type === 'mode') device.mode = command.value;
    if(command.type === 'fan') device.fan = command.value;
    if(command.type === 'lock') device.locked = !!command.value;
    if(command.type === 'pump') device.on = !!command.value;
    device.lastCommand = command.type;
    device.lastCommandAt = Date.now();
    return write(model);
  }

  function updateFieldDevice(id, patch){ return updateDevice(id, patch); }
  function getFieldDevices(){ return getAll('field'); }
  function getHomeDevices(){ return getAll('home'); }

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

  return {storageKey, ensure, read, write, getAll, getDevice, getFieldDevices, getHomeDevices, updateDevice, updateFieldDevice, executeCommand, reset};
})();
