const params=new URLSearchParams(location.search);const contextDevice=params.get('device');
/* 这个文件一直在用 $()，却从来没定义过 —— 结果每次 render() 都在更新 KPI 那一行抛
   "$ is not defined"，KPI 停在 HTML 里写死的 12/5，而且后面的「推进 →」事件绑定根本
   没执行到，工单状态机实际上点不动。 */
const $=s=>document.querySelector(s);
const list=document.querySelector('#work-list');
/* 工单种子从共享资产模型里取真实设备。
   旧版这里写死了 A-1032 / B-0718 / D-0321 / E-0418 / C-0788 —— 资产表里根本没有这些编号
   （工业域是 IOT-0001 ~ IOT-1000），点进去只会看到一个空列表。 */
function seedOrders(){
  const ds=window.IoTShared?.getFieldDevices?.()||[];
  const by=s=>ds.filter(d=>d.status===s);
  /* 演示案例设备带两条履历：一条「上一轮已闭环」（第 8 步要看的 MTTR / 根因），
     一条「本轮处理中」（第 7 步点「推进」能真的走完闭环并写进知识库） */
  const demo=window.IoTShared?.getDemoCase?.('field')||null;
  const off=by('offline').filter(d=>!demo||d.id!==demo.id),warn=by('warning'),on=by('online');
  const rows=[
    ['019',demo,'通信恢复检查','P1','处理中'],
    ['018',demo,'上轮通信中断复盘','P2','已完成'],
    ['017',off[0],'离线根因排查','P1','待处理'],
    ['016',warn[0],'遥测异常巡检','P2','待处理'],
    ['015',warn[1],'通信质量检查','P2','待验证'],
    ['014',on[0],'例行点检','P3','已完成']
  ];
  return rows.filter(r=>r[1]).map(r=>[`WO-260914-${r[0]}`,`${r[1].name} ${r[2]}`,`${r[1].zone} · ${r[1].gateway}`,r[3],r[4],r[1].id]);
}
const states=['待处理','已分派','处理中','待验证','已完成'];
/* 键升到 v2：旧键里存的是上面那批幽灵编号，不清掉的话升级后照样读回错的工单 */
const WO_KEY='iot-work-orders-v2';
/* 设备详情页的「一键生成工单」写在按设备分组的 iot-workorders-v1 里，
   这里并入同一张工单表 —— 否则两个页面各存一份，互相看不见对方建的工单 */
