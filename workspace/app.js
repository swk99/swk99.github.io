'use strict';
const $=id=>document.getElementById(id);
let problems=[],current,worker,ready=false,busy=false,timer,aceEditor,frames=[],frameIndex=0,marker,runMode,runProblem,runCode;
const value=()=>aceEditor?aceEditor.getValue():$('code').value;
function status(s){$('runtime').textContent=s;}
function save(){if(!current)return;try{localStorage.setItem('graph-workspace:'+current.id,value());$('saved').textContent='●';}catch(e){$('saved').textContent='!';status('Storage unavailable — export your code');}}
function refreshLines(){const text=value();$('gutter').textContent=text.split('\n').map((_,i)=>i+1).join('\n');const p=$('code').selectionStart;const before=text.slice(0,p).split('\n');$('position').textContent=`Ln ${before.length}, Col ${before.at(-1).length+1}`;}
function buttons(){for(const id of ['run','debug','submit'])$(id).disabled=!ready||busy;$('stop').disabled=!busy&&!(!ready&&worker);$('case').disabled=busy;}
function resetTrace(){frames=[];$('trace-controls').hidden=true;$('variables').hidden=true;if(aceEditor&&marker!=null){aceEditor.session.removeMarker(marker);marker=null;}}
function openProblem(p){if(busy)stop('Execution stopped: module changed.');save();current=p;leetcodeLink.href='https://leetcode.com/problems/'+leetcodeSlugs[p.id]+'/description/';leetcodeLink.hidden=!leetcodeSlugs[p.id];resetTrace();$('filename').textContent=p.file;$('crumb').textContent=p.file;$('pid').textContent='#'+p.id;$('problem-title').textContent=p.title;$('rules').replaceChildren(...p.rules.map(r=>{const li=document.createElement('li');li.textContent=r;return li;}));$('examples').textContent=p.examples;$('constraints').textContent=p.constraints;$('custom').value=JSON.stringify(p.tests[0].args);$('test-count').textContent=`${p.tests.length} examples · ${p.extra.length} additional tests`;
let draft;try{draft=localStorage.getItem('graph-workspace:'+p.id);}catch(e){}$('code').value=draft??p.starter;if(aceEditor)aceEditor.setValue($('code').value,-1);refreshLines();$('output').textContent=`${p.file} ready. Implement Solution.${p.method}().`;history.replaceState(null,'','#'+p.id);renderFiles();}
function renderFiles(){const q=$('search').value.toLowerCase();$('files').replaceChildren(...problems.filter(p=>(p.file+p.title+p.id).toLowerCase().includes(q)).map(p=>{const b=document.createElement('button');b.className='file'+(current?.id===p.id?' active':'');b.title=p.id+'. '+p.title;const icon=document.createElement('span');icon.className='python';icon.textContent='Py';const name=document.createElement('span');name.textContent=p.file;b.append(icon,name);b.onclick=()=>openProblem(p);return b;}));}
function boot(){if(worker)worker.terminate();ready=false;busy=false;status('Python loading…');worker=new Worker('worker.js',{type:'module'});buttons();clearTimeout(timer);timer=setTimeout(()=>stop('Runtime loading timed out. Check CDN access, then reload the page.'),90000);
worker.onmessage=({data:m})=>{if(m.type==='ready'){clearTimeout(timer);ready=true;status('Python '+m.version+' · ready');buttons();return;}if(m.type==='error'){clearTimeout(timer);busy=false;status('Runtime error');$('output').textContent=m.error;buttons();return;}if(m.type==='result'){clearTimeout(timer);busy=false;buttons();const d=m.data;const passed=d.results.filter(x=>x.ok===true).length;const lines=d.results.map(r=>`[${r.ok===null?'RESULT':r.ok?'PASS':'FAIL'}] case ${r.case}\n`+(r.error?r.error:`  actual: ${JSON.stringify(r.actual)}${r.ok===null?'':'\n  expected: '+JSON.stringify(r.expected)}`));let summary=runMode==='submit'?`LOCAL SUBMISSION: ${passed===runProblem.tests.length+runProblem.extra.length?'PASSED':'FAILED'} (${passed}/${runProblem.tests.length+runProblem.extra.length})\nExamples + additional local tests; not the official LeetCode judge.\n`:'';$('output').textContent=summary+lines.join('\n\n')+(d.output?'\n\nSTDOUT\n'+d.output:'')+`\n\nCompleted in ${d.elapsed} ms.`;status('Python · ready');if(runMode==='submit'){try{const k='graph-submissions:'+runProblem.id;const old=JSON.parse(localStorage.getItem(k)||'[]');old.unshift({date:new Date().toISOString(),passed,total:runProblem.tests.length+runProblem.extra.length,code:runCode});localStorage.setItem(k,JSON.stringify(old.slice(0,10)));}catch(e){status('Results not saved — storage unavailable');}}if(runMode==='debug'&&d.frames.length){frames=d.frames;frameIndex=0;$('trace-controls').hidden=false;$('variables').hidden=false;showFrame();if(d.traceTruncated)$('output').textContent+='\nTrace capped at 2,500 events.';}}};worker.onerror=()=>{clearTimeout(timer);busy=false;ready=false;status('Python unavailable');$('output').textContent='Unable to load Python. Check network/CDN access and reload.';buttons();};}
function stop(message='Execution cancelled. Reloading Python…'){if(worker)worker.terminate();clearTimeout(timer);worker=null;busy=false;ready=false;buttons();$('output').textContent=message;status('Stopped · reload page to restart');}
function run(mode){if(!ready||busy)return;let tests=current.tests;if(mode!=='submit'&&$('case').value==='custom'){try{const args=JSON.parse($('custom').value);if(!Array.isArray(args)||args.length!==current.tests[0].args.length)throw new Error('Use a JSON array containing '+current.tests[0].args.length+' function arguments.');tests=[{args}];}catch(e){$('output').textContent='Invalid custom arguments: '+e.message;return;}}if(mode==='debug')tests=tests.slice(0,1);if(mode==='submit')tests=[...current.tests,...current.extra];save();resetTrace();runMode=mode;runProblem=current;runCode=value();busy=true;buttons();status('Python · running');$('output').textContent=mode==='debug'?'Recording execution of the first selected case…':'Running '+tests.length+' test cases…';worker.postMessage({code:runCode,problem:current.id,method:current.method,tests,mode});timer=setTimeout(()=>{stop('Execution timed out after 12 seconds. Python is restarting…');boot();},12000);}
function showFrame(){const f=frames[frameIndex];$('step').max=frames.length;$('step').value=frameIndex+1;$('trace-label').textContent=` / ${frames.length} · line ${f.line} · ${f.event}`;$('variables').textContent=`Recorded ${f.function}() · before line execution (return events are after)\n`+Object.entries(f.locals).map(([k,v])=>`${k} = ${v}`).join('\n');$('prev').disabled=frameIndex===0;$('next').disabled=frameIndex===frames.length-1;if(aceEditor){if(marker!=null)aceEditor.session.removeMarker(marker);const Range=ace.require('ace/range').Range;marker=aceEditor.session.addMarker(new Range(f.line-1,0,f.line-1,1),'trace-line','fullLine');aceEditor.gotoLine(f.line,0,false);}else{const lines=value().split('\n');const start=lines.slice(0,f.line-1).join('\n').length+(f.line>1?1:0);$('code').focus();$('code').setSelectionRange(start,start+(lines[f.line-1]||'').length);$('code').scrollTop=Math.max(0,(f.line-5)*22);}}
$('search').oninput=renderFiles;$('code').oninput=()=>{save();refreshLines();resetTrace();};$('code').onscroll=()=>{$('gutter').scrollTop=$('code').scrollTop;};$('code').onclick=refreshLines;$('code').onkeyup=refreshLines;
$('code').onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();const t=e.target;const a=t.selectionStart,b=t.selectionEnd;t.setRangeText('    ',a,b,'end');save();refreshLines();}else if(e.key==='Enter'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();const t=e.target;const before=t.value.slice(0,t.selectionStart).split('\n').at(-1);const indent=(before.match(/^\s*/)||[''])[0]+(before.trimEnd().endsWith(':')?'    ':'');t.setRangeText('\n'+indent,t.selectionStart,t.selectionEnd,'end');save();refreshLines();}};
for(const id of ['run','debug','submit'])$(id).onclick=()=>run(id);$('stop').onclick=()=>{stop();boot();};$('clear').onclick=()=>{$('output').textContent='';};$('case').onchange=()=>{$('custom').hidden=$('case').value!=='custom';};$('prev').onclick=()=>{frameIndex=Math.max(0,frameIndex-1);showFrame();};$('next').onclick=()=>{frameIndex=Math.min(frames.length-1,frameIndex+1);showFrame();};$('step').onchange=()=>{frameIndex=Math.max(0,Math.min(frames.length-1,(Number($('step').value)||1)-1));showFrame();};$('focus').onclick=()=>{$('spec').hidden=!$('spec').hidden;document.querySelector('.work').classList.toggle('focus',$('spec').hidden);aceEditor?.resize();};$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([value()],{type:'text/x-python'}));const a=document.createElement('a');a.href=url;a.download=current.file;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run('run');}});

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
#leetcode {display:inline-flex;align-items:center;font-size:11px;line-height:1.6;padding:5px 10px;border:1px solid #77613d;border-radius:4px;background:#302a20;color:#e4c58e;text-decoration:none;white-space:nowrap}
#leetcode:hover {background:#453923}
#leetcode:focus-visible {outline:2px solid var(--accent);outline-offset:2px}
`;
document.head.append(linkStyle);
leetcodeLink.addEventListener('click', async () => {
  // Keep the anchor's normal navigation: the new tab opens directly from the click.
  const code = value();
  save();
  try {
    await navigator.clipboard.writeText(code);
    status('Code copied · paste into LeetCode Python3, then Submit');
    $('output').textContent = 'Code copied. In the LeetCode tab, select Python3, replace the starter code with Ctrl/Cmd + V, then click Submit. Sign in there if required.';
  } catch (error) {
    status('Copy manually · clipboard access unavailable');
    $('output').textContent = 'LeetCode opened, but automatic copy was blocked. Select and copy your code from this editor, then paste into the LeetCode Python3 editor and click Submit.';
    if (aceEditor) {aceEditor.focus(); aceEditor.selectAll();}
    else {$('code').focus(); $('code').select();}
  }
});

async function init(){try{const response=await fetch('problems.json');if(!response.ok)throw new Error('Could not load modules');problems=await response.json();openProblem(problems.find(p=>String(p.id)===location.hash.slice(1))||problems[0]);boot();const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/ace/1.36.2/ace.js';script.onload=()=>{const text=value();$('ace').hidden=false;aceEditor=ace.edit('ace');aceEditor.setTheme('ace/theme/tomorrow_night');aceEditor.session.setMode('ace/mode/python');aceEditor.setOptions({showPrintMargin:false,fontSize:13,tabSize:4,useSoftTabs:true});aceEditor.setValue(text,-1);$('code').hidden=true;$('gutter').hidden=true;aceEditor.session.on('change',()=>{save();resetTrace();});aceEditor.selection.on('changeCursor',()=>{const p=aceEditor.getCursorPosition();$('position').textContent=`Ln ${p.row+1}, Col ${p.column+1}`;});aceEditor.commands.addCommand({name:'runTests',bindKey:{win:'Ctrl-Enter',mac:'Command-Enter'},exec:()=>run('run')});};document.head.append(script);}catch(e){$('output').textContent=e.message;status('Workspace unavailable');}}init();
