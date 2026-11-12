/* SQL presentation only. Progress and drafts remain owned by app.js. */
window.sqlWorkspace=(()=>{
 let track='advanced',data=null,active='Result',caseIndex=0,consoleAnchor,body,controls,selector;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const trackFor=p=>p.retired?'archive':String(p.id).startsWith('kodori-sql-')?'advanced':p.study?'study':'interview';
 const tracks={advanced:'🐨 Advanced SQL Adventure with Kodori',study:'SQL study course',interview:'Interview problems',archive:'Previous exercise history'};
 function init(){
  if(selector)return;
  const label=el('label',undefined,'sql-track');label.append(el('span','Learning track'));selector=el('select');selector.id='sql-track';selector.setAttribute('aria-label','SQL learning track');label.append(selector);document.querySelector('.search').before(label);
  selector.onchange=()=>{track=selector.value;$('search').value='';const group=problems.filter(p=>p.language==='sql'&&trackFor(p)===track);openProblem(group.find(p=>!isSolved(p))||group[0]);};
  const settings=el('button','Settings','sql-settings');settings.onclick=()=>dialog.showModal();document.querySelector('header').append(settings);
  const dialog=el('dialog',undefined,'sql-settings-dialog');const close=el('button','Close');close.onclick=()=>dialog.close();const archive=el('button','Open previous exercise history');archive.onclick=()=>{dialog.close();const p=problems.find(p=>p.retired);if(p)openProblem(p);};const exportButton=el('button','Export current solution');exportButton.onclick=()=>$('download').click();dialog.append(el('h2','SQL settings'),el('p','Your solutions and completion history remain saved in this browser.'),archive,exportButton,close);document.body.append(dialog);
  body=el('div');body.id='sql-problem-content';$('problem-title').after(body);
  const journeyPanel=el('section',undefined,'sql-journey');journeyPanel.id='sql-journey';document.querySelector('main').prepend(journeyPanel);const reopen=el('button','View results','sql-reopen');reopen.onclick=()=>document.body.classList.add('sql-results-open');document.querySelector('.toolbar>div').prepend(reopen);const panel=document.querySelector('.console');consoleAnchor=document.createComment('SQL inline results anchor');panel.before(consoleAnchor);
  controls=el('div',undefined,'sql-result-controls');const tabs=el('div',undefined,'sql-result-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','SQL execution results');
  ['Result','Expected','Difference'].forEach((name,i)=>{const b=el('button',name);b.setAttribute('role','tab');b.onclick=()=>{active=name;renderResult();};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const next=(i+(e.key==='ArrowRight'?1:2))%3;tabs.children[next].click();tabs.children[next].focus();}};tabs.append(b);});
  const cases=el('select');cases.id='sql-result-case';cases.setAttribute('aria-label','Select result dataset');cases.onchange=()=>{caseIndex=Number(cases.value);renderResult();};
  const toolsPanel=el('details',undefined,'sql-result-tools');toolsPanel.append(el('summary','Query plan · Additional data'));const plan=el('button','Run query plan');plan.onclick=()=>run('debug');const inputs=el('div');inputs.id='sql-result-inputs';toolsPanel.append(plan,inputs);
  const collapse=el('button','Collapse results');collapse.onclick=()=>document.body.classList.remove('sql-results-open');controls.append(tabs,cases,el('span','','sql-result-status'),collapse,toolsPanel);panel.prepend(controls);
  new ResizeObserver(()=>aceEditor?.resize()).observe(document.querySelector('.editor-wrap'));
 }
 function open(p){
  init();if(executionDialog?.open)executionDialog.close();const sql=p.language==='sql';document.body.classList.toggle('sql-mode',sql);const panel=document.querySelector('.console');if(sql)document.querySelector('main').append(panel);else consoleAnchor.after(panel);
  $('submit').textContent=sql?'Submit answer':'Submit ↗';$('search').placeholder=sql?'Find a problem':'Find a module…';if(aceEditor){aceEditor.setTheme(sql?'ace/theme/chrome':'ace/theme/tomorrow_night');aceEditor.setFontSize(sql?'16px':'16pt');}if(!sql)return;
  if($('sql-koala-message'))$('sql-koala-message').textContent='🐨 Let\'s start with a small query together!';track=trackFor(p);selector.replaceChildren();for(const [key,name] of Object.entries(tracks)){if(key==='archive'&&track!=='archive')continue;selector.add(new Option(name,key));}selector.value=track;
  body.replaceChildren();body.append(el('p',p.rules[0],'sql-task'));
  if(p.syntax)body.append(el('p','Syntax to learn · '+p.syntax,'sql-syntax'));
  const tables=el('div',undefined,'sql-input-output'),input=el('div'),expected=el('div');input.append(el('h2','Input table'));expected.append(el('h2','Expected result'));for(const [name,cols] of Object.entries(p.schema))input.append(sqlTable(name,cols.map(c=>c[0]),p.tests[0].args[0][name]||[],cols.map(c=>c[1])));expected.append(sqlTable('Answer',p.columns,p.tests[0].expected));tables.append(input,expected);body.append(tables);
  if(p.referenceSql){body.append(el('h2','Original SQL'),codeBlock(p.referenceSql));}
  const drawer=el('details',undefined,'sql-hints');drawer.append(el('summary','Show hints'));const content=el('div');let level=0;const hints=p.study?.hints||[];const next=el('button','Next hint');const show=()=>{content.replaceChildren(el('h3',['Hint 1 · Concept','Hint 2 · Syntax template','Hint 3 · Almost the answer'][level]||'Explanation'),el('pre',hints[level]||p.study?.concept||'Compare the problem\'s input and expected output.'));next.hidden=level>=hints.length-1;};next.onclick=()=>{level++;show();};show();drawer.append(content,next);
  if(p.rules.length>1){const conditions=el('details');conditions.append(el('summary','Detailed requirements'));p.rules.slice(1).forEach(r=>conditions.append(el('p',r)));drawer.append(conditions);}
  if(p.study){const answer=el('details');answer.append(el('summary','View solution and explanation'),el('pre',p.study.solution),el('p',p.study.explanation));const load=el('button','Load solution into editor');load.onclick=()=>{if(aceEditor)aceEditor.setValue(p.study.solution,-1);else $('code').value=p.study.solution;save();refreshLines();};answer.append(load);drawer.append(answer);}
  body.append(drawer);const nextProblem=el('button','Next unfinished problem →','sql-next');nextProblem.onclick=()=>{const p=problems.find(p=>p.language==='sql'&&trackFor(p)===track&&!isSolved(p));if(p)openProblem(p);};body.append(nextProblem);
  document.body.classList.remove('sql-results-open');data=null;active='Result';caseIndex=0;$('sql-result-case').replaceChildren();$('sql-result-inputs').replaceChildren();controls.querySelector('.sql-result-status').textContent='';controls.querySelector('details').open=false;renderResult();
 }
 function files(){
  const list=$('files');list.replaceChildren();if(selector)journey();const group=problems.filter(p=>p.language==='sql'&&trackFor(p)===track);list.append(el('div',`${group.filter(isSolved).length} / ${group.length} completed`,'completion-heading'));const q=$('search').value.toLowerCase();const visible=group.filter(p=>(p.title+p.id+p.file).toLowerCase().includes(q));
  let chapter='';for(const p of visible){if(p.study?.level&&p.study.level!==chapter){chapter=p.study.level;list.append(el('div',chapter,'sql-chapter'));}const row=el('div',undefined,'problem-row'+(isSolved(p)?' solved':''));const check=el('input');check.type='checkbox';check.id='completed-'+p.id;check.checked=isSolved(p);check.setAttribute('aria-label',p.title+' completed');check.onchange=()=>{markSolved(p,check.checked);$('completed-'+p.id)?.focus();};const b=el('button',p.title,'file'+(p.id===current.id?' active':''));b.onclick=()=>openProblem(p);row.append(check,b);list.append(row);}if(!visible.length)list.append(el('p','No matching problems.'));
 }
 function result(d){document.body.classList.add('sql-results-open');data=d;if(runMode==='submit'){const passed=d.results.length>0&&d.results.every(r=>r.ok===true)&&(!d.syntax||d.syntax.ok);$('sql-koala-message').textContent=passed?'🐨 You did it! One more step on our adventure.':'🐨 That\'s okay! Compare the results and try again.';if(passed)recordDay();} caseIndex=0;active='Result';const cases=$('sql-result-case');cases.replaceChildren();d.results.forEach((r,i)=>cases.add(new Option((r.ok?'✓ ':r.ok===false?'✗ ':'')+(r.label||'Case '+r.case),String(i))));controls.querySelector('.sql-result-status').textContent=`${d.results.filter(r=>r.ok).length}/${d.results.length} passed`+(d.syntax?' · Syntax '+(d.syntax.ok?'Passed':'Needs review'):'');renderResult();}
 function renderResult(){
  controls.querySelectorAll('[role=tab]').forEach(b=>{const selected=b.textContent===active;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
  const out=$('output');out.replaceChildren();if(!data){out.append(el('p','Use Run to inspect results and Submit to complete the exercise.'));return;}
  const r=data.results[caseIndex];if(!r)return;
  if(active==='Result'){if(r.error)out.append(el('pre',r.error));else if(r.actual)out.append(sqlTable('Execution result',r.actual.columns,r.actual.rows));if(data.syntax){const checks=el('details');checks.append(el('summary',data.syntax.ok?'✓ Required syntax passed':'Required syntax needs review'));for(const c of data.syntax.checks||[])checks.append(el('p',(c.ok?'✓ ':'✗ ')+c.label));if(data.syntax.error)checks.append(el('p',data.syntax.error));out.append(checks);}}
  else if(active==='Expected'){if(r.expected)out.append(sqlTable('Expected',r.expected.columns,r.expected.rows));else out.append(el('p','No expected output is available for this run.'));}
  else{out.append(el('p',r.ok?'Matches the expected output.':r.error?'Resolve the execution error first.':'Compare column names, row values, and duplicate counts.'));if(r.actual&&r.expected){const compare=el('div',undefined,'sql-input-output');compare.append(sqlTable('Execution result',r.actual.columns,r.actual.rows),sqlTable('Expected',r.expected.columns,r.expected.rows));out.append(compare);}}
  const inputs=$('sql-result-inputs');inputs.replaceChildren();if(data.output)inputs.append(el('pre',data.output));const test=[...current.tests,...current.extra].find(t=>t.label===r.label)||[...current.tests,...current.extra][caseIndex];if(test)for(const [name,cols] of Object.entries(current.schema))inputs.append(sqlTable(name,cols.map(c=>c[0]),test.args[0][name]||[]));
 }
 function localDay(date=new Date()){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
 function streak(days,now=new Date()){
  const seen=new Set(days);const cursor=new Date(now.getFullYear(),now.getMonth(),now.getDate());if(!seen.has(localDay(cursor)))cursor.setDate(cursor.getDate()-1);let count=0;while(seen.has(localDay(cursor))){count++;cursor.setDate(cursor.getDate()-1);}return count;
 }
 function recordDay(){try{const key='sql-journey-study-days';const old=JSON.parse(localStorage.getItem(key)||'[]');const days=Array.isArray(old)?old:[];const day=localDay();if(!days.includes(day))localStorage.setItem(key,JSON.stringify([...days,day]));}catch(e){/* Progress saving remains independent. */}}
 function journey(){
  const panel=$('sql-journey');if(!panel)return;const previous=$('sql-koala-message')?.textContent;panel.replaceChildren();const group=problems.filter(p=>p.language==='sql'&&trackFor(p)===track);const done=group.filter(isSolved).length;
  const mascot=el('div','🐨','sql-mascot');mascot.setAttribute('aria-hidden','true');const info=el('div',undefined,'sql-journey-info');const line=el('div',undefined,'sql-journey-line');line.append(el('strong',done+' / '+group.length+' steps'),el('span','One problem at a time with Kodori'));const bar=el('progress');bar.max=group.length||1;bar.value=done;bar.setAttribute('aria-label','Learning track progress');const message=el('p',previous?.includes('You did it')?previous:'🐨 Let\'s start with a small query together!');message.id='sql-koala-message';message.setAttribute('role','status');info.append(line,bar,message);
  let days=[];try{days=JSON.parse(localStorage.getItem('sql-journey-study-days')||'[]');}catch(e){}const badge=el('span','🔥 '+streak(Array.isArray(days)?days:[])+'-day streak','sql-streak');badge.title='Based on days with a correct submission · Recorded from first use';panel.append(mascot,info,badge);
  const map=el('details',undefined,'sql-map');map.append(el('summary','Adventure map'));const stops=el('div');for(const level of new Set(group.map(p=>p.study?.level||'Interview'))){const lessons=group.filter(p=>(p.study?.level||'Interview')===level);const completed=lessons.filter(isSolved).length;const stop=el('button',(completed===lessons.length?'✓ ':'')+level+' · '+completed+'/'+lessons.length);stop.className=completed===lessons.length?'complete':'';stop.onclick=()=>openProblem(lessons.find(p=>!isSolved(p))||lessons[0]);stops.append(stop);}map.append(stops);panel.append(map);
 }
 function codeBlock(sql){
  // Tokenize before formatting: quoted strings and identifiers stay byte-identical.
  const tokens=sql.match(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|\[[^\]]*\]|[A-Za-z_][\w]*|\d+(?:\.\d+)?|\s+|./g)||[];
  const pairs=[],stack=[];tokens.forEach((token,i)=>{if(token==='(')stack.push(i);else if(token===')'&&stack.length){const start=stack.pop();const text=tokens.slice(start+1,i).join('').trim();if(/^SELECT\b/i.test(text))pairs.push({start,end:i,text:text.replace(/\s+/g,' ').toUpperCase()});}});
  const repeated=pairs.filter(p=>pairs.filter(q=>q.text===p.text).length>1);const starts=new Set(repeated.map(p=>p.start)),ends=new Set(repeated.map(p=>p.end));const pre=el('pre',undefined,'sql-code-block');pre.setAttribute('aria-label','Original SQL code');const code=el('code');pre.append(code);let target=code,depth=0,atLine=true;
  const append=(text,cls)=>{const span=el('span',text,cls);target.append(span);};
  tokens.forEach((token,i)=>{
   if(/^\s+$/.test(token)){if(!atLine)append(' ');return;}
   if(starts.has(i)){const mark=el('mark');mark.title='Repeated identical subquery';target.append(mark);target=mark;}
   if(token===')')depth=Math.max(0,depth-1);
   if(/^(SELECT|FROM|WHERE|HAVING|JOIN|LEFT|INNER|GROUP|ORDER|UNION|WITH)$/i.test(token)&&!atLine){append('\n'+'  '.repeat(depth));atLine=true;}
   const cls=/^(SELECT|FROM|WHERE|AS|WITH|GROUP|BY|ORDER|HAVING|JOIN|LEFT|INNER|ON|AND|OR|UNION|ALL|CASE|WHEN|THEN|ELSE|END|OVER|PARTITION|DESC|ASC)$/i.test(token)?'sql-keyword':/^(SUM|MAX|MIN|AVG|COUNT|ROW_NUMBER|RANK|LAG|LEAD)$/i.test(token)?'sql-function':/^['"]/.test(token)?'sql-literal':/^--|^\/\*/.test(token)?'sql-comment':undefined;
   append(token,cls);atLine=false;if(token==='(')depth++;if(ends.has(i))target=target.parentElement||code;
  });
  const wrapper=el('div',undefined,'sql-reference');if(repeated.length)wrapper.append(el('small','Highlighted sections contain identical subqueries. Try defining the calculation once and reusing it.'));wrapper.append(pre);return wrapper;
 }
 function begin(){document.body.classList.add('sql-results-open');data=null;active='Result';caseIndex=0;$('sql-result-case').replaceChildren();$('sql-result-inputs').replaceChildren();controls.querySelector('.sql-result-status').textContent='Running…';renderResult();}
 return {open,files,result,trackFor,begin,codeBlock,streak};
})();

