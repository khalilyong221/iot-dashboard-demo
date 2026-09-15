(() => {
  const KEY='iot-knowledge-base-v2';
  /* 知识库种子引用共享资产模型里的真实设备。
     原先是 A-0871 / A-0612 / B-0420 —— 资产表里根本没有这些编号（工业域是 IOT-0001~1000），
     于是"历史案例"面板上展示的设备在整个系统里并不存在。
     第一条刻意落在演示案例设备的片区、并给出与离线设备一致的根因，
     这样驾驶舱的 AI 面板能真的"召回"到历史处置经验，而不是永远显示"暂无同根因闭环记录"。 */
  function seedFromModel(){
    const ds=window.IoTShared?.getFieldDevices?.()||[];
    const demo=window.IoTShared?.getDemoCase?.('field')||null;
    const bad=ds.filter(d=>d.status!=='online');
    const pick=(reason,i)=>bad.find(x=>x.offlineReason===reason)||bad[i]||null;
    const rows=[
      {rootCause:'通信链路中断',resolution:'确认网关在线与丢包情况后重新连接设备',priority:'P1',mttr:14,d:demo,days:9},
      {rootCause:'网关无响应',resolution:'检查网关电源与上行链路后重启网关',priority:'P1',mttr:21,d:pick('网关无响应',0),days:15},
      {rootCause:'信号质量过差',resolution:'调整无线覆盖并重新连接',priority:'P2',mttr:18,d:pick('信号质量过差',1),days:23}
    ];
    return rows.map((r,i)=>({id:'KB-00'+(i+1),deviceId:r.d?.id||'--',zone:r.d?.zone||'--',gateway:r.d?.gateway||'--',rootCause:r.rootCause,resolution:r.resolution,priority:r.priority,mttr:r.mttr,at:Date.now()-86400000*r.days}));
  }
  const seed=seedFromModel();
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'null')||seed}catch(e){return seed}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v));window.dispatchEvent(new CustomEvent('iot-knowledge-change',{detail:v}))}
  function add(record){const list=read();list.unshift({...record,id:`KB-${String(Date.now()).slice(-6)}`,at:Date.now()});write(list);return list[0]}
  function similar(device,rootCause){return read().filter(x=>(device?.zone&&x.zone===device.zone)||(rootCause&&x.rootCause===rootCause))}
  function summary(device,rootCause){const rows=similar(device,rootCause);const cause=rows.filter(x=>x.rootCause===rootCause);const avg=rows.length?Math.round(rows.reduce((s,x)=>s+(x.mttr||0),0)/rows.length):0;return {count:rows.length,causeCount:cause.length,avgMttr:avg,rows}}
  window.IoTKnowledge={read,write,add,similar,summary,seed};
  if(!localStorage.getItem(KEY))write(seed);
})();
