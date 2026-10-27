'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={spaces:[],pages:[],token:'',instance:''}, view='home', spaceId='workspace', current=null, editing=false, dirty=false, editBase=null, searchTimer, toastTimer, setupRequired=false;
const collapsed=new Set();
const templates={
 blank:{name:'Blank page',icon:'▤',description:'A clean page for a new idea.',title:'',body:''},
 project:{name:'Project overview',icon:'▱',description:'Scope, architecture, delivery and evidence.',title:'New project',body:'## Summary\nWhat problem does this solve, and for whom?\n\n## Scope\n- In scope:\n- Out of scope:\n\n## Architecture\nDescribe components, interfaces and data flow.\n\n## Delivery plan\n- [ ] Confirm requirements\n- [ ] Implement\n- [ ] Validate\n- [ ] Document and hand over\n\n## Risks and dependencies\n| Risk | Impact | Mitigation | Owner |\n| --- | --- | --- | --- |\n| To record | To record | To record | To record |\n\n## Evidence and outcomes\nLink verified results and supporting files.\n'},
 runbook:{name:'Runbook',icon:'☷',description:'A repeatable procedure with a safe rollback.',title:'New runbook',body:'## Purpose and trigger\nWhen should someone use this procedure?\n\n## Prerequisites\n- Required access:\n- Environment:\n- Backup or recovery point:\n\n## Procedure\n1. Confirm the environment.\n2. Perform the action.\n3. Verify the outcome.\n\n## Verification\nRecord the expected health checks and output.\n\n## Rollback\nExact steps to restore the previous working state.\n\n## Escalation\nOwner, contact route and evidence to provide.\n'},
 incident:{name:'Incident review',icon:'⚑',description:'Timeline, impact, root cause and follow-up.',title:'New incident review',body:'## Summary\nDate, service, severity and current state.\n\n## Impact\nDescribe affected users and duration.\n\n## Timeline\n| Time + timezone | Event | Evidence |\n| --- | --- | --- |\n| To record | To record | To link |\n\n## Root cause\nSeparate confirmed findings from hypotheses.\n\n## Resolution\nActions taken and validation.\n\n## Follow-up\n- [ ] Prevent recurrence\n- [ ] Improve detection\n- [ ] Update the runbook\n'},
 decision:{name:'Decision record',icon:'◇',description:'Keep the context behind a technical choice.',title:'ADR · New decision',body:'## Context\nWhat problem or constraint requires a decision?\n\n## Options considered\n| Option | Benefits | Trade-offs |\n| --- | --- | --- |\n| Option A | To record | To record |\n| Option B | To record | To record |\n\n## Decision\nWhat was chosen, by whom, and when?\n\n## Consequences\nRecord operational and implementation implications.\n\n## Review trigger\nWhen should this decision be revisited?\n'},
 daily:{name:'Daily work note',icon:'◷',description:'Capture progress, questions and the next step.',title:new Date().toLocaleDateString('en-CA')+' · Work note',body:'## Focus\nToday’s intended outcome.\n\n## Work completed\n- \n\n## Findings and decisions\n- \n\n## Blockers\n- \n\n## Next actions\n- [ ] \n\n## Evidence\nLinks, test output or attachments.\n'},
 handover:{name:'Handover',icon:'⇄',description:'Help the next person operate with confidence.',title:'New handover',body:'## Service overview\nPurpose, environment and owner.\n\n## Architecture and dependencies\nDescribe the main components and external systems.\n\n## Build and deployment\nDocument the exact release process.\n\n## Daily operations\nHealth checks, alerts and expected routine work.\n\n## Recovery\nBackup, restore and rollback procedures.\n\n## Known issues\n| Issue | Workaround | Owner | Next action |\n| --- | --- | --- | --- |\n| To record | To record | To record | To record |\n\n## Acceptance\n- [ ] Recipient can operate the service\n- [ ] Recovery was demonstrated\n- [ ] Access is verified\n'}
};
function inline(text){
 const tokens=[]; const token=html=>'\u0000'+(tokens.push(html)-1)+'\u0000';
 let s=String(text).replace(/\u0000/g,'').replace(/`([^`]+)`/g,(_,t)=>token('<code>'+esc(t)+'</code>'));
 s=s.replace(/\[([^\]\n]+)\]\(([^\s)]+)\)/g,(_,label,url)=>{
  const allowed=/^(https?:\/\/|mailto:|#page\/|#section-)/i.test(url);
  return token(allowed?'<a href="'+esc(url)+'"'+(/^https?:/i.test(url)?' target="_blank" rel="noopener noreferrer"':'')+'>'+esc(label)+'</a>':esc(label+' ('+url+')'));
 });
 s=esc(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g,'$1<em>$2</em>');
 return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>tokens[Number(i)]);
}
function markdown(source,prefix='section-'){
 const lines=String(source||'').replace(/\r/g,'').split('\n'), out=[], headings=[];let i=0;
 const special=l=>/^(#{1,6}\s|```|>\s?|[-*]\s|\d+\.\s|---\s*$|\|)/.test(l);
 const cells=l=>l.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
 while(i<lines.length){
  let l=lines[i];if(!l.trim()){i++;continue;}
  if(l.startsWith('```')){const code=[];i++;while(i<lines.length&&!lines[i].startsWith('```'))code.push(lines[i++]);i++;out.push('<pre><code>'+esc(code.join('\n'))+'</code></pre>');continue;}
  const h=l.match(/^(#{1,6})\s+(.+)$/);if(h){const id=prefix+headings.length;headings.push({id,text:h[2],level:h[1].length});out.push('<h'+h[1].length+' id="'+id+'">'+inline(h[2])+'</h'+h[1].length+'>');i++;continue;}
  if(/^---\s*$/.test(l)){out.push('<hr>');i++;continue;}
  if(l.startsWith('|')&&i+1<lines.length&&/^\|?[\s:|-]+\|\s*$/.test(lines[i+1])&&lines[i+1].includes('---')){
   const header=cells(l);out.push('<table><thead><tr>'+header.map(x=>'<th>'+inline(x)+'</th>').join('')+'</tr></thead><tbody>');i+=2;
   while(i<lines.length&&lines[i].startsWith('|'))out.push('<tr>'+cells(lines[i++]).map(x=>'<td>'+inline(x)+'</td>').join('')+'</tr>');out.push('</tbody></table>');continue;
  }
  if(/^>/.test(l)){const b=[];while(i<lines.length&&/^>/.test(lines[i]))b.push(lines[i++].replace(/^>\s?/,''));out.push('<blockquote>'+b.map(inline).join('<br>')+'</blockquote>');continue;}
  if(/^([-*]|\d+\.)\s/.test(l)){
   const ordered=/^\d+\./.test(l), tag=ordered?'ol':'ul';out.push('<'+tag+'>');
   while(i<lines.length&&(ordered?/^\d+\.\s/:/^[-*]\s/).test(lines[i])){
    let item=lines[i++].replace(/^([-*]|\d+\.)\s/,'');const check=item.match(/^\[([ xX])\]\s?(.*)$/);
    out.push(check?'<li class="check-item"><span class="check-box '+(check[1]!==' '?'checked':'')+'">'+(check[1]!==' '?'✓':'')+'</span>'+inline(check[2])+'</li>':'<li>'+inline(item)+'</li>');
   }out.push('</'+tag+'>');continue;
  }
  const p=[l];i++;while(i<lines.length&&lines[i].trim()&&!special(lines[i]))p.push(lines[i++]);out.push('<p>'+p.map(inline).join('\n')+'</p>');
 }
 return {html:out.join('\n'),headings};
}
function toast(message,error=false){const el=$('#toast');clearTimeout(toastTimer);el.textContent=message;el.className=error?'error':'';el.style.display='block';toastTimer=setTimeout(()=>el.style.display='none',error?9000:3500);}
async function api(path,data){
 const options=data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Wiki-Token':state.token},body:JSON.stringify(data)};
 let res;try{res=await fetch('/api/'+path,options);}catch{throw Error('Cannot reach the local server. Keep the server window open, then retry.');}
 let result;try{result=await res.json();}catch{throw Error('Unexpected server response. Reload when the local server is ready.');}
 if(!res.ok){if(res.status===401&&!['login','setup'].includes(path))showLogin('Your session ended. Please sign in again.');throw Error(result.error||'Request failed.');}return result;
}
function activePages(){return state.pages.filter(p=>!p.deleted);}
function spaceName(id){return state.spaces.find(s=>s.id===id)?.name||'Workspace';}
function date(s){return new Date(s).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function badge(s){return '<span class="status '+esc(s.toLowerCase().replaceAll(' ','-'))+'">'+esc(s)+'</span>';}
function pageButton(p){return '<button class="title-link" data-page="'+esc(p.id)+'"><span class="doc-icon">▤</span>'+esc(p.title)+'</button>';}
function table(pages){if(!pages.length)return '<div class="empty"><strong>No pages here yet</strong>Create a page to start documenting your work.</div>';return '<table class="page-table"><thead><tr><th>Page</th><th>Status</th><th>Updated</th></tr></thead><tbody>'+pages.map(p=>'<tr><td>'+pageButton(p)+'<small>'+esc(spaceName(p.space_id))+'</small></td><td>'+badge(p.status)+'</td><td class="subtle">'+date(p.updated)+'</td></tr>').join('')+'</tbody></table>';}
function shell(content,crumb='Workspace'){return '<div class="page-shell"><div class="breadcrumb"><button data-view="home">Workspace</button><span>/</span>'+esc(crumb)+'</div>'+content+'</div>';}
function renderNav(){
 $$('.sidebar [data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
 $('#spaces').innerHTML=state.spaces.map((s,i)=>'<button class="space-item '+(spaceId===s.id?'selected':'')+'" data-space="'+esc(s.id)+'"><span class="space-icon">'+esc(s.name[0])+'</span>'+esc(s.name)+'</button>').join('');
 const pages=activePages().filter(p=>p.space_id===spaceId);
 function branch(parent){return pages.filter(p=>p.parent_id===parent).slice().sort((a,b)=>a.title.localeCompare(b.title)).map(p=>{const children=pages.some(x=>x.parent_id===p.id), shut=collapsed.has(p.id);return '<div class="tree-row '+(current?.id===p.id?'selected':'')+'"><button class="tree-toggle" data-toggle="'+esc(p.id)+'" aria-label="'+(shut?'Expand':'Collapse')+' '+esc(p.title)+'" aria-expanded="'+(!shut)+'">'+(children?(shut?'›':'⌄'):'·')+'</button><button class="tree-page" title="'+esc(p.title)+'" data-page="'+esc(p.id)+'">'+esc(p.title)+'</button></div>'+(children&&!shut?'<div class="branch">'+branch(p.id)+'</div>':'');}).join('');}
 $('#tree').innerHTML=branch(null)||'<small class="subtle">No pages yet.</small>';
}
function renderHome(){
 const pages=activePages();
 $('#main').innerHTML=shell('<div class="page-head"><div><h1>Your work, connected.</h1><div class="subtle">Write the context. Track the work. Keep it all on your computer.</div></div><button data-action="export">⇩ Export pages</button></div><section class="hero"><div><div class="eyebrow">DOCUMENTS & TASKS, TOGETHER</div><h2>Keep the context.<br>Build on what you know.</h2><p>From the first design decision to the production runbook — give every project a place to grow.</p><div class="hero-actions"><button class="primary" data-action="create">＋ Create a page</button><button data-view="board">Open board →</button></div></div><div class="hero-art" aria-hidden="true"><div class="art-doc"><b>W.</b><i></i><i></i><i></i></div></div></section><div class="section-heading"><h2>Your spaces <span class="count-chip">'+state.spaces.length+'</span></h2><button class="text-button" data-action="new-space">＋ New space</button></div><div class="space-grid">'+state.spaces.map(s=>'<button class="space-card" data-space="'+esc(s.id)+'"><span class="space-icon">'+esc(s.name[0])+'</span><strong>'+esc(s.name)+'</strong><small>'+esc(s.description)+'</small><small class="count">'+pages.filter(p=>p.space_id===s.id).length+' pages ↗</small></button>').join('')+'</div><div class="home-grid"><section><div class="section-heading"><h2>Recently updated</h2><button class="text-button" data-view="recent">View all →</button></div>'+table(pages.slice(0,6))+'</section><aside class="note-card"><div class="eyebrow">A GOOD PLACE TO START</div><h3>Turn today’s work into<br>tomorrow’s reference.</h3><p>Capture what changed, why it mattered, and the evidence behind it. A short note is enough to begin.</p><button data-template="daily">Write a daily note →</button><div class="mini-stat"><span>Pages in your workspace</span><strong>'+pages.length+'</strong></div><div class="mini-stat"><span>Open issues</span><strong>'+(state.issues||[]).filter(i=>!i.deleted&&i.status!=='Done').length+'</strong></div></aside></div><div class="footer-note">LOCAL WORKSPACE · No cloud sync · Documents and issues stay on this computer.</div>','Overview');
}
function renderList(kind){
 const titles={favorites:'Favorites',recent:'Recently updated',trash:'Trash',space:spaceName(spaceId)};
 let pages=state.pages.filter(p=>kind==='trash'?p.deleted:!p.deleted);
 if(kind==='favorites')pages=pages.filter(p=>p.favorite);
 if(kind==='space')pages=pages.filter(p=>p.space_id===spaceId);
 $('#main').innerHTML=shell('<div class="page-head"><div><div class="eyebrow">'+(kind==='space'?'SPACE OVERVIEW':'YOUR WORKSPACE')+'</div><h1>'+esc(titles[kind])+'</h1><div class="subtle">'+(kind==='trash'?'Deleted pages stay here until you restore them.':kind==='space'?esc(state.spaces.find(s=>s.id===spaceId)?.description):'Pick up where you left off.')+'</div></div>'+(kind!=='trash'?'<button class="primary" data-action="create">＋ Create page</button>':'')+'</div>'+table(pages)+(kind==='trash'?issueTrash():''),titles[kind]);
}
function renderTemplates(){
 $('#main').innerHTML=shell('<div class="page-head"><div><h1>A head start for every page.</h1><div class="subtle">Simple structures for clear, useful documentation.</div></div></div><div class="template-grid">'+Object.entries(templates).map(([k,t])=>'<button class="template-card" data-template="'+k+'"><span class="template-icon">'+t.icon+'</span><strong>'+t.name+'</strong><small>'+t.description+'</small></button>').join('')+'</div>','Templates');
}
function renderSearch(query){
 view='search';current=null;renderNav();const q=query.trim().toLocaleLowerCase();
 const pages=activePages().filter(p=>[p.title,p.body,p.labels].join(' ').toLocaleLowerCase().includes(q));
 $('#main').innerHTML=shell('<div class="page-head"><div><h1>Search results</h1><div class="subtle">'+pages.length+' pages matching “'+esc(query)+'” · all spaces</div></div></div>'+ (pages.length?pages.map(p=>{const idx=p.body.toLocaleLowerCase().indexOf(q),start=Math.max(0,idx-70);return '<div class="result-item"><button data-page="'+esc(p.id)+'">'+esc(p.title)+'</button><small>'+esc(spaceName(p.space_id))+' / '+esc(p.labels)+'</small><div class="search-snippet">'+esc(p.body.slice(start,start+220))+'…</div></div>';}).join(''):'<div class="empty"><strong>No matching pages</strong>Try a shorter phrase, project name, or label.</div>'),'Search');
}
function renderPage(p){
 const rendered=markdown(p.body);const parent=state.pages.find(x=>x.id===p.parent_id);
 $('#main').innerHTML=shell((p.deleted?'<div class="banner trash-banner">This page is in the trash. <button data-action="trash">Restore page</button></div>':'')+'<div class="page-head"><div><h1>'+esc(p.title)+'</h1><div class="metadata"><span class="avatar">ME</span><span>'+esc(state.username||'Local account')+'</span><span>·</span><span>Updated '+date(p.updated)+'</span><span>· v'+p.version+'</span>'+badge(p.status)+'</div></div><div class="page-toolbar"><button data-action="favorite" aria-label="Toggle favorite">'+(p.favorite?'★':'☆')+'</button>'+(p.deleted?'':'<button class="primary" data-action="edit">✎ Edit</button>')+'<button data-action="history">History</button><button data-action="more">•••</button></div></div>'+(parent?'<div class="subtle">Parent: <a href="#page/'+esc(parent.id)+'">'+esc(parent.title)+'</a></div>':'')+'<div class="document-layout"><article class="document">'+(rendered.html||'<p class="subtle">This page is empty. Select Edit to start writing.</p>')+'</article><aside class="toc"><strong>ON THIS PAGE</strong>'+rendered.headings.filter(h=>h.level<=3).map(h=>'<a href="#'+h.id+'" data-scroll="'+h.id+'">'+esc(h.text)+'</a>').join('')+'</aside></div><section class="linked-issues"><div class="section-heading"><h3>Linked issues</h3>'+(p.deleted?'':'<button data-action="create-issue">＋ Create linked issue</button>')+'</div>'+linkedIssues(p.id)+'</section><div class="labels">'+p.labels.split(',').map(x=>x.trim()).filter(Boolean).map(x=>'<span class="label">'+esc(x)+'</span>').join('')+'</div><section class="attachments"><div class="section-heading"><h3>Attachments <span class="count-chip">'+p.attachments.length+'</span></h3>'+(p.deleted?'':'<button data-action="attach">＋ Attach file</button>')+'</div>'+p.attachments.map(a=>'<div class="attachment"><span>▧</span><a href="/api/attachment/'+esc(a.id)+'">'+esc(a.name)+'</a><small>'+Math.max(1,Math.round(a.size/1024))+' KB</small></div>').join('')+(!p.attachments.length?'<small>No attachments. Add diagrams, specifications or test evidence (up to 15 MB per file).</small>':'')+'</section>',spaceName(p.space_id));
}
function canLeave(){return !dirty||confirm('Leave the editor? Your unsaved draft will remain in this browser.');}
async function navigate(next,id){
 if(!canLeave())return;editing=false;dirty=false;current=null;view=next;
 if(next==='page'){
  try{current=await api('page/'+encodeURIComponent(id));spaceId=current.space_id;renderPage(current);history.replaceState(null,'','#page/'+current.id);}catch(e){toast(e.message,true);view='home';renderHome();}
 }else{history.replaceState(null,'',next==='space'?'#space/'+spaceId:'#'+next);if(next==='home')renderHome();else if(next==='templates')renderTemplates();else if(next==='board'||next==='backlog')renderBoard(next);else renderList(next);}
 renderNav();$('#main').focus({preventScroll:true});window.scrollTo(0,0);
}
async function refresh(){state=await api('state');if(!state.spaces.some(s=>s.id===spaceId))spaceId=state.spaces[0]?.id;renderNav();}
function dialog(title,html){$('#modal-title').textContent=title;$('#modal-body').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();}
function closeDialog(){$('#modal').close();}
function draftKey(p){return 'worklog:'+state.instance+':draft:'+(p.id||'new');}
function stashDraft(){dirty=true;const p=readEditor();try{sessionStorage.setItem(draftKey(p),JSON.stringify(p));$('#draft-state').textContent='Unsaved · draft kept in this tab';}catch{$('#draft-state').textContent='Unsaved · browser draft unavailable; save to the server';}}
function readEditor(){return {id:editBase.id,version:editBase.version,title:$('#edit-title').value,body:$('#edit-body').value,space_id:$('#edit-space').value,parent_id:$('#edit-parent').value||null,status:$('#edit-status').value,labels:$('#edit-labels').value,note:$('#edit-note').value};}
function parentOptions(p){
 const descendants=new Set(p.id?[p.id]:[]);let added=true;while(added){added=false;for(const x of activePages())if(descendants.has(x.parent_id)&&!descendants.has(x.id)){descendants.add(x.id);added=true;}}
 return '<option value="">Space root</option>'+activePages().filter(x=>x.space_id===p.space_id&&!descendants.has(x.id)).map(x=>'<option value="'+esc(x.id)+'" '+(p.parent_id===x.id?'selected':'')+'>'+esc(x.title)+'</option>').join('');
}
function startEditor(page){
 if(editing&&!canLeave())return;
 editBase={...page};let p={...page};let recovered=false;
 try{const saved=JSON.parse(sessionStorage.getItem(draftKey(p))||'null');if(saved){p={...p,...saved};recovered=true;}}catch{}
 editing=true;dirty=recovered;view='editor';
 $('#main').innerHTML=shell((recovered?'<div class="banner">Recovered an unsaved draft from this browser. Review it before saving.<button data-action="discard-draft">Discard recovered draft</button></div>':'')+'<div class="page-head"><div><div class="eyebrow">'+(p.id?'EDIT PAGE':'NEW PAGE')+'</div><div class="subtle">Write in Markdown. Preview updates as you type.</div></div><div class="page-toolbar"><button data-action="cancel-edit">Close editor</button><button class="primary" data-action="save" id="save-button">Save page</button></div></div><input id="edit-title" class="editor-title" aria-label="Page title" placeholder="Give your page a title" maxlength="200" value="'+esc(p.title)+'"><div class="editor-fields"><label class="field">Space<select id="edit-space">'+state.spaces.map(s=>'<option value="'+esc(s.id)+'" '+(p.space_id===s.id?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></label><label class="field">Parent page<select id="edit-parent">'+parentOptions(p)+'</select></label><label class="field">Status<select id="edit-status">'+['Draft','In progress','In review','Complete'].map(s=>'<option '+(p.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select></label></div><label class="field">Labels · separated by commas<input id="edit-labels" value="'+esc(p.labels)+'" maxlength="500" placeholder="api, runbook, production"></label><p class="editor-hint">Use internal links like [Project](#page/page-id). Tables, code blocks and checklists are supported.</p><div class="formatbar"><button data-format="heading">H2</button><button data-format="bold"><b>B</b></button><button data-format="italic"><i>I</i></button><button data-format="list">☷ List</button><button data-format="check">☑ Task</button><button data-format="code">&lt;/&gt; Code</button><button data-format="table">▦ Table</button><button data-format="link">↗ Link</button><button data-action="import">⇧ Import .md</button><span>MARKDOWN → PREVIEW</span></div><div class="editor-columns"><textarea id="edit-body" aria-label="Page Markdown" spellcheck="false">'+esc(p.body)+'</textarea><div class="editor-preview document" id="editor-preview">'+markdown(p.body,'preview-').html+'</div></div><div class="editor-bottom"><input id="edit-note" placeholder="What changed? (optional version note)" aria-label="Version note" maxlength="500" value="'+esc(p.note||'')+'"><span id="draft-state">'+(recovered?'Recovered browser draft':'Save creates a new version')+'</span></div>',spaceName(p.space_id));
 renderNav();
 ['#edit-title','#edit-labels','#edit-note','#edit-body','#edit-status','#edit-parent'].forEach(sel=>$(sel).addEventListener('input',()=>{stashDraft();if(sel==='#edit-body')$('#editor-preview').innerHTML=markdown($('#edit-body').value,'preview-').html;}));
 $('#edit-space').addEventListener('change',()=>{$('#edit-parent').innerHTML=parentOptions({...readEditor(),parent_id:null});stashDraft();});$('#edit-title').focus();
}
function createPage(template='blank',child=false){if(!canLeave())return;dirty=false;editing=false;closeDialog();const t=templates[template];startEditor({space_id:spaceId,parent_id:child&&current&&!current.deleted?current.id:null,title:t.title,body:t.body,status:'Draft',labels:'',version:0});}
function chooseTemplate(child=false){dialog('Create a page','<p class="subtle">Choose a starting point in '+esc(spaceName(spaceId))+'.</p><div class="template-grid">'+Object.entries(templates).map(([k,t])=>'<button class="template-card" data-create-template="'+k+'" data-child="'+child+'"><span class="template-icon">'+t.icon+'</span><strong>'+t.name+'</strong><small>'+t.description+'</small></button>').join('')+'</div>');}
async function save(){
 const b=$('#save-button');if(!b||b.disabled)return;const p=readEditor();b.disabled=true;b.textContent='Saving…';
 try{const result=await api('save',p);try{sessionStorage.removeItem(draftKey(p));}catch{}dirty=false;editing=false;await refresh();await navigate('page',result.id);toast('Page saved · version '+result.version);}catch(e){toast(e.message,true);if(b.isConnected){b.disabled=false;b.textContent='Save page';}}
}
function format(kind){const t=$('#edit-body'),a=t.selectionStart,b=t.selectionEnd,selected=t.value.slice(a,b);const snippets={heading:'\n## '+(selected||'Heading')+'\n',bold:'**'+(selected||'bold text')+'**',italic:'*'+(selected||'italic text')+'*',list:'\n- '+(selected||'List item')+'\n',check:'\n- [ ] '+(selected||'Task')+'\n',code:'\n```\n'+(selected||'code here')+'\n```\n',table:'\n| Column | Details |\n| --- | --- |\n| Item | Description |\n',link:'['+(selected||'Link text')+'](https://example.com)'};t.setRangeText(snippets[kind],a,b,'end');t.dispatchEvent(new Event('input'));t.focus();}
function showHistory(){const p=current;dialog('Page history','<p class="subtle">Restoring creates a new version. Your current page location is kept.</p>'+p.history.map(h=>'<div class="history-row"><b>v'+h.version+'</b><div>'+esc(h.note)+'<small>'+date(h.created)+'</small></div><button data-inspect-version="'+h.version+'">View</button>'+(h.version!==p.version&&!p.deleted?'<button data-restore-version="'+h.version+'">Restore</button>':'<small>'+(h.version===p.version?'Current':'')+'</small>')+'</div>').join('')+'<div id="history-preview"></div>');}
function showMore(){dialog('Page actions','<div class="modal-form"><button data-action="copy-link">Copy page link</button><button data-action="download-page">Download Markdown</button><button data-action="print">Print / Save as PDF</button>'+(current.deleted?'':'<button data-action="duplicate">Duplicate page</button><button data-action="create-child">Create child page</button>')+'<button class="danger" data-action="trash">'+(current.deleted?'Restore from trash':'Move to trash')+'</button></div>');}
function newSpace(){dialog('Create a space','<form id="space-form" class="modal-form"><label class="field">Space name<input id="space-name" required maxlength="80" placeholder="e.g. Research & experiments"></label><label class="field">Description<input id="space-description" maxlength="300" placeholder="What belongs in this space?"></label><div class="modal-actions"><button type="submit" class="primary">Create space</button></div></form>');$('#space-form').addEventListener('submit',async e=>{e.preventDefault();if(!canLeave())return;try{const s=await api('space',{name:$('#space-name').value,description:$('#space-description').value});closeDialog();dirty=false;editing=false;spaceId=s.id;await refresh();await navigate('space');toast('Space created.');}catch(err){toast(err.message,true);}});$('#space-name').focus();}
function downloadBlob(text,name,type='text/markdown;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function action(name){
 try{
  if(name==='create-issue')editIssue();
  else if(name==='create')chooseTemplate();
  else if(name==='create-child')chooseTemplate(true);
  else if(name==='new-space')newSpace();
  else if(name==='edit')startEditor(current);
  else if(name==='save')await save();
  else if(name==='cancel-edit')await navigate(current?'page':'home',current?.id);
  else if(name==='discard-draft'){if(!confirm('Discard the recovered unsaved draft?'))return;sessionStorage.removeItem(draftKey(editBase));dirty=false;editing=false;startEditor(editBase);}
  else if(name==='favorite'){await api('favorite',{id:current.id,version:current.version});await refresh();await navigate('page',current.id);}
  else if(name==='history')showHistory();
  else if(name==='more')showMore();
  else if(name==='trash'){
   if(!current.deleted&&!confirm('Move this page to the trash? You can restore it later.'))return;
   const pid=current.id;await api('trash',{id:pid,version:current.version});closeDialog();await refresh();await navigate('page',pid);toast(current.deleted?'Page moved to trash.':'Page restored.');
  }
  else if(name==='backup')dialog('Back up your workspace','<p>A full backup includes all spaces, pages, version history and attachments.</p><p class="subtle">Save the database somewhere separate from this application folder. To restore, stop the server and follow README_KO.md. Browser drafts are not included.</p><div class="modal-actions"><button data-action="export">Export Markdown</button><a class="primary" href="/api/backup" download>Download SQLite backup ↓</a></div>');
  else if(name==='export'){const a=document.createElement('a');a.href='/api/export';a.download='worklog-markdown.zip';a.click();}
  else if(name==='download-page'){downloadBlob('# '+current.title+'\n\n'+current.body,current.title.replace(/[^\w가-힣 .-]/g,'_')+'.md');closeDialog();}
  else if(name==='print'){closeDialog();window.print();}
  else if(name==='copy-link'){try{await navigator.clipboard.writeText(location.origin+'/#page/'+current.id);toast('Page link copied.');}catch{dialog('Page link','<input readonly aria-label="Page link" value="'+esc(location.origin+'/#page/'+current.id)+'">');}}
  else if(name==='duplicate'){const p={...current};delete p.id;p.title+=' (copy)';p.version=0;closeDialog();startEditor(p);}
  else if(name==='attach')$('#attachment-input').click();
  else if(name==='import')$('#import-input').click();
 }catch(e){toast(e.message,true);}
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button,a');if(!b)return;
 if(b.dataset.view){e.preventDefault();await navigate(b.dataset.view);}
 else if(b.dataset.issue){await showIssue(Number(b.dataset.issue));}
 else if(b.dataset.page){e.preventDefault();await navigate('page',b.dataset.page);}
 else if(b.dataset.space){e.preventDefault();if(!canLeave())return;dirty=false;spaceId=b.dataset.space;await navigate('space');}
 else if(b.dataset.toggle){const id=b.dataset.toggle;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);renderNav();}
 else if(b.dataset.template)createPage(b.dataset.template);
 else if(b.dataset.createTemplate)createPage(b.dataset.createTemplate,b.dataset.child==='true');
 else if(b.dataset.action)await action(b.dataset.action);
 else if(b.dataset.format)format(b.dataset.format);
 else if(b.dataset.scroll){e.preventDefault();document.getElementById(b.dataset.scroll)?.scrollIntoView({behavior:'smooth',block:'center'});}
 else if(b.dataset.inspectVersion){const h=current.history.find(x=>x.version===Number(b.dataset.inspectVersion));const p=JSON.parse(h.snapshot);$('#history-preview').innerHTML='<div class="history-preview document"><h2>'+esc(p.title)+' · v'+h.version+'</h2>'+markdown(p.body,'history-').html+'</div>';}
 else if(b.dataset.restoreVersion){try{if(!confirm('Restore the content from version '+b.dataset.restoreVersion+' as a new version?'))return;const p=await api('restore',{id:current.id,version:current.version,restore_version:Number(b.dataset.restoreVersion)});closeDialog();await refresh();await navigate('page',p.id);toast('Previous content restored as version '+p.version);}catch(err){toast(err.message,true);}}
 else if(b.getAttribute('href')?.startsWith('#page/')){e.preventDefault();await navigate('page',b.getAttribute('href').slice(6));}
});
$('#home').onclick=()=>navigate('home');$('#create-top').onclick=()=>chooseTemplate();$('#create-child').onclick=()=>chooseTemplate(true);$('#new-space').onclick=newSpace;$('#backup').onclick=()=>action('backup');$('#close-modal').onclick=closeDialog;
$('#search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(editing){toast('Close the editor to search. Your draft stays in this browser.');return;}const q=$('#search').value.trim();if(q)renderSearch(q);else navigate('home');},180);});
$('#attachment-input').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file||!current)return;if(file.size>15*1024*1024){toast('Attachment limit: 15 MB.',true);return;}const pid=current.id;try{toast('Saving attachment…');const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});await api('attachment',{page_id:pid,name:file.name,data:base64});if(current?.id===pid)await navigate('page',pid);toast('Attachment saved on the server.');}catch(err){toast(err.message||'Could not read file.',true);}});
$('#import-input').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f||!editing)return;if(f.size>1_000_000){toast('Markdown import limit: 1 MB.',true);return;}if($('#edit-body').value&&!confirm('Replace editor text with this file? The saved page is unchanged until you save.'))return;try{$('#edit-body').value=await f.text();$('#edit-body').dispatchEvent(new Event('input'));}catch{toast('Could not read the text file.',true);}});
document.addEventListener('keydown',e=>{if(document.body.classList.contains('auth-locked'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search').focus();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&editing){e.preventDefault();save();}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('popstate',()=>{if(!document.body.classList.contains('auth-locked'))route();});
async function route(){const hash=location.hash.slice(1);if(hash.startsWith('page/'))await navigate('page',hash.slice(5));else if(hash.startsWith('space/')){spaceId=hash.slice(6);await navigate('space');}else await navigate(['home','favorites','recent','templates','trash','board','backlog'].includes(hash)?hash:'home');}
function showLogin(message='',setup=setupRequired){
 setupRequired=setup;
 clearTimeout(searchTimer);closeDialog();document.body.classList.add('auth-locked');
 $('#auth-root').hidden=false;$('#main').innerHTML='';$('#spaces').innerHTML='';$('#tree').innerHTML='';$('#search').value='';
 state={spaces:[],pages:[],token:'',instance:''};current=null;editBase=null;editing=false;dirty=false;
 $('#auth-root').innerHTML='<div class="auth-card"><span class="brandmark">w</span><h1>'+ (setup?'A fresh start.':'Your work. Your space.') +'</h1><p class="subtle">'+(setup?'Create the account for this computer.':'Sign in to your local workspace.')+'</p><form id="login-form"><label for="login-user">Username</label><input id="login-user" name="username" autocomplete="username" maxlength="80" value="" required><label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="'+(setup?'new-password':'current-password')+'" minlength="8" maxlength="1024" required><div class="auth-error" id="login-error" role="alert">'+esc(message)+'</div><button class="primary" id="login-submit" type="submit">'+(setup?'Create local account →':'Sign in →')+'</button></form><p class="auth-note">이 컴퓨터에서만 실행되는 개인 위키입니다.<br>문서·첨부파일·백업은 로그인 후 이용할 수 있습니다.</p><span class="local-badge"><i></i> Local access only</span></div>';
 $('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=$('#login-submit');button.disabled=true;button.textContent='Signing in…';$('#login-error').textContent='';
  try{
   const bootstrap=await api('session');state.token=bootstrap.token;
   await api(bootstrap.setup_required?'setup':'login',{username:$('#login-user').value,password:$('#login-password').value});
   $('#login-password').value='';setupRequired=false;await openWorkspace();
  }catch(err){if($('#login-error'))$('#login-error').textContent=err.message;if(button.isConnected){button.disabled=false;button.textContent=setup?'Create local account →':'Sign in →';}}
 });$(setup?'#login-user':'#login-password').focus();
}
async function openWorkspace(){
 await refresh();document.body.classList.remove('auth-locked');$('#auth-root').hidden=true;$('#auth-root').innerHTML='';await route();
}
$('#logout').onclick=async()=>{
 if(dirty&&!confirm('Sign out? Unsaved drafts in this tab will be discarded.'))return;
 try{
  const instance=state.instance;await api('logout',{});
  try{Object.keys(sessionStorage).filter(k=>k.startsWith('worklog:'+instance+':')).forEach(k=>sessionStorage.removeItem(k));}catch{}
  showLogin('Signed out.');
 }catch(e){toast(e.message,true);}
};
let issueQuery='', issuePriority='';
function spaceIssues(includeTrash=false){return (state.issues||[]).filter(i=>i.space_id===spaceId&&(includeTrash||!i.deleted));}
function priorityMark(p){return '<span class="priority '+esc(p.toLowerCase())+'">'+({Low:'↓',Medium:'=',High:'↑',Critical:'↑↑'}[p]||'')+' '+esc(p)+'</span>';}
function issueKey(i){return 'WL-'+i.id;}
function linkedIssues(pid){const issues=(state.issues||[]).filter(i=>!i.deleted&&i.linked_page_id===pid);return issues.length?issues.map(i=>'<button class="linked-issue" data-issue="'+i.id+'"><span class="issue-key">'+issueKey(i)+'</span><strong>'+esc(i.title)+'</strong>'+badge(i.status)+'</button>').join(''):'<small>No linked issues yet. Connect a task to the context behind it.</small>';}
function issueTrash(){const issues=(state.issues||[]).filter(i=>i.deleted);return '<h2 class="issue-trash-title">Deleted issues</h2>'+(issues.length?issues.map(i=>'<button class="linked-issue" data-issue="'+i.id+'"><span class="issue-key">'+issueKey(i)+'</span>'+esc(i.title)+'</button>').join(''):'<small>No deleted issues.</small>');}
function issueCard(i){return '<article class="issue-card" draggable="true" data-drag-issue="'+i.id+'"><div class="issue-card-top"><span class="issue-kind '+i.kind.toLowerCase()+'">'+({Task:'✓',Bug:'●',Story:'▰'}[i.kind])+'</span><span class="issue-key">'+issueKey(i)+'</span><span class="issue-kind-label">'+esc(i.kind)+'</span></div><button class="issue-title" data-issue="'+i.id+'">'+esc(i.title)+'</button>'+(i.labels?'<div class="issue-labels">'+i.labels.split(',').filter(x=>x.trim()).slice(0,3).map(x=>'<span class="label">'+esc(x.trim())+'</span>').join('')+'</div>':'')+(i.linked_page_id?'<small class="linked-doc-indicator">▤ Linked document</small>':'')+'<div class="issue-card-bottom">'+priorityMark(i.priority)+'<span class="assignee" title="'+esc(i.assignee||'Unassigned')+'">'+esc(i.assignee?i.assignee.slice(0,2).toUpperCase():'—')+'</span></div>'+(i.due_date?'<small class="due-date">Due '+esc(i.due_date)+'</small>':'')+'</article>';}
function filteredIssues(){const q=issueQuery.trim().toLocaleLowerCase();return spaceIssues().filter(i=>(!issuePriority||i.priority===issuePriority)&&(!q||[issueKey(i),i.title,i.description,i.labels,i.assignee].join(' ').toLocaleLowerCase().includes(q)));}
function renderBoard(kind='board'){
 const total=spaceIssues();
 $('#main').innerHTML=shell('<div class="page-head"><div><div class="eyebrow">'+esc(spaceName(spaceId))+' / WORK MANAGEMENT</div><h1>'+(kind==='board'?'Board':'Backlog')+'</h1><div class="subtle">'+(kind==='board'?'Keep work moving, with the context one click away.':'Capture ideas and make the next step clear.')+'</div></div><div class="page-toolbar"><button data-view="'+(kind==='board'?'backlog':'board')+'">'+(kind==='board'?'☷ Backlog':'▥ Board')+'</button><button class="primary" data-action="create-issue">＋ Create issue</button></div></div><div class="board-tabs"><button class="'+(kind==='board'?'selected':'')+'" data-view="board">Board <span>'+total.filter(i=>i.status!=='Backlog').length+'</span></button><button class="'+(kind==='backlog'?'selected':'')+'" data-view="backlog">Backlog <span>'+total.filter(i=>i.status==='Backlog').length+'</span></button><button data-view="space">Documents <span>'+activePages().filter(p=>p.space_id===spaceId).length+'</span></button></div><div class="board-filters"><input id="issue-search" placeholder="Search issues, labels or assignees" aria-label="Search issues" value="'+esc(issueQuery)+'"><select id="issue-priority" aria-label="Filter by priority"><option value="">All priorities</option>'+['Low','Medium','High','Critical'].map(p=>'<option '+(issuePriority===p?'selected':'')+'>'+p+'</option>').join('')+'</select><span class="subtle">'+(kind==='board'?'Drag a card to move it · Open a card to edit':'Open an issue to plan or move it to the board')+'</span></div><div id="board-body"></div>',spaceName(spaceId));
 renderBoardBody(kind);$('#issue-search').oninput=()=>{issueQuery=$('#issue-search').value;renderBoardBody(kind);};$('#issue-priority').onchange=()=>{issuePriority=$('#issue-priority').value;renderBoardBody(kind);};
}
function renderBoardBody(kind){
 const issues=filteredIssues();
 if(kind==='backlog'){
  const list=issues.filter(i=>i.status==='Backlog');
  $('#board-body').innerHTML=list.length?'<div class="backlog-list">'+list.map(i=>'<div class="backlog-row"><span class="issue-kind '+i.kind.toLowerCase()+'">'+({Task:'✓',Bug:'●',Story:'▰'}[i.kind])+'</span><span class="issue-key">'+issueKey(i)+'</span><button data-issue="'+i.id+'">'+esc(i.title)+'</button>'+priorityMark(i.priority)+'<span class="subtle">'+esc(i.assignee||'Unassigned')+'</span><button class="text-button" data-plan-issue="'+i.id+'">Move to To do →</button></div>').join('')+'</div>':'<div class="empty"><strong>Your backlog is clear</strong>Capture an idea or task, then move it onto the board when you are ready.<p><button class="primary" data-action="create-issue">＋ Create issue</button></p></div>';
  $$('[data-plan-issue]').forEach(b=>b.onclick=()=>moveIssue(Number(b.dataset.planIssue),'To do'));return;
 }
 $('#board-body').innerHTML='<div class="board-grid">'+['To do','In progress','In review','Done'].map(status=>{const cards=issues.filter(i=>i.status===status);return '<section class="board-column" data-drop-status="'+status+'"><div class="column-head"><span class="column-dot '+status.toLowerCase().replaceAll(' ','-')+'"></span><h2>'+status+'</h2><span>'+cards.length+'</span></div><div class="column-cards">'+cards.map(issueCard).join('')+(!cards.length?'<div class="empty-column">'+(issueQuery||issuePriority?'No matching issues':'No issues yet')+'</div>':'')+'</div><button class="column-create" data-new-status="'+status+'">＋ Create issue</button></section>';}).join('')+'</div>';
 $$('[data-new-status]').forEach(b=>b.onclick=()=>editIssue(null,b.dataset.newStatus));
 $$('[data-drag-issue]').forEach(card=>card.ondragstart=e=>{e.dataTransfer.setData('text/plain',card.dataset.dragIssue);e.dataTransfer.effectAllowed='move';});
 $$('[data-drop-status]').forEach(col=>{col.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';col.classList.add('drag-over');};col.ondragleave=()=>col.classList.remove('drag-over');col.ondrop=e=>{e.preventDefault();col.classList.remove('drag-over');const iid=Number(e.dataTransfer.getData('text/plain'));if(Number.isInteger(iid)&&iid>0)moveIssue(iid,col.dataset.dropStatus);};});
}
async function updateIssueView(){await refresh();if(view==='page'&&current)await navigate('page',current.id);else if(view==='trash')renderList('trash');else renderBoard(view==='backlog'?'backlog':'board');}
async function moveIssue(id,status){try{const i=(state.issues||[]).find(x=>x.id===id);if(!i||i.status===status)return;await api('issue/save',{...i,status});await updateIssueView();toast(issueKey(i)+' moved to '+status);}catch(e){toast(e.message,true);}}
async function showIssue(id){
 try{const i=await api('issue/'+id);dialog(issueKey(i)+' · '+i.kind,'<div class="issue-detail"><h2>'+esc(i.title)+'</h2><div class="issue-detail-meta">'+badge(i.status)+priorityMark(i.priority)+'<span>'+esc(i.assignee||'Unassigned')+'</span>'+(i.due_date?'<span>Due '+esc(i.due_date)+'</span>':'')+'</div><article class="document">'+(markdown(i.description,'issue-').html||'<p class="subtle">No description yet.</p>')+'</article>'+(i.linked_page_id?'<p><a href="#page/'+esc(i.linked_page_id)+'" id="issue-doc-link">▤ '+esc(state.pages.find(p=>p.id===i.linked_page_id)?.title||'Linked document')+'</a></p>':'')+'<div class="labels">'+i.labels.split(',').filter(x=>x.trim()).map(x=>'<span class="label">'+esc(x.trim())+'</span>').join('')+'</div><details class="issue-history"><summary>Activity · '+i.history.length+' changes</summary>'+i.history.map(h=>{const snap=JSON.parse(h.snapshot);return '<div class="history-row"><div><b>v'+h.version+'</b> · '+esc(h.note)+' · '+esc(snap.status)+'<small>'+date(h.created)+'</small></div></div>';}).join('')+'</details><div class="modal-actions"><button class="danger" id="issue-trash">'+(i.deleted?'Restore issue':'Move to trash')+'</button>'+(!i.deleted?'<button class="primary" id="issue-edit">Edit issue</button>':'')+'</div></div>');
 if($('#issue-edit'))$('#issue-edit').onclick=()=>editIssue(i);if($('#issue-doc-link'))$('#issue-doc-link').addEventListener('click',()=>closeDialog());
 $('#issue-trash').onclick=async()=>{try{if(!i.deleted&&!confirm('Move this issue to trash? You can restore it later.'))return;await api('issue/trash',{id:i.id,version:i.version});closeDialog();await updateIssueView();toast(i.deleted?'Issue restored.':'Issue moved to trash.');}catch(e){toast(e.message,true);}};
 }catch(e){toast(e.message,true);}
}
function editIssue(issue=null,status='Backlog'){
 const i=issue||{space_id:spaceId,title:'',description:'',kind:'Task',status,priority:'Medium',assignee:'',due_date:'',labels:'',linked_page_id:current?.id||null};
 const select=(id,values,value)=>'<select id="'+id+'">'+values.map(v=>'<option '+(v===value?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select>';
 const links=sid=>'<option value="">No linked document</option>'+activePages().filter(p=>p.space_id===sid).map(p=>'<option value="'+esc(p.id)+'" '+(p.id===i.linked_page_id?'selected':'')+'>'+esc(p.title)+'</option>').join('');
 dialog(issue?'Edit '+issueKey(i):'Create issue','<form id="issue-form" class="modal-form"><label class="field">Summary<input id="issue-title" required maxlength="200" placeholder="What needs to happen?" value="'+esc(i.title)+'"></label><div class="editor-fields"><label class="field">Space<select id="issue-space">'+state.spaces.map(s=>'<option value="'+esc(s.id)+'" '+(s.id===i.space_id?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></label><label class="field">Type'+select('issue-kind',['Task','Bug','Story'],i.kind)+'</label><label class="field">Status'+select('issue-status',['Backlog','To do','In progress','In review','Done'],i.status)+'</label></div><label class="field">Description · Markdown<textarea id="issue-description" rows="6" maxlength="1000000" placeholder="Context, acceptance criteria, or the next action">'+esc(i.description)+'</textarea></label><div class="editor-fields"><label class="field">Priority'+select('issue-priority-edit',['Low','Medium','High','Critical'],i.priority)+'</label><label class="field">Assignee<input id="issue-assignee" maxlength="100" placeholder="Name (optional)" value="'+esc(i.assignee)+'"></label><label class="field">Due date<input id="issue-due" type="date" value="'+esc(i.due_date)+'"></label></div><label class="field">Linked document<select id="issue-link">'+links(i.space_id)+'</select></label><label class="field">Labels · comma separated<input id="issue-labels" maxlength="500" value="'+esc(i.labels)+'"></label><div class="modal-actions"><button type="submit" class="primary" id="issue-save">'+(issue?'Save changes':'Create issue')+'</button></div></form>');
 $('#issue-space').onchange=()=>$('#issue-link').innerHTML=links($('#issue-space').value);
 $('#issue-form').onsubmit=async e=>{e.preventDefault();const button=$('#issue-save');button.disabled=true;try{const payload={id:i.id,version:i.version,space_id:$('#issue-space').value,title:$('#issue-title').value,description:$('#issue-description').value,kind:$('#issue-kind').value,status:$('#issue-status').value,priority:$('#issue-priority-edit').value,assignee:$('#issue-assignee').value,due_date:$('#issue-due').value,labels:$('#issue-labels').value,linked_page_id:$('#issue-link').value||null};const saved=await api('issue/save',payload);closeDialog();await refresh();if(view==='page'&&current)await navigate('page',current.id);else{spaceId=saved.space_id;await navigate(saved.status==='Backlog'?'backlog':'board');}toast(issueKey(saved)+' saved.');}catch(err){toast(err.message,true);if(button.isConnected)button.disabled=false;}};$('#issue-title').focus();
}

(async()=>{try{const session=await api('session');if(session.authenticated)await openWorkspace();else showLogin('',session.setup_required);}catch(e){showLogin(e.message);}})();
