/* LOGX – Gemini Live: hội thoại bằng âm thanh hai chiều qua WebSocket (tùy chọn) */
const LIVE=(()=>{
const $=s=>document.querySelector(s);
const WS='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=';
const LSYS=()=>SYS+' CHẾ ĐỘ GIỌNG NÓI TRỰC TIẾP: luôn nói tiếng Việt tự nhiên, ngắn gọn 2–4 câu; thuật ngữ tiếng Anh (CBM, FOB, Incoterms, VGM…) đọc đúng giọng Anh; không đọc ký hiệu markdown. Khi người dùng yêu cầu mở chức năng, quay lại hoặc tắt giọng nói, hãy gọi hàm tương ứng.';
const FN=[{name:'open_module',description:'Mở một chức năng của LOGX',parameters:{type:'OBJECT',properties:{module:{type:'STRING',enum:['home','chat','ocr','forum','pack']}},required:['module']}},
  {name:'go_back',description:'Quay lại màn hình trước'},{name:'stop_voice',description:'Tắt giọng nói khi người dùng muốn kết thúc'}];
let on=false,ws,inCtx,outCtx,stream,node,gain,outAn,inAn,src=new Set(),nextT=0,raf,inT='',outT='',cur='';
const b64=buf=>{let s='';const u=new Uint8Array(buf);for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)};
const unb64=t=>{const s=atob(t),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u.buffer};
const label=t=>{$('#vState').textContent=t;$('#vBtn').classList.toggle('on',on)};

async function liveModels(){
  const r=await fetch(`${G}models?pageSize=200&key=${KEY}`),j=await r.json();
  if(!r.ok)throw new Error(j.error?.message||'Không tải được danh sách model');
  const m=(j.models||[]).filter(x=>(x.supportedGenerationMethods||[]).includes('bidiGenerateContent')).map(x=>x.name.replace('models/',''));
  const rank=n=>/native-audio/.test(n)?0:/live/.test(n)?1:2;
  return m.sort((a,b)=>rank(a)-rank(b));
}
function setup(model,v){
  const s={model:'models/'+model,generationConfig:{responseModalities:['AUDIO']},systemInstruction:{parts:[{text:LSYS()}]}};
  if(v<3){s.inputAudioTranscription={};s.outputAudioTranscription={}}
  if(v===0)s.tools=[{googleSearch:{}},{functionDeclarations:FN}];
  if(v===1)s.tools=[{functionDeclarations:FN}];
  return{setup:s};
}
function open(model,v){
  return new Promise((ok,no)=>{
    const w=new WebSocket(WS+encodeURIComponent(KEY));w.binaryType='arraybuffer';let up=false;
    w.onopen=()=>w.send(JSON.stringify(setup(model,v)));
    w.onmessage=e=>{
      let m;try{m=JSON.parse(typeof e.data==='string'?e.data:new TextDecoder().decode(e.data))}catch{return}
      if(!up){if(m.setupComplete){up=true;ok(w)}return}
      handle(m);
    };
    w.onclose=ev=>{if(!up)no(new Error(ev.reason||('Kết nối bị đóng (mã '+ev.code+')')));else if(on){toast('Phiên Live đã kết thúc'+(ev.reason?': '+ev.reason:''));stop()}};
  });
}

/* ---- Nhận từ máy chủ ---- */
function handle(m){
  const sc=m.serverContent;
  if(sc){
    if(sc.interrupted)flush();                               // người dùng nói chen → dừng ngay
    (sc.modelTurn?.parts||[]).forEach(p=>{if(p.inlineData?.data)play(p.inlineData.data)});
    if(sc.inputTranscription?.text)inT+=sc.inputTranscription.text;
    if(sc.outputTranscription?.text)outT+=sc.outputTranscription.text;
    if(inT||outT){const e=$('#vSub');e.hidden=false;e.innerHTML=(inT?`<span class="me">${esc(inT)}</span><br>`:'')+md(outT);e.scrollTop=1e9}
    if(sc.turnComplete){
      if(inT.trim()){bubble('u',md(inT.trim()));hist.push({role:'user',parts:[{text:inT.trim()}]})}
      if(outT.trim()){bubble('a',md(outT.trim()));hist.push({role:'model',parts:[{text:outT.trim()}]})}
      inT='';outT='';
    }
  }
  if(m.toolCall){
    const res=m.toolCall.functionCalls.map(f=>{
      let r='ok';
      if(f.name==='open_module'){if(!user)r='Người dùng chưa đăng nhập';else{show(f.args?.module||'home')}}
      else if(f.name==='go_back')$('#backBtn').click();
      else if(f.name==='stop_voice')setTimeout(stop,3500);
      return{id:f.id,name:f.name,response:{result:r}};
    });
    ws.send(JSON.stringify({toolResponse:{functionResponses:res}}));
  }
  if(m.goAway)toast('Phiên Live sắp hết hạn, hãy bật lại sau ít phút.');
}

/* ---- Phát âm thanh 24 kHz, lập lịch liền mạch ---- */
function play(data){
  const i16=new Int16Array(unb64(data)),f=new Float32Array(i16.length);
  for(let i=0;i<f.length;i++)f[i]=i16[i]/32768;
  const b=outCtx.createBuffer(1,f.length,24000);b.copyToChannel(f,0);
  const s=outCtx.createBufferSource();s.buffer=b;s.connect(gain);
  nextT=Math.max(nextT,outCtx.currentTime+.03);s.start(nextT);nextT+=b.duration;
  src.add(s);s.onended=()=>src.delete(s);
}
function flush(){src.forEach(s=>{try{s.stop()}catch{}});src.clear();nextT=0}

/* ---- Vòng lặp hiển thị: mỏ neo đập theo âm thanh thật ---- */
function level(an){const a=new Uint8Array(an.fftSize);an.getByteTimeDomainData(a);let s=0;for(const v of a){const d=(v-128)/128;s+=d*d}return Math.sqrt(s/a.length)}
function loop(){
  if(!on)return;raf=requestAnimationFrame(loop);
  const speaking=src.size>0,l=speaking?level(outAn):level(inAn);
  label(speaking?'Live · AI đang nói…':'Live · đang nghe…');
  const el=$('#vAnc');el.style.transform=`scale(${(1+Math.min(l*(speaking?1.6:2.5),.18)).toFixed(3)})`;
  el.style.textShadow=speaking?`0 0 ${8+l*80}px #F59E0B`:'0 0 8px rgba(212,175,55,.5)';
}

/* ---- Bật / tắt ---- */
const WORKLET=`class P extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(1024);this.n=0}process(i){const c=i[0][0];if(c){for(let k=0;k<c.length;k++){this.b[this.n++]=c[k];if(this.n===1024){const o=new Int16Array(1024);for(let j=0;j<1024;j++){const s=Math.max(-1,Math.min(1,this.b[j]));o[j]=s<0?s*32768:s*32767}this.port.postMessage(o.buffer,[o.buffer]);this.n=0}}}return true}}registerProcessor('pcm',P);`;
async function start(){
  if(on)return;if(!KEY){show('key');return}
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC||!navigator.mediaDevices||!window.AudioWorklet)return toast('Trình duyệt chưa hỗ trợ Gemini Live. Hãy dùng Chrome hoặc Edge.');
  VOICE.stop();label('Live · đang kết nối…');$('#vBtn').classList.add('on');
  try{
    inCtx=new AC({sampleRate:16000});outCtx=new AC({sampleRate:24000});await inCtx.resume();await outCtx.resume();
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    const models=await liveModels();
    if(!models.length)throw new Error('API key này chưa có model hỗ trợ Live. Hãy dùng chế độ Voice chuẩn.');
    let err;ws=null;
    outer:for(const m of models.slice(0,2))for(let v=0;v<4;v++){try{ws=await open(m,v);cur=m;break outer}catch(e){err=e}}
    if(!ws)throw err;
    gain=outCtx.createGain();outAn=outCtx.createAnalyser();outAn.fftSize=512;gain.connect(outAn);outAn.connect(outCtx.destination);
    inAn=inCtx.createAnalyser();inAn.fftSize=512;
    await inCtx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET],{type:'application/javascript'})));
    const mic=inCtx.createMediaStreamSource(stream);node=new AudioWorkletNode(inCtx,'pcm');mic.connect(inAn);mic.connect(node);
    node.port.onmessage=e=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify({realtimeInput:{audio:{data:b64(e.data),mimeType:'audio/pcm;rate=16000'}}}))};
    on=true;raf=requestAnimationFrame(loop);
    toast('Gemini Live đã kết nối ('+cur+'). Hãy nói, bạn có thể ngắt lời bất cứ lúc nào. Nên dùng tai nghe.');
  }catch(e){toast('Không bật được Live: '+e.message);on=true;stop()}
}
function stop(){
  const was=on;on=false;cancelAnimationFrame(raf);
  try{ws&&ws.close()}catch{}ws=null;flush();
  try{node&&(node.port.onmessage=null,node.disconnect())}catch{}
  stream&&stream.getTracks().forEach(t=>t.stop());stream=null;
  try{inCtx&&inCtx.close()}catch{}try{outCtx&&outCtx.close()}catch{}inCtx=outCtx=null;
  inT=outT='';if(was||$('#vState').textContent.startsWith('Live'))label('Voice tắt');$('#vBtn').classList.remove('on');$('#vAnc').style.transform='';$('#vSub').hidden=true;
}

/* ---- Gắn vào nút ⚓ ---- */
$('#vLive').checked=store.get('lx_live')==='1';
$('#vLive').onchange=e=>{store.set('lx_live',e.target.checked?'1':'0');if(!e.target.checked&&on)stop()};
const btn=$('#vBtn'),begin=()=>$('#vLive').checked?start():VOICE.start();
btn.onclick=()=>{if(on)stop();else if(btn.classList.contains('on'))VOICE.stop();else begin()};
$('#tileVoice').onclick=()=>{if(!on&&!btn.classList.contains('on'))begin()};
addEventListener('beforeunload',stop);
return{start,stop};
})();
