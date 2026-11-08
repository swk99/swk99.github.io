'use strict';
const $=id=>document.getElementById(id);
let runtimeAttempt=0,pendingMode=null,switchingProblem=false;
const runtimeSources=['https://cdn.jsdelivr.net/pyodide/v314.0.7/full/','https://unpkg.com/pyodide@314.0.7/'];
let problems=[],current,worker,ready=false,busy=false,timer,aceEditor,frames=[],frameIndex=0,marker,runMode,runProblem,runCode;
const languageButtons=document.querySelectorAll('.workspace-languages button');
const lastProblemByLanguage=new Map();
const problemLanguage=p=>p?.language==='sql'?'sql':'python';
for(const button of languageButtons)button.onclick=()=>{
 const language=button.dataset.language;
 if(language===problemLanguage(current))return;
 const problem=lastProblemByLanguage.get(language)||(language==='sql'?problems.find(p=>p.study&&!isSolved(p)):null)||problems.find(p=>problemLanguage(p)===language);
 if(!problem)return;
 $('search').value='';
 openProblem(problem);
};

$('kodori-start').onclick=()=>{
 const course=problems.filter(p=>String(p.id).startsWith('kodori-sql-')&&!p.retired);
 const lesson=course.find(p=>!isSolved(p))||course[0];
 if(lesson){$('search').value='';openProblem(lesson);$('problem-title').focus();}
};
const value=()=>aceEditor?aceEditor.getValue():$('code').value;
function status(s){$('runtime').textContent=s;}
function save(){if(!current||switchingProblem)return;try{localStorage.setItem('graph-workspace:'+current.id,value());$('saved').textContent='●';}catch(e){$('saved').textContent='!';status('Storage unavailable — export your code');}}
const editorWrap=document.querySelector('.editor-wrap');
function resizeEditor(lineCount){
 const lineHeight=aceEditor?.renderer.lineHeight||32;
 const height=(lineCount+1)*lineHeight+36+'px';
 if(editorWrap.style.getPropertyValue('--editor-content-height')===height)return;
 editorWrap.style.setProperty('--editor-content-height',height);
 aceEditor?.resize();
}
function refreshLines(){
 if(aceEditor){
  resizeEditor(aceEditor.session.getLength());
  return;
 }
 const text=value();
 const lines=text.split('\n');
 resizeEditor(lines.length);
 $('gutter').textContent=lines.map((_,i)=>i+1).join('\n');
 const before=text.slice(0,$('code').selectionStart).split('\n');
 $('position').textContent=`Ln ${before.length}, Col ${before.at(-1).length+1}`;
}
function buttons(){for(const id of ['run','debug','submit'])$(id).disabled=!current||busy;$('stop').disabled=!busy&&!(!ready&&worker);$('case').disabled=busy;}
function resetTrace(){frames=[];$('trace-controls').hidden=true;$('variables').hidden=true;if(aceEditor&&marker!=null){aceEditor.session.removeMarker(marker);marker=null;}}
function openProblem(p){window.workspaceAnimationClose?.();pendingMode=null;if(busy){stop('Execution stopped: module changed.');boot();}save();switchingProblem=true;current=p;const language=problemLanguage(p);lastProblemByLanguage.set(language,p);
for(const button of languageButtons){
 button.disabled=false;
 button.setAttribute('aria-pressed',String(button.dataset.language===language));
}
setLanguage(p);editorialButton.hidden=p.hasEditorial===false;const animationButton=$('animation-button');if(animationButton)animationButton.hidden=p.hasAnimation===false;if(editorialDialog.open)editorialDialog.close();leetcodeLink.href='https://leetcode.com/problems/'+(p.slug||leetcodeSlugs[p.id])+'/description/';leetcodeLink.hidden=!(p.slug||leetcodeSlugs[p.id]);resetTrace();$('filename').textContent=p.file;$('crumb').textContent=p.file;$('pid').textContent=p.study?'#'+p.study.number:'#'+p.id;$('problem-title').textContent=p.title;$('rules').replaceChildren(...p.rules.map(r=>{const li=document.createElement('li');li.textContent=r;return li;}));renderSqlStudy(p);$('examples').textContent=p.examples;renderSqlExamples(p);renderExampleImages(p);$('constraints').textContent=p.constraints;$('custom').value=JSON.stringify(p.tests[0].args);$('test-count').textContent=`${p.tests.length} examples · ${p.extra.length} edge cases`;renderEdgeCases(p);
let draft;try{draft=localStorage.getItem('graph-workspace:'+p.id);}catch(e){}$('code').value=draft??p.starter;if(aceEditor)aceEditor.setValue($('code').value,-1);switchingProblem=false;refreshLines();$('output').textContent=`${p.file} ready. ${p.language==='sql'?'Write a SQLite SELECT / WITH query.':'Implement Solution.'+p.method+'().'}`;history.replaceState(null,'','#'+p.id);window.sqlWorkspace?.open(p);renderFiles();showSqlSchema();queueLivePlan(true);}

