/* LOGX 2.5 – 3D Container Optimizer (Extreme Points + Three.js r128) */
const PACK=(()=>{
const $=s=>document.querySelector(s);
const CT={'20DC':[590,235,239,28000],'40DC':[1203,235,239,26500],'40HC':[1203,235,270,26500]};
const DEMO=`Thùng điện tử;60;40;40;18;60;1
Pallet máy móc;120;100;100;650;6;0
Thùng gốm sứ;50;40;40;12;40;1
Cuộn vải;110;40;40;35;20;0
Thùng linh kiện;80;60;50;40;20;0`;
let res=null,scene,cam,ren,grp,run=false,th=.9,ph=1.05,rad=20,ctr,loopId,timer;
$('#pItems').value=DEMO;

function pack(c,items,strat){
  const [L,W,H,MX]=c;const boxes=[];
  items.forEach((it,i)=>{for(let q=0;q<it.q;q++)boxes.push({...it,i})});
  boxes.sort(strat==='vol'?(a,b)=>b.l*b.w*b.h-a.l*a.w*a.h:(a,b)=>b.kg-a.kg);
  let ep=[[0,0,0]];const pl=[],un=[];let tw=0,mx=0,my=0,mz=0;
  for(const b of boxes){
    const rots=b.f?[[b.l,b.w,b.h],[b.w,b.l,b.h]]:[[b.l,b.w,b.h],[b.w,b.l,b.h],[b.l,b.h,b.w],[b.h,b.l,b.w],[b.w,b.h,b.l],[b.h,b.w,b.l]];
    let best=null;
    if(tw+b.kg<=MX)for(const [dx,dz,dy] of rots)for(const [x,y,z] of ep){
      if(x+dx>L||y+dy>H||z+dz>W)continue;
      let ok=true,sup=0;
      for(const p of pl){
        if(x<p.x+p.dx&&x+dx>p.x&&y<p.y+p.dy&&y+dy>p.y&&z<p.z+p.dz&&z+dz>p.z){ok=false;break}
        if(y>0&&Math.abs(p.y+p.dy-y)<.5){
          const ox=Math.min(x+dx,p.x+p.dx)-Math.max(x,p.x),oz=Math.min(z+dz,p.z+p.dz)-Math.max(z,p.z);
          if(ox>0&&oz>0){if(p.f||(strat==='heavy'&&p.kg*1.2<b.kg)){ok=false;break}sup+=ox*oz}
        }
      }
      if(!ok||(y>0&&sup<.75*dx*dz))continue;
      let s;
      if(strat==='bal'){const cx=(mx+b.kg*(x+dx/2))/(tw+b.kg),cz=(mz+b.kg*(z+dz/2))/(tw+b.kg);s=Math.abs(cx-L/2)/L*1e4+Math.abs(cz-W/2)/W*1e4+x*.01+y*.1}
      else s=strat==='heavy'?y*1e4+x*10+z:x*1e4+y*10+z;
      if(!best||s<best.s)best={s,x,y,z,dx,dy,dz};
    }
    if(!best){un.push({name:b.name,why:tw+b.kg>MX?'vượt tải trọng tối đa':'không còn chỗ phù hợp'});continue}
    const {x,y,z,dx,dy,dz}=best;pl.push({...b,x,y,z,dx,dy,dz});
    tw+=b.kg;mx+=b.kg*(x+dx/2);my+=b.kg*(y+dy/2);mz+=b.kg*(z+dz/2);
    const seen=new Set(),n=[];
    [...ep,[x+dx,y,z],[x,y+dy,z],[x,y,z+dz]].forEach(e=>{
      const k=e.join();
      if(seen.has(k)||e[0]>=L||e[1]>=H||e[2]>=W)return;
      if(e[0]>=x&&e[0]<x+dx&&e[1]>=y&&e[1]<y+dy&&e[2]>=z&&e[2]<z+dz)return;
      seen.add(k);n.push(e);
    });
    ep=n;
  }
  return{pl,un,tw,cog:tw?[mx/tw,my/tw,mz/tw]:[L/2,0,W/2],c};
}

function analyse(r,strat){
  const [L,W,H,MX]=r.c,cv=L*W*H;
  const vol=r.pl.reduce((a,b)=>a+b.dx*b.dy*b.dz,0);
  const fill=vol/cv*100,load=r.tw/MX*100,empty=100-fill;
  const dx=(r.cog[0]-L/2)/L*100,dz=(r.cog[2]-W/2)/W*100;
  let risk=Math.min(35,Math.max(0,Math.abs(dx)-5)*5)+Math.min(20,Math.max(0,Math.abs(dz)-5)*4)
    +Math.min(20,Math.max(0,empty-25)*.8)+(r.un.length?10:0)+(load>95?15:0);
  risk=Math.round(Math.min(100,risk));
  const lv=risk<25?['Thấp','lo']:risk<50?['Trung bình','mid']:['Cao','hi'];
  const rec=[];
  if(Math.abs(dx)>5)rec.push(`Trọng tâm lệch ${dx.toFixed(1)}% chiều dài (vượt ±5%): đổi sang chiến lược "Cân bằng tải trọng" hoặc dời hàng nặng về giữa.`);
  if(Math.abs(dz)>5)rec.push(`Trọng tâm lệch ${dz.toFixed(1)}% chiều ngang: phân bố lại hàng nặng đều hai bên.`);
  if(empty>25)rec.push(`Khoảng trống ${empty.toFixed(1)}%: chèn lót (dunnage), túi khí hoặc dây chằng để hàng không xê dịch.`);
  if(r.un.length)rec.push(`${r.un.length} kiện chưa xếp được: cân nhắc container lớn hơn hoặc chuyến bổ sung.`);
  if(load>95)rec.push('Tải trọng sát giới hạn: kiểm tra VGM kỹ trước khi giao hãng tàu.');
  if(!rec.length)rec.push('Phương án ổn. Vẫn cần chằng buộc theo CTU Code.');
  return{fill,load,dx,dz,empty,risk,lv,rec,vol};
}

function show(r,a){
  const k=(t,v,c='')=>`<div class="${c}">${t}<b>${v}</b></div>`;
  $('#pStats').innerHTML=`<div class="kpi">
    ${k('Lấp đầy thể tích',a.fill.toFixed(1)+'%')}${k('Tải trọng',a.load.toFixed(1)+'%')}
    ${k('CoG lệch (dài / ngang)',a.dx.toFixed(1)+'% / '+a.dz.toFixed(1)+'%')}${k('Chỗ trống',a.empty.toFixed(1)+'%')}
    ${k('Rủi ro hư hại',a.lv[0]+' ('+a.risk+'/100)',a.lv[1])}${k('Đã xếp / chưa xếp',r.pl.length+' / '+r.un.length)}</div>
    <p class="msg">Công thức: Lấp đầy = Σ thể tích hàng ÷ thể tích trong container; Tải trọng = Σ kg ÷ tải tối đa; CoG = trung bình tâm hộp theo khối lượng (giới hạn tham chiếu CTU Code ±5%). Rủi ro = CoG lệch + khoảng trống + chưa xếp + tải sát giới hạn. Gợi ý của AI – cần xác nhận của người có thẩm quyền.</p>
    <ul>${a.rec.map(x=>`<li>${x}</li>`).join('')}</ul>
    ${r.un.length?'<p class="msg">Chưa xếp được: '+[...new Set(r.un.map(u=>u.name+' ('+u.why+')'))].join('; ')+'</p>':''}`;
  $('#pPlan').hidden=false;
  $('#pPlan').innerHTML='<b>Loading Plan (cm: x, y, z · kích thước dài×rộng×cao)</b><br>'+r.pl.map((p,i)=>`${i+1}. ${p.name} — (${p.x}, ${p.y}, ${p.z}) · ${p.dx}×${p.dz}×${p.dy}`).join('<br>');
  $('#pAsk').hidden=false;
}

/* ---- 3D ---- */
function init(){
  if(ren||!window.THREE)return;
  const el=$('#pView');
  scene=new THREE.Scene();scene.background=new THREE.Color(0x07121d);
  cam=new THREE.PerspectiveCamera(45,el.clientWidth/430,.1,200);
  ren=new THREE.WebGLRenderer({antialias:true});ren.setPixelRatio(Math.min(devicePixelRatio,2));ren.setSize(el.clientWidth,430);
  el.append(ren.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff,0x223344,.85));
  const d=new THREE.DirectionalLight(0xffffff,.7);d.position.set(10,20,12);scene.add(d);
  let dn=null;const cv=ren.domElement;
  cv.onpointerdown=e=>{dn=[e.clientX,e.clientY];cv.setPointerCapture(e.pointerId)};
  cv.onpointerup=()=>dn=null;
  cv.onpointermove=e=>{if(!dn)return;th-=(e.clientX-dn[0])*.01;ph=Math.min(3.09,Math.max(.01,ph-(e.clientY-dn[1])*.01));dn=[e.clientX,e.clientY]};
  cv.onwheel=e=>{e.preventDefault();rad=Math.min(60,Math.max(4,rad*(e.deltaY>0?1.08:.92)))};
  addEventListener('resize',()=>{if(ren){const w=el.clientWidth;ren.setSize(w,430);cam.aspect=w/430;cam.updateProjectionMatrix()}});
}
function build(r,a){
  init();if(!ren){$('#pOut').textContent='Không tải được Three.js (WebGL).';return}
  if(grp){scene.remove(grp);grp.traverse(o=>{o.geometry&&o.geometry.dispose();o.material&&o.material.dispose()})}
  grp=new THREE.Group();const [L,W,H]=r.c,S=.01;
  const cb=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(L*S,H*S,W*S)),new THREE.LineBasicMaterial({color:0xD4AF37}));
  cb.position.set(L*S/2,H*S/2,W*S/2);grp.add(cb);
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(L*S,W*S),new THREE.MeshBasicMaterial({color:0x14B8A6,transparent:true,opacity:.12,side:2}));
  fl.rotation.x=-Math.PI/2;fl.position.set(L*S/2,.001,W*S/2);grp.add(fl);
  const boxes=new THREE.Group();grp.add(boxes);
  r.pl.forEach(p=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(p.dx*S*.995,p.dy*S*.995,p.dz*S*.995),
      new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL((p.i*.17)%1,p.f?.75:.55,p.f?.6:.5),roughness:.7}));
    m.position.set((p.x+p.dx/2)*S,(p.y+p.dy/2)*S,(p.z+p.dz/2)*S);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:0x000000})));
    boxes.add(m);
  });
  const g=new THREE.Mesh(new THREE.SphereGeometry(.18,16,16),new THREE.MeshBasicMaterial({color:0xF59E0B}));
  g.position.set(r.cog[0]*S,r.cog[1]*S,r.cog[2]*S);grp.add(g);
  scene.add(grp);
  ctr=new THREE.Vector3(L*S/2,H*S/2,W*S/2);rad=L*S*1.15;
  $('#pStep').max=r.pl.length;$('#pStep').value=r.pl.length;setStep(r.pl.length);
}
function setStep(n){if(!grp)return;grp.children[2].children.forEach((m,i)=>m.visible=i<n)}
function loop(){
  if(!run)return;loopId=requestAnimationFrame(loop);
  if(!ren||!ctr)return;
  cam.position.set(ctr.x+rad*Math.sin(ph)*Math.sin(th),ctr.y+rad*Math.cos(ph),ctr.z+rad*Math.sin(ph)*Math.cos(th));
  cam.lookAt(ctr);ren.render(scene,cam);
}
function active(on){
  if(on&&!run){run=true;init();if(ren){const w=$('#pView').clientWidth;ren.setSize(w,430);cam.aspect=w/430;cam.updateProjectionMatrix()}loop()}
  if(!on){run=false;cancelAnimationFrame(loopId);clearInterval(timer);$('#pPlay').textContent='▶ Phát từng bước'}
}

