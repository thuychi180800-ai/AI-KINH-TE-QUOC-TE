/* LOGX – phiên bản 1 · Gemini + Supabase · không cần build */
const SB_URL='https://bkfahjavipyxmgqfvjix.supabase.co';
const SB_KEY='sb_publishable_IX6L8776b6KNfNdWQTTUJg_X7ePebZI';
const G='https://generativelanguage.googleapis.com/v1beta/';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const sb=supabase.createClient(SB_URL,SB_KEY);
const store={get:k=>{try{return localStorage.getItem(k)||''}catch{return''}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}}};
let KEY=store.get('lx_key'),MODEL=store.get('lx_model'),user=null,stack=[],hist=[],ocrText='';
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const md=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
const toast=t=>{const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,3000)};

/* ---------- Điều hướng + nút Back ---------- */
function show(v,push=true){
  $$('.view').forEach(e=>e.hidden=e.id!=='v-'+v);
  if(push&&stack[stack.length-1]!==v)stack.push(v);
  $('#backBtn').hidden=stack.length<2||v==='home';
  $('#keyBtn').hidden=!KEY||v==='key';
  $('#outBtn').hidden=!user;
  $('#who').textContent=user?user.user_metadata?.name||user.email:'';
  if(v==='forum')openForum(); else closeForum();
  if(v!=='chat')mic(false);
  window.PACK&&PACK.active(v==='pack');
}
$('#backBtn').onclick=()=>{stack.pop();show(stack[stack.length-1]||'home',false)};
$$('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
$('#keyBtn').onclick=()=>show('key');
function enter(){stack=[];show(!KEY||!MODEL?'key':!user?'auth':'home')}

/* ---------- Gemini ---------- */
async function post(body){
  const r=await fetch(`${G}models/${MODEL}:generateContent?key=${KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));return{ok:r.ok,j};
}
async function gem(contents,sys,search){
  const body={contents};if(sys)body.systemInstruction={parts:[{text:sys}]};
  if(search)body.tools=[{google_search:{}}];
  let x=await post(body);
  if(!x.ok&&search){delete body.tools;x=await post(body)}   // model không hỗ trợ Search → trả lời không tra cứu
  if(!x.ok)throw new Error(x.j.error?.message||'Lỗi kết nối AI');
  const c=x.j.candidates?.[0];
  const text=(c?.content?.parts||[]).map(p=>p.text||'').join('').trim();
  const src=(c?.groundingMetadata?.groundingChunks||[]).map(g=>g.web).filter(Boolean).slice(0,4);
  return{text:text||'(Không có phản hồi)',src};
}

/* ---------- 1. API key + danh sách model ---------- */
$('#keyIn').value=KEY;
const kmsg=(t,ok)=>{$('#keyMsg').textContent=t;$('#keyMsg').className='msg'+(ok?' ok':'')};
$('#loadModels').onclick=async()=>{
  const k=$('#keyIn').value.trim();if(!k)return kmsg('Hãy dán API key trước.');
  kmsg('Đang tải danh sách model…',true);
  try{
    const r=await fetch(`${G}models?pageSize=200&key=${encodeURIComponent(k)}`);const j=await r.json();
    if(!r.ok)throw new Error(j.error?.message||'Key không hợp lệ');
    const ms=(j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace('models/','')).sort();
    const pick=ms.find(m=>m===store.get('lx_model'))||ms.find(m=>/^gemini-2\.5-flash$/.test(m))||ms.find(m=>/flash/.test(m))||ms[0];
    $('#modelSel').innerHTML=ms.map(m=>`<option ${m===pick?'selected':''}>${m}</option>`).join('');
    kmsg(`Tìm thấy ${ms.length} model. Hãy chọn model rồi bấm “Kiểm tra và kết nối”.`,true);
  }catch(e){kmsg('Lỗi: '+e.message)}
};
$('#testKey').onclick=async()=>{
  const k=$('#keyIn').value.trim(),m=$('#modelSel').value;
  if(!k||!m)return kmsg('Cần nhập key và tải/chọn model.');
  KEY=k;MODEL=m;kmsg('Đang kiểm tra…',true);
  try{await gem([{role:'user',parts:[{text:'Trả lời đúng một từ: OK'}]}]);
    store.set('lx_key',KEY);store.set('lx_model',MODEL);kmsg('Kết nối thành công ✔',true);
    setTimeout(()=>{stack=[];show(user?'home':'auth')},500);
  }catch(e){KEY=store.get('lx_key');MODEL=store.get('lx_model');kmsg('Không kết nối được: '+e.message)}
};

/* ---------- 2. Đăng nhập / đăng ký ---------- */
let reg=false;
const amsg=t=>$('#authMsg').textContent=t;
function authMode(r){reg=r;$('#authTitle').textContent=r?'Đăng ký':'Đăng nhập';$('#aName').hidden=!r;$('#aGo').textContent=r?'Tạo tài khoản':'Đăng nhập';$('#aSwap').textContent=r?'Đã có tài khoản? Đăng nhập':'Chưa có tài khoản? Đăng ký';amsg('')}
$('#aSwap').onclick=()=>authMode(!reg);
$('#aGo').onclick=async()=>{
  const email=$('#aMail').value.trim(),password=$('#aPass').value,name=$('#aName').value.trim()||email.split('@')[0];
  if(!email||password.length<6)return amsg('Nhập email và mật khẩu từ 6 ký tự.');
  amsg('Đang xử lý…');
  const {data,error}=reg?await sb.auth.signUp({email,password,options:{data:{name}}}):await sb.auth.signInWithPassword({email,password});
  if(error)return amsg(error.message);
  if(reg&&!data.session)return amsg('Đã gửi email xác nhận. Hãy xác nhận rồi đăng nhập.');
};
$('#outBtn').onclick=()=>sb.auth.signOut();
sb.auth.onAuthStateChange((_e,s)=>{const was=!!user;user=s?.user||null;if(user&&!was)enter();if(!user&&was)enter();$('#outBtn').hidden=!user});

/* ---------- 3. Chatbot + research ---------- */
const SYS=`Bạn là Trợ lý LOGX, chuyên gia Logistics và Chuỗi cung ứng với hơn 15 năm thực chiến. Trả lời mọi câu hỏi liên quan đến logistics, vận tải đa phương thức, kho vận (WMS, IQC, FIFO/FEFO, tồn kho an toàn), hải quan và thủ tục XNK, Incoterms 2020, mã HS, quy tắc xuất xứ, hiệp định thương mại (EVFTA, CPTPP, RCEP), CBAM, EUDR, GACC, bảo hiểm hàng hóa, chứng từ (Invoice, PL, B/L, C/O, VGM, ISPM 15) và cách dùng LOGX. Với thông tin có thể thay đổi (luật, thuế, cước, quy định mới) hãy chủ động dùng công cụ tìm kiếm. Cấu trúc: trả lời trực tiếp, giải thích/các bước, rồi dòng "Căn cứ:" ghi tên văn bản/quy tắc cụ thể. Không bịa số hiệu văn bản, điều, khoản; không chắc thì nói rõ. Nội dung pháp lý ghi: "Thông tin tham khảo, cần đối chiếu văn bản hiện hành". Giữ nguyên thuật ngữ tiếng Anh chuẩn (CBM, OTD, FOB...). Câu hỏi ngoài ngành: từ chối hài hước, duyên dáng trong tối đa 2 câu và kéo về chủ đề kho vận. Trả lời bằng ngôn ngữ người hỏi, mặc định tiếng Việt.`;
function bubble(cls,html){const d=document.createElement('div');d.className='b '+cls;d.innerHTML=html;$('#log').append(d);$('#log').scrollTop=1e9;return d}
async function send(text){
  text=(text||'').trim();if(!text)return;
  if(!KEY)return show('key');
  bubble('u',md(text));hist.push({role:'user',parts:[{text}]});
  const w=bubble('a','Đang tra cứu và soạn câu trả lời…');
  try{
    const r=await gem(hist.slice(-20),SYS,true);
    hist.push({role:'model',parts:[{text:r.text}]});
    w.innerHTML=md(r.text)+r.src.map(s=>`<a class="src" target="_blank" rel="noopener" href="${esc(s.uri)}">🔎 ${esc(s.title||s.uri)}</a>`).join('');
    if($('#optSpeak').checked)speak(r.text);
  }catch(e){hist.pop();w.textContent='⚠ '+e.message}
  $('#log').scrollTop=1e9;
}
$('#sendBtn').onclick=()=>{const t=$('#chatIn').value;$('#chatIn').value='';send(t)};
$('#chatIn').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#sendBtn').click()}};
$$('.chip').forEach(c=>c.onclick=()=>send(c.textContent));
$('#clearChat').onclick=()=>{hist=[];$('#log').innerHTML='';speechSynthesis.cancel()};
$('#stopSpeak').onclick=()=>speechSynthesis.cancel();
bubble('a','Xin chào! Em là Trợ lý LOGX. Bạn cứ hỏi về logistics, hải quan, Incoterms, xuất xứ, kho vận… hoặc bấm “Bật micro” để nói chuyện nhé.');

/* ---------- 4. Micro: nghe liên tục, chỉ tắt khi người dùng bấm ---------- */
let rec=null,micOn=false;
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function mic(on){
  if(on===micOn)return;
  const b=$('#micBtn'),m=$('#micMsg');
  if(!on){micOn=false;try{rec&&rec.stop()}catch{}b.textContent='🎤 Bật micro';b.classList.remove('rec');m.textContent='';return}
  if(!SR){m.textContent='Trình duyệt chưa hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome hoặc Edge.';return}
  rec=new SR();rec.lang='vi-VN';rec.continuous=true;rec.interimResults=true;
  rec.onresult=e=>{
    let fin='',tmp='';
    for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;e.results[i].isFinal?fin+=t:tmp+=t}
    if(speechSynthesis.speaking&&(fin||tmp.trim().split(/\s+/).length>=2)){speechSynthesis.cancel()}   // nói chen → dừng đọc
    const stop=/^\s*(dừng|stop|thôi|khoan)\s*[.!]?\s*$/i;
    if(fin&&stop.test(fin)){speechSynthesis.cancel();$('#chatIn').value='';return}
    if(fin){if($('#optAuto').checked){$('#chatIn').value='';send(fin)}else $('#chatIn').value+=(($('#chatIn').value?' ':'')+fin.trim())}
    else if(!$('#optAuto').checked||tmp)$('#chatIn').placeholder='Đang nghe: '+tmp;
  };
  rec.onend=()=>{if(micOn)setTimeout(()=>{try{rec.start()}catch{}},150)};          // tự nghe lại, không tự tắt
  rec.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){micOn=false;b.textContent='🎤 Bật micro';b.classList.remove('rec');m.textContent='Chưa được cấp quyền micro. Hãy bấm biểu tượng ổ khóa trên thanh địa chỉ và cho phép micro.'}};
  micOn=true;try{rec.start()}catch{}
  b.textContent='⏹ Tắt micro';b.classList.add('rec');m.textContent='Micro đang bật và sẽ nghe liên tục cho đến khi bạn bấm tắt. Nên dùng tai nghe để tránh loa tự ngắt lời.';m.className='msg ok';
}
$('#micBtn').onclick=()=>mic(!micOn);

/* ---------- 5. Đọc to: tiếng Việt + từ tiếng Anh đọc đúng giọng Anh ---------- */
let voices=[];const loadV=()=>voices=speechSynthesis.getVoices();loadV();speechSynthesis.onvoiceschanged=loadV;
const pickV=l=>voices.find(v=>v.lang.replace('_','-').toLowerCase().startsWith(l));
const VN=/^(ngh|ng|nh|ch|gh|gi|kh|ph|th|tr|qu|[bcdghklmnpqrstvx])?[aeiouy]{1,3}(ch|ng|nh|c|m|n|p|t)?$/i;
function segs(t){
  const out=[];
  t.split(/(\s+)/).forEach(w=>{
    const core=w.replace(/[^\p{L}\p{N}]/gu,'');let lang='vi-VN',s=w;
    if(/^[A-Z0-9]{2,}$/.test(core)&&/[A-Z]/.test(core)){lang='en-US';s=w.replace(core,core.split('').join(' '))}   // CBM → "C B M"
    else if(/^[A-Za-z]{3,}$/.test(core)&&!VN.test(core))lang='en-US';
    const last=out[out.length-1];
    if(last&&(last[0]===lang||!w.trim()))last[1]+=s;else out.push([lang,s]);
  });
  return out;
}
function speak(text){
  if(!window.speechSynthesis)return;speechSynthesis.cancel();
  const clean=text.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/[*_#`>|]/g,' ').replace(/\n+/g,'. ');
  clean.split(/(?<=[.!?;:])\s+/).forEach(sen=>segs(sen).forEach(([lang,txt])=>{
    if(!txt.trim())return;
    const u=new SpeechSynthesisUtterance(txt);u.lang=lang;const v=pickV(lang.slice(0,2));if(v)u.voice=v;u.rate=1;speechSynthesis.speak(u);
  }));
}