function syncDetailOrders(){
  let m={};try{m=JSON.parse(localStorage.getItem('iot-workorders-v1')||'{}')||{}}catch(e){return}
  const map={'待派单':'待处理','已关闭':'已完成'};
  Object.keys(m).forEach(id=>{
    const d=window.IoTShared?.getDevice?.(id);
    (m[id]||[]).forEach(o=>{
      if(orders.some(x=>x[0]===o.no))return;
      orders.push([o.no,`${d?.name||id} · ${o.type||'故障处置'}`,`${d?.zone||'--'} · ${d?.gateway||o.date||'--'}`,o.state==='待派单'?'P1':'P3',map[o.state]||o.state||'待处理',id]);
    });
  });
  try{localStorage.setItem(WO_KEY,JSON.stringify(orders))}catch(e){}
}
const orders=JSON.parse(localStorage.getItem(WO_KEY)||'null')||seedOrders();
syncDetailOrders();
function render(){/* 有设备上下文时不再过滤到只剩一台 —— 新设备通常还没工单，页面会直接空掉。
   改为命中行置顶高亮，设备是谁由顶部上下文横幅交代。 */
const q=(contextDevice||'').toLowerCase(),hit=o=>!!q&&o.join(' ').toLowerCase().includes(q);
const rows=q?orders.slice().sort((a,b)=>(hit(b)?1:0)-(hit(a)?1:0)):orders;list.innerHTML=rows.map((o,i)=>{const idx=states.indexOf(o[4]),on=hit(o);return `<div class="work-row${on?' hl':''}"><span class="work-id">${o[0]}</span><div><b>${o[1]}</b><span>${o[2]} · ${o[5]||'--'}</span></div><span class="priority ${o[3].toLowerCase()}">${o[3]}</span><span class="work-status ${o[4]==='已完成'?'done':''}">${o[4]}</span><button class="action-mini advance" data-i="${orders.indexOf(o)}" ${idx>=4?'disabled':''}>${idx>=4?'已关闭':'推进 →'}</button><a class="work-link" href="topology.html?device=${encodeURIComponent(o[5]||'')}">拓扑</a></div>`}).join('')||'<div class="empty">暂无工单</div>';
document.querySelectorAll('.advance').forEach(b=>b.addEventListener('click',()=>advance(+b.dataset.i)));
/* 事件绑定放在 KPI 之前：万一取值出问题，也不至于把整页交互一起带走 */
$('#open-count').textContent=orders.filter(o=>o[4]!=='已完成').length;$('#progress-count').textContent=orders.filter(o=>o[4]==='处理中').length;}
function completeKnowledge(o){
  if(!window.IoTKnowledge||!o||o[4]!=='已完成')return;
  const existing=window.IoTKnowledge.read().some(x=>x.workOrder===o[0]);if(existing)return;
  const pending=JSON.parse(localStorage.getItem('iot-pending-workorder')||'null');
  const d=window.IoTShared?.getFieldDevices?.().find(x=>x.id===o[5]);
  const rootCause=pending?.reason||localStorage.getItem('iot-ai-confirmed')&&JSON.parse(localStorage.getItem('iot-ai-confirmed')).rootCause||((d?.rssi??-55)<=-68?'无线信号衰减 / 链路质量下降':(d?.temperature??25)>=60?'设备负载或执行机构异常':'设备状态异常');
  window.IoTKnowledge.add({workOrder:o[0],deviceId:o[5],deviceName:d?.name||o[1],zone:d?.zone||o[2].split(' · ')[0],gateway:d?.gateway||o[2].split(' · ')[1]||'',rootCause,resolution:rootCause.includes('通信')?'检查无线覆盖并重新连接设备':rootCause.includes('温度')||rootCause.includes('负载')?'检查负载并验证温度恢复':'完成现场检查并验证设备恢复',priority:o[3],mttr:Math.max(10,18-(o[3]==='P1'?3:o[3]==='P2'?1:0))});
}
function advance(i){const o=orders[i];const idx=states.indexOf(o[4]);if(idx<0||idx>=states.length-1)return;o[4]=states[idx+1];localStorage.setItem(WO_KEY,JSON.stringify(orders));localStorage.setItem('iot-last-workorder-update',JSON.stringify({workOrder:o[0],deviceId:o[5],status:o[4],at:Date.now()}));if(o[4]==='已完成')completeKnowledge(o);render();}
function hydrateContext(){if(!contextDevice)return;const d=IoTShared.getFieldDevices().find(x=>x.id===contextDevice);const pending=JSON.parse(localStorage.getItem('iot-pending-workorder')||'null');const c=document.querySelector('#context-banner');if(!d&&!pending)return;c.classList.remove('hidden');const id=d?.id||pending?.deviceId||contextDevice;document.querySelector('#context-title').textContent=d?.name||pending?.deviceName||id;document.querySelector('#context-meta').textContent=`${id} · ${d?.zone||pending?.zone||'--'} · ${d?.gateway||pending?.gateway||'Gateway'} · ${d?.status||'待处置'}`;document.querySelector('#context-ai').href=`../index.html?device=${encodeURIComponent(id)}#ai-section`;document.querySelector('#context-topology').href=`topology.html?device=${encodeURIComponent(id)}`;document.querySelector('#context-incident').href=`alerts.html?device=${encodeURIComponent(id)}`;}
document.querySelector('#new-order').addEventListener('click',()=>{const pending=JSON.parse(localStorage.getItem('iot-pending-workorder')||'null');const id=contextDevice||pending?.deviceId||'';const name=pending?.deviceName||(id?`设备 ${id}`:'现场巡检任务');const order=['WO-260914-'+String(19+orders.length).padStart(3,'0'),`${name} · AI 处置工单`,pending?.zone?`${pending.zone} · ${pending.gateway||'Gateway'}`:'自动创建 · 待分派',pending?.priority||'P2','待处理',id];orders.unshift(order);localStorage.setItem(WO_KEY,JSON.stringify(orders));localStorage.removeItem('iot-pending-workorder');render();});
hydrateContext();render();
