(() => {
  const KEY='iot-knowledge-base';
  const seed=[
    {id:'KB-001',deviceId:'A-0871',zone:'A 区温室',gateway:'Gateway-A03',rootCause:'无线信号衰减 / 链路质量下降',resolution:'调整无线覆盖并重新连接设备',priority:'P1',mttr:14,at:Date.now()-86400000*8},
    {id:'KB-002',deviceId:'A-0612',zone:'A 区温室',gateway:'Gateway-A03',rootCause:'无线信号衰减 / 链路质量下降',resolution:'检查天线并重新连接',priority:'P2',mttr:18,at:Date.now()-86400000*13},
    {id:'KB-003',deviceId:'B-0420',zone:'B 区冷库',gateway:'Gateway-B02',rootCause:'设备负载或执行机构异常',resolution:'降低负载并检查执行机构',priority:'P2',mttr:22,at:Date.now()-86400000*16}
  ];
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'null')||seed}catch(e){return seed}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v));window.dispatchEvent(new CustomEvent('iot-knowledge-change',{detail:v}))}
  function add(record){const list=read();list.unshift({...record,id:`KB-${String(Date.now()).slice(-6)}`,at:Date.now()});write(list);return list[0]}
  function similar(device,rootCause){return read().filter(x=>(device?.zone&&x.zone===device.zone)||(rootCause&&x.rootCause===rootCause))}
  function summary(device,rootCause){const rows=similar(device,rootCause);const cause=rows.filter(x=>x.rootCause===rootCause);const avg=rows.length?Math.round(rows.reduce((s,x)=>s+(x.mttr||0),0)/rows.length):0;return {count:rows.length,causeCount:cause.length,avgMttr:avg,rows}}
  window.IoTKnowledge={read,write,add,similar,summary,seed};
  if(!localStorage.getItem(KEY))write(seed);
})();
