// Execute the production progress, renderer, course adapter and resume handler
// against synthetic pre-upgrade localStorage. No browser/user data is accessed.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../workspace');const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const data=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const active=data('kodori-sql.json'),archive=data('kodori-sql-archive.json');
const saved=new Map([
 ['workspace-solved:kodori-sql-window-all','true'],
 ['graph-workspace:kodori-sql-window-all','SELECT saved_user_code;'],
 ['graph-submissions:kodori-sql-partition',JSON.stringify([{passed:2,total:2}])],
 ['workspace-solved:kodori-sql-hello','true'],
 ['graph-workspace:kodori-sql-hello','SELECT name FROM snacks;'],
 ['workspace-solved:kodori-sql-rank','false'],
 ['graph-submissions:kodori-sql-rank',JSON.stringify([{passed:2,total:2}])],
 ['graph-submissions:kodori-sql-v3-cte-extract',JSON.stringify([{passed:2,total:2,syntaxPassed:false}])],
 ['unrelated-app','keep me']
]);const before=new Map(saved);
class Element{constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.value='';this.hidden=false;this.textContent='';}append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes}setAttribute(k,v){this.attributes[k]=v}focus(){}}
const els=Object.fromEntries(['files','search','kodori-start','problem-title'].map(id=>[id,new Element('div')]));
const document={createElement:tag=>new Element(tag),getElementById:id=>els[id]};
const context={window:{},document,inputs:{active,archive},localStorage:{getItem:k=>saved.has(k)?saved.get(k):null,setItem:(k,v)=>saved.set(k,String(v))},status:()=>{}};vm.createContext(context);
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
vm.runInContext(`const $=id=>document.getElementById(id);let problems=[],current;const problemLanguage=p=>p?.language==='sql'?'sql':'python';function openProblem(p){current=p;}function renderSqlStudy(){}\n`+
 section('// Explicit overrides','function buildSqlStudy')+
 section('function buildSqlStudy','function renderSqlStudy')+
 section("$('kodori-start').onclick=",'const value=')+
 `\nproblems=[...buildSqlStudy(inputs.active),...buildSqlStudy(inputs.archive)];current=problems[0];`,context);
const read=code=>vm.runInContext(code,context);
assert.equal(read("isSolved(problems.find(p=>p.id==='kodori-sql-window-all'))"),true);
assert.equal(read("isSolved(problems.find(p=>p.id==='kodori-sql-partition'))"),true);
assert.equal(read("isSolved(problems.find(p=>p.id==='kodori-sql-rank'))"),false);
assert.equal(read("isSolved(problems[0])"),false,'Data-only pass must not count as syntax completion');
read('renderFiles()');
const all=[];function walk(el){all.push(el);for(const child of el.children||[])walk(child)}walk(els.files);
assert.equal(all.find(el=>el.id==='completed-kodori-sql-window-all').checked,true);
assert.equal(all.find(el=>el.id==='completed-kodori-sql-hello').checked,true);
assert(all.some(el=>el.textContent.includes('2/48 完了')||el.textContent.includes('2/48 완료')));
assert(all.some(el=>el.textContent.includes('1개 완료 / 28개 보관')));
assert.deepEqual([...saved],[...before],'Reading and displaying revised course must not mutate old storage');
read("$('kodori-start').onclick()");assert.equal(read('current.id'),'kodori-sql-v3-cte-extract');
// Completing a new task advances only that task; old IDs/drafts remain byte-identical.
read('markSolved(current,true)');read("$('kodori-start').onclick()");assert.equal(read('current.id'),'kodori-sql-v3-cte-chain');
for(const [key,value] of before)assert.equal(saved.get(key),value,key);
read('showArchived=true;renderFiles()');
const allExpanded=[];function collect(el){allExpanded.push(el);for(const child of el.children||[])collect(child)}collect(els.files);
assert(allExpanded.some(el=>el.id==='completed-kodori-sql-where'),'Retired unfinished task remains accessible');
// Reload semantics: clear only in-memory test overrides, then read durable records.
read('completionOverrides.clear()');assert(read("isSolved(problems.find(p=>p.id==='kodori-sql-v3-cte-extract'))"));
console.log('PASS: retained checks, historical submissions, manual overrides, retired records, unchanged drafts, new-only completion, resume and reload');
// Exercise the new track renderer with the same saved records.
vm.runInContext(fs.readFileSync(path.join(root,'sql-ui.js'),'utf8'),context);
read('renderFiles()');
assert.equal(els.files.children.filter(e=>e.className?.includes('problem-row')).length,48);
assert(!els.files.children.some(e=>e.children?.some(c=>c.id==='completed-kodori-sql-hello')),'Archive stays out of active track');
assert.equal(read("window.sqlWorkspace.trackFor(problems.find(p=>p.retired))"),'archive');
assert.equal(read("window.sqlWorkspace.trackFor({language:'sql'})"),'interview');
for(const [key,value] of before)assert.equal(saved.get(key),value,key);
console.log('PASS: selected SQL track renders 48 active items, excludes archive, preserves saved records');
assert.equal(read("window.sqlWorkspace.streak(['2026-11-06','2026-11-07','2026-11-08'],new Date(2026,10,8))"),3);
assert.equal(read("window.sqlWorkspace.streak(['2026-11-06','2026-11-07'],new Date(2026,10,8))"),2);
assert.equal(read("window.sqlWorkspace.streak(['2026-11-06'],new Date(2026,10,8))"),0);
assert.equal(read("window.sqlWorkspace.streak(['2026-10-31','2026-11-01'],new Date(2026,10,1))"),2);
const codeBlock=read(`window.sqlWorkspace.codeBlock("SELECT 'FROM WHERE' AS label FROM (SELECT SUM(amount) FROM snacks) a JOIN (SELECT SUM(amount) FROM snacks) b;")`);
const nodes=[];function descendants(n){nodes.push(n);for(const child of n.children||[])descendants(child)}descendants(codeBlock);
assert.equal(nodes.filter(n=>n.tag==='mark').length,2,'Both repeated subqueries highlighted');
assert(nodes.some(n=>n.className==='sql-literal'&&n.textContent==="'FROM WHERE'"),'Keywords inside strings stay intact');
console.log('PASS: study streak dates, duplicate subquery highlights and quoted SQL literals');
