'use strict';
const $=id=>document.getElementById(id);
let runtimeAttempt=0,pendingMode=null;
const runtimeSources=['https://cdn.jsdelivr.net/pyodide/v314.0.7/full/','https://unpkg.com/pyodide@314.0.7/'];
let problems=[],current,worker,ready=false,busy=false,timer,aceEditor,frames=[],frameIndex=0,marker,runMode,runProblem,runCode;
const value=()=>aceEditor?aceEditor.getValue():$('code').value;
function status(s){$('runtime').textContent=s;}
function save(){if(!current)return;try{localStorage.setItem('graph-workspace:'+current.id,value());$('saved').textContent='●';}catch(e){$('saved').textContent='!';status('Storage unavailable — export your code');}}
function refreshLines(){const text=value();$('gutter').textContent=text.split('\n').map((_,i)=>i+1).join('\n');const p=$('code').selectionStart;const before=text.slice(0,p).split('\n');$('position').textContent=`Ln ${before.length}, Col ${before.at(-1).length+1}`;}
function buttons(){for(const id of ['run','debug','submit'])$(id).disabled=!current||busy;$('stop').disabled=!busy&&!(!ready&&worker);$('case').disabled=busy;}
function resetTrace(){frames=[];$('trace-controls').hidden=true;$('variables').hidden=true;if(aceEditor&&marker!=null){aceEditor.session.removeMarker(marker);marker=null;}}
function openProblem(p){window.workspaceAnimationClose?.();if(busy){pendingMode=null;stop('Execution stopped: module changed.');boot();}save();current=p;setLanguage(p);editorialButton.hidden=p.hasEditorial===false;const animationButton=$('animation-button');if(animationButton)animationButton.hidden=p.hasAnimation===false;if(editorialDialog.open)editorialDialog.close();leetcodeLink.href='https://leetcode.com/problems/'+(p.slug||leetcodeSlugs[p.id])+'/description/';leetcodeLink.hidden=!(p.slug||leetcodeSlugs[p.id]);resetTrace();$('filename').textContent=p.file;$('crumb').textContent=p.file;$('pid').textContent='#'+p.id;$('problem-title').textContent=p.title;$('rules').replaceChildren(...p.rules.map(r=>{const li=document.createElement('li');li.textContent=r;return li;}));$('examples').textContent=p.examples;renderSqlExamples(p);renderExampleImages(p);$('constraints').textContent=p.constraints;$('custom').value=JSON.stringify(p.tests[0].args);$('test-count').textContent=`${p.tests.length} examples · ${p.extra.length} edge cases`;renderEdgeCases(p);
let draft;try{draft=localStorage.getItem('graph-workspace:'+p.id);}catch(e){}$('code').value=draft??p.starter;if(aceEditor)aceEditor.setValue($('code').value,-1);refreshLines();$('output').textContent=`${p.file} ready. ${p.language==='sql'?'Write a SQLite SELECT / WITH query.':'Implement Solution.'+p.method+'().'}`;history.replaceState(null,'','#'+p.id);renderFiles();}

function renderEdgeCases(p) {
  let panel = $('edge-cases');
  if (!panel) {
    panel = document.createElement('details');
    panel.id = 'edge-cases';
    panel.open = true;
    $('examples').closest('details').after(panel);
  }
  const title = document.createElement('summary');
  title.textContent = `Additional edge cases (${p.extra.length})`;
  const hint = document.createElement('p');
  hint.textContent = 'Expand a case to inspect its input and expected output. Run and Debug include all cases by default. You can also select a single case below the editor. Submit always includes every case.';
  hint.className = 'note';
  panel.replaceChildren(title, hint);
  const select = $('case');
  select.replaceChildren();
  for (const [value, text] of [['all','All cases (examples + edges)'], ['examples','All examples'], ['edges','All edge cases'], ['custom','Custom arguments']]) {
    select.add(new Option(text, value));
  }
  p.extra.forEach((test, index) => {
    const label = `E${index + 1} · ${test.label}`;
    select.add(new Option(label, `edge:${index}`));
    const detail = document.createElement('details');
    const heading = document.createElement('summary');
    heading.textContent = label;
    const pre = document.createElement('pre');
    pre.textContent = 'Arguments (JSON array):\n' + JSON.stringify(test.args) + '\n\nExpected output:\n' + JSON.stringify(test.expected);
    pre.style.maxHeight = '240px';
    pre.style.overflow = 'auto';
    const use = document.createElement('button');
    use.textContent = 'Use this case';
    use.addEventListener('click', () => {
      if (busy) return;
      select.value = `edge:${index}`;
      $('custom').hidden = true;
      $('output').textContent = label + ' selected. Click Run or Debug.';
      select.scrollIntoView({block:'nearest'});
    });
    detail.append(heading, p.language==='sql'?sqlCaseTables(p,test):pre, use);
    panel.append(detail);
  });
  $('custom').hidden = true;
}

