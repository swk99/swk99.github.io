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
const context={document,inputs:{active,archive},localStorage:{getItem:k=>saved.has(k)?saved.get(k):null,setItem:(k,v)=>saved.set(k,String(v))},status:()=>{}};vm.createContext(context);
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
