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
  const journeyPanel=el('section',undefined,'sql-journey');journeyPanel.id='sql-journey';document.querySelector('main').prepend(journeyPanel);const reopen=el('button','결과 보기','sql-reopen');reopen.onclick=()=>document.body.classList.add('sql-results-open');document.querySelector('.toolbar>div').prepend(reopen);const panel=document.querySelector('.console');consoleAnchor=document.createComment('SQL inline results anchor');panel.before(consoleAnchor);
  controls=el('div',undefined,'sql-result-controls');const tabs=el('div',undefined,'sql-result-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','SQL 실행 결과');
  ['결과','기대값','차이'].forEach((name,i)=>{const b=el('button',name);b.setAttribute('role','tab');b.onclick=()=>{active=name;renderResult();};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const next=(i+(e.key==='ArrowRight'?1:2))%3;tabs.children[next].click();tabs.children[next].focus();}};tabs.append(b);});
  const cases=el('select');cases.id='sql-result-case';cases.setAttribute('aria-label','결과 데이터 선택');cases.onchange=()=>{caseIndex=Number(cases.value);renderResult();};
  const toolsPanel=el('details',undefined,'sql-result-tools');toolsPanel.append(el('summary','실행 계획 · 추가 데이터'));const plan=el('button','실행 계획 실행');plan.onclick=()=>run('debug');const inputs=el('div');inputs.id='sql-result-inputs';toolsPanel.append(plan,inputs);
  const collapse=el('button','결과 접기');collapse.onclick=()=>document.body.classList.remove('sql-results-open');controls.append(tabs,cases,el('span','','sql-result-status'),collapse,toolsPanel);panel.prepend(controls);
  new ResizeObserver(()=>aceEditor?.resize()).observe(document.querySelector('.editor-wrap'));
 }
 function open(p){
  init();if(executionDialog?.open)executionDialog.close();const sql=p.language==='sql';document.body.classList.toggle('sql-mode',sql);const panel=document.querySelector('.console');if(sql)document.querySelector('main').append(panel);else consoleAnchor.after(panel);
  $('submit').textContent=sql?'정답 제출':'Submit ↗';$('search').placeholder=sql?'문제 찾아보기':'Find a module…';if(aceEditor){aceEditor.setTheme(sql?'ace/theme/chrome':'ace/theme/tomorrow_night');aceEditor.setFontSize(sql?'16px':'16pt');}if(!sql)return;
  if($('sql-koala-message'))$('sql-koala-message').textContent='🐨 작은 쿼리부터, 같이 가보자!';track=trackFor(p);selector.replaceChildren();for(const [key,name] of Object.entries(tracks)){if(key==='archive'&&track!=='archive')continue;selector.add(new Option(name,key));}selector.value=track;
  body.replaceChildren();body.append(el('p',p.rules[0],'sql-task'));
  if(p.syntax)body.append(el('p','이번에 배우는 문법 · '+p.syntax,'sql-syntax'));
  const tables=el('div',undefined,'sql-input-output'),input=el('div'),expected=el('div');input.append(el('h2','입력 표'));expected.append(el('h2','기대 결과'));for(const [name,cols] of Object.entries(p.schema))input.append(sqlTable(name,cols.map(c=>c[0]),p.tests[0].args[0][name]||[],cols.map(c=>c[1])));expected.append(sqlTable('정답',p.columns,p.tests[0].expected));tables.append(input,expected);body.append(tables);
  if(p.referenceSql){body.append(el('h2','원본 SQL'),codeBlock(p.referenceSql));}
  const drawer=el('details',undefined,'sql-hints');drawer.append(el('summary','힌트 보기'));const content=el('div');let level=0;const hints=p.study?.hints||[];const next=el('button','다음 힌트');const show=()=>{content.replaceChildren(el('h3',['힌트 1 · 개념','힌트 2 · 문법 틀','힌트 3 · 거의 정답'][level]||'설명'),el('pre',hints[level]||p.study?.concept||'문제의 입력과 기대 결과를 비교해 보세요.'));next.hidden=level>=hints.length-1;};next.onclick=()=>{level++;show();};show();drawer.append(content,next);
  if(p.rules.length>1){const conditions=el('details');conditions.append(el('summary','상세 조건'));p.rules.slice(1).forEach(r=>conditions.append(el('p',r)));drawer.append(conditions);}
  if(p.study){const answer=el('details');answer.append(el('summary','풀이와 해설 보기'),el('pre',p.study.solution),el('p',p.study.explanation));const load=el('button','풀이를 편집기에 넣기');load.onclick=()=>{if(aceEditor)aceEditor.setValue(p.study.solution,-1);else $('code').value=p.study.solution;save();refreshLines();};answer.append(load);drawer.append(answer);}
  body.append(drawer);const nextProblem=el('button','다음 미완료 문제 →','sql-next');nextProblem.onclick=()=>{const p=problems.find(p=>p.language==='sql'&&trackFor(p)===track&&!isSolved(p));if(p)openProblem(p);};body.append(nextProblem);
  document.body.classList.remove('sql-results-open');data=null;active='결과';caseIndex=0;$('sql-result-case').replaceChildren();$('sql-result-inputs').replaceChildren();controls.querySelector('.sql-result-status').textContent='';controls.querySelector('details').open=false;renderResult();
 }
 function files(){
  const list=$('files');list.replaceChildren();if(selector)journey();const group=problems.filter(p=>p.language==='sql'&&trackFor(p)===track);list.append(el('div',`${group.filter(isSolved).length} / ${group.length} 완료`,'completion-heading'));const q=$('search').value.toLowerCase();const visible=group.filter(p=>(p.title+p.id+p.file).toLowerCase().includes(q));
  let chapter='';for(const p of visible){if(p.study?.level&&p.study.level!==chapter){chapter=p.study.level;list.append(el('div',chapter,'sql-chapter'));}const row=el('div',undefined,'problem-row'+(isSolved(p)?' solved':''));const check=el('input');check.type='checkbox';check.id='completed-'+p.id;check.checked=isSolved(p);check.setAttribute('aria-label',p.title+' 완료');check.onchange=()=>{markSolved(p,check.checked);$('completed-'+p.id)?.focus();};const b=el('button',p.title,'file'+(p.id===current.id?' active':''));b.onclick=()=>openProblem(p);row.append(check,b);list.append(row);}if(!visible.length)list.append(el('p','일치하는 문제가 없어요.'));
 }
 function result(d){document.body.classList.add('sql-results-open');data=d;if(runMode==='submit'){const passed=d.results.length>0&&d.results.every(r=>r.ok===true)&&(!d.syntax||d.syntax.ok);$('sql-koala-message').textContent=passed?'🐨 해냈다! 한 걸음 더 여행했어.':'🐨 괜찮아! 결과를 비교하면서 한 번 더 해보자.';if(passed)recordDay();} caseIndex=0;active='결과';const cases=$('sql-result-case');cases.replaceChildren();d.results.forEach((r,i)=>cases.add(new Option((r.ok?'✓ ':r.ok===false?'✗ ':'')+(r.label||'Case '+r.case),String(i))));controls.querySelector('.sql-result-status').textContent=`${d.results.filter(r=>r.ok).length}/${d.results.length} 통과`+(d.syntax?' · 문법 '+(d.syntax.ok?'통과':'확인 필요'):'');renderResult();}
 function renderResult(){
  controls.querySelectorAll('[role=tab]').forEach(b=>{const selected=b.textContent===active;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
  const out=$('output');out.replaceChildren();if(!data){out.append(el('p','Run으로 결과를 확인하고, Submit으로 완료하세요.'));return;}
  const r=data.results[caseIndex];if(!r)return;
  if(active==='결과'){if(r.error)out.append(el('pre',r.error));else if(r.actual)out.append(sqlTable('실행 결과',r.actual.columns,r.actual.rows));if(data.syntax){const checks=el('details');checks.append(el('summary',data.syntax.ok?'✓ 학습 문법 통과':'학습 문법 확인 필요'));for(const c of data.syntax.checks||[])checks.append(el('p',(c.ok?'✓ ':'✗ ')+c.label));if(data.syntax.error)checks.append(el('p',data.syntax.error));out.append(checks);}}
  else if(active==='기대값'){if(r.expected)out.append(sqlTable('기대값',r.expected.columns,r.expected.rows));else out.append(el('p','이 실행에는 기대값이 없습니다.'));}
  else{out.append(el('p',r.ok?'기대값과 일치합니다.':r.error?'실행 오류를 먼저 해결해 주세요.':'열 이름, 행 값과 중복 개수를 비교해 주세요.'));if(r.actual&&r.expected){const compare=el('div',undefined,'sql-input-output');compare.append(sqlTable('실행 결과',r.actual.columns,r.actual.rows),sqlTable('기대값',r.expected.columns,r.expected.rows));out.append(compare);}}
  const inputs=$('sql-result-inputs');inputs.replaceChildren();if(data.output)inputs.append(el('pre',data.output));const test=[...current.tests,...current.extra].find(t=>t.label===r.label)||[...current.tests,...current.extra][caseIndex];if(test)for(const [name,cols] of Object.entries(current.schema))inputs.append(sqlTable(name,cols.map(c=>c[0]),test.args[0][name]||[]));
 }
 function localDay(date=new Date()){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
 function streak(days,now=new Date()){
  const seen=new Set(days);const cursor=new Date(now.getFullYear(),now.getMonth(),now.getDate());if(!seen.has(localDay(cursor)))cursor.setDate(cursor.getDate()-1);let count=0;while(seen.has(localDay(cursor))){count++;cursor.setDate(cursor.getDate()-1);}return count;
 }
 function recordDay(){try{const key='sql-journey-study-days';const old=JSON.parse(localStorage.getItem(key)||'[]');const days=Array.isArray(old)?old:[];const day=localDay();if(!days.includes(day))localStorage.setItem(key,JSON.stringify([...days,day]));}catch(e){/* Progress saving remains independent. */}}
 function journey(){
  const panel=$('sql-journey');if(!panel)return;const previous=$('sql-koala-message')?.textContent;panel.replaceChildren();const group=problems.filter(p=>p.language==='sql'&&trackFor(p)===track);const done=group.filter(isSolved).length;
  const mascot=el('div','🐨','sql-mascot');mascot.setAttribute('aria-hidden','true');const info=el('div',undefined,'sql-journey-info');const line=el('div',undefined,'sql-journey-line');line.append(el('strong',done+' / '+group.length+' 걸음'),el('span','오늘도 한 문제씩, 코돌이와 함께'));const bar=el('progress');bar.max=group.length||1;bar.value=done;bar.setAttribute('aria-label','트랙 학습 진도');const message=el('p',previous?.includes('해냈다')?previous:'🐨 작은 쿼리부터, 같이 가보자!');message.id='sql-koala-message';message.setAttribute('role','status');info.append(line,bar,message);
  let days=[];try{days=JSON.parse(localStorage.getItem('sql-journey-study-days')||'[]');}catch(e){}const badge=el('span','🔥 '+streak(Array.isArray(days)?days:[])+'일 연속','sql-streak');badge.title='정답을 제출한 날 기준 · 이 기능을 사용한 날부터 기록';panel.append(mascot,info,badge);
  const map=el('details',undefined,'sql-map');map.append(el('summary','여행 지도'));const stops=el('div');for(const level of new Set(group.map(p=>p.study?.level||'인터뷰'))){const lessons=group.filter(p=>(p.study?.level||'인터뷰')===level);const completed=lessons.filter(isSolved).length;const stop=el('button',(completed===lessons.length?'✓ ':'')+level+' · '+completed+'/'+lessons.length);stop.className=completed===lessons.length?'complete':'';stop.onclick=()=>openProblem(lessons.find(p=>!isSolved(p))||lessons[0]);stops.append(stop);}map.append(stops);panel.append(map);
 }
 function codeBlock(sql){
  // Tokenize before formatting: quoted strings and identifiers stay byte-identical.
  const tokens=sql.match(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|\[[^\]]*\]|[A-Za-z_][\w]*|\d+(?:\.\d+)?|\s+|./g)||[];
  const pairs=[],stack=[];tokens.forEach((token,i)=>{if(token==='(')stack.push(i);else if(token===')'&&stack.length){const start=stack.pop();const text=tokens.slice(start+1,i).join('').trim();if(/^SELECT\b/i.test(text))pairs.push({start,end:i,text:text.replace(/\s+/g,' ').toUpperCase()});}});
  const repeated=pairs.filter(p=>pairs.filter(q=>q.text===p.text).length>1);const starts=new Set(repeated.map(p=>p.start)),ends=new Set(repeated.map(p=>p.end));const pre=el('pre',undefined,'sql-code-block');pre.setAttribute('aria-label','원본 SQL 코드');const code=el('code');pre.append(code);let target=code,depth=0,atLine=true;
  const append=(text,cls)=>{const span=el('span',text,cls);target.append(span);};
  tokens.forEach((token,i)=>{
   if(/^\s+$/.test(token)){if(!atLine)append(' ');return;}
   if(starts.has(i)){const mark=el('mark');mark.title='반복되는 동일한 서브쿼리';target.append(mark);target=mark;}
   if(token===')')depth=Math.max(0,depth-1);
   if(/^(SELECT|FROM|WHERE|HAVING|JOIN|LEFT|INNER|GROUP|ORDER|UNION|WITH)$/i.test(token)&&!atLine){append('\n'+'  '.repeat(depth));atLine=true;}
   const cls=/^(SELECT|FROM|WHERE|AS|WITH|GROUP|BY|ORDER|HAVING|JOIN|LEFT|INNER|ON|AND|OR|UNION|ALL|CASE|WHEN|THEN|ELSE|END|OVER|PARTITION|DESC|ASC)$/i.test(token)?'sql-keyword':/^(SUM|MAX|MIN|AVG|COUNT|ROW_NUMBER|RANK|LAG|LEAD)$/i.test(token)?'sql-function':/^['"]/.test(token)?'sql-literal':/^--|^\/\*/.test(token)?'sql-comment':undefined;
   append(token,cls);atLine=false;if(token==='(')depth++;if(ends.has(i))target=target.parentElement||code;
  });
  const wrapper=el('div',undefined,'sql-reference');if(repeated.length)wrapper.append(el('small','노란 부분은 동일한 서브쿼리예요. 한 번 계산해 재사용해 보세요.'));wrapper.append(pre);return wrapper;
 }
 function begin(){document.body.classList.add('sql-results-open');data=null;active='결과';caseIndex=0;$('sql-result-case').replaceChildren();$('sql-result-inputs').replaceChildren();controls.querySelector('.sql-result-status').textContent='실행 중…';renderResult();}
 return {open,files,result,trackFor,begin,codeBlock,streak};
})();