function renderEdgeCases(p) {
  let panel = $('edge-cases');
  if (!panel) {
    panel = document.createElement('details');
    panel.id = 'edge-cases';
    panel.open = true;
    $('examples').closest('details').after(panel);
  }
  (p.study?$('sql-study-guide'):$('examples').closest('details')).after(panel);
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
let showArchived=false;
function isSolved(p){
 if(completionOverrides.has(String(p.id)))return completionOverrides.get(String(p.id));
 try{
  const explicit=localStorage.getItem('workspace-solved:'+p.id);
  if(explicit!==null)return explicit==='true';
  const history=JSON.parse(localStorage.getItem('graph-submissions:'+p.id)||'[]');
  return Array.isArray(history)&&history.some(r=>r.total>0&&r.passed===r.total&&r.syntaxPassed!==false);
 }catch(e){return false;}
}
function markSolved(p,done){
 completionOverrides.set(String(p.id),done);
 try{localStorage.setItem('workspace-solved:'+p.id,String(done));}
 catch(e){status('완료 표시는 이번 방문에만 유지됩니다 · 저장 공간 사용 불가');}
 renderFiles();
 if(current?.study)renderSqlStudy(current);
}
function renderFiles(){
 if(current?.language==='sql'&&window.sqlWorkspace)return window.sqlWorkspace.files();
 const q=$('search').value.toLowerCase();
 const matching=problems.filter(p=>(!p.retired||showArchived||isSolved(p)||p===current)&&problemLanguage(p)===problemLanguage(current)&&(p.file+p.title+p.id+(p.study?.level??'')).toLowerCase().includes(q));
 const files=$('files');files.replaceChildren();
 if(problemLanguage(current)==='sql'){
  const archiveToggle=document.createElement('button');archiveToggle.type='button';archiveToggle.className='archive-toggle';
  archiveToggle.textContent=showArchived?'이전 문제: 완료 기록만 보기':'이전 문제 전체 보기 (진도 유지)';
  archiveToggle.setAttribute('aria-expanded',String(showArchived));archiveToggle.onclick=()=>{showArchived=!showArchived;renderFiles();};files.append(archiveToggle);
 }
 if(!matching.length&&current)files.textContent='일치하는 문제가 없어요.';
 const remaining=matching.filter(p=>!isSolved(p));
 const solved=matching.filter(isSolved);
 for(const course of new Set(matching.filter(p=>p.study).map(p=>p.study.course))){
  const lessons=problems.filter(p=>p.study?.course===course);
  const visible=matching.filter(p=>p.study?.course===course);
  const label=lessons[0]?.retired?`${course} · ${lessons.filter(isSolved).length}개 완료 / ${lessons.length}개 보관`:`${course} · ${lessons.filter(isSolved).length}/${lessons.length} 완료`;
  appendGroup(label,visible,false);
 }
 const interview=remaining.filter(p=>!p.study);
 appendGroup(`${problemLanguage(current)==='sql'?'인터뷰 문제':'남은 문제'} · ${interview.length}`,interview,false);
 const solvedInterview=solved.filter(p=>!p.study);
 appendGroup(`✓ 완료 · ${solvedInterview.length}`,solvedInterview,true);

 function appendGroup(label,group,done){
  if(!group.length)return;
  const heading=document.createElement('div');
  heading.className='completion-heading';
  heading.textContent=label;
  files.append(heading);
  for(const p of group){
   const done=isSolved(p);
   const row=document.createElement('div');row.className='problem-row'+(done?' solved':'');
   const check=document.createElement('input');check.type='checkbox';check.checked=done;check.setAttribute('aria-label',p.title+' 완료');
   check.onchange=()=>{markSolved(p,check.checked);document.getElementById('completed-'+p.id)?.focus();};check.id='completed-'+p.id;
   const b=document.createElement('button');b.className='file'+(current?.id===p.id?' active':'');b.title=p.id+'. '+p.title;
   const icon=document.createElement('span');icon.className='python';icon.textContent=p.study?.number??(p.language==='sql'?'SQL':'Py');
   const name=document.createElement('span');name.textContent=p.study?p.title:p.file;b.append(icon,name);b.onclick=()=>openProblem(p);
   row.append(check,b);files.append(row);
  }
 }
}

function buildSqlStudy({datasets,lessons,course="SQL 학습 코스",intro,retired=false}){
 return lessons.map(({dataset,expected,level,concept,conceptExample,hints,solution,explanation,...lesson},i)=>{
  const {schema,example,edge}=datasets[dataset];
  const number=String(i+1).padStart(2,'0');
  return {
   ...lesson,retired,language:'sql',method:'__sql__',hasEditorial:false,hasAnimation:false,
   study:{number,total:lessons.length,course,intro,level,concept,conceptExample,hints,solution,explanation},
   starter:lesson.starter||`-- ${lesson.title}\n-- FROM ${Object.keys(schema).join(', ')}\n\n`,
   schema,examples:'',constraints:Object.entries(schema).map(([name,cols])=>
    `CREATE TABLE ${name} (${cols.map(col=>col.join(' ')).join(', ')});`
   ).join('\n')+'\n\nOutput columns: '+lesson.columns.join(', '),
   tests:[{label:'예제 데이터',args:[example],expected:expected.example}],
   extra:[{label:'추가 데이터',args:[edge],expected:expected.edge}]
  };
 });
}

function renderSqlStudy(p){
 if(window.sqlWorkspace)return;
 const panel=$('sql-study-guide');
 panel.hidden=!p.study;
 panel.replaceChildren();
 if(!p.study)return;
 const {number,total,course,level,concept,conceptExample,hints,solution,explanation}=p.study;
 const heading=document.createElement('h2');
 heading.textContent=`${course} · ${number}/${total} · ${level}`;
 const conceptHeading=document.createElement('h3');
 conceptHeading.textContent='먼저 보는 개념';
 const intro=document.createElement('p');
 intro.textContent=concept;
 panel.append(heading);
 if(p.study.intro&&number==='01'){const overviewIntro=document.createElement('p');overviewIntro.className='course-intro';overviewIntro.textContent=p.study.intro;panel.append(overviewIntro);}
 if(!p.syntax)panel.append(conceptHeading,intro);
 if(p.referenceSql){const reference=addReveal('원본 SQL · 결과를 유지하며 고쳐보세요',p.referenceSql,'pre');reference.open=true;}
 if(p.microSteps){const steps=document.createElement('ol');for(const step of p.microSteps){const li=document.createElement('li');li.textContent=step;steps.append(li);}panel.append(steps);const note=document.createElement('p');note.textContent='소단계는 Run으로 중간 결과를 살펴보고, 요구한 최종 결과 열을 모두 갖춘 뒤 Submit하세요.';panel.append(note);}
 if(conceptExample&&!p.syntax){
  const example=addReveal('짧은 개념 예제',conceptExample.sql,'pre');
  const explanation=document.createElement('p');
  explanation.textContent=conceptExample.explanation;
  example.append(explanation);
 }
 for(const [i,hint] of hints.entries())addReveal(p.syntax?['힌트 1 · 개념','힌트 2 · 문법 틀','힌트 3 · 거의 정답'][i]:'힌트 '+(i+1),hint,p.syntax&&i>0?'pre':'p');
 const answer=addReveal('예시 풀이와 해설 보기',solution,'pre');
 const trySolution=document.createElement('button');trySolution.type='button';
 trySolution.textContent='풀이를 편집기에 넣기';
 trySolution.onclick=()=>{if(aceEditor)aceEditor.setValue(solution,-1);else $('code').value=solution;save();refreshLines();queueLivePlan();};
 answer.append(trySolution);
 if(explanation){const why=document.createElement('p');why.textContent=explanation;answer.append(why);}
 const courseLessons=problems.filter(problem=>problem.study?.course===course);
 const overview=document.createElement('details');
 const overviewTitle=document.createElement('summary');
 overviewTitle.textContent=`여행 지도 · ${courseLessons.filter(isSolved).length}/${total} 완료 · 원하는 단계로 이동`;
 overview.append(overviewTitle);
 const map=document.createElement('ol');map.className='course-map';
 for(const lesson of courseLessons){
  const item=document.createElement('li');const link=document.createElement('a');
  link.href='#'+lesson.id;
  link.textContent=`${isSolved(lesson)?'✓ ':''}${lesson.study.number}. ${lesson.study.level} / ${lesson.title}`;
  if(lesson===p)link.setAttribute('aria-current','step');
  link.onclick=e=>{e.preventDefault();openProblem(lesson);$('problem-title').focus();};
  item.append(link);map.append(item);
 }
 overview.append(map);panel.append(overview);
 const navigation=document.createElement('nav');
 navigation.className='sql-study-nav';
 navigation.setAttribute('aria-label','SQL 학습 코스 탐색');
 const lessons=courseLessons;
 const index=lessons.indexOf(p);
 const next=lessons[index+1];
 const nextPending=lessons.slice(index+1).find(lesson=>!isSolved(lesson))||lessons.slice(0,index).find(lesson=>!isSolved(lesson));
 addLessonLink('← 이전 문제',lessons[index-1]);
 addLessonLink('다음 문제 →',next);
 if(!p.retired)addLessonLink('다음 미완료 문제 →',nextPending);
 if(!p.retired&&lessons.every(isSolved)){const done=document.createElement('p');done.textContent='🐨 이 코스를 모두 완료했어요! 기존 완료 기록은 그대로 보관돼요.';panel.append(done);}
 panel.append(navigation);

 function addReveal(label,content,tag){
  const details=document.createElement('details');
  const summary=document.createElement('summary');
  const body=document.createElement(tag);
  summary.textContent=label;
  body.textContent=content;
  details.append(summary,body);
  panel.append(details);
  return details;
 }
 function addLessonLink(label,problem){
  if(!problem)return;
  const link=document.createElement('a');
  link.textContent=label;
  link.href='#'+problem.id;
  link.onclick=event=>{
   if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   event.preventDefault();
   openProblem(problem);
   $('problem-title').focus();
  };
  navigation.append(link);
 }
}
window.addEventListener('storage',e=>{if(e.key===null||e.key.startsWith('workspace-solved:')||e.key.startsWith('graph-submissions:')){completionOverrides.clear();renderFiles();}});
function runtimeFailure(message){clearTimeout(timer);if(worker)worker.terminate();worker=null;ready=false;busy=false;if(runtimeAttempt+1<runtimeSources.length){runtimeAttempt++;$('output').textContent=message+'\n다른 다운로드 경로로 자동 재시도 중…';boot();}else{pendingMode=null;status('Runtime unavailable · click Run to retry');if(current?.language==='sql')$('live-plan-status').textContent='SQLite를 불러오지 못했어요. Run으로 다시 시도하세요.';$('output').textContent=message+'\n실행 엔진을 불러오지 못했습니다. Run / Debug / Submit을 누르면 다시 시도합니다. 작성한 코드는 보존됩니다.';buttons();}}
function boot(){if(worker)worker.terminate();ready=false;busy=false;status('Python loading…');worker=new Worker('worker.js?v=kodori48-v1&source='+runtimeAttempt,{type:'module'});queueLivePlan(true);buttons();clearTimeout(timer);timer=setTimeout(()=>runtimeFailure('Runtime loading timed out.'),30000);
const activeWorker=worker;worker.onmessage=({data:m})=>{if(worker!==activeWorker)return;if(m.type==='plan'){renderLivePlan(m);return;}if(m.type==='progress'){status(m.message);return;}if(m.type==='ready'){clearTimeout(timer);ready=true;status('Python / SQLite · ready');buttons();if(pendingMode){const mode=pendingMode;pendingMode=null;run(mode);}requestLivePlan();return;}if(m.type==='error'){if(!ready){runtimeFailure(m.error);return;}clearTimeout(timer);busy=false;status('Runtime error');$('output').textContent=m.error;buttons();requestLivePlan();return;}if(m.type==='result'){clearTimeout(timer);busy=false;buttons();requestLivePlan();const d=m.data;const passed=d.results.filter(x=>x.ok===true).length;const lines=d.results.map(r=>`[${r.ok===null?'RESULT':r.ok?'PASS':'FAIL'}] case ${r.case}${r.label?' · '+r.label:''}\n`+(r.error?r.error:`  actual: ${JSON.stringify(r.actual)}${r.ok===null?'':'\n  expected: '+JSON.stringify(r.expected)}`));let summary=runMode==='submit'?`LOCAL SUBMISSION: ${passed===runProblem.tests.length+runProblem.extra.length?'PASSED':'FAILED'} (${passed}/${runProblem.tests.length+runProblem.extra.length})\n${runProblem.study?'학습 코스 · 예제 및 추가 데이터':'Examples + additional local tests; not the official LeetCode judge.'}\n`:'';$('output').textContent=summary+lines.join('\n\n')+(d.output?'\n\nSTDOUT\n'+d.output:'')+`\n\nCompleted in ${d.elapsed} ms.`;if(runProblem.language==='sql')renderSqlResults(d,runMode);status(current?.language==='sql'?'SQLite · ready':'Python · ready');if(runMode==='submit'){const learningPassed=!d.syntax||d.syntax.ok;if(passed>0&&passed===runProblem.tests.length+runProblem.extra.length&&d.results.length===passed&&learningPassed)markSolved(runProblem,true);try{const k='graph-submissions:'+runProblem.id;const old=JSON.parse(localStorage.getItem(k)||'[]');old.unshift({date:new Date().toISOString(),passed,total:runProblem.tests.length+runProblem.extra.length,syntaxPassed:learningPassed,code:runCode});localStorage.setItem(k,JSON.stringify(old.slice(0,10)));}catch(e){status('Results not saved — storage unavailable');}}if(runMode==='debug'&&d.frames.length){frames=d.frames;frameIndex=0;$('trace-case').replaceChildren();const seenCases=new Set();frames.forEach((f,i)=>{if(!seenCases.has(f.case)){seenCases.add(f.case);$('trace-case').add(new Option('Case '+f.case+' · '+f.label,String(i)));}});$('trace-controls').hidden=false;$('variables').hidden=false;showFrame();if(d.traceTruncated)$('output').textContent+='\nTrace capped at 2,500 events per case; all results are still reported.';}}};worker.onerror=()=>runtimeFailure('Unable to load the execution engine.');}
function stop(message='Execution cancelled. Reloading Python…'){if(worker)worker.terminate();clearTimeout(timer);worker=null;busy=false;ready=false;buttons();$('output').textContent=message;status('Stopped · reload page to restart');}
function run(mode){showExecutionPanel();if(!current){$('output').textContent='문제 목록을 아직 불러오는 중입니다. 잠시 후 다시 눌러 주세요.';return;}if(busy)return;if(!ready){pendingMode=mode;$('output').textContent='실행 엔진을 준비하고 있어요. 준비되면 '+mode+'을 자동으로 실행합니다…';if(!worker){runtimeAttempt=0;boot();}return;}let tests=[...current.tests,...current.extra];const selection=$('case').value;if(selection==='examples')tests=current.tests;if(selection==='edges')tests=current.extra;if(selection.startsWith('edge:'))tests=[current.extra[Number(selection.slice(5))]];if(mode!=='submit'&&$('case').value==='custom'){try{const args=JSON.parse($('custom').value);if(!Array.isArray(args)||args.length!==current.tests[0].args.length)throw new Error('Use a JSON array containing '+current.tests[0].args.length+' function arguments.');tests=[{args}];}catch(e){$('output').textContent='Invalid custom arguments: '+e.message;return;}}if(mode==='submit')tests=[...current.tests,...current.extra];save();resetTrace();runMode=mode;runProblem=current;runCode=value();if(current.language==='sql')window.sqlWorkspace?.begin();busy=true;buttons();status(current.language==='sql'?'SQLite · running':'Python · running');$('output').textContent=mode==='debug'?(current.language==='sql'?'Running queries and recording query plans for ':'Recording execution of ')+tests.length+' test cases…':'Running '+tests.length+' test cases…';worker.postMessage({code:runCode,problem:current.id,method:current.method,language:current.language,schema:current.schema,columns:current.columns,ordered:current.ordered,requirements:current.requirements,tests,mode});timer=setTimeout(()=>{const elapsed=12;stop(`Time Limit Exceeded (TLE)\nExecution exceeded the ${elapsed}-second local time limit.\nResult: TIME LIMIT EXCEEDED\n\nYour code was stopped; this submission was not marked as solved.\nTip: avoid scanning every word in every BFS iteration.\n\nThis is a local browser limit, not the official LeetCode time limit.`);boot();},12000);}
function showFrame(){const f=frames[frameIndex];$('trace-case').value=String(frames.findIndex(x=>x.case===f.case));$('step').max=frames.length;$('step').value=frameIndex+1;$('trace-label').textContent=` / ${frames.length} · case ${f.case} · line ${f.line} · ${f.event}`;$('variables').textContent=`Case ${f.case} · ${f.label}\nRecorded ${f.function}() · before line execution (return events are after)\n`+Object.entries(f.locals).map(([k,v])=>`${k} = ${v}`).join('\n');$('prev').disabled=frameIndex===0;$('next').disabled=frameIndex===frames.length-1;if(aceEditor){if(marker!=null)aceEditor.session.removeMarker(marker);const Range=ace.require('ace/range').Range;marker=aceEditor.session.addMarker(new Range(f.line-1,0,f.line-1,1),'trace-line','fullLine');aceEditor.gotoLine(f.line,0,false);}else{const lines=value().split('\n');const start=lines.slice(0,f.line-1).join('\n').length+(f.line>1?1:0);$('code').focus();$('code').setSelectionRange(start,start+(lines[f.line-1]||'').length);$('code').scrollTop=Math.max(0,(f.line-5)*32);}}
$('trace-case').onchange=()=>{frameIndex=Number($('trace-case').value);showFrame();};$('search').oninput=renderFiles;$('code').oninput=()=>{save();refreshLines();resetTrace();queueLivePlan();};$('code').onscroll=()=>{$('gutter').scrollTop=$('code').scrollTop;};$('code').onclick=refreshLines;$('code').onkeyup=refreshLines;
$('code').onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();const t=e.target;const a=t.selectionStart,b=t.selectionEnd;t.setRangeText('    ',a,b,'end');save();refreshLines();queueLivePlan();}else if(e.key==='Enter'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();const t=e.target;const before=t.value.slice(0,t.selectionStart).split('\n').at(-1);const indent=(before.match(/^\s*/)||[''])[0]+(before.trimEnd().endsWith(':')?'    ':'');t.setRangeText('\n'+indent,t.selectionStart,t.selectionEnd,'end');save();refreshLines();queueLivePlan();}};
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
  $('examples').parentElement.querySelector('.note').textContent=(p.images||[]).length?'Original example text and supplied diagram links.':p.study?'Run으로 결과를 확인하세요. Submit에서 예제와 추가 데이터를 모두 통과하면 완료로 표시돼요.':p.language==='sql'?'Practice datasets. Each test starts with a fresh database.':'Original example text. Diagrams referenced in this text were not supplied as image links.';
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

