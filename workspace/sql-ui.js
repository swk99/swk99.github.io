/* SQL presentation only. Progress and drafts remain owned by app.js. */
window.sqlWorkspace=(()=>{
 let track='advanced',data=null,active='결과',caseIndex=0,consoleAnchor,body,controls,selector;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const trackFor=p=>p.retired?'archive':String(p.id).startsWith('kodori-sql-')?'advanced':p.study?'study':'interview';
 const tracks={advanced:'🐨 코돌이와 SQL 심화여행',study:'SQL 학습 코스',interview:'인터뷰 문제',archive:'이전 문제 기록'};
 function init(){
  if(selector)return;
  const label=el('label',undefined,'sql-track');label.append(el('span','학습 트랙'));selector=el('select');selector.id='sql-track';selector.setAttribute('aria-label','SQL 학습 트랙');label.append(selector);document.querySelector('.search').before(label);
  selector.onchange=()=>{track=selector.value;$('search').value='';const group=problems.filter(p=>p.language==='sql'&&trackFor(p)===track);openProblem(group.find(p=>!isSolved(p))||group[0]);};
  const settings=el('button','설정','sql-settings');settings.onclick=()=>dialog.showModal();document.querySelector('header').append(settings);
  const dialog=el('dialog',undefined,'sql-settings-dialog');const close=el('button','닫기');close.onclick=()=>dialog.close();const archive=el('button','이전 문제 기록 열기');archive.onclick=()=>{dialog.close();const p=problems.find(p=>p.retired);if(p)openProblem(p);};const exportButton=el('button','현재 풀이 내보내기');exportButton.onclick=()=>$('download').click();dialog.append(el('h2','SQL 설정'),el('p','풀이와 완료 기록은 이 브라우저에 계속 보관됩니다.'),archive,exportButton,close);document.body.append(dialog);
  body=el('div');body.id='sql-problem-content';$('problem-title').after(body);
  const panel=document.querySelector('.console');consoleAnchor=document.createComment('SQL inline results anchor');panel.before(consoleAnchor);
  controls=el('div',undefined,'sql-result-controls');const tabs=el('div',undefined,'sql-result-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','SQL 실행 결과');
  ['결과','기대값','차이'].forEach((name,i)=>{const b=el('button',name);b.setAttribute('role','tab');b.onclick=()=>{active=name;renderResult();};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const next=(i+(e.key==='ArrowRight'?1:2))%3;tabs.children[next].click();tabs.children[next].focus();}};tabs.append(b);});
  const cases=el('select');cases.id='sql-result-case';cases.setAttribute('aria-label','결과 데이터 선택');cases.onchange=()=>{caseIndex=Number(cases.value);renderResult();};
  const toolsPanel=el('details',undefined,'sql-result-tools');toolsPanel.append(el('summary','실행 계획 · 추가 데이터'));const plan=el('button','실행 계획 실행');plan.onclick=()=>run('debug');const inputs=el('div');inputs.id='sql-result-inputs';toolsPanel.append(plan,inputs);
  controls.append(tabs,cases,el('span','','sql-result-status'),toolsPanel);panel.prepend(controls);
  new ResizeObserver(()=>aceEditor?.resize()).observe(document.querySelector('.editor-wrap'));
 }
 function open(p){
  init();if(executionDialog?.open)executionDialog.close();const sql=p.language==='sql';document.body.classList.toggle('sql-mode',sql);const panel=document.querySelector('.console');if(sql)document.querySelector('main').append(panel);else consoleAnchor.after(panel);
  if(!sql)return;
  track=trackFor(p);selector.replaceChildren();for(const [key,name] of Object.entries(tracks)){if(key==='archive'&&track!=='archive')continue;selector.add(new Option(name,key));}selector.value=track;
  body.replaceChildren();body.append(el('p',p.rules[0],'sql-task'));
  if(p.syntax)body.append(el('p','이번에 배우는 문법 · '+p.syntax,'sql-syntax'));
  const tables=el('div',undefined,'sql-input-output'),input=el('div'),expected=el('div');input.append(el('h2','입력 표'));expected.append(el('h2','기대 결과'));for(const [name,cols] of Object.entries(p.schema))input.append(sqlTable(name,cols.map(c=>c[0]),p.tests[0].args[0][name]||[],cols.map(c=>c[1])));expected.append(sqlTable('정답',p.columns,p.tests[0].expected));tables.append(input,expected);body.append(tables);
  if(p.referenceSql){body.append(el('h2','원본 SQL'),el('pre',p.referenceSql));}
  const drawer=el('details',undefined,'sql-hints');drawer.append(el('summary','힌트 보기'));const content=el('div');let level=0;const hints=p.study?.hints||[];const next=el('button','다음 힌트');const show=()=>{content.replaceChildren(el('h3',['힌트 1 · 개념','힌트 2 · 문법 틀','힌트 3 · 거의 정답'][level]||'설명'),el('pre',hints[level]||p.study?.concept||'문제의 입력과 기대 결과를 비교해 보세요.'));next.hidden=level>=hints.length-1;};next.onclick=()=>{level++;show();};show();drawer.append(content,next);
  if(p.rules.length>1){const conditions=el('details');conditions.append(el('summary','상세 조건'));p.rules.slice(1).forEach(r=>conditions.append(el('p',r)));drawer.append(conditions);}
  if(p.study){const answer=el('details');answer.append(el('summary','풀이와 해설 보기'),el('pre',p.study.solution),el('p',p.study.explanation));const load=el('button','풀이를 편집기에 넣기');load.onclick=()=>{if(aceEditor)aceEditor.setValue(p.study.solution,-1);else $('code').value=p.study.solution;save();refreshLines();};answer.append(load);drawer.append(answer);}
  body.append(drawer);const nextProblem=el('button','다음 미완료 문제 →','sql-next');nextProblem.onclick=()=>{const p=problems.find(p=>p.language==='sql'&&trackFor(p)===track&&!isSolved(p));if(p)openProblem(p);};body.append(nextProblem);
  data=null;active='결과';caseIndex=0;$('sql-result-case').replaceChildren();$('sql-result-inputs').replaceChildren();controls.querySelector('.sql-result-status').textContent='';controls.querySelector('details').open=false;renderResult();
 }
 function files(){
  const list=$('files');list.replaceChildren();const group=problems.filter(p=>p.language==='sql'&&trackFor(p)===track);list.append(el('div',`${group.filter(isSolved).length} / ${group.length} 완료`,'completion-heading'));const q=$('search').value.toLowerCase();const visible=group.filter(p=>(p.title+p.id+p.file).toLowerCase().includes(q));
  for(const p of visible){const row=el('div',undefined,'problem-row'+(isSolved(p)?' solved':''));const check=el('input');check.type='checkbox';check.id='completed-'+p.id;check.checked=isSolved(p);check.setAttribute('aria-label',p.title+' 완료');check.onchange=()=>{markSolved(p,check.checked);$('completed-'+p.id)?.focus();};const b=el('button',p.title,'file'+(p.id===current.id?' active':''));b.onclick=()=>openProblem(p);row.append(check,b);list.append(row);}if(!visible.length)list.append(el('p','일치하는 문제가 없어요.'));
 }
 function result(d){data=d;caseIndex=0;active='결과';const cases=$('sql-result-case');cases.replaceChildren();d.results.forEach((r,i)=>cases.add(new Option((r.ok?'✓ ':r.ok===false?'✗ ':'')+(r.label||'Case '+r.case),String(i))));controls.querySelector('.sql-result-status').textContent=`${d.results.filter(r=>r.ok).length}/${d.results.length} 통과`+(d.syntax?' · 문법 '+(d.syntax.ok?'통과':'확인 필요'):'');renderResult();}
 function renderResult(){
  controls.querySelectorAll('[role=tab]').forEach(b=>{const selected=b.textContent===active;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
  const out=$('output');out.replaceChildren();if(!data){out.append(el('p','Run으로 결과를 확인하고, Submit으로 완료하세요.'));return;}
  const r=data.results[caseIndex];if(!r)return;
  if(active==='결과'){if(r.error)out.append(el('pre',r.error));else if(r.actual)out.append(sqlTable('실행 결과',r.actual.columns,r.actual.rows));if(data.syntax){const checks=el('details');checks.append(el('summary',data.syntax.ok?'✓ 학습 문법 통과':'학습 문법 확인 필요'));for(const c of data.syntax.checks||[])checks.append(el('p',(c.ok?'✓ ':'✗ ')+c.label));if(data.syntax.error)checks.append(el('p',data.syntax.error));out.append(checks);}}
  else if(active==='기대값'){if(r.expected)out.append(sqlTable('기대값',r.expected.columns,r.expected.rows));else out.append(el('p','이 실행에는 기대값이 없습니다.'));}
  else{out.append(el('p',r.ok?'기대값과 일치합니다.':r.error?'실행 오류를 먼저 해결해 주세요.':'열 이름, 행 값과 중복 개수를 비교해 주세요.'));if(r.actual&&r.expected){const compare=el('div',undefined,'sql-input-output');compare.append(sqlTable('실행 결과',r.actual.columns,r.actual.rows),sqlTable('기대값',r.expected.columns,r.expected.rows));out.append(compare);}}
  const inputs=$('sql-result-inputs');inputs.replaceChildren();if(data.output)inputs.append(el('pre',data.output));const test=[...current.tests,...current.extra].find(t=>t.label===r.label)||[...current.tests,...current.extra][caseIndex];if(test)for(const [name,cols] of Object.entries(current.schema))inputs.append(sqlTable(name,cols.map(c=>c[0]),test.args[0][name]||[]));
 }
 function begin(){data=null;active='결과';caseIndex=0;$('sql-result-case').replaceChildren();$('sql-result-inputs').replaceChildren();controls.querySelector('.sql-result-status').textContent='실행 중…';renderResult();}
 return {open,files,result,trackFor,begin};
})();