// Explicit overrides preserve manual unchecking even when older submissions passed.
const completionOverrides=new Map();
function isSolved(p){
 if(completionOverrides.has(String(p.id)))return completionOverrides.get(String(p.id));
 try{
  const explicit=localStorage.getItem('workspace-solved:'+p.id);
  if(explicit!==null)return explicit==='true';
  const history=JSON.parse(localStorage.getItem('graph-submissions:'+p.id)||'[]');
  return Array.isArray(history)&&history.some(r=>r.total>0&&r.passed===r.total);
 }catch(e){return false;}
}
function markSolved(p,done){
 completionOverrides.set(String(p.id),done);
 try{localStorage.setItem('workspace-solved:'+p.id,String(done));}
 catch(e){status('완료 표시는 이번 방문에만 유지됩니다 · 저장 공간 사용 불가');}
 renderFiles();
}
function renderFiles(){
 const q=$('search').value.toLowerCase();
 const matching=problems.filter(p=>(p.file+p.title+p.id).toLowerCase().includes(q));
 const files=$('files');files.replaceChildren();
 for(const done of [false,true]){
  const group=matching.filter(p=>isSolved(p)===done);if(!group.length)continue;
  const heading=document.createElement('div');heading.className='completion-heading';heading.textContent=(done?'✓ 완료':'남은 문제')+' · '+group.length;files.append(heading);
  for(const p of group){
   const row=document.createElement('div');row.className='problem-row'+(done?' solved':'');
   const check=document.createElement('input');check.type='checkbox';check.checked=done;check.setAttribute('aria-label',p.title+' 완료');
   check.onchange=()=>{markSolved(p,check.checked);document.getElementById('completed-'+p.id)?.focus();};check.id='completed-'+p.id;
   const b=document.createElement('button');b.className='file'+(current?.id===p.id?' active':'');b.title=p.id+'. '+p.title;
   const icon=document.createElement('span');icon.className='python';icon.textContent=p.language==='sql'?'SQL':'Py';
   const name=document.createElement('span');name.textContent=p.file;b.append(icon,name);b.onclick=()=>openProblem(p);
   row.append(check,b);files.append(row);
  }
 }
}
window.addEventListener('storage',e=>{if(e.key===null||e.key.startsWith('workspace-solved:')||e.key.startsWith('graph-submissions:')){completionOverrides.clear();renderFiles();}});
function runtimeFailure(message){clearTimeout(timer);if(worker)worker.terminate();worker=null;ready=false;busy=false;if(runtimeAttempt+1<runtimeSources.length){runtimeAttempt++;$('output').textContent=message+'\n다른 다운로드 경로로 자동 재시도 중…';boot();}else{pendingMode=null;status('Runtime unavailable · click Run to retry');$('output').textContent=message+'\n실행 엔진을 불러오지 못했습니다. Run / Debug / Submit을 누르면 다시 시도합니다. 작성한 코드는 보존됩니다.';buttons();}}
function boot(){if(worker)worker.terminate();ready=false;busy=false;status('Python loading…');worker=new Worker('worker.js?v=runtime-fix-v1&source='+runtimeAttempt,{type:'module'});buttons();clearTimeout(timer);timer=setTimeout(()=>runtimeFailure('Runtime loading timed out.'),30000);
worker.onmessage=({data:m})=>{if(m.type==='progress'){status(m.message);return;}if(m.type==='ready'){clearTimeout(timer);ready=true;status('Python / SQLite · ready');buttons();if(pendingMode){const mode=pendingMode;pendingMode=null;run(mode);}return;}if(m.type==='error'){if(!ready){runtimeFailure(m.error);return;}clearTimeout(timer);busy=false;status('Runtime error');$('output').textContent=m.error;buttons();return;}if(m.type==='result'){clearTimeout(timer);busy=false;buttons();const d=m.data;const passed=d.results.filter(x=>x.ok===true).length;const lines=d.results.map(r=>`[${r.ok===null?'RESULT':r.ok?'PASS':'FAIL'}] case ${r.case}${r.label?' · '+r.label:''}\n`+(r.error?r.error:`  actual: ${JSON.stringify(r.actual)}${r.ok===null?'':'\n  expected: '+JSON.stringify(r.expected)}`));let summary=runMode==='submit'?`LOCAL SUBMISSION: ${passed===runProblem.tests.length+runProblem.extra.length?'PASSED':'FAILED'} (${passed}/${runProblem.tests.length+runProblem.extra.length})\nExamples + additional local tests; not the official LeetCode judge.\n`:'';$('output').textContent=summary+lines.join('\n\n')+(d.output?'\n\nSTDOUT\n'+d.output:'')+`\n\nCompleted in ${d.elapsed} ms.`;if(runProblem.language==='sql')renderSqlResults(d,runMode);status(current?.language==='sql'?'SQLite · ready':'Python · ready');if(runMode==='submit'){if(passed>0&&passed===runProblem.tests.length+runProblem.extra.length&&d.results.length===passed)markSolved(runProblem,true);try{const k='graph-submissions:'+runProblem.id;const old=JSON.parse(localStorage.getItem(k)||'[]');old.unshift({date:new Date().toISOString(),passed,total:runProblem.tests.length+runProblem.extra.length,code:runCode});localStorage.setItem(k,JSON.stringify(old.slice(0,10)));}catch(e){status('Results not saved — storage unavailable');}}if(runMode==='debug'&&d.frames.length){frames=d.frames;frameIndex=0;$('trace-case').replaceChildren();const seenCases=new Set();frames.forEach((f,i)=>{if(!seenCases.has(f.case)){seenCases.add(f.case);$('trace-case').add(new Option('Case '+f.case+' · '+f.label,String(i)));}});$('trace-controls').hidden=false;$('variables').hidden=false;showFrame();if(d.traceTruncated)$('output').textContent+='\nTrace capped at 2,500 events per case; all results are still reported.';}}};worker.onerror=()=>runtimeFailure('Unable to load the execution engine.');}
function stop(message='Execution cancelled. Reloading Python…'){if(worker)worker.terminate();clearTimeout(timer);worker=null;busy=false;ready=false;buttons();$('output').textContent=message;status('Stopped · reload page to restart');}
function run(mode){showExecutionPanel();if(!current){$('output').textContent='문제 목록을 아직 불러오는 중입니다. 잠시 후 다시 눌러 주세요.';return;}if(busy)return;if(!ready){pendingMode=mode;$('output').textContent='실행 엔진을 준비하고 있어요. 준비되면 '+mode+'을 자동으로 실행합니다…';if(!worker){runtimeAttempt=0;boot();}return;}let tests=[...current.tests,...current.extra];const selection=$('case').value;if(selection==='examples')tests=current.tests;if(selection==='edges')tests=current.extra;if(selection.startsWith('edge:'))tests=[current.extra[Number(selection.slice(5))]];if(mode!=='submit'&&$('case').value==='custom'){try{const args=JSON.parse($('custom').value);if(!Array.isArray(args)||args.length!==current.tests[0].args.length)throw new Error('Use a JSON array containing '+current.tests[0].args.length+' function arguments.');tests=[{args}];}catch(e){$('output').textContent='Invalid custom arguments: '+e.message;return;}}if(mode==='submit')tests=[...current.tests,...current.extra];save();resetTrace();runMode=mode;runProblem=current;runCode=value();busy=true;buttons();status(current.language==='sql'?'SQLite · running':'Python · running');$('output').textContent=mode==='debug'?(current.language==='sql'?'Running queries and recording query plans for ':'Recording execution of ')+tests.length+' test cases…':'Running '+tests.length+' test cases…';worker.postMessage({code:runCode,problem:current.id,method:current.method,language:current.language,schema:current.schema,columns:current.columns,ordered:current.ordered,tests,mode});timer=setTimeout(()=>{const elapsed=12;stop(`Time Limit Exceeded (TLE)\nExecution exceeded the ${elapsed}-second local time limit.\nResult: TIME LIMIT EXCEEDED\n\nYour code was stopped; this submission was not marked as solved.\nTip: avoid scanning every word in every BFS iteration.\n\nThis is a local browser limit, not the official LeetCode time limit.`);boot();},12000);}
function showFrame(){const f=frames[frameIndex];$('trace-case').value=String(frames.findIndex(x=>x.case===f.case));$('step').max=frames.length;$('step').value=frameIndex+1;$('trace-label').textContent=` / ${frames.length} · case ${f.case} · line ${f.line} · ${f.event}`;$('variables').textContent=`Case ${f.case} · ${f.label}\nRecorded ${f.function}() · before line execution (return events are after)\n`+Object.entries(f.locals).map(([k,v])=>`${k} = ${v}`).join('\n');$('prev').disabled=frameIndex===0;$('next').disabled=frameIndex===frames.length-1;if(aceEditor){if(marker!=null)aceEditor.session.removeMarker(marker);const Range=ace.require('ace/range').Range;marker=aceEditor.session.addMarker(new Range(f.line-1,0,f.line-1,1),'trace-line','fullLine');aceEditor.gotoLine(f.line,0,false);}else{const lines=value().split('\n');const start=lines.slice(0,f.line-1).join('\n').length+(f.line>1?1:0);$('code').focus();$('code').setSelectionRange(start,start+(lines[f.line-1]||'').length);$('code').scrollTop=Math.max(0,(f.line-5)*32);}}
$('trace-case').onchange=()=>{frameIndex=Number($('trace-case').value);showFrame();};$('search').oninput=renderFiles;$('code').oninput=()=>{save();refreshLines();resetTrace();};$('code').onscroll=()=>{$('gutter').scrollTop=$('code').scrollTop;};$('code').onclick=refreshLines;$('code').onkeyup=refreshLines;
$('code').onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();const t=e.target;const a=t.selectionStart,b=t.selectionEnd;t.setRangeText('    ',a,b,'end');save();refreshLines();}else if(e.key==='Enter'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();const t=e.target;const before=t.value.slice(0,t.selectionStart).split('\n').at(-1);const indent=(before.match(/^\s*/)||[''])[0]+(before.trimEnd().endsWith(':')?'    ':'');t.setRangeText('\n'+indent,t.selectionStart,t.selectionEnd,'end');save();refreshLines();}};
for(const id of ['run','debug','submit'])$(id).onclick=()=>{try{run(id);}catch(e){busy=false;buttons();showExecutionPanel();$('output').textContent='실행 오류: '+(e.stack||e.message||e);}};$('stop').onclick=()=>{pendingMode=null;runtimeAttempt=0;stop();boot();};$('clear').onclick=()=>{$('output').textContent='';};$('case').onchange=()=>{$('custom').hidden=$('case').value!=='custom';};$('prev').onclick=()=>{frameIndex=Math.max(0,frameIndex-1);showFrame();};$('next').onclick=()=>{frameIndex=Math.min(frames.length-1,frameIndex+1);showFrame();};$('step').onchange=()=>{frameIndex=Math.max(0,Math.min(frames.length-1,(Number($('step').value)||1)-1));showFrame();};$('focus').onclick=()=>{$('spec').hidden=!$('spec').hidden;document.querySelector('.work').classList.toggle('focus',$('spec').hidden);aceEditor?.resize();};$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([value()],{type:'text/x-python'}));const a=document.createElement('a');a.href=url;a.download=current.file;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run('run');}});