/* ---------- 6. OCR bằng Gemini (ảnh + PDF) ---------- */
const OCR_PROMPT=`Bạn là hệ thống OCR cho chứng từ logistics. Đọc toàn bộ nội dung trong ảnh/PDF và trả về tiếng Việt:
1. Loại chứng từ.
2. Các trường chính: số chứng từ, ngày, Shipper, Consignee, Notify Party, Incoterms, tiền tệ, POL, POD, tàu/chuyến, số container, số seal.
3. Bảng dòng hàng: mô tả, SKU, số lượng, đơn giá, thành tiền, N.W, G.W, kích thước, số kiện.
4. Có chữ ký/con dấu không. Ghi rõ chỗ mờ hoặc chưa chắc chắn, không tự bịa số liệu.
5. Gợi ý mã HS 8 số (kèm cảnh báo cần đối chiếu biểu thuế) và các điểm bất thường cần kiểm tra.`;
const b64=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result.split(',')[1]);r.onerror=no;r.readAsDataURL(f)});
async function ocr(file){
  if(!file)return;if(!KEY)return show('key');
  if(file.size>15*1024*1024)return toast('Tệp quá lớn (tối đa 15 MB).');
  const img=$('#ocrImg'),out=$('#ocrOut');
  if(file.type.startsWith('image/')){img.src=URL.createObjectURL(file);img.hidden=false}else img.hidden=true;
  out.hidden=false;out.textContent='Đang đọc chứng từ…';$('#ocrAsk').hidden=true;
  try{
    const data=await b64(file);
    const r=await gem([{role:'user',parts:[{inline_data:{mime_type:file.type||'application/pdf',data}},{text:OCR_PROMPT}]}]);
    ocrText=r.text;out.innerHTML=md(r.text);$('#ocrAsk').hidden=false;
  }catch(e){out.textContent='⚠ '+e.message}
}
$('#ocrCam').onchange=e=>{ocr(e.target.files[0]);e.target.value=''};
$('#ocrFile').onchange=e=>{ocr(e.target.files[0]);e.target.value=''};
$('#ocrAsk').onclick=()=>{show('chat');send('Dưới đây là nội dung OCR của chứng từ tôi vừa quét. Hãy kiểm tra điểm bất thường, rủi ro hải quan và việc cần làm tiếp theo:\n\n'+ocrText)};

