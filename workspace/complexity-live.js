'use strict';
(()=>{
const $=id=>document.getElementById(id);
let previous='';
function estimate(code){
 const lines=code.split('\n').filter(l=>l.trim()&&!/^\s*#/.test(l));
 const indent=l=>(l.match(/^\s*/)||[''])[0].replace(/\t/g,'    ').length;
 const loops=[],stack=[];
 for(const line of lines){
  const n=indent(line);
  while(stack.length&&stack[stack.length-1].indent>=n)stack.pop();
  const match=line.match(/^\s*(for|while)\b/);
  if(!match)continue;
  const fixed=/^\s*for\s+\w+\s+in\s+(?:range\(\s*\d+\s*\)|\[[^\]]*\]|\([^)]*\))\s*:/.test(line);
  const parent=stack.length?stack[stack.length-1]:null;
  const node={indent:n,fixed,parent,line};
  loops.push(node);stack.push(node);
 }
 const depth=Math.max(0,...loops.map(node=>{let d=0;for(let p=node;p;p=p.parent)if(!p.fixed)d++;return d;}));
 const sorting=/\bsorted\s*\(|\.sort\s*\(/.test(code);
 const allocated=/\b(set|dict|deque|defaultdict|list|Counter)\s*\(|\[[^\]]*\bfor\b|\bvisited\s*=/.test(code);
 const queue=/\bdeque\s*\(|\.popleft\s*\(/.test(code);
 const visited=/\bvisited\b/.test(code)&&/\.add\s*\(|\bvisited\s*\[/.test(code);
 const gridDimensions=/\blen\s*\(\s*\w+\s*\[\s*0\s*\]\s*\)/.test(code)&&/\blen\s*\(\s*\w+\s*\)/.test(code);
 const directions=/\b(?:dir|dirs|directions|moves)\s*=/.test(code)||/\(\s*-?1\s*,\s*0\s*\)/.test(code);
 const boundary=/\b(?:next_r|nr|new_r|r)\s*(?:<|>=)\s*(?:0|m|rows)\b/.test(code)||/\b(?:next_c|nc|new_c|c)\s*(?:<|>=)\s*(?:0|n|cols)\b/.test(code);
 const bfs=queue&&visited;
 const gridBfs=bfs&&gridDimensions&&(directions||boundary);
 const graphBfs=bfs&&!gridBfs&&/\b(?:graph|adj|neighbors|adjacency)\b/.test(code);
 const twoPointers=/\b(?:left|l)\s*=\s*0\b/.test(code)&&/\b(?:right|r)\s*=/.test(code)&&/\bwhile\s+(?:left|l)\s*<\s*(?:right|r)/.test(code);
 const sliding=/\b(?:left|start)\s*=\s*0\b/.test(code)&&/\bfor\s+\w+\s+in\s+(?:range\(|enumerate\()/.test(code)&&/\bwhile\s+/.test(code)&&/\b(?:left|start)\s*\+=\s*1/.test(code);
 let time=depth===0?'O(1)':depth===1?'O(n)':depth===2?'O(n²)':'O(n^'+depth+')';
 let space=allocated||queue?'O(n)':'O(1)';
 let detail='Loop-depth heuristic; not a formal complexity proof.';
 if(gridBfs){time='O(m × n)';space='O(m × n)';detail='Grid BFS pattern: each cell is visited at most once; m = rows, n = columns.';}
 else if(graphBfs){time='O(V + E)';space='O(V)';detail='Graph BFS pattern: V = vertices, E = edges; assumes adjacency-list traversal.';}
 else if(twoPointers||sliding){time='O(n)';detail='Monotonic pointer pattern detected; assumes pointers only move forward/inward.';}
 else if(sorting&&depth<=1){time='O(n log n)';detail='Sorting detected; assumes the loop is linear and sorting is performed once.';}
 else if(depth===0&&sorting){time='O(n log n)';detail='Sorting detected.';}
 return {time,space,detail};
}
function update(){
 const aceCode=window.ace&&window.ace.edit?(()=>{try{return window.ace.edit('ace').getValue()}catch(e){return null}})():null;
 const code=aceCode??$('code')?.value??'';
 const key=code+'|'+(document.querySelector('#filename')?.textContent||'');
 if(key===previous)return;previous=key;
 const time=$('complexity-time'),space=$('complexity-space'),note=$('complexity-note'),legend=$('complexity-legend');
 if(!time)return;
 if(/\.sql$/i.test(document.querySelector('#filename')?.textContent||'')){
  time.textContent='Time: query-dependent';space.textContent='Space: query-dependent';
  if(note)note.textContent='SQL depends on table sizes, indexes and execution plan.';
  if(legend)legend.hidden=true;
  return;
 }
 const result=estimate(code);
 time.textContent='Time: ~'+result.time;
 space.textContent='Space: ~'+result.space;
 if(legend){legend.hidden=true;legend.textContent='';}
 if(note)note.textContent='Live pattern-based estimate · '+result.detail+' Not guaranteed exact.';
}
setInterval(update,400);update();
})();
