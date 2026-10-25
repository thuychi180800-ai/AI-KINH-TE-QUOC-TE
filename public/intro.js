/* LOGX – Mở đầu điện ảnh 8 giây: canvas 2D + Web Audio (sóng biển, còi tàu) */
const INTRO=(()=>{
const $=s=>document.querySelector(s),D=Math.PI/180;
const HUBS=[[-118.2,34,'Los Angeles','p'],[4.4,51.9,'Rotterdam','p'],[10,53.5,'Hamburg','p'],[103.8,1.35,'Singapore','s'],[121.5,31.2,'Thượng Hải','s'],[129,35.1,'Busan','s'],[55.3,25.2,'Dubai','s'],[151.2,-33.9,'Sydney','s']];
const VN=[108,16];
let ov,cv,g,W,H,t0,raf,ac,master,done=true,snd=false,routes=[],fb=0;
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const vec=(o,a)=>[Math.cos(a*D)*Math.cos(o*D),Math.cos(a*D)*Math.sin(o*D),Math.sin(a*D)];
const proj=(o,a)=>[(((o-100+540)%360)/360)*W,(68-a)/115*H];
function path(a,b){
  const va=vec(a[0],a[1]),vb=vec(b[0],b[1]),om=Math.acos(Math.min(1,va[0]*vb[0]+va[1]*vb[1]+va[2]*vb[2])),s=Math.sin(om),pts=[];
  for(let i=0;i<=60;i++){const t=i/60,k1=Math.sin((1-t)*om)/s,k2=Math.sin(t*om)/s,v=[0,1,2].map(j=>k1*va[j]+k2*vb[j]);
    pts.push(proj(Math.atan2(v[1],v[0])/D,Math.asin(v[2])/D))}
  const len=Math.hypot(pts[60][0]-pts[0][0],pts[60][1]-pts[0][1]);
  return pts.map((p,i)=>[p[0],p[1]-Math.sin(Math.PI*i/60)*len*.2]);
}
function size(){
  const r=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;cv.width=W*r;cv.height=H*r;g.setTransform(r,0,0,r,0,0);
  routes=HUBS.map(h=>({p:path(VN,h),h,plane:h[3]==='p'}));
}
function veh(x,y,a,plane){
  g.save();g.translate(x,y);g.rotate(a);g.fillStyle=plane?'#fff':'#F59E0B';g.beginPath();
  if(plane){g.moveTo(10,0);g.lineTo(-6,-7);g.lineTo(-3,0);g.lineTo(-6,7)}else{g.moveTo(11,0);g.lineTo(6,5);g.lineTo(-9,5);g.lineTo(-7,-3);g.lineTo(5,-3)}
  g.closePath();g.fill();g.restore();
}
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
function frame(){
  const t=(performance.now()-t0)/1000;
  if(t>=8)return finish();
  raf=requestAnimationFrame(frame);
  const bg=g.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*.7);bg.addColorStop(0,'#0f3a4a');bg.addColorStop(1,'#030a10');
  g.fillStyle=bg;g.fillRect(0,0,W,H);
  const a0=clamp(t),vis=a0;g.globalAlpha=vis;
  g.fillStyle='rgba(229,231,235,.08)';
  for(let x=13;x<W;x+=26)for(let y=13;y<H;y+=26)g.fillRect(x,y,1.5,1.5);
  const[vx,vy]=proj(VN[0],VN[1]);
  if(t>=1&&!reduce){
    const k=clamp((t-1)/1.5),ph=(t*1.4)%1;
    g.shadowColor='#D4AF37';g.shadowBlur=30;g.fillStyle='#F59E0B';g.beginPath();g.arc(vx,vy,6*k,0,7);g.fill();g.shadowBlur=0;
    g.strokeStyle=`rgba(212,175,55,${.7*(1-ph)*k})`;g.lineWidth=2;g.beginPath();g.arc(vx,vy,6+ph*38,0,7);g.stroke();
  }
  if(t>2.5&&!reduce){
    const p=clamp((t-2.5)/3.5),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    routes.forEach(r=>{
      const n=Math.max(1,Math.floor(e*60)),pts=r.p;
      g.lineWidth=2;g.strokeStyle=r.plane?'rgba(255,255,255,.75)':'rgba(20,184,166,.85)';g.shadowColor=r.plane?'#fff':'#14B8A6';g.shadowBlur=12;
      if(r.plane)g.setLineDash([6,6]);
      g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<=n;i++)g.lineTo(pts[i][0],pts[i][1]);g.stroke();g.setLineDash([]);g.shadowBlur=0;
      const a=pts[Math.max(0,n-2)],b=pts[n];veh(b[0],b[1],Math.atan2(b[1]-a[1],b[0]-a[0]),r.plane);
      if(p>.9){const o=clamp((p-.9)*10);g.fillStyle=`rgba(229,231,235,${o*.9})`;g.font='11pt "Times New Roman"';g.textAlign='center';g.fillText(r.h[2],b[0],b[1]-12);g.beginPath();g.arc(b[0],b[1],3,0,7);g.fill()}
    });
  }
  g.globalAlpha=1;
  $('#introLogo').style.opacity=clamp(((reduce?1.5:6)-0)<t?(t-(reduce?1.5:6))/1:0);
  ov.style.opacity=t>7.5?clamp(1-(t-7.5)/.5):1;
}
/* ---- Âm thanh ---- */
function audioInit(){
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  ac=new AC();master=ac.createGain();master.gain.value=0;master.connect(ac.destination);
  const buf=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate),d=buf.getChannelData(0);let b=0;
  for(let i=0;i<d.length;i++){b=(b+.04*(Math.random()*2-1))/1.04;d[i]=b*4}
  const n=ac.createBufferSource();n.buffer=buf;n.loop=true;
  const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=800;
  const wg=ac.createGain();wg.gain.value=.6;const lfo=ac.createOscillator();lfo.frequency.value=.15;
  const lg=ac.createGain();lg.gain.value=.35;lfo.connect(lg);lg.connect(wg.gain);
  n.connect(lp);lp.connect(wg);wg.connect(master);n.start();lfo.start();
}
function horn(at,v){
  [110,138].forEach(f=>{
    const o=ac.createOscillator(),lp=ac.createBiquadFilter(),gn=ac.createGain();
    o.type='sawtooth';o.frequency.value=f;lp.type='lowpass';lp.frequency.value=500;
    gn.gain.setValueAtTime(0,at);gn.gain.linearRampToValueAtTime(v*.3,at+.15);gn.gain.setValueAtTime(v*.3,at+1.35);gn.gain.linearRampToValueAtTime(0,at+2.15);
    o.connect(lp);lp.connect(gn);gn.connect(master);o.start(at);o.stop(at+2.2);
  });
}
function sound(){
  if(snd||!ac||ac.state!=='running')return;snd=true;$('#introHint').hidden=true;
  const el=(performance.now()-t0)/1000,rem=Math.max(.1,7.5-el),at=ac.currentTime,vol=+store.get('lx_vol')||.5;
  master.gain.setValueAtTime(0,at);
  if(rem>1.2){master.gain.linearRampToValueAtTime(vol,at+1);master.gain.setValueAtTime(vol,at+rem)}else master.gain.setValueAtTime(vol,at);
  master.gain.linearRampToValueAtTime(0,at+rem+.5);
  [[3,1],[5.5,.6]].forEach(([s,v])=>{if(s>el)horn(at+s-el,vol*v)});
}
const wake=()=>{if(ac)ac.resume().then(sound).catch(()=>{})};
function finish(){
  if(done)return;done=true;cancelAnimationFrame(raf);clearTimeout(fb);
  removeEventListener('pointerdown',wake);removeEventListener('keydown',onKey);
  if(ac){const c=ac,m=master;try{m.gain.cancelScheduledValues(c.currentTime);m.gain.setValueAtTime(m.gain.value,c.currentTime);m.gain.linearRampToValueAtTime(0,c.currentTime+.3)}catch{}setTimeout(()=>c.close().catch(()=>{}),400);ac=null}
  ov.style.opacity=0;setTimeout(()=>{if(done)ov.hidden=true},420);
}
const onKey=e=>{if(e.key==='Escape')finish();else wake()};
function play(){
  try{
    ov=$('#intro');cv=$('#introC');g=cv.getContext('2d');
    ov.hidden=false;ov.style.opacity=1;$('#introLogo').style.opacity=0;
    const lg=$('#introLogo .lg');lg.style.animation='none';void lg.offsetWidth;lg.style.animation='';
    size();snd=false;done=false;t0=performance.now();
    audioInit();wake();setTimeout(()=>{if(!snd&&!done)$('#introHint').hidden=false},300);
    addEventListener('pointerdown',wake);addEventListener('keydown',onKey);
    fb=setTimeout(finish,8600);raf=requestAnimationFrame(frame);
  }catch(e){done=false;finish()}
}
addEventListener('resize',()=>{if(!done)size()});
$('#introSkip').onclick=finish;
$('#replayBtn').onclick=()=>{if(done)play()};
play();
return{play,finish};
})();