/* ---------- 7. Diễn đàn realtime + hiện người đang trực tuyến ---------- */
let chPosts=null,chPres=null;
const postHtml=p=>`<div class="post" data-id="${p.id}">${p.user_id===user?.id?'<button class="btn ghost del">Xóa</button>':''}<b>${esc(p.author)}</b> <small>${new Date(p.created_at).toLocaleString('vi-VN')}</small><div>${md(p.content)}</div></div>`;
async function openForum(){
  if(chPosts||!user)return;
  const {data,error}=await sb.from('posts').select('*').order('created_at',{ascending:false}).limit(50);
  if(error)$('#posts').innerHTML='<p class="msg">Chưa đọc được dữ liệu. Hãy chạy file supabase/schema.sql. ('+esc(error.message)+')</p>';
  else $('#posts').innerHTML=data.map(postHtml).join('')||'<p class="msg ok">Chưa có bài nào. Hãy là người đăng bài đầu tiên.</p>';
  chPosts=sb.channel('posts-live').on('postgres_changes',{event:'*',schema:'public',table:'posts'},p=>{
    if(p.eventType==='INSERT'){if(!$(`[data-id="${p.new.id}"]`))$('#posts').insertAdjacentHTML('afterbegin',postHtml(p.new))}
    if(p.eventType==='DELETE'&&p.old?.id)$(`[data-id="${p.old.id}"]`)?.remove();
  }).subscribe();
  chPres=sb.channel('online',{config:{presence:{key:user.id}}});
  chPres.on('presence',{event:'sync'},()=>{const n=Object.values(chPres.presenceState()).flat().map(x=>x.name);$('#online').textContent=`🟢 ${n.length} người đang trực tuyến: ${[...new Set(n)].join(', ')}`})
    .subscribe(s=>{if(s==='SUBSCRIBED')chPres.track({name:user.user_metadata?.name||user.email})});
}
function closeForum(){if(chPosts){sb.removeChannel(chPosts);chPosts=null}if(chPres){sb.removeChannel(chPres);chPres=null}}
$('#postBtn').onclick=async()=>{
  const content=$('#postIn').value.trim();if(!content||!user)return;
  const {error}=await sb.from('posts').insert({content,author:user.user_metadata?.name||user.email});
  if(error)toast('Không đăng được: '+error.message);else $('#postIn').value='';
};
$('#posts').onclick=async e=>{
  if(!e.target.classList.contains('del'))return;
  const id=e.target.closest('.post').dataset.id;
  const {error}=await sb.from('posts').delete().eq('id',id);if(error)toast(error.message);
};

/* ---------- Khởi động ---------- */
sb.auth.getSession().then(({data})=>{user=data.session?.user||null;enter()});
addEventListener('beforeunload',()=>{try{speechSynthesis.cancel();rec&&rec.stop()}catch{}});
