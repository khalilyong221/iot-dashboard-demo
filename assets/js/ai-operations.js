(() => {
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));
  const devices=()=>window.IoTShared?.getSceneDevices?.()||[];
  const getDevice=id=>devices().find(d=>d.id===id)||null;
  const score=d=>Math.round((d.status==='offline'?48:d.status==='warning'?26:4)+Math.max(0,(-65-(d.rssi||-55))*1.4)+((d.restartCount||0)*4));
  function diagnosis(d){
    if(!d)return null;
    const weak=(d.rssi??-55)<=-68,hot=(d.temperature??25)>=60,offline=d.status==='offline';
    let primary='设备状态异常';
    if(offline&&weak)primary='通信链路 / 弱信号';else if(hot&&weak)primary='负载异常 + 通信质量下降';else if(offline)primary='通信链路中断';else if(hot)primary='设备温度异常';
    const candidates=offline&&weak?[['无线信号衰减 / 链路质量下降',72,'同区域 / 同网关异常更值得优先关注'],['网关侧连接波动',19,'建议关联同网关设备状态'],['设备自身故障',9,'单设备异常时再提高该假设权重']]:hot?[['设备负载或执行机构异常',61,'温度与设备类型 / 运行状态需要联合判断'],['环境温度影响',23,'对比同区域设备温度曲线'],['传感器漂移',16,'检查校准记录与历史基线']]:[['通信质量变化',45,'检查 RSSI 与丢包趋势'],['网关连接状态',31,'关联同网关设备'],['设备自身状态',24,'检查电量 / 固件 / 重启记录']];
    const actions=offline&&weak?['确认所属网关在线与丢包情况','对比同网关设备异常数量','现场检查无线覆盖 / 天线','必要时执行重新连接']:hot?['确认当前负载与运行工况','对比同区域同类型温度','检查散热与执行机构','建立预防性维护工单']:['检查近期遥测趋势','关联相邻资产与网关','确认是否需要现场巡检'];
    return {primary,candidates,actions,confidence:Math.max(68,94-score(d)/3)};
  }
  function ensurePanel(){
    if($('#ai-diagnosis-panel'))return $('#ai-diagnosis-panel');
    const p=document.createElement('div');p.id='ai-diagnosis-panel';p.className='ai-diagnosis hidden';
    p.innerHTML='<div class="ai-diagnosis-card"><button class="ai-close" id="ai-close">×</button><div class="ai-diag-top"><div><div class="eyebrow">AI DIAGNOSIS / DECISION SUPPORT</div><h2 id="ai-diag-title">设备诊断</h2><p id="ai-diag-sub">--</p></div><span class="ai-confidence" id="ai-confidence">--</span></div><div class="ai-diag-grid"><div><div class="ai-section-label">ROOT CAUSE HYPOTHESES</div><div id="ai-causes"></div></div><div><div class="ai-section-label">RECOMMENDED ACTIONS</div><div id="ai-actions"></div></div></div><div class="ai-history" id="ai-history"></div><div class="ai-evidence" id="ai-evidence"></div><div class="ai-action-bar"><button class="action" id="ai-topology">查看拓扑</button><button class="action" id="ai-alerts">查看事件</button><button class="action" id="ai-workorder">创建工单</button><button class="action primary" id="ai-confirm">确认根因 / 进入处置</button></div><div id="ai-toast" class="ai-toast"></div></div>';
    document.body.appendChild(p);$('#ai-close').onclick=()=>p.classList.add('hidden');return p;
  }
  function open(id){
    const d=getDevice(id);if(!d)return;
    const r=diagnosis(d),p=ensurePanel();
    const kb=window.IoTKnowledge?.summary(d,r.primary)||{count:0,causeCount:0,avgMttr:0,rows:[]};
    $('#ai-diag-title').textContent=`${d.name} · AI 根因分析`;
    $('#ai-diag-sub').textContent=`${d.id} · ${d.zone} · ${d.gateway||'Gateway'} · 当前${d.status==='offline'?'离线':d.status==='warning'?'异常':'在线'}`;
    $('#ai-confidence').textContent=`置信度 ${r.confidence.toFixed(0)}%`;
    $('#ai-causes').innerHTML=r.candidates.map((x,i)=>`<div class="ai-cause"><span>${i+1}</span><div><b>${esc(x[0])}</b><small>${x[1]}% · ${esc(x[2])}</small></div><i><em style="width:${x[1]}%"></em></i></div>`).join('');
    $('#ai-actions').innerHTML=r.actions.map((x,i)=>`<div class="ai-action"><span>0${i+1}</span><b>${esc(x)}</b></div>`).join('');
    $('#ai-history').innerHTML=`<div class="history-title">HISTORICAL CASES / KNOWLEDGE LOOP</div><div class="history-card"><strong>${kb.count} 起</strong><span>区域 / 根因相似案例</span><b>${kb.causeCount} 起</b><span>相同根因案例</span><b>${kb.avgMttr||'--'} min</b><span>历史平均修复时间</span></div><p class="history-note">${kb.causeCount?`历史案例显示“${esc(r.primary)}”已有 ${kb.causeCount} 起记录，AI 将优先参考已验证处置方案。`:'暂无同根因闭环记录，本次处置结果将沉淀为新的知识。'}</p>`;
    $('#ai-evidence').innerHTML=`<span>Evidence</span><b>RSSI ${d.rssi??'--'} dBm</b><b>Temp ${d.temperature==null?'--':d.temperature+'°C'}</b><b>Last seen ${d.minutesSinceSeen??0} min</b><b>Health ${Math.max(0,100-score(d))}%</b>`;
    $('#ai-topology').onclick=()=>location.href=`../../pages/topology.html?device=${encodeURIComponent(d.id)}`;
    $('#ai-alerts').onclick=()=>location.href=`../../pages/alerts.html?device=${encodeURIComponent(d.id)}`;
    $('#ai-workorder').onclick=()=>{localStorage.setItem('iot-pending-workorder',JSON.stringify({deviceId:d.id,deviceName:d.name,zone:d.zone,gateway:d.gateway||'',priority:d.status==='offline'?'P1':'P2',reason:r.primary,createdAt:Date.now()}));location.href=`../../pages/maintenance.html?device=${encodeURIComponent(d.id)}&from=ai`};
    $('#ai-confirm').onclick=()=>{localStorage.setItem('iot-ai-confirmed',JSON.stringify({deviceId:d.id,rootCause:r.primary,at:Date.now()}));$('#ai-toast').textContent=`已确认：${r.primary}。处置完成后将自动沉淀为历史知识。`};
    p.classList.remove('hidden');
  }
  window.IoTAIDiagnosis={open};
})();