$('#pDemo').onclick=()=>$('#pItems').value=DEMO;
$('#pRun').onclick=()=>{
  const items=$('#pItems').value.split('\n').map(l=>l.split(';').map(x=>x.trim())).filter(a=>a.length>=6&&a[0]).map(a=>({name:a[0],l:+a[1],w:+a[2],h:+a[3],kg:+a[4],q:Math.round(+a[5]),f:a[6]==='1'}));
  if(!items.length||items.some(i=>!(i.l>0&&i.w>0&&i.h>0&&i.q>0&&i.kg>=0)))return $('#pOut').textContent='Dữ liệu chưa hợp lệ. Kiểm tra từng dòng: tên; dài; rộng; cao; kg; số lượng; dễ vỡ.';
  if(items.reduce((a,i)=>a+i.q,0)>400)return $('#pOut').textContent='Tối đa 400 kiện mỗi lần tính.';
  $('#pOut').textContent='Đang tính…';
  setTimeout(()=>{
    const strat=$('#pSt').value;res=pack(CT[$('#pCt').value],items,strat);const a=analyse(res,strat);
    $('#pOut').textContent='';build(res,a);show(res,a);
  },30);
};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{const v=b.dataset.view;[ph,th]=v==='p'?[1.05,.9]:v==='t'?[.01,0]:v==='s'?[Math.PI/2,0]:[Math.PI/2,Math.PI/2]});
$('#pStep').oninput=e=>setStep(+e.target.value);
$('#pPlay').onclick=()=>{
  if(!res)return;
  if(timer){clearInterval(timer);timer=null;$('#pPlay').textContent='▶ Phát từng bước';return}
  let n=0;$('#pPlay').textContent='⏸ Tạm dừng';
  timer=setInterval(()=>{n++;$('#pStep').value=n;setStep(n);if(n>=res.pl.length){clearInterval(timer);timer=null;$('#pPlay').textContent='▶ Phát từng bước'}},Math.max(30,3000/res.pl.length));
};
$('#pAsk').onclick=()=>{
  const a=analyse(res,$('#pSt').value);show_('chat');
  send(`Tôi vừa xếp hàng vào container ${$('#pCt').value}: lấp đầy ${a.fill.toFixed(1)}%, tải trọng ${a.load.toFixed(1)}%, CoG lệch ${a.dx.toFixed(1)}% chiều dài và ${a.dz.toFixed(1)}% chiều ngang, rủi ro hư hại ${a.lv[0]}, ${res.un.length} kiện chưa xếp. Hãy đánh giá và đề xuất cách chèn lót, chằng buộc theo CTU Code.`);
};
const show_=v=>document.querySelector(`[data-go="${v}"]`)?.click();
return{active};
})();
