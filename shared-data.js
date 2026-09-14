const IoTShared = (() => {
  const storageKey = 'iot-dashboard-shared-model-v1';
  const seed = [
    { id:'U-001', name:'客厅空调', room:'客厅', type:'aircon', icon:'❄', online:true, temp:24, mode:'制冷', fan:'自动', on:true, brightness:null, aqi:null, locked:null, alert:false },
    { id:'U-002', name:'客厅主灯', room:'客厅', type:'light', icon:'☼', online:true, brightness:80, on:true, alert:false },
    { id:'U-003', name:'主卧空气净化器', room:'卧室', type:'air', icon:'◌', online:true, aqi:28, on:true, alert:false },
    { id:'U-004', name:'主卧门锁', room:'卧室', type:'lock', icon:'⌑', online:true, locked:true, alert:false },
    { id:'U-005', name:'厨房烟雾传感器', room:'厨房', type:'sensor', icon:'◈', online:true, alert:true, temp:31.8, humidity:null },
    { id:'U-006', name:'厨房顶灯', room:'厨房', type:'light', icon:'☼', online:true, brightness:0, on:false, alert:false },
    { id:'U-007', name:'阳台水泵', room:'阳台', type:'pump', icon:'≈', online:true, on:false, alert:false },
    { id:'U-008', name:'阳台温湿度计', room:'阳台', type:'sensor', icon:'⌁', online:true, temp:26.4, humidity:61, alert:false }
  ];
  const defaults = () => ({ devices: structuredClone(seed), updatedAt: Date.now(), revision: 1 });
  function read(){
    try { const raw = localStorage.getItem(storageKey); return raw ? JSON.parse(raw) : defaults(); }
    catch(e){ return defaults(); }
  }
  function write(model){
    const next = {...model, updatedAt: Date.now(), revision: (model.revision || 0) + 1};
    localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('iot-model-change', {detail: next}));
    return next;
  }
  function ensure(){
    const current = read();
    if(!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify(current));
    return current;
  }
  function update(mutator){ const model = ensure(); mutator(model.devices); return write(model); }
  function getDevice(id){ return ensure().devices.find(d => d.id === id); }
  function updateDevice(id, patch){ return update(devices => { const d=devices.find(x=>x.id===id); if(d) Object.assign(d, patch); }); }
  function executeCommand(id, command){
    return update(devices => {
      const d = devices.find(x=>x.id===id); if(!d) return;
      if(command.type==='power') d.on = !!command.value;
      if(command.type==='brightness'){ d.brightness = Math.max(0, Math.min(100, Number(command.value)||0)); d.on = d.brightness > 0; }
      if(command.type==='temperature') d.temp = Math.max(16, Math.min(30, Number(command.value)||24));
      if(command.type==='mode') d.mode = command.value;
      if(command.type==='fan') d.fan = command.value;
      if(command.type==='lock') d.locked = !!command.value;
      if(command.type==='pump') d.on = !!command.value;
      d.lastCommand = command.type;
      d.lastCommandAt = Date.now();
    });
  }
  return {ensure, read, write, update, getDevice, updateDevice, executeCommand, storageKey};
})();
