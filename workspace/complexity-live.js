'use strict';
(()=>{
const $=id=>document.getElementById(id);
let previous='';
function update(){
 const editor=document.querySelector('#ace .ace_text-input');
 const aceCode=window.ace&&window.ace.edit?(()=>{try{return window.ace.edit('ace').getValue()}catch(e){return null}})():null;
 const code=aceCode??$('code')?.value??'';
 const key=code+'|'+(document.querySelector('#filename')?.textContent||'');
 if(key===previous)return;previous=key;
 const time=$('complexity-time'),space=$('complexity-space'),note=$('complexity-note'),legend=$('complexity-legend');
 if(!time)return; if(legend)legend.hidden=true;
 if(/\.sql$/i.test(document.querySelector('#filename')?.textContent||'')){time.textContent='Time: query-dependent';space.textContent='Space: query-dependent';note.textContent='SQL depends on table sizes, indexes and execution plan.';return;}
 const lines=code.split('\n').filter(l=>l.trim()&&!/^\s*#/.test(l));
 const indent=l=>(l.match(/^\s*/)||[''])[0].replace(/\t/g,'    ').length;
 let depth=0,stack=[];
 for(const l of lines){const n=indent(l);while(stack.length&&stack[stack.length-1]>=n)stack.pop();if(/^\s*(for|while)\b/.test(l)){stack.push(n);depth=Math.max(depth,stack.length)}}
 const bfs=/\.popleft\s*\(|\bheappop\s*\(/.test(code);
 const scan=/for\s+\w+\s+in\s+(wordList|words|nums|arr|values)\b/.test(code);
 const sorting=/\bsorted\s*\(|\.sort\s*\(/.test(code);
 const allocated=/\b(set|dict|deque|defaultdict|list|Counter)\s*\(|\[[^\]]*\bfor\b/.test(code);
 let t=depth===0?'O(1)':depth===1?'O(n)':depth===2?'O(n²)':'O(n^'+depth+')';
 if(sorting&&depth===0)t='O(n log n)';
 if(bfs&&scan&&depth>=2)t='O(V × N × L)';
 let sp=allocated||bfs?'O(n)':'O(1)';
 time.textContent='Time: ~'+t;space.textContent='Space: ~'+sp;
 if(legend){legend.hidden=!/[VNL]/.test(t);legend.textContent=t.includes('V × N × L')?'V = 방문한 단어 수 (visited words)   ·   N = wordList 단어 수   ·   L = 단어 길이 (word length)':'n = 입력 데이터 크기 (input size)';}
 note.textContent='Live pattern-based estimate · nested loops, sorting and containers; not guaranteed exact.';
}
setInterval(update,400);update();
})();