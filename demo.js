(() => {
  const steps=[
    '“我先从总览看系统健康度，再从风险设备进入事件上下文。”',
    '“需要判断是区域性问题还是单点故障时，我会打开全国分布地图，按省市县下钻，看异常设备在空间上的聚集。”',
    '“这里不是简单的设备列表，我会进入数字档案，把设备状态、信号和最近遥测放在同一个上下文里。”',
    '“接下来进入事件中心，把异常从一个红点变成有等级、有证据、有生命周期的 Incident。”',
    '“AI 在这里不是聊天装饰，而是基于 RSSI、温度、网关关系和历史案例给出根因假设。”',
    '“如果怀疑网关或区域问题，我会打开拓扑，看故障的影响范围，而不是只看单台设备。”',
    '“诊断确认后直接创建工单，设备上下文跟着事件走，减少人工二次录入。”',
    '“工单完成后再把根因、解决方案和 MTTR 沉淀下来，让下一次 AI 判断有历史依据。”'
  ];
  let current=0;
  const $=s=>document.querySelector(s);
  const all=()=>document.querySelectorAll('.step');

  /* 案例设备不写死 id：从共享资产模型取当前真正离线、且离线最久的那台。
     否则一旦数据重新生成（比例调整、洗牌种子变化），动线就会指向一台其实在线的设备，
     第 3 步"定位异常资产"打开的是一台健康设备，整个叙事直接断掉。 */
  function device(){
    return window.IoTShared?.getDemoCase?.('field')
      || {id:'IOT-0001',name:'温度传感器 0001',zone:'A 区温室',gateway:'Gateway-A03',status:'offline'};
  }
  /* 页面里 6 处链接写成 device=__CASE__，加载后用真实案例设备编号替换 */
  function applyLinks(id){
    const token='__CASE__', enc=encodeURIComponent(id);
    document.querySelectorAll('a[href*="'+token+'"]').forEach(a=>{
      a.setAttribute('href', a.getAttribute('href').split(token).join(enc));
    });
  }
  function render(){
    const d=device();
    all().forEach((el,i)=>el.classList.toggle('active',i===current));
    $('#talk-text').textContent=steps[current];
    $('#next-step').textContent=current===steps.length-1?'重新开始 ↺':'下一步 →';
    $('#case-device').textContent=d.id;
    $('#case-meta').textContent=`${d.name} · ${d.zone} · ${d.gateway||'Gateway'} · ${d.status==='offline'?`离线 ${d.minutesSinceSeen||0} 分钟`:'状态异常'}`;
    $('#case-status').textContent=`当前步骤 ${current+1}/8 · ${['态势','分布','资产','事件','AI','拓扑','处置','知识'][current]}`;
  }
  applyLinks(device().id);
  render();
  $('#next-step').addEventListener('click',()=>{current=(current+1)%steps.length;render();window.scrollTo({top:document.querySelector('.steps').offsetTop-24,behavior:'smooth'});});
  all().forEach((el,i)=>el.addEventListener('click',e=>{if(e.target.closest('a'))return;current=i;render();}));
  render();
})();