import type { Store } from "./db.js";
export function renderDashboard() {
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 <title>Central de agentes | EComerce</title><style>
 :root{color-scheme:light;--bg:#f6f7f9;--card:#fff;--line:#dfe3e8;--ink:#1e2934;--muted:#626c79;--accent:#34465c}
 *{box-sizing:border-box}body{background:var(--bg);color:var(--ink);font:14px system-ui,Arial;margin:0}
 header{background:#202a36;color:#fff;padding:21px max(24px,calc((100vw - 1150px)/2));display:flex;align-items:center;justify-content:space-between}
 header h1{font-size:19px;margin:0}header small{color:#cbd5e1}
 main{max-width:1150px;margin:25px auto;padding:0 18px;display:grid;grid-template-columns:1fr 1fr;gap:18px}
 section{background:var(--card);border:1px solid var(--line);border-radius:7px;padding:20px;min-width:0}
 h2{font-size:17px;margin:0 0 14px}h3{font-size:14px;margin:18px 0 10px}
 label{display:block;font-weight:600;font-size:12px;color:#475569;margin:12px 0 5px}
 input,select,textarea{font:inherit;width:100%;padding:10px;border:1px solid #cbd5df;border-radius:5px;background:#fff;color:var(--ink)}
 textarea{min-height:90px;resize:vertical}button{border:0;border-radius:5px;padding:10px 15px;background:var(--accent);color:white;cursor:pointer;margin-top:12px}
 button.secondary{background:#e9edf2;color:#233044}button:disabled{opacity:.5}
 .full{grid-column:1/-1}.muted{color:var(--muted)}.item{display:block;width:100%;text-align:left;border:1px solid var(--line);padding:12px;border-radius:5px;margin:8px 0;background:#f8fafc;color:var(--ink)}
 .item.active{border-color:#52677b;background:#e8eff6}.flex{display:flex;gap:10px;align-items:center}.flex>*{flex:1}
 .row{display:flex;align-items:center;justify-content:space-between;gap:10px}.notice{padding:10px;border:1px solid var(--line);margin:10px 0;border-radius:5px}
 .bubble{padding:9px 12px;background:#f2f4f7;margin:7px 0;border-radius:6px;white-space:pre-wrap}
 .bubble.assistant{background:#e8edf4;margin-left:25px}.bubble.user{margin-right:25px}
 @media(max-width:800px){main{display:block}section{margin-bottom:16px}}
 </style></head><body><header><h1>Central de agentes <small>V1</small></h1><small>Atendimento multiloja</small></header>
 <main><section><div class="row"><h2>Estabelecimentos</h2><button type="button" id="new" class="secondary">Nova loja</button></div><div id="stores">Carregando...</div>
 <h3>Webhook da Meta</h3><p class="muted">URL: <code id="webhook"></code><br>Configure o token de verificação global no ambiente do servidor.</p></section>
 <section><h2>Configurar vendedor</h2><p class="muted">O número, as credenciais e a personalidade são independentes para cada loja.</p>
 <form id="editor">
 <label>Nome da loja</label><input name="name" required maxlength="100">
 <label>URL da loja (HTTPS)</label><input name="storeUrl" type="url" required placeholder="https://loja.exemplo">
 <div class="flex"><div><label>Número do WhatsApp (com DDI)</label><input name="whatsappNumber" required placeholder="5551999999999"></div><div><label>Phone Number ID (Meta)</label><input name="phoneId" required></div></div>
 <label>Token da API oficial do WhatsApp</label><input name="whatsappToken" type="password" autocomplete="new-password" placeholder="Preencher na criação ou ao trocar">
 <label>Chave da API do EComerce</label><input name="commerceKey" type="password" autocomplete="new-password" placeholder="Preencher na criação ou ao trocar">
 <div class="flex"><div><label>Tom de voz</label><select name="tone"><option value="descontraído e consultivo">Descontraído e consultivo</option><option value="formal e objetivo">Formal e objetivo</option><option value="acolhedor e paciente">Acolhedor e paciente</option><option value="direto e técnico">Direto e técnico</option></select></div><div><label>Status do agente</label><select name="enabled"><option value="false">Desativado</option><option value="true">Ativo</option></select></div></div>
 <label>Orientações de venda / personalidade</label><textarea name="instructions" maxlength="1500" placeholder="Ex.: trate o cliente por você, não insista após uma recusa, destaque produtos nacionais..."></textarea>
 <label><input name="emojis" type="checkbox" style="width:auto" checked> Permitir emojis discretos</label>
 <label><input name="upsell" type="checkbox" style="width:auto" checked> Sugerir complementos quando fizer sentido</label>
 <button type="submit">Salvar configurações</button><p id="result" role="status" class="muted"></p></form>
 </section>
 <section class="full"><h2>Atendimentos</h2><div class="flex"><div><label>Loja</label><select id="conversationStore"></select></div><div><button id="refresh" type="button" class="secondary">Atualizar</button></div></div><div class="flex"><div id="conversationList"></div><div id="messages" style="min-height:100px"></div></div></section></main>
 <script>
 let stores=[],selected=null,selectedConversation=null;
 const $=id=>document.getElementById(id);
 async function api(path, method='GET', body){
  const res=await fetch('/admin/api'+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Falha na operação');return data;
 }
 function escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function formValue(form,name){return form.elements.namedItem(name).value;}
 function loadForm(store){
  selected=store?.id||null;const f=$('editor');f.reset();
  for(const item of $('stores').querySelectorAll('.item'))item.classList.toggle('active',item.dataset.id===selected);
  if(!store)return;
  for(const [key,value] of Object.entries({name:store.name,storeUrl:store.store_url,whatsappNumber:store.whatsapp_number,phoneId:store.whatsapp_phone_id,tone:store.preferences?.tone||'descontraído e consultivo',instructions:store.preferences?.instructions||'',enabled:String(store.enabled)}))f.elements.namedItem(key).value=value;
  f.elements.namedItem('emojis').checked=store.preferences?.emojis!==false;
  f.elements.namedItem('upsell').checked=store.preferences?.upsell!==false;
 }
 async function loadStores(){
  const data=await api('/stores');stores=data.stores;
  $('stores').innerHTML=stores.map(s=>'<button class="item" type="button" data-id="'+escape(s.id)+'"><b>'+escape(s.name)+'</b><br><span class="muted">'+escape(s.whatsapp_number)+' · '+(s.enabled?'Ativo':'Desativado')+'</span></button>').join('')||'<p class="muted">Nenhuma loja cadastrada.</p>';
  for(const button of $('stores').querySelectorAll('.item'))button.onclick=()=>{loadForm(stores.find(s=>s.id===button.dataset.id));$('conversationStore').value=button.dataset.id;loadConversations();};
  $('conversationStore').innerHTML=stores.map(s=>'<option value="'+escape(s.id)+'">'+escape(s.name)+'</option>').join('');
  loadForm(stores.find(s=>s.id===selected)||stores[0]);if(stores.length)$('conversationStore').value=selected||stores[0].id;
 }
 $('new').onclick=()=>loadForm(null);
 $('webhook').textContent=location.origin+'/webhook/whatsapp';
 $('editor').onsubmit=async e=>{
  e.preventDefault();const f=e.currentTarget;
  const body={name:formValue(f,'name'),storeUrl:formValue(f,'storeUrl'),whatsappNumber:formValue(f,'whatsappNumber'),phoneId:formValue(f,'phoneId'),whatsappToken:formValue(f,'whatsappToken')||undefined,commerceKey:formValue(f,'commerceKey')||undefined,enabled:formValue(f,'enabled')==='true',preferences:{tone:formValue(f,'tone'),instructions:formValue(f,'instructions'),emojis:f.elements.namedItem('emojis').checked,upsell:f.elements.namedItem('upsell').checked}};
  $('result').textContent='Salvando...';try{const result=await api(selected?'/stores/'+selected:'/stores',selected?'PUT':'POST',body);selected=result.id;$('result').textContent='Configurações salvas.';await loadStores();}catch(err){$('result').textContent=err.message;}
 };
 async function loadConversations(){
  selectedConversation=null;$('messages').textContent='';const storeId=$('conversationStore').value;if(!storeId)return;
  try{const result=await api('/conversations?storeId='+encodeURIComponent(storeId));
   $('conversationList').innerHTML=result.conversations.map(c=>'<button type="button" class="item" data-id="'+escape(c.id)+'">'+escape(c.phone)+' · '+escape(c.mode)+'</button>').join('')||'<p class="muted">Sem atendimentos ainda.</p>';
   for(const el of $('conversationList').querySelectorAll('button'))el.onclick=()=>showConversation(el.dataset.id);
  }catch(e){$('conversationList').textContent=e.message;}
 }
 async function showConversation(id){
  selectedConversation=id;const r=await api('/conversations/'+id);
  $('messages').replaceChildren();
  const title=document.createElement('div');title.className='row';title.textContent=r.conversation.phone+' · '+r.conversation.mode;
  const toggle=document.createElement('button');toggle.className='secondary';toggle.textContent=r.conversation.mode==='ai'?'Assumir atendimento':'Devolver à IA';
  toggle.onclick=async()=>{await api('/conversations/'+id+'/mode','PUT',{mode:r.conversation.mode==='ai'?'human':'ai'});await showConversation(id);await loadConversations();};
  title.append(toggle);$('messages').append(title);
  for(const m of r.messages){const div=document.createElement('div');div.className='bubble '+m.role;div.textContent=(m.role==='user'?'Cliente: ':'Agente: ')+m.text;$('messages').append(div);}
 }
 $('refresh').onclick=loadConversations;$('conversationStore').onchange=loadConversations;
 loadStores().then(loadConversations).catch(e=>$('stores').textContent=e.message);
 </script></body></html>`;
}
