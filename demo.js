(() => {
  const steps=[
    '“我先从总览看系统健康度，再从风险设备进入事件上下文。”',
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
  function device(){return window.IoTShared?.getFieldDevices?.().find(d=>d.id==='IOT-0004')||{id:'IOT-0004',name:'温度传感器 0004',zone:'A 区温室',gateway:'Gateway-A03',status:'offline'};}
  function render(){
    all().forEach((el,i)=>el.classList.toggle('active',i===current));
    $('#talk-text').textContent=steps[current];
    $('#next-step').textContent=current===steps.length-1?'重新开始 ↺':'下一步 →';
    const d=device();$('#case-device').textContent=d.id;$('#case-meta').textContent=`${d.name} · ${d.zone} · ${d.gateway||'Gateway'} · ${d.status==='offline'?'离线异常':'状态异常'}`;
    $('#case-status').textContent=`当前步骤 ${current+1}/7 · ${['态势','资产','事件','AI','拓扑','处置','知识'][current]}`;
  }
  $('#next-step').addEventListener('click',()=>{current=(current+1)%steps.length;render();window.scrollTo({top:document.querySelector('.steps').offsetTop-24,behavior:'smooth'});});
  all().forEach((el,i)=>el.addEventListener('click',e=>{if(e.target.closest('a'))return;current=i;render();}));
  render();
})();