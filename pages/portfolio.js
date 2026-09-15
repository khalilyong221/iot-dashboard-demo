const links=[...document.querySelectorAll('a[href^="#"]')];links.forEach(a=>a.addEventListener('click',()=>{links.forEach(x=>x.classList.remove('active'));a.classList.add('active')}));

/* Hero 里那四块数字直接读共享资产模型（工业域），不再写死。
   原先这里是「设备总数 1,000 / 在线率 60.1% / 异常 200 / 告警 400」四块硬编码，
   外加一个 60.1% ± 1.8% 的正弦波动 —— 数字既和驾驶舱对不上，也和资产表对不上。 */
(function heroStats(){
  const hero=document.querySelector('.hero-screen');
  if(!hero)return;
  const cells=hero.querySelectorAll('.screen-stats > div');
  if(!cells.length)return;
  const ds=window.IoTShared?.getFieldDevices?.()||[];
  if(!ds.length)return;
  const total=ds.length;
  const online=ds.filter(d=>d.status==='online').length;
  const warn=ds.filter(d=>d.status==='warning').length;
  const active=ds.filter(d=>d.status!=='online').length;
  const values=[total.toLocaleString(),`${(online/total*100).toFixed(1)}%`,`${warn}`,`${active}`];
  cells.forEach((cell,i)=>{const s=cell.querySelector('strong');if(s&&values[i]!=null)s.textContent=values[i]});
})();