const leetcodeSlugs = {
  547: 'number-of-provinces',
  802: 'find-eventual-safe-states',
  841: 'keys-and-rooms',
  1129: 'shortest-path-with-alternating-colors',
  1376: 'time-needed-to-inform-all-employees',
  1466: 'reorder-routes-to-make-all-paths-lead-to-the-city-zero',
  1192: 'critical-connections-in-a-network',
  1926: 'nearest-exit-from-entrance-in-maze',
  934: 'shortest-bridge',
  433: 'minimum-genetic-mutation',
  127: 'word-ladder'
};
const leetcodeLink = document.createElement('a');
leetcodeLink.id = 'leetcode';
leetcodeLink.textContent = 'Copy & LeetCode ↗';
leetcodeLink.target = '_blank';
leetcodeLink.rel = 'noopener noreferrer';
leetcodeLink.title = 'Copy your Python code and open this problem on LeetCode. Paste into its Python3 editor, then Submit.';
leetcodeLink.hidden = true;
$('submit').after(leetcodeLink);
const linkStyle = document.createElement('style');
linkStyle.textContent = `
.toolbar > div {display:flex; flex-wrap:wrap; gap:4px; justify-content:flex-end}
#leetcode {display:inline-flex;align-items:center;font-size:16pt;line-height:1.6;padding:5px 10px;border:1px solid #77613d;border-radius:4px;background:#302a20;color:#e4c58e;text-decoration:none;white-space:nowrap}
#leetcode:hover {background:#453923}
#leetcode:focus-visible {outline:2px solid var(--accent);outline-offset:2px}
`;
document.head.append(linkStyle);
leetcodeLink.addEventListener('click', async () => {
  // Keep the anchor's normal navigation: the new tab opens directly from the click.
  const code = value();
  const sql=current.language==='sql';
  save();
  try {
    await navigator.clipboard.writeText(code);
    status('Code copied · paste into LeetCode '+(sql?'SQL':'Python3')+', then Submit');
    $('output').textContent = sql?'SQL copied. Choose a SQL dialect on LeetCode and adjust SQLite date functions if necessary before submitting.':'Code copied. In the LeetCode tab, select Python3, replace the starter code with Ctrl/Cmd + V, then click Submit. Sign in there if required.';
  } catch (error) {
    status('Copy manually · clipboard access unavailable');
    $('output').textContent = 'LeetCode opened, but automatic copy was blocked. Select and copy your code manually into the matching language editor.';
    if (aceEditor) {aceEditor.focus(); aceEditor.selectAll();}
    else {$('code').focus(); $('code').select();}
  }
});


