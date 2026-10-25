/* LOGX Voice – hội thoại giọng nói thời gian thật: streaming + đọc theo câu + VAD ngắt lời + Wake Word */
const VOICE=(()=>{
const $=s=>document.querySelector(s);
const WAKE_REPLY='XIN CHÀO BẠN, BẠN MUỐN TÔI GIÚP GÌ CHO BẠN?';
const VSYS=()=>SYS+' CHẾ ĐỘ GIỌNG NÓI: trả lời ngắn gọn 2–4 câu như đang nói chuyện, không dùng bảng, gạch đầu dòng hay ký hiệu; nêu tên căn cứ pháp lý thật ngắn gọn; nhắc lại thuật ngữ tiếng Anh nguyên dạng.';
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const WAKE=/\b(xin chao|chao|alo|e|oi|hey)\s*(logx|log x|lock x|loc x|lo g x|lo gi ich|lo go ich|logic|lock|log)\b/;
const BYE=/tam biet( logx| log x)?$/,STOP=/^(dung|stop|thoi|khoan)( lai)?$/;
let on=false,state='idle',awake=false,rec,stream,actx,an,raf,ctrl,pend=0,done=true,pulse=0,idleT,vadN=0,vadT=0,lastVad=0,bub=null,full='',buf='';
const AC=window.AudioContext||window.webkitAudioContext,SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const wakeOn=()=>$('#vWake').checked;
const LBL={idle:'Voice tắt',thinking:'Đang xử lý…',speaking:'Đang nói…'};
function setState(s){
  state=s;$('#vState').textContent=s==='listening'?(wakeOn()&&!awake?'Chờ “Xin chào LOGX”':'Đang nghe…'):LBL[s];
  $('#vBtn').classList.toggle('on',s!=='idle');
}
function sub(t,me){const e=$('#vSub');e.hidden=!t;e.innerHTML=t?(me?'<span class="me">'+esc(t)+'</span>':md(t)):''; e.scrollTop=1e9}
function touch(){clearTimeout(idleT);if(wakeOn()&&awake)idleT=setTimeout(()=>{awake=false;if(state==='listening')setState('listening')},30000)}

/* ---- Đọc to theo từng câu (tiếng Việt + từ Anh đọc giọng Anh) ---- */
function say(t){
  const c=t.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/[*_#`>|~]/g,' ').replace(/\s+/g,' ').trim();
  if(!c)return;if(state!=='speaking')setState('speaking');
  segs(c).forEach(([lang,txt])=>{
    if(!txt.trim())return;
    const u=new SpeechSynthesisUtterance(txt);u.lang=lang;const v=pickV(lang.slice(0,2));if(v)u.voice=v;
    u.rate=+store.get('lx_rate')||1.05;pend++;u.onboundary=()=>pulse=1;
    u.onend=u.onerror=()=>{pend=Math.max(0,pend-1);check()};speechSynthesis.speak(u);
  });
}
function check(){if(done&&pend<=0&&state==='speaking'){setState('listening');touch()}}
function sayNow(t,shown){speechSynthesis.cancel();pend=0;done=true;sub(shown||t);say(t)}

/* ---- Ngắt lời ---- */
function barge(t0){
  if(state!=='speaking'&&state!=='thinking')return;
  try{ctrl&&ctrl.abort()}catch{}speechSynthesis.cancel();pend=0;done=true;
  if(full.trim()){hist.push({role:'model',parts:[{text:full}]});full=''}
  setState('listening');const ms=Math.round(performance.now()-(t0||performance.now()));
  console.log('[LOGX Voice] barge-in',ms,'ms');toast('Đã ngắt lời ('+ms+' ms)');
}

/* ---- Hỏi AI, stream từng câu ---- */
async function ask(q){
  if(!KEY){show('key');return sayNow('Bạn cần nhập API key trước.')}
  setState('thinking');sub(q,true);bubble('u',md(q));hist.push({role:'user',parts:[{text:q}]});
  bub=bubble('a','…');full='';buf='';done=false;pend=0;ctrl=new AbortController();
  const feed=d=>{
    full+=d;buf+=d;bub.innerHTML=md(full);sub(full);$('#log').scrollTop=1e9;
    for(;;){
      let i=buf.search(/[.!?…\n](\s|$)/);
      if(i<0&&buf.length>170)i=buf.lastIndexOf(', ');
      if(i<0)break;
      const s=buf.slice(0,i+1);buf=buf.slice(i+1);if(s.trim())say(s);
    }
  };
  const call=async tools=>{
    const body={contents:hist.slice(-16),systemInstruction:{parts:[{text:VSYS()}]}};if(tools)body.tools=[{google_search:{}}];
    return fetch(`${G}models/${MODEL}:streamGenerateContent?alt=sse&key=${KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctrl.signal});
  };
  try{
    let r=await call(true);if(!r.ok)r=await call(false);
    if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error?.message||'Lỗi kết nối AI');
    const rd=r.body.getReader(),dec=new TextDecoder();let acc='';
    for(;;){
      const {done:dn,value}=await rd.read();if(dn)break;
      acc+=dec.decode(value,{stream:true});let i;
      while((i=acc.indexOf('\n'))>=0){
        const line=acc.slice(0,i).trim();acc=acc.slice(i+1);if(!line.startsWith('data:'))continue;
        try{const d=(JSON.parse(line.slice(5)).candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');if(d)feed(d)}catch{}
      }
    }
    if(buf.trim())say(buf);buf='';done=true;
    if(full.trim())hist.push({role:'model',parts:[{text:full}]});full='';
    if(pend<=0)setState('listening');else check();
  }catch(e){
    if(e.name==='AbortError')return;
    hist.pop();done=true;bub.textContent='⚠ '+e.message;sayNow('Xin lỗi, tôi chưa kết nối được. '+e.message.slice(0,80),'⚠ '+e.message);
  }
}

/* ---- Khẩu lệnh điều hướng ---- */
function command(n){
  const go=(v,t)=>{if(!user){sayNow('Bạn cần đăng nhập trước.');return true}show(v);sayNow('Đã mở '+t);return true};
  if(/(tat giong noi|tat voice|tat micro)/.test(n)){sayNow('Đã tắt giọng nói. Hẹn gặp lại bạn.');setTimeout(stop,2200);return true}
  if(/quay lai/.test(n)){$('#backBtn').click();sayNow('Đã quay lại');return true}
  if(/mo.*(container|3d)/.test(n))return go('pack','3D Container Optimizer');
  if(/mo.*dien dan/.test(n))return go('forum','diễn đàn');
  if(/mo.*(quet|ocr|chung tu)/.test(n))return go('ocr','quét chứng từ');
  if(/mo.*(tro ly|chat)/.test(n))return go('chat','trợ lý AI');
  if(/(trang chu|ve home)/.test(n))return go('home','trang chủ');
  return false;
}

/* ---- Nhận dạng giọng nói ---- */
function onFinal(text){
  const n=norm(text);if(!n)return;
  if(state==='speaking'||state==='thinking'){
    if(STOP.test(n)){barge(vadT);return}
    if(performance.now()-lastVad>3000)return;           // bỏ qua tiếng loa tự thu lại
    barge(vadT);
  }
  if(wakeOn()&&!awake){
    if(!WAKE.test(n))return;
    awake=true;touch();speechSynthesis.cancel();pend=0;done=true;sub(WAKE_REPLY);say(WAKE_REPLY.toLowerCase());return;
  }
  touch();
  if(STOP.test(n))return;
  if(BYE.test(n)){awake=false;return sayNow('Tạm biệt bạn. Cần gì cứ gọi LOGX nhé.')}
  if(command(n))return;
  ask(text.trim());
}
function mkRec(){
  rec=new SR();rec.lang='vi-VN';rec.continuous=true;rec.interimResults=true;
  rec.onresult=e=>{
    let fin='',tmp='';
    for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;e.results[i].isFinal?fin+=t:tmp+=t}
    if(tmp&&state==='listening'&&(awake||!wakeOn()))sub(tmp,true);
    if(tmp&&state==='speaking'&&tmp.trim().split(/\s+/).length>=2&&performance.now()-lastVad<1500)barge(vadT);
    if(fin)onFinal(fin);
  };
  rec.onend=()=>{if(on)setTimeout(()=>{try{rec.start()}catch{}},120)};
  rec.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){toast('Chưa được cấp quyền micro. Hãy cho phép micro trên thanh địa chỉ.');stop()}};
}

/* ---- Vòng lặp: mức micro (VAD), nhịp mỏ neo ---- */
function loop(){
  if(!on)return;raf=requestAnimationFrame(loop);
  const a=new Uint8Array(an.fftSize);an.getByteTimeDomainData(a);
  let s=0;for(const v of a){const d=(v-128)/128;s+=d*d}const rms=Math.sqrt(s/a.length),now=performance.now();
  if(state==='speaking'||state==='thinking'){
    if(rms>.1){if(!vadN)vadT=now;vadN++;lastVad=now;if(now-vadT>=110&&vadN>=6)barge(vadT)}else vadN=0;   // ~110 ms giọng người → dừng đọc
  }else vadN=0;
  pulse*=.9;
  const k=state==='speaking'?1+pulse*.12+.03*Math.sin(now/90):state==='listening'?1+Math.min(rms*2.5,.15):state==='thinking'?1+.04*Math.sin(now/200):1;
  const el=$('#vAnc');el.style.transform=`scale(${k.toFixed(3)}) rotate(${state==='thinking'?(now/12)%360:0}deg)`;
  el.style.textShadow=state==='speaking'?`0 0 ${8+pulse*22}px #F59E0B`:'0 0 8px rgba(212,175,55,.5)';
}

/* ---- Bật / tắt (một chạm) ---- */
async function start(){
  if(on)return;
  if(!SR||!AC||!navigator.mediaDevices)return toast('Trình duyệt chưa hỗ trợ giọng nói. Hãy dùng Chrome hoặc Edge, hoặc dùng Trợ lý gõ chữ.');
  try{typeof mic==='function'&&mic(false);
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    actx=new AC();await actx.resume();an=actx.createAnalyser();an.fftSize=512;actx.createMediaStreamSource(stream).connect(an);
    speechSynthesis.speak(new SpeechSynthesisUtterance(' '));
    if(!pickV('vi'))toast('Máy chưa có giọng đọc tiếng Việt, sẽ dùng giọng mặc định.');
    on=true;awake=!wakeOn();mkRec();rec.start();setState('listening');raf=requestAnimationFrame(loop);
    toast('Micro đang bật. Trình duyệt có thể gửi âm thanh tới nhà cung cấp dịch vụ nhận dạng. Nên dùng tai nghe.');
    sub(wakeOn()?'Hãy nói “Xin chào LOGX” để bắt đầu.':'Mời bạn nói, tôi đang nghe.');
  }catch(e){on=false;toast(e.name==='NotAllowedError'?'Bạn đã từ chối quyền micro. Hãy bật lại trong cài đặt trình duyệt.':'Không bật được micro: '+e.message)}
}
function stop(){
  on=false;awake=false;clearTimeout(idleT);cancelAnimationFrame(raf);
  try{ctrl&&ctrl.abort()}catch{}try{rec&&rec.stop()}catch{}speechSynthesis.cancel();
  stream&&stream.getTracks().forEach(t=>t.stop());try{actx&&actx.close()}catch{}
  pend=0;done=true;setState('idle');sub('');$('#vAnc').style.transform='';
}
$('#vBtn').onclick=()=>on?stop():start();
$('#tileVoice').onclick=()=>{if(!on)start()};
$('#vWake').onchange=()=>{awake=!wakeOn();setState(state)};
addEventListener('beforeunload',stop);
return{start,stop};
})();