async function init(){try{const response=await fetch('problems.json');if(!response.ok)throw new Error('Could not load modules');problems=await response.json();const stringsResponse=await fetch('strings.json?v=string10-v1');if(!stringsResponse.ok)throw new Error('Could not load string modules');problems.push(...await stringsResponse.json());const sqlResponse=await fetch('sql-problems.json?v=sql31-v1');if(!sqlResponse.ok)throw new Error('Could not load SQL modules');const studyResponse=await fetch('sql-study.json?v=2');if(!studyResponse.ok)throw new Error('Could not load the SQL study course');const kodoriResponse=await fetch('kodori-sql.json?v=48-v1');if(!kodoriResponse.ok)throw new Error('Could not load 코돌이와 SQL 심화여행');const archiveResponse=await fetch('kodori-sql-archive.json?v=48-v1');if(!archiveResponse.ok)throw new Error('Could not load saved coursework history');problems.push(...buildSqlStudy(await kodoriResponse.json()),...buildSqlStudy(await studyResponse.json()),...await sqlResponse.json(),...buildSqlStudy(await archiveResponse.json()));$('kodori-start').disabled=false;openProblem(problems.find(p=>String(p.id)===location.hash.slice(1))||(location.hash.startsWith('#kodori-sql-')?problems.find(p=>String(p.id).startsWith('kodori-sql-')):problems[0]));boot();const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/ace/1.36.2/ace.js';script.onload=()=>{const text=value();$('ace').hidden=false;aceEditor=ace.edit('ace');aceEditor.setTheme(current?.language==='sql'?'ace/theme/chrome':'ace/theme/tomorrow_night');aceEditor.session.setMode(current?.language==='sql'?'ace/mode/sql':'ace/mode/python');aceEditor.setOptions({showPrintMargin:false,fontSize:current?.language==='sql'?'16px':'16pt',tabSize:4,useSoftTabs:true});aceEditor.setValue(text,-1);$('code').hidden=true;$('gutter').hidden=true;refreshLines();aceEditor.session.on('change',()=>{save();refreshLines();resetTrace();queueLivePlan();});aceEditor.selection.on('changeCursor',()=>{const p=aceEditor.getCursorPosition();$('position').textContent=`Ln ${p.row+1}, Col ${p.column+1}`;});aceEditor.commands.addCommand({name:'runTests',bindKey:{win:'Ctrl-Enter',mac:'Command-Enter'},exec:()=>run('run')});};document.head.append(script);}catch(e){$('output').textContent=e.message;status('Workspace unavailable');}}init();



function setLanguage(p){
 const sql=p.language==='sql';
 $('complexity-panel').hidden=sql;
 $('live-query-plan').hidden=!sql;
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
 for(const [name,cols] of Object.entries(p.schema))box.append(sqlTable('입력 표 · '+name,cols.map(c=>c[0]),test.args[0][name]||[],cols.map(c=>c[1])));
 box.append(sqlTable('기대 결과 · 정답 표',p.columns,test.expected));
 return box;
}
function renderSqlExamples(p){
 let area=$('sql-examples');if(!area){area=document.createElement('div');area.id='sql-examples';$('examples').after(area);}
 const sql=p.language==='sql';$('examples').hidden=sql;area.hidden=!sql;area.replaceChildren();
 let focus=$('sql-learning-focus');if(!focus){focus=document.createElement('section');focus.id='sql-learning-focus';$('rules').after(focus);}
 focus.hidden=!p.syntax;focus.replaceChildren();
 if(p.syntax){const h=document.createElement('h2');h.textContent='이번에 배우는 문법';const code=document.createElement('code');code.textContent=p.syntax;const delta=document.createElement('p');delta.textContent='이번 단계: '+p.newElement;focus.append(h,code,delta);}

 const examplePanel=$('examples').closest('details');
 const guide=$('sql-study-guide');
 if(sql){focus.after(examplePanel);examplePanel.after(guide);if($('edge-cases'))guide.after($('edge-cases'));examplePanel.open=true;}
 else guide.after(examplePanel);
 examplePanel.querySelector('summary').textContent=sql?'입력 표 · 기대 결과':'Examples · input / output';
 if(sql)p.tests.forEach((test,i)=>{const label=document.createElement('h2');label.textContent='Example '+(i+1);area.append(label,sqlCaseTables(p,test));});
}
function renderSqlResults(data,mode){
 if(window.sqlWorkspace)return window.sqlWorkspace.result(data);
 const output=$('output');output.replaceChildren();
 const summary=document.createElement('div');summary.className='sql-result-summary';
 const passed=data.results.filter(r=>r.ok===true).length;
 summary.textContent=(mode==='submit'?'SUBMIT · ':'RUN · ')+'결과 '+passed+'/'+data.results.length+' 통과 · '+data.elapsed+' ms';output.append(summary);
 if(data.syntax){
  const report=document.createElement('section');report.className='syntax-report';
  const h=document.createElement('h3');h.textContent=data.syntax.ok?'✓ 학습 문법 통과':'학습 문법 확인 필요';report.append(h);
  if(data.syntax.error){const error=document.createElement('p');error.textContent=data.syntax.error;report.append(error);}
  for(const check of data.syntax.checks){const line=document.createElement('p');line.textContent=(check.ok?'✓ ':'✗ ')+check.label;report.append(line);}
  const note=document.createElement('p');note.textContent='완료 조건: Submit에서 모든 데이터와 학습 문법을 통과. 기존 완료 기록은 변경하지 않아요.';report.append(note);output.append(report);
 }
 data.results.forEach(r=>{const section=document.createElement('section');section.className='sql-result-case';const h=document.createElement('h3');h.textContent=(r.ok===null?'RESULT':r.ok?'PASS':'FAIL')+' · Case '+r.case;section.append(h);
 if(r.error){const e=document.createElement('pre');e.textContent=r.error;section.append(e);}
 else{section.append(sqlTable('Actual result · 실행 결과',r.actual.columns,r.actual.rows));if(r.expected)section.append(sqlTable('기대 결과 · 정답 표',r.expected.columns,r.expected.rows));}output.append(section);});
 if(data.output){const pre=document.createElement('pre');pre.textContent=data.output;output.append(pre);}
}
const sqlTableStyle=document.createElement('style');
sqlTableStyle.textContent=`
#sql-examples[hidden], #examples[hidden]{display:none!important}
.sql-case-tables,.sql-sheet,.sql-result-case{white-space:normal;min-width:0;max-width:100%}
.sql-sheet{margin:14px 0 20px}
.sql-sheet h3{font:700 22px/1.5 system-ui,sans-serif;margin:0;padding:14px 16px;background:#213c35;color:#bcebd9;border:1px solid #436159;border-bottom:0;border-radius:6px 6px 0 0;overflow-wrap:anywhere}
.sql-sheet-scroll{max-width:100%;overflow:auto;border:1px solid #436159;border-radius:0 0 6px 6px}
.sql-data-table{border-collapse:collapse;width:100%;margin:0;font:20px/1.6 ui-monospace,monospace;color:#f0f5fa;background:#192129}
.sql-data-table caption{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.sql-data-table th,.sql-data-table td{padding:12px 16px!important;border:1px solid #50616d!important;text-align:left;white-space:nowrap;font-size:20px!important}
.sql-data-table thead th{background:#293d43;color:#d7f4e8;font-weight:600;position:sticky;top:0}
.sql-data-table th small{display:block;font:14px/1.5 system-ui,sans-serif;color:#bad3d2}
.sql-data-table tbody th{width:30px;background:#202c34;color:#84959f;font-weight:400;text-align:right}
.sql-data-table tbody tr:nth-child(even) td{background:#202b34}
.sql-data-table tbody tr:hover td{background:#2d4247}
.sql-data-table td.sql-number{text-align:right}
.sql-data-table td.sql-null{color:#9ba7b2;font-style:italic}
.sql-result-summary{white-space:normal;font-weight:600;padding:8px 0;color:#a7e3cb}
#sql-examples>h2{font-size:22px;margin-top:12px}
`;
document.head.append(sqlTableStyle);

let executionDialog;
function showExecutionPanel(){
 if(current?.language==='sql'&&window.sqlWorkspace){document.body.classList.add('sql-results-open');return;}
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
showSqlSchema();

let planTimer,planRevision=0,planCode='';
const planExplanations={
 SCAN:'테이블 또는 인덱스의 행을 훑어요.',
 SEARCH:'키나 인덱스로 조건에 맞는 행을 찾아요.',
 'USE TEMP B-TREE FOR ORDER BY':'정렬에 임시 자료구조를 써요.',
 'USE TEMP B-TREE FOR GROUP BY':'그룹화에 임시 자료구조를 써요.',
 'USE TEMP B-TREE FOR DISTINCT':'중복 제거에 임시 자료구조를 써요.',
 MATERIALIZE:'중간 결과를 만들어 저장해요.',
 'CO-ROUTINE':'하위 쿼리의 결과를 필요한 만큼 가져와요.'
};

function queueLivePlan(reset=false){
 clearTimeout(planTimer);
 const revision=++planRevision;
 planCode='';
 if(window.sqlWorkspace||current?.language!=='sql')return;
 const code=value().replace(/^(?:\s+|--[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$))+/,'');
 if(reset||!code.trim())$('live-plan-steps').hidden=true;
 if(!code.trim()){
  $('live-plan-status').textContent='SELECT 또는 WITH 쿼리를 입력하면 실행 흐름이 표시돼요.';
  return;
 }
 $('live-plan-status').textContent=ready?'새 실행 계획을 확인하는 중…':'SQLite를 준비하는 중…';
 if(!worker&&runtimeAttempt>0)$('live-plan-status').textContent='SQLite를 불러오지 못했어요. Run으로 다시 시도하세요.';
 planTimer=setTimeout(()=>{
  if(revision!==planRevision)return;
  planCode=code;
  requestLivePlan();
 },250);
}

function requestLivePlan(){
 if(!ready||busy||!planCode)return;
 worker.postMessage({type:'plan',revision:planRevision,code:planCode,schema:current.schema,rows:current.tests[0].args[0]});
 planCode='';
}

function renderLivePlan(message){
 if(message.revision!==planRevision||current?.language!=='sql')return;
 const status=$('live-plan-status');
 const list=$('live-plan-steps');
 if(message.error){
  list.hidden=true;
  status.textContent='실행 계획 대기 중 · '+message.error;
  return;
 }
 status.textContent='SQLite 실행 계획 · 첫 번째 예시의 테이블 기준';
 const depth=new Map();
 const steps=[];
 for(const [id,parent,,detail] of message.rows){
  const level=depth.has(parent)?depth.get(parent)+1:0;
  depth.set(id,level);
  const step=document.createElement('li');
  step.style.marginInlineStart=Math.min(level,4)*14+'px';
  const label=document.createElement('code');
  label.textContent=detail;
  step.append(label);
  const explanation=planExplanations[detail]||planExplanations[detail.split(' ')[0]];
  if(explanation)step.append(' · '+explanation);
  steps.push(step);
 }
 list.replaceChildren(...steps);
 list.hidden=false;
}

window.addEventListener('hashchange',()=>{const target=problems.find(p=>String(p.id)===location.hash.slice(1));if(target&&target!==current)openProblem(target);});