function renderExampleImages(p) {
  let area=$('example-images');
  if(!area){area=document.createElement('div');area.id='example-images';$('examples').after(area);}
  area.replaceChildren();
  $('examples').parentElement.querySelector('.note').textContent=(p.images||[]).length?'Original example text and supplied diagram links.':p.language==='sql'?'Practice datasets. Each test starts with a fresh database.':'Original example text. Diagrams referenced in this text were not supplied as image links.';
  (p.images||[]).forEach((url,index)=>{
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';
    const img=document.createElement('img');img.src=url;img.loading='lazy';img.alt=p.title+' · supplied example diagram '+(index+1);img.style.cssText='max-width:100%;height:auto;background:white;border-radius:5px;margin:8px 0';
    a.append(img);area.append(a);
  });
}
const editorialButton=document.createElement('button');
editorialButton.id='editorial-button';editorialButton.textContent='Solutions · 3 approaches';
editorialButton.title='English explanations, three Python solutions, and time/space complexity';
$('run').after(editorialButton);
import('./animations.js?v=animation-restored-v2').then(m=>{m.installAnimations(editorialButton,()=>current);if(current)$('animation-button').hidden=current.hasAnimation===false;}).catch(e=>console.error('Animation player unavailable',e));
const editorialDialog=document.createElement('dialog');
editorialDialog.id='editorial-dialog';editorialDialog.lang='en';
editorialDialog.setAttribute('aria-labelledby','editorial-title');
document.body.append(editorialDialog);
let editorialDataPromise;
editorialButton.onclick=async()=>{
  const selected=current;if(!selected)return;
  editorialDialog.replaceChildren();
  const head=document.createElement('div');head.className='editorial-head';
  const title=document.createElement('h2');title.id='editorial-title';title.textContent=selected.id+' · '+selected.title;
  const close=document.createElement('button');close.textContent='Close ×';close.onclick=()=>editorialDialog.close();head.append(title,close);
  const body=document.createElement('div');body.className='editorial-body';body.textContent='Loading explanations…';editorialDialog.append(head,body);editorialDialog.showModal();
  try{
    editorialDataPromise ||= fetch('editorials.json?v=readable-en-v1').then(r=>{if(!r.ok)throw new Error('Could not load the explanations.');return r.json();}).catch(e=>{editorialDataPromise=null;throw e;});
    const data=(await editorialDataPromise)[String(selected.id)];
    if(current!==selected||!editorialDialog.open)return;
    if(!data)throw new Error('No explanation was found for this problem.');
    body.replaceChildren();
    const intro=document.createElement('p');intro.className='editorial-intro';intro.textContent=data.summary;
    const caution=document.createElement('p');caution.className='editorial-caution';caution.textContent='Watch out · '+data.pitfall;
    const table=document.createElement('table');table.className='complexity-table';
    const row=document.createElement('tr');for(const label of ['Approach','Time complexity','Space complexity']){const th=document.createElement('th');th.textContent=label;row.append(th);}table.append(row);
    data.methods.forEach((m,i)=>{const tr=document.createElement('tr');for(const value of [(i+1)+'. '+m.name,m.time,m.space]){const td=document.createElement('td');td.textContent=value;tr.append(td);}table.append(tr);});
    const notation=document.createElement('details');const ns=document.createElement('summary');ns.textContent='Complexity notation';const np=document.createElement('p');np.textContent=data.notation;notation.append(ns,np);
    body.append(intro,caution,table,notation);
    data.methods.forEach((m,i)=>{
      const section=document.createElement('details');section.className='editorial-method';section.open=i===0;
      const summary=document.createElement('summary');summary.textContent='Method '+(i+1)+' · '+m.name;
      const idea=document.createElement('p');idea.textContent=m.idea;
      const list=document.createElement('ol');m.steps.forEach(step=>{const li=document.createElement('li');li.textContent=step;list.append(li);});
      const bar=document.createElement('div');bar.className='editorial-codebar';const label=document.createElement('span');label.textContent='Python 3 · standalone Solution code';
      const copy=document.createElement('button');copy.textContent='Copy code';
      const pre=document.createElement('pre');const code=document.createElement('code');code.textContent=m.code;pre.append(code);
      copy.onclick=async()=>{try{await navigator.clipboard.writeText(m.code);copy.textContent='Copied';}catch(e){const selection=window.getSelection();const range=document.createRange();range.selectNodeContents(code);selection.removeAllRanges();selection.addRange(range);copy.textContent='Press Ctrl/Cmd+C to copy the selected code';}};
      bar.append(label,copy);section.append(summary,idea,list,bar,pre);body.append(section);
    });
    const note=document.createElement('p');note.className='note';note.textContent='These explanations and solutions have been checked against the original examples and additional local tests. Slower comparison methods and recursion limits are noted where relevant. Copy a solution into the editor and use Run or Debug to explore it.';body.append(note);
  }catch(e){body.textContent=e.message;}
};

