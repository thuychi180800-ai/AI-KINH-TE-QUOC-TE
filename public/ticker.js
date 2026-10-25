/* LOGX – Ticker Radar: 1 hàng, chạy liên tục, dữ liệu mô phỏng cập nhật mỗi 10 giây */
(()=>{
const tr=document.querySelector('#tkTrack');
const R=a=>a[Math.floor(Math.random()*a.length)],rn=(a,b,d=1)=>+(Math.random()*(b-a)+a).toFixed(d);
const LANE=[['g','Luồng xanh · Thông quan hoàn tất'],['y','Luồng vàng · Chờ kiểm tra hồ sơ'],['r','Luồng đỏ · Chờ kiểm hóa']];
const hhmm=()=>new Date().toTimeString().slice(0,5);
function mk(){
  const k=R(['c','b','e']);
  if(k==='c'){const l=R(LANE);return{c:l[0],t:`🛃 Lô LX-${24000+Math.floor(Math.random()*200)} · ${l[1]} ${hhmm()}`}}
  if(k==='b'){const f=rn(78,96),d=rn(.5,6),low=d<=5&&f>=82;
    return{c:low?'g':'y',go:'pack',t:`📦 Cont ${R(["40'HC","40'DC","20'DC"])} #C-${100+Math.floor(Math.random()*90)} · Lấp đầy ${f}% · CoG lệch ${d}% · Rủi ro hư hại: ${low?'Thấp':'Trung bình'}`}}
  return{c:'g',t:`🌿 ESG · Phát thải ước tính ${rn(1.2,2.6,2)} tCO₂e/lô · Giảm ${rn(2,9)}% so với tháng trước`};
}
let q=Array.from({length:6},mk);
function render(){
  const h=q.map(m=>`<span class="tk ${m.c}" data-t="${m.go||''}">${m.t}</span><i>◆</i>`).join('');
  tr.innerHTML=h+h;
  tr.style.animationDuration=Math.max(30,tr.scrollWidth/2/70)+'s';
}
render();
setInterval(()=>{q.push(mk());if(q.length>20)q.shift();render()},10000);
tr.onclick=e=>{
  const s=e.target.closest('.tk');
  if(s&&s.dataset.t==='pack'&&typeof user!=='undefined'&&user)document.querySelector('[data-go="pack"]').click();
};
})();
