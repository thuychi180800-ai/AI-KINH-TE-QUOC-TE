/* LOGX – Phân tích lô hàng 2.1 · Kho (SS/ROP, 3-Way Match, bin) · Luật & Hiệp ước + PDF */
(()=>{
const $=s=>document.querySelector(s),n2=(x,d=2)=>(+x).toLocaleString('vi-VN',{maximumFractionDigits:d});
const lines=id=>$(id).value.split('\n').map(l=>l.split(';').map(x=>x.trim())).filter(a=>a.length>1&&a[0]);
const cc=c=>c>=90?'cg':c>=70?'cy':'cr';
const table=(h,rows)=>`<div class="wrap"><table class="tbl"><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</table></div>`;

/* ===== 1. PHÂN TÍCH LÔ HÀNG ===== */
const RATE={A:.0035,B:.0025,C:.0018},MULT={perishable:1.5,highValue:1.3,dg:1.6};   // tỷ lệ minh họa – cấu hình theo biểu phí thực tế
const SAMPLE=`COMMERCIAL INVOICE No. INV-2026-0815, date 2026-08-15
Shipper: ABC Electronics Co., Shenzhen. Consignee: LogX Trading JSC, Ho Chi Minh City
Incoterms: FOB Shenzhen. Currency: USD. POL: Shenzhen. POD: Cat Lai
1) Lithium-ion battery pack 48V, qty 200 pcs, USD 85/pc, N.W 600 lb, G.W 720 lb, carton 60x40x30 cm x 20 cartons
2) LED display module 15 inch, qty 500 pcs, USD 32/pc, N.W 450 kg, G.W 520 kg, carton 50x40x25 cm x 25 cartons
Freight USD 2400. Document signed and stamped.`;
const PROMPT=`Bạn là chuyên gia hải quan/logistics. Từ chứng từ dưới đây, trả về DUY NHẤT một JSON hợp lệ, không giải thích:
{"docs":{"invoiceNo":"","incoterms":"","currency":""},"parties":{"shipper":"","consignee":""},"pol":"","pod":"","freight":0,
"lines":[{"desc":"","qty":0,"uom":"","unitPrice":0,"nw_kg":0,"gw_kg":0,"cbm":0,"hs":[{"code8":"","conf":0,"reason":""}]}],
"auth":{"signature":true,"stamp":true,"issues":[""]},
"risk":{"perishable":false,"highValue":false,"dg":{"isDG":false,"un":"","class":""}},
"predict":{"delayProb":0,"lane":"green|yellow|red","damage":"low|medium|high","reasons":["","",""]}}
Quy tắc: quy đổi lb→kg (×0,45359237), tấn→kg (×1000), cm→CBM = D×R×C/1.000.000 × số kiện. hs có 3 ứng viên mã HS 8 số, conf 0–100, sắp giảm dần. highValue khi giá trị lô ≥ 50.000 USD hoặc điện tử/trang sức. Phát hiện pin lithium/hóa chất = DG (UN, class IMDG). delayProb 0–100. Không bịa số liệu không có trong chứng từ.
CHỨNG TỪ:\n`;
let SH=null;
async function shipRun(){
  const t=$('#shIn').value.trim();if(!t)return toast('Hãy dán nội dung chứng từ hoặc nạp demo.');if(!KEY)return show('key');
  $('#shOut').innerHTML='<p class="msg ok">AI đang trích xuất và phân tích…</p>';
  try{
    const x=await post({contents:[{role:'user',parts:[{text:PROMPT+t}]}],generationConfig:{responseMimeType:'application/json'}});
    if(!x.ok)throw new Error(x.j.error?.message||'Lỗi AI');
    SH=JSON.parse((x.j.candidates[0].content.parts.map(p=>p.text||'').join('')).replace(/```json|```/g,'').trim());
    shipRender(SH);
  }catch(e){$('#shOut').innerHTML='<p class="msg">⚠ '+esc(e.message)+'</p>'}
}
function shipRender(J){
  const L=J.lines||[],goods=L.reduce((a,l)=>a+(+l.qty||0)*(+l.unitPrice||0),0),inc=(J.docs?.incoterms||'').toUpperCase(),fr=+J.freight||0,R=J.risk||{},dg=R.dg?.isDG;
  const mult=(R.perishable?MULT.perishable:1)*(R.highValue?MULT.highValue:1)*(dg?MULT.dg:1);
  const ins=['A','B','C'].map(c=>{const r=RATE[c]*mult;
    const cif=/CIF/.test(inc)?goods:/CFR|CNF/.test(inc)?goods/(1-1.1*r):/FOB|FCA|EXW|FAS/.test(inc)?(goods+fr)/(1-1.1*r):goods+fr;
    return{c,r,cif,iv:cif*1.1,pr:cif*1.1*r}});
  const rec=(R.perishable||R.highValue||dg)?'A':'B';
  const P=J.predict||{},lane={green:'Xanh',yellow:'Vàng',red:'Đỏ'}[P.lane]||P.lane;
  $('#shOut').innerHTML=`<h2>Dòng hàng và mã HS</h2>`+table(['Mô tả','SL','Đơn giá','N.W kg','G.W kg','CBM','HS 8 số (độ tin cậy)'],
    L.map(l=>[esc(l.desc||''),n2(l.qty,0)+' '+esc(l.uom||''),n2(l.unitPrice),n2(l.nw_kg),n2(l.gw_kg),n2(l.cbm,3),
      (l.hs||[]).map((h,i)=>`<span class="${cc(h.conf)}" title="${esc(h.reason||'')}">${i?'':'<b>'}${esc(h.code8)} (${n2(h.conf,0)}%)${i?'':'</b>'}</span>`).join('<br>')]))
  +`<p class="msg">Gợi ý của AI – cần đối chiếu Biểu thuế hiện hành hoặc xác định trước mã số. Độ tin cậy dưới 70% cần người dùng xác nhận.</p>
  <h2>Xác thực chứng từ</h2><p>Chữ ký: <b class="${J.auth?.signature?'cg':'cr'}">${J.auth?.signature?'Có':'Không'}</b> · Con dấu: <b class="${J.auth?.stamp?'cg':'cr'}">${J.auth?.stamp?'Có':'Không'}</b>${(J.auth?.issues||[]).filter(Boolean).map(i=>'<br>• '+esc(i)).join('')}</p>
  <h2>Phân loại rủi ro</h2><p>Hàng dễ hỏng: <b class="${R.perishable?'cr':'cg'}">${R.perishable?'Có':'Không'}</b> · Giá trị cao: <b class="${R.highValue?'cy':'cg'}">${R.highValue?'Có':'Không'}</b> · Nguy hiểm (DG): <b class="${dg?'cr':'cg'}">${dg?`Có – UN ${esc(R.dg.un||'?')}, Class ${esc(R.dg.class||'?')}`:'Không'}</b>${dg?'<br>Yêu cầu MSDS, DG Declaration, nhãn nguy hiểm, quy tắc cách ly.':''}</p>
  <h2>Bảo hiểm (Giá trị bảo hiểm = CIF × 110%)</h2>`+table(['Điều kiện','Tỷ lệ phí','CIF','Giá trị bảo hiểm','Phí bảo hiểm'],ins.map(i=>[`ICC (${i.c})${i.c===rec?' <b class="cg">đề xuất</b>':''}`,n2(i.r*100,3)+'%',n2(i.cif),n2(i.iv),n2(i.pr)]))
  +`<p class="msg">Incoterms ${esc(inc||'?')}: FOB/CFR được quy đổi về CIF trước khi tính. Tỷ lệ phí là giá trị minh họa (bảng RATE × hệ số rủi ro ${n2(mult)}), cần thay bằng biểu phí thực tế.</p>
  <h2>Dự đoán</h2><p>Xác suất chậm trễ: <b>${n2(P.delayProb,0)}%</b> · Luồng hải quan dự kiến: <b>${esc(lane||'?')}</b> · Rủi ro hư hại: <b>${esc(P.damage||'?')}</b></p>
  <ol>${(P.reasons||[]).map(r=>`<li>${esc(r)}</li>`).join('')}</ol>
  <details><summary>JSON dữ liệu</summary><pre class="out card">${esc(JSON.stringify(J,null,1))}</pre></details>`;
}
$('#shDemo').onclick=()=>$('#shIn').value=SAMPLE;
$('#shRun').onclick=shipRun;
$('#ocrDeep').onclick=()=>{$('#shIn').value=ocrText;show('ship');shipRun()};

/* ===== 2. KHO ===== */
$('#whIn').value=`SKU-A1;520;40;8;14;3
SKU-B2;180;25;6;21;5
SKU-C3;1400;60;12;10;2
SKU-D4;90;12;4;30;7`;
$('#twIn').value=`SKU-A1;100;100;100;1200;1210;1215
SKU-B2;50;50;48;800;800;830
SKU-C3;200;200;200;3000;3050;3051`;
$('#whRun').onclick=()=>{
  const Z=+$('#whZ').value;
  $('#whOut').innerHTML=table(['SKU','Tồn','d̄','σd','L̄','σL','Safety Stock','ROP','Trạng thái','Đề xuất đặt'],lines('#whIn').map(a=>{
    const [sku,st,d,sd,L,sl]=[a[0],...a.slice(1,6).map(Number)],ss=Z*Math.sqrt(L*sd*sd+d*d*sl*sl),rop=d*L+ss;
    const s=st<=rop?['Dưới ROP – cần đặt','cr']:st<=rop*1.2?['Sắp chạm ROP','cy']:['Đủ','cg'];
    return[esc(sku),n2(st,0),d,sd,L,sl,n2(ss,0),n2(rop,0),`<b class="${s[1]}">${s[0]}</b>`,st<=rop*1.2?n2(Math.ceil(rop+d*L-st),0):'—']}))
  +'<p class="msg">Safety Stock = Z × √(L̄·σd² + d̄²·σL²); ROP = d̄ × L̄ + Safety Stock; đề xuất đặt = ROP + d̄ × L̄ − tồn (đưa tồn về mức đặt hàng).</p>';
};
$('#twRun').onclick=()=>{
  const df=(a,b)=>b?Math.abs(a-b)/b*100:0;
  $('#twOut').innerHTML=table(['SKU','SL PO/Inv/PL','kg PO/Inv/PL','Lệch kg lớn nhất','Kết quả'],lines('#twIn').map(a=>{
    const [q1,q2,q3,w1,w2,w3]=a.slice(1,7).map(Number),d=Math.max(df(w2,w1),df(w3,w2),df(w3,w1)),qok=q1===q2&&q2===q3;
    const r=!qok||d>2?['Sai lệch','cr']:d>1.5?['Cảnh báo','cy']:['Khớp','cg'];
    return[esc(a[0]),`${q1}/${q2}/${q3}`,`${w1}/${w2}/${w3}`,n2(d)+'%',`<b class="${r[1]}">${r[0]}</b>`]}))
  +'<p class="msg">Lệch trọng lượng = |W<sub>A</sub> − W<sub>B</sub>| ÷ W<sub>B</sub> × 100%, tính cho từng cặp; ngưỡng cảnh báo 2%.</p>';
};
(()=>{
  let seed=7;const rnd=()=>(seed=(seed*9301+49297)%233280)/233280;const g=$('#bins');
  for(let r=0;r<6;r++)for(let c=0;c<12;c++){
    const u=Math.round(35+rnd()*65),k=u<80?'g':u<=90?'y':'r',b=document.createElement('button');
    b.className='bin '+k;b.title=u+'%';b.setAttribute('aria-label','Bin '+u+'%');
    b.onclick=()=>$('#binInfo').textContent=`${'ABCDEF'[r]}-${String(c+1).padStart(2,'0')}-R${r+10}-L${c%3+1}-B0${c%5+1} · sử dụng ${u}% · ${u<80?'còn trống':u<=90?'sắp đầy':'đầy'}`;
    g.append(b);
  }
})();

/* ===== 3. LUẬT & HIỆP ƯỚC ===== */
const LV='10/2026 (theo tài liệu đặc tả, cần đối chiếu văn bản hiện hành)';
const LEGAL=[
{id:'EVFTA',name:'EVFTA (Việt Nam – EU)',eff:'Hiệu lực 01/08/2020',pts:'Cắt giảm thuế theo lộ trình; xuất xứ chứng minh bằng EUR.1 hoặc tờ khai của nhà xuất khẩu đủ điều kiện/đăng ký (REX); quy tắc xuất xứ theo từng mặt hàng (PSR).',doc:'EUR.1 / tờ khai REX',src:'Hiệp định EVFTA – Chương Quy tắc xuất xứ',todo:['Xác định mã HS và quy tắc xuất xứ (PSR)','Chuẩn bị EUR.1 hoặc tờ khai xuất xứ (REX)','Lưu hồ sơ chứng minh xuất xứ nguyên liệu']},
{id:'CPTPP',name:'CPTPP',eff:'Áp dụng với Việt Nam từ 14/01/2019',pts:'Ưu đãi thuế quan; cơ chế tự chứng nhận xuất xứ; quy tắc xuất xứ cộng gộp.',doc:'Tự chứng nhận xuất xứ',src:'Hiệp định CPTPP – Chương Quy tắc xuất xứ',todo:['Xác định quy tắc xuất xứ cộng gộp','Lập tự chứng nhận xuất xứ đúng mẫu']},
{id:'RCEP',name:'RCEP',eff:'Hiệu lực với Việt Nam từ 01/01/2022',pts:'Quy tắc xuất xứ cộng gộp toàn khối; chứng nhận bằng C/O RCEP hoặc tờ khai của nhà xuất khẩu đủ điều kiện.',doc:'C/O RCEP / tờ khai xuất xứ',src:'Hiệp định RCEP – Chương Quy tắc xuất xứ',todo:['Chọn C/O RCEP hoặc tờ khai nhà xuất khẩu đủ điều kiện','So sánh mức ưu đãi RCEP với các FTA khác']},
{id:'CBAM',name:'EU CBAM',eff:'Chuyển tiếp 10/2023–12/2025; chính thức từ 01/01/2026',pts:'Xi măng, sắt thép, nhôm, phân bón, điện, hydro. Nhà nhập khẩu vượt 50 tấn/năm phải là Authorised CBAM Declarant; tờ khai năm đầu (hàng nhập 2026) hạn 30/09/2027; cần dữ liệu phát thải nhúng từ nhà sản xuất.',doc:'Dữ liệu phát thải nhúng',src:'Quy định (EU) 2023/956, sửa đổi bởi Quy định (EU) 2025/2083',todo:['Thu thập dữ liệu phát thải nhúng từ nhà sản xuất','Xác nhận đối tác EU là Authorised CBAM Declarant','Theo dõi ngưỡng 50 tấn/năm']},
{id:'EUDR',name:'EU EUDR',eff:'Từ 30/12/2026 (lớn/vừa); 30/06/2027 (vi mô/nhỏ)',pts:'Gia súc, ca cao, cà phê, dầu cọ, cao su, đậu tương, gỗ và sản phẩm dẫn xuất. Yêu cầu thẩm định, tọa độ địa lý lô đất, tuyên bố thẩm định (DDS).',doc:'Tuyên bố thẩm định (DDS), tọa độ lô đất',src:'Quy định (EU) 2023/1115, sửa đổi bởi Quy định (EU) 2025/2650',todo:['Thu thập tọa độ địa lý từng lô đất trồng','Lập hồ sơ thẩm định chuỗi cung ứng','Cung cấp thông tin để nhà nhập khẩu EU lập DDS']},
{id:'GACC',name:'GACC (Hải quan Trung Quốc)',eff:'Lệnh 248 và 249 áp dụng từ 01/01/2022',pts:'Đăng ký cơ sở sản xuất thực phẩm nước ngoài, quản lý an toàn thực phẩm nhập khẩu; mã đăng ký, nhãn tiếng Trung, kiểm dịch nông thủy sản.',doc:'Mã đăng ký GACC, nhãn tiếng Trung',src:'Lệnh 248 và 249 của GACC',todo:['Kiểm tra cơ sở đã đăng ký GACC','Làm nhãn tiếng Trung đúng quy định','Chuẩn bị hồ sơ kiểm dịch']}];
$('#lgCards').innerHTML=LEGAL.map(l=>`<details class="card" style="margin:8px 0"><summary><b>${l.name}</b> · ${l.eff}</summary><p>${l.pts}</p><p>Chứng từ: ${l.doc}<br>Căn cứ: ${l.src}<br>Xác minh cuối: ${LV}</p></details>`).join('');
const AX=['Thuế và ưu đãi','Xuất xứ (RoO)','SPS/TBT','Môi trường và bền vững','Đăng ký và giấy phép','Chứng từ và khai báo'];
let DG=null;
function diagnose(){
  const dir=$('#lgDir').value,ind=$('#lgInd').value,mk=$('#lgMk').value,xk=dir==='Xuất khẩu',ids=[];
  if(mk==='EU')ids.push('EVFTA');if(['Nhật Bản','Úc'].includes(mk))ids.push('CPTPP','RCEP');if(['Trung Quốc','Hàn Quốc','ASEAN'].includes(mk))ids.push('RCEP');
  if(mk==='EU'&&xk&&ind==='Thép/Nhôm')ids.push('CBAM');if(mk==='EU'&&xk&&['Cà phê/Cao su','Gỗ'].includes(ind))ids.push('EUDR');if(mk==='Trung Quốc'&&xk&&ind==='Nông sản')ids.push('GACC');
  const a=[25,25,25,25,25,25],has=i=>ids.includes(i);
  if(ids.some(i=>['EVFTA','CPTPP','RCEP'].includes(i))){a[0]-=10;a[1]+=20}if(mk==='Hoa Kỳ'){a[0]+=25;a[5]+=10}
  if(has('CBAM')){a[3]+=45;a[5]+=20}if(has('EUDR')){a[3]+=50;a[4]+=25;a[5]+=15}if(has('GACC')){a[2]+=35;a[4]+=40}
  if(ind==='Điện tử')a[2]+=25;if(ind==='Nông sản')a[2]+=30;if(ind==='Dệt may')a[1]+=15;
  const sc=a.map(v=>Math.max(0,Math.min(100,v))),tot=Math.round(sc.reduce((x,y)=>x+y,0)/6),lv=tot<35?['Thấp','cg']:tot<65?['Trung bình','cy']:['Cao','cr'];
  const top=sc.map((v,i)=>[v,AX[i]]).sort((x,y)=>y[0]-x[0]).slice(0,3).map(x=>x[1]);
  const items=[];
  ids.forEach(i=>{const l=LEGAL.find(x=>x.id===i);l.todo.forEach(t=>items.push({g:l.name,t,doc:l.doc,src:l.src,p:'Cao',h:'Trước khi khai báo',o:'Bộ phận chứng từ'}))});
  [['Xác định mã HS chính xác','Phiếu phân loại HS','Biểu thuế hiện hành'],['Kiểm tra Incoterms và điều khoản thanh toán','Hợp đồng','Incoterms® 2020 – ICC'],['Chuẩn bị Invoice, Packing List, B/L đầy đủ','Bộ chứng từ','Quy định hải quan hiện hành'],['Lưu ảnh đóng gói và xếp hàng','Ảnh, biên bản','Quy trình nội bộ']].forEach(x=>items.push({g:'Chung',t:x[0],doc:x[1],src:x[2],p:'TB',h:'Trước khi giao hàng',o:'Kho vận'}));
  DG={dir,ind,mk,ids,sc,tot,lv,top,items,done:items.map(()=>false),id:'LX-RP-'+Date.now().toString(36).toUpperCase()};render();
}
function render(){
  const D=DG,pct=Math.round(D.done.filter(Boolean).length/D.items.length*100);
  $('#lgOut').innerHTML=`<div class="card"><h2 style="margin-top:0">Điểm rủi ro: <span class="${D.lv[1]}">${D.tot}/100 – ${D.lv[0]}</span></h2>
   <p>Hiệp định/quy định áp dụng: <b>${D.ids.join(', ')||'chưa xác định'}</b> · Yếu tố chính: ${D.top.join(', ')}</p>
   ${D.sc.map((v,i)=>`<div>${AX[i]}: ${v}<div class="bar2"><i style="width:${v}%;background:${v<35?'#14b8a6':v<65?'#f59e0b':'#ef4444'}"></i></div></div>`).join('')}</div>
   <h2>Actionable Checklist · Sẵn sàng tuân thủ: <span class="cg">${pct}%</span></h2>`+table(['✔','Nhóm','Việc cần làm','Chứng từ','Căn cứ','Ưu tiên','Hạn','Phụ trách'],
   D.items.map((x,i)=>[`<input type="checkbox" data-i="${i}" ${D.done[i]?'checked':''}>`,x.g,x.t,x.doc,x.src,x.p,x.h,x.o]))
   +'<p class="msg">Gợi ý của AI – cần xác nhận của người có thẩm quyền. Thông tin tham khảo, kiểm tra văn bản gốc trước khi áp dụng.</p><button id="lgPdf" class="btn gold">Xuất báo cáo PDF</button>';
  document.querySelectorAll('#lgOut [data-i]').forEach(c=>c.onchange=()=>{DG.done[+c.dataset.i]=c.checked;render()});
  $('#lgPdf').onclick=()=>{$('#pdfPage').innerHTML=report();$('#pdfModal').hidden=false};
}
function report(){
  const D=DG,pct=Math.round(D.done.filter(Boolean).length/D.items.length*100);
  return `<div class="seal">⚓ LOGX<br>Báo cáo chẩn đoán</div><h1 style="font-size:20pt">LOGX – Báo cáo chẩn đoán rủi ro hải quan</h1>
  <p>Chiều: <b>${D.dir}</b> · Ngành hàng: <b>${D.ind}</b> · Thị trường: <b>${D.mk}</b><br>Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} · Mã báo cáo: ${D.id}</p>
  <h2>1. Điểm rủi ro: ${D.tot}/100 – ${D.lv[0]}</h2>`+table(['Trục rủi ro','Điểm'],D.sc.map((v,i)=>[AX[i],v]))
  +`<p>Yếu tố chính: ${D.top.join(', ')}.</p><h2>2. Hiệp định/quy định áp dụng</h2>`
  +(D.ids.length?table(['Tên','Hiệu lực','Căn cứ'],D.ids.map(i=>{const l=LEGAL.find(x=>x.id===i);return[l.name,l.eff,l.src]})):'<p>Chưa xác định hiệp định áp dụng.</p>')
  +`<h2>3. Checklist (sẵn sàng ${pct}%)</h2>`+table(['','Việc cần làm','Chứng từ','Ưu tiên'],D.items.map((x,i)=>[D.done[i]?'☑':'☐',x.t,x.doc,x.p]))
  +`<h2>4. Miễn trừ trách nhiệm</h2><p>Báo cáo do AI gợi ý, chỉ có tính tham khảo, không thay thế tư vấn pháp lý hoặc xác nhận của cơ quan có thẩm quyền. Xác minh cuối: ${LV}.</p><p style="text-align:center">LOGX · ${D.id} · Trang 1</p>`;
}
const fname=()=>'Baocao_ChanDoan_LOGX_'+DG.ind.replace(/đ/g,'d').replace(/Đ/g,'D').normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/[^A-Za-z0-9]+/).filter(Boolean).map(w=>w[0].toUpperCase()+w.slice(1).toLowerCase()).join('')+'.pdf';
$('#pdfDl').onclick=async()=>{
  if(!window.html2pdf)return toast('Chưa tải được thư viện html2pdf.');
  const y=scrollY,st=document.createElement('div');st.id='pdf-stage';st.className='rp';
  st.style.cssText='position:absolute;left:0;top:0;width:794px;background:#fff;color:#000;transform:none;filter:none;opacity:1;z-index:-1;margin:0';
  st.innerHTML=report();document.body.append(st);scrollTo(0,0);
  try{
    await document.fonts.ready;
    if(st.scrollHeight<50)throw new Error('Nội dung báo cáo trống');
    await html2pdf().set({margin:[10,10,12,10],filename:fname(),image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0,windowWidth:794},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy'],avoid:['tr','h2']}}).from(st).save();
    toast('Đã tạo PDF');
  }catch(e){toast('Không tạo được PDF: '+e.message)}finally{st.remove();scrollTo(0,y)}
};
$('#pdfClose').onclick=()=>$('#pdfModal').hidden=true;
$('#lgRun').onclick=diagnose;
})();