async function init(){try{const response=await fetch('problems.json');if(!response.ok)throw new Error('Could not load modules');problems=await response.json();const stringsResponse=await fetch('strings.json?v=string10-v1');if(!stringsResponse.ok)throw new Error('Could not load string modules');problems.push(...await stringsResponse.json());const sqlResponse=await fetch('sql-problems.json?v=sql31-v1');if(!sqlResponse.ok)throw new Error('Could not load SQL modules');problems.push(...await sqlResponse.json());openProblem(problems.find(p=>String(p.id)===location.hash.slice(1))||problems[0]);boot();const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/ace/1.36.2/ace.js';script.onload=()=>{const text=value();$('ace').hidden=false;aceEditor=ace.edit('ace');aceEditor.setTheme('ace/theme/tomorrow_night');aceEditor.session.setMode(current?.language==='sql'?'ace/mode/sql':'ace/mode/python');aceEditor.setOptions({showPrintMargin:false,fontSize:'16pt',tabSize:4,useSoftTabs:true});aceEditor.setValue(text,-1);$('code').hidden=true;$('gutter').hidden=true;aceEditor.session.on('change',()=>{save();resetTrace();});aceEditor.selection.on('changeCursor',()=>{const p=aceEditor.getCursorPosition();$('position').textContent=`Ln ${p.row+1}, Col ${p.column+1}`;});aceEditor.commands.addCommand({name:'runTests',bindKey:{win:'Ctrl-Enter',mac:'Command-Enter'},exec:()=>run('run')});};document.head.append(script);}catch(e){$('output').textContent=e.message;status('Workspace unavailable');}}init();



function setLanguage(p){
 const sql=p.language==='sql';
 leetcodeLink.title=sql?'Copy SQL and open LeetCode; adjust the SQL dialect if needed.':'Copy Python code and open LeetCode.';
 document.querySelector('.toolbar > span').textContent=sql?'SQL · SQLite':'Python 3';
 document.querySelector('.tab .python').textContent=sql?'SQL':'Py';
 $('download').textContent=sql?'Export .sql':'Export .py';
 $('debug').textContent=sql?'⌁ Query plan':'⌁ Debug';
 $('debug').title=sql?'Execute query and inspect SQLite EXPLAIN QUERY PLAN':'Trace Python execution';
 $('code').setAttribute('aria-label',sql?'SQL query editor':'Python code editor');
 $('custom').setAttribute('aria-label',sql?'Custom table rows as JSON: [{TableName: [[values]]}]':'Custom arguments as JSON array');
 $('custom').placeholder=sql?'[{"TableName": [[1, "value"]]}]':'Function arguments as JSON array';
 if(aceEditor)aceEditor.session.setMode(sql?'ace/mode/sql':'ace/mode/python');
 if(ready)status(sql?'SQLite · ready':'Python · ready');
 document.querySelector('footer > span:last-child').textContent=sql?'UTF-8 · SQL':'UTF-8 · Python';
}

function sqlTable(title,columns,rows,types){
 const section=document.createElement('section');section.className='sql-sheet';
 const label=document.createElement('h3');label.textContent=title+' · '+rows.length+' rows';section.append(label);
 const wrap=document.createElement('div');wrap.className='sql-sheet-scroll';wrap.tabIndex=0;wrap.setAttribute('aria-label',title+' table');
 const table=document.createElement('table');table.className='sql-data-table';
 const caption=document.createElement('caption');caption.textContent=title;table.append(caption);
 const head=document.createElement('thead'),hr=document.createElement('tr');
 const corner=document.createElement('th');corner.textContent='#';corner.scope='col';hr.append(corner);
 columns.forEach((name,i)=>{const th=document.createElement('th');th.scope='col';th.textContent=name;if(types){const small=document.createElement('small');small.textContent=types[i];th.append(small);}hr.append(th);});
 head.append(hr);table.append(head);
 const body=document.createElement('tbody');
 rows.forEach((row,i)=>{const tr=document.createElement('tr'),idx=document.createElement('th');idx.scope='row';idx.textContent=i+1;tr.append(idx);row.forEach(value=>{const td=document.createElement('td');td.textContent=value===null?'NULL':String(value);if(value===null)td.className='sql-null';if(typeof value==='number')td.className='sql-number';tr.append(td);});body.append(tr);});
 if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=columns.length+1;td.textContent='No rows';tr.append(td);body.append(tr);}
 table.append(body);wrap.append(table);section.append(wrap);return section;
}
function sqlCaseTables(p,test){
 const box=document.createElement('div');box.className='sql-case-tables';
 for(const [name,cols] of Object.entries(p.schema))box.append(sqlTable(name,cols.map(c=>c[0]),test.args[0][name]||[],cols.map(c=>c[1])));
 box.append(sqlTable('Expected result · 정답',p.columns,test.expected));
 return box;
}
function renderSqlExamples(p){
 let area=$('sql-examples');if(!area){area=document.createElement('div');area.id='sql-examples';$('examples').after(area);}
 const sql=p.language==='sql';$('examples').hidden=sql;area.hidden=!sql;area.replaceChildren();
 if(sql)p.tests.forEach((test,i)=>{const label=document.createElement('h2');label.textContent='Example '+(i+1);area.append(label,sqlCaseTables(p,test));});
}
function renderSqlResults(data,mode){
 const output=$('output');output.replaceChildren();
 const summary=document.createElement('div');summary.className='sql-result-summary';
 const passed=data.results.filter(r=>r.ok===true).length;
 summary.textContent=(mode==='submit'?'LOCAL SUBMISSION · ':'')+passed+'/'+data.results.length+' passed · '+data.elapsed+' ms';output.append(summary);
 data.results.forEach(r=>{const section=document.createElement('section');section.className='sql-result-case';const h=document.createElement('h3');h.textContent=(r.ok===null?'RESULT':r.ok?'PASS':'FAIL')+' · Case '+r.case;section.append(h);
 if(r.error){const e=document.createElement('pre');e.textContent=r.error;section.append(e);}
 else{section.append(sqlTable('Actual result · 실행 결과',r.actual.columns,r.actual.rows));if(r.expected)section.append(sqlTable('Expected result · 정답',r.expected.columns,r.expected.rows));}output.append(section);});
 if(data.output){const pre=document.createElement('pre');pre.textContent=data.output;output.append(pre);}
}
const sqlTableStyle=document.createElement('style');
sqlTableStyle.textContent=`
#sql-examples[hidden], #examples[hidden]{display:none!important}
.sql-case-tables,.sql-sheet,.sql-result-case{white-space:normal;min-width:0;max-width:100%}
.sql-sheet{margin:14px 0 20px}
.sql-sheet h3{font:600 14px/1.5 system-ui,sans-serif;margin:0;padding:9px 12px;background:#213c35;color:#bcebd9;border:1px solid #436159;border-bottom:0;border-radius:6px 6px 0 0;overflow-wrap:anywhere}
.sql-sheet-scroll{max-width:100%;overflow:auto;border:1px solid #436159;border-radius:0 0 6px 6px}
.sql-data-table{border-collapse:collapse;width:100%;margin:0;font:14px/1.5 ui-monospace,monospace;color:#e1e8ef;background:#192129}
.sql-data-table caption{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.sql-data-table th,.sql-data-table td{padding:8px 12px!important;border:1px solid #34424c!important;text-align:left;white-space:nowrap;font-size:14px!important}
.sql-data-table thead th{background:#293d43;color:#d7f4e8;font-weight:600;position:sticky;top:0}
.sql-data-table th small{display:block;font:10px/1.4 system-ui,sans-serif;color:#9ab6b5}
.sql-data-table tbody th{width:30px;background:#202c34;color:#84959f;font-weight:400;text-align:right}
.sql-data-table tbody tr:nth-child(even) td{background:#202b34}
.sql-data-table tbody tr:hover td{background:#2d4247}
.sql-data-table td.sql-number{text-align:right}
.sql-data-table td.sql-null{color:#9ba7b2;font-style:italic}
.sql-result-summary{white-space:normal;font-weight:600;padding:8px 0;color:#a7e3cb}
#sql-examples>h2{font-size:16px;margin-top:12px}
`;
document.head.append(sqlTableStyle);

let executionDialog;
function showExecutionPanel(){
 if(!executionDialog){
  executionDialog=document.createElement('dialog');executionDialog.id='execution-dialog';
  const header=document.createElement('div');header.className='execution-heading';
  const title=document.createElement('h2');title.textContent='실행 결과 · Run / Debug / Submit';
  const close=document.createElement('button');close.textContent='닫기 ×';close.onclick=()=>executionDialog.close();
  header.append(title,close);executionDialog.append(header);document.body.append(executionDialog);
  const consolePanel=document.querySelector('.console');
  const placeholder=document.createComment('console location');consolePanel.before(placeholder);
  executionDialog.addEventListener('close',()=>{placeholder.after(consolePanel);aceEditor?.resize();});
  executionDialog.consolePanel=consolePanel;
 }
 executionDialog.append(executionDialog.consolePanel);
 if(!executionDialog.open)executionDialog.showModal();
}
window.addEventListener('error',event=>{
 const out=$('output');if(out)out.textContent='페이지 오류: '+event.message+'\n'+(event.filename||'')+':'+event.lineno;
 status('Page error · see execution results');
});
window.addEventListener('unhandledrejection',event=>{
 const out=$('output');if(out)out.textContent='실행 준비 오류: '+String(event.reason?.message||event.reason);
 status('Runtime error · see execution results');
});
const executionStyle=document.createElement('style');executionStyle.textContent=`
#execution-dialog{width:min(1100px,96vw);max-height:90dvh;padding:0;background:#14171c;color:#d9dee7;border:1px solid #587e68;border-radius:10px}
#execution-dialog::backdrop{background:#0009}
.execution-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;position:sticky;top:0;background:#1c2925;z-index:2}
.execution-heading h2{font-size:18px;margin:0}
#execution-dialog .console{height:auto;min-height:240px;max-height:75dvh;overflow:auto;resize:none;margin:0}
`;document.head.append(executionStyle);

// A collapsible prompt composer opens the user's own ChatGPT session.
const gptPanel=document.createElement('details');gptPanel.id='gpt-panel';
gptPanel.innerHTML=`<summary>ChatGPT에 질문하기 · 펼치기</summary>
<div class="gpt-body"><p>현재 문제와 코드를 질문에 함께 담아요. 답변은 별도 ChatGPT 창에서 받을 수 있어요. 그 창에서 본인 계정으로 로그인하세요.</p>
<label for="gpt-question">질문</label><textarea id="gpt-question" rows="3" placeholder="이 코드에서 틀린 부분을 전 → 후로 알려줘"></textarea>
<label class="gpt-option"><input id="gpt-output" type="checkbox"> 현재 실행 결과도 포함</label>
<div class="gpt-actions"><button id="gpt-copy-open">질문 복사 + ChatGPT 열기 ↗</button><button id="gpt-preview-button">복사할 내용 보기</button><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT 열기 ↗</a></div>
<p id="gpt-status" role="status"></p><textarea id="gpt-preview" rows="8" readonly hidden aria-label="ChatGPT에 붙여넣을 내용"></textarea></div>`;
document.querySelector('.coding').prepend(gptPanel);
function gptPrompt(){
 if(!current)return '';
 const question=$('gpt-question').value.trim()||'이 코드를 검토하고 틀린 부분을 전 → 후로 설명해 줘. 한국어로 답해 줘.';
 return ['문제: '+current.id+' · '+current.title,...current.rules,'예시:',current.examples,'제약:',current.constraints,'내 코드 ('+(current.language==='sql'?'SQL / SQLite':'Python 3')+'):',value(),...($('gpt-output').checked?['현재 실행 결과:',$('output').innerText]:[]),'질문:',question].join('\n\n');
}
$('gpt-preview-button').onclick=()=>{$('gpt-preview').value=gptPrompt();$('gpt-preview').hidden=false;};
$('gpt-copy-open').onclick=()=>{
 if(!current){$('gpt-status').textContent='문제를 불러온 후 다시 눌러 주세요.';return;}
 const prompt=gptPrompt();$('gpt-preview').value=prompt;
 window.open('https://chatgpt.com/','_blank','noopener,noreferrer');
 navigator.clipboard.writeText(prompt).then(()=>{$('gpt-status').textContent='복사했어요! ChatGPT 창에 Ctrl/Cmd + V로 붙여넣고 보내세요. 창이 안 열리면 ChatGPT 열기 링크를 누르세요.';}).catch(()=>{
  $('gpt-preview').hidden=false;$('gpt-preview').focus();$('gpt-preview').select();$('gpt-status').textContent='자동 복사가 차단되었어요. 선택된 내용을 Ctrl/Cmd + C로 복사해 ChatGPT에 붙여넣으세요.';
 });
};
gptPanel.addEventListener('toggle',()=>aceEditor?.resize());
const progressStyle=document.createElement('style');progressStyle.textContent=`
.completion-heading{padding:12px 14px 6px;color:#a5b8c9;font:600 13px/1.5 system-ui}
.problem-row{display:flex;align-items:center;gap:5px;padding-left:10px;min-width:0}
.problem-row input{flex:none;width:17px;height:17px;accent-color:#80c7a2;cursor:pointer}
.problem-row .file{flex:1;min-width:0}.problem-row.solved .file{color:#9cb8a9}
#gpt-panel{flex:none;border-bottom:1px solid #395447;background:#192620;padding:10px 14px;max-height:45dvh;overflow:auto}
#gpt-panel summary{cursor:pointer;color:#b5e3c8;font:600 15px/1.5 system-ui}
.gpt-body{font:14px/1.5 system-ui;color:#d5e4db}.gpt-body p{margin:8px 0}
#gpt-question,#gpt-preview{display:block;box-sizing:border-box;width:100%;margin:6px 0;padding:10px;background:#111b17;color:#e1eee6;border:1px solid #557161;border-radius:6px;font:14px/1.5 system-ui;resize:vertical}
#gpt-preview[hidden]{display:none}.gpt-option{display:flex;align-items:center;gap:6px}.gpt-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:8px}.gpt-actions a{color:#b5e3c8}#gpt-status{font-size:13px}
`;document.head.append(progressStyle);


/* SQL schema is always visible above the editor, with FROM-ready table names. */
const sqlSchemaPanel=document.createElement('section');
sqlSchemaPanel.id='sql-schema-panel';
sqlSchemaPanel.style.cssText='padding:12px 16px;background:#18242e;color:#e2edf7;border-bottom:2px solid #638db1;font:14px/1.5 system-ui;max-height:210px;overflow:auto';
document.querySelector('.toolbar').before(sqlSchemaPanel);
function showSqlSchema(){
 if(!current||current.language!=='sql'||!current.schema){sqlSchemaPanel.hidden=true;return;}
 sqlSchemaPanel.hidden=false;
 const heading=document.createElement('strong');heading.textContent='DATABASE TABLES · FROM / JOIN';heading.style.cssText='display:block;color:#a8d5fa;font-size:16px;margin-bottom:8px';
 const wrap=document.createElement('div');wrap.style.cssText='display:flex;gap:12px;flex-wrap:wrap';
 for(const [name,cols] of Object.entries(current.schema)){
  const table=document.createElement('div');table.style.cssText='padding:8px 12px;background:#233545;border:1px solid #42647f;border-radius:7px;min-width:155px';
  const title=document.createElement('strong');title.textContent=name;title.style.cssText='color:#fff;font-size:17px;display:block';
  const fields=document.createElement('div');fields.textContent=cols.map(c=>c[0]+' ('+c[1]+')').join(' · ');fields.style.cssText='font-size:13px;color:#c6d8e8;margin-top:4px';
  table.append(title,fields);wrap.append(table);
 }
 sqlSchemaPanel.replaceChildren(heading,wrap);
}
const originalOpenProblem=openProblem;
openProblem=function(p){originalOpenProblem(p);showSqlSchema();};
showSqlSchema();
