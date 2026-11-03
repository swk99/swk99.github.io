// Guided example visualizations, separate from execution of the user's Python.
export function installAnimations(anchor,getProblem){
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=el('button','▶ 문제 애니메이션','animation-launch');button.id='animation-button';button.title='예제 1을 한국어 설명과 함께 단계별로 보기';anchor.before(button);
 const dialog=el('dialog',undefined,'animation-dialog');dialog.lang='ko';dialog.setAttribute('aria-labelledby','animation-title');document.body.append(dialog);
 let dataPromise,scene,index=0,timer=null,draw,play,slider,prev,next,counter,speed,request=0;
 const pause=()=>{clearTimeout(timer);timer=null;if(play)play.textContent='▶ 재생';};
 const close=()=>{request++;pause();if(dialog.open)dialog.close();};window.workspaceAnimationClose=close;
 dialog.addEventListener('close',pause);dialog.addEventListener('cancel',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 const tick=()=>{timer=setTimeout(()=>{index++;draw();if(index<scene.steps.length-1)tick();else pause();},Number(speed.value));};
 button.onclick=async()=>{
  const p=getProblem();if(!p)return;close();const token=++request;
  dialog.replaceChildren();const head=el('div',undefined,'editorial-head');const title=el('h2',p.id+' · '+p.title);title.id='animation-title';const x=el('button','닫기 ×');x.onclick=close;head.append(title,x);
  const body=el('div',undefined,'animation-body');body.textContent='애니메이션을 불러오는 중…';dialog.append(head,body);dialog.showModal();
  try{
   dataPromise ||=fetch('animations.json').then(r=>{if(!r.ok)throw Error('애니메이션을 불러오지 못했습니다.');return r.json();}).catch(e=>{dataPromise=null;throw e;});
   const all=await dataPromise;if(token!==request||!dialog.open)return;scene=all[String(p.id)];if(!scene)throw Error('이 문제의 애니메이션을 찾을 수 없습니다.');index=0;body.replaceChildren();
   body.append(el('p','EXAMPLE 01  /  문제 이해하기','animation-kicker'),el('p','첫 번째 예제를 설명하는 가이드입니다. 작성한 코드의 실행 결과는 Run / Debug에서 확인하세요.','note'));
   const stage=el('div',undefined,'animation-stage');const caption=el('p',undefined,'animation-caption');caption.setAttribute('aria-live','polite');
   const controls=el('div',undefined,'animation-controls');const reset=el('button','↺ 처음');prev=el('button','← 이전');play=el('button','▶ 재생');next=el('button','다음 →');
   speed=el('select');speed.setAttribute('aria-label','재생 속도');[[3200,'느리게'],[2000,'보통'],[1000,'빠르게']].forEach(([v,t])=>speed.add(new Option(t,v)));speed.value='2000';speed.onchange=()=>{if(timer){pause();play.textContent='Ⅱ 일시정지';tick();}};
   counter=el('span');slider=el('input');slider.type='range';slider.min=0;slider.max=scene.steps.length-1;slider.value=0;slider.setAttribute('aria-label','애니메이션 단계');
   const jump=n=>{pause();index=n;draw();};reset.onclick=()=>jump(0);prev.onclick=()=>jump(Math.max(0,index-1));next.onclick=()=>jump(Math.min(scene.steps.length-1,index+1));slider.oninput=()=>jump(Number(slider.value));
   play.onclick=()=>{if(timer){pause();return;}if(index===scene.steps.length-1){index=0;draw();}play.textContent='Ⅱ 일시정지';tick();};
   controls.append(reset,prev,play,next,speed,counter);body.append(stage,caption,controls,slider);
   const details=el('details');details.append(el('summary','예제 입력 / 출력'));details.append(el('pre','Arguments: '+JSON.stringify(scene.input)+'\nExpected: '+JSON.stringify(scene.expected)));body.append(details);
   body.append(el('p','강조 표시 = 현재 설명 중인 정점·간선 또는 이동 칸. 모든 가능한 경로를 보여주는 탐색 기록은 아닙니다.','note'));
   draw=()=>{const f=scene.steps[index];caption.textContent=f.text;counter.textContent=`${index+1} / ${scene.steps.length}`;slider.value=index;prev.disabled=index===0;next.disabled=index===scene.steps.length-1;stage.replaceChildren(scene.grid?renderGrid(scene,f,el):renderGraph(scene,f));};draw();
  }catch(e){if(token===request)body.textContent=e.message;}
 };
}
function renderGrid(scene,frame,el){
 const grid=el('div',undefined,'animation-grid');grid.style.gridTemplateColumns=`repeat(${scene.grid[0].length}, minmax(30px, 64px))`;grid.setAttribute('role','img');grid.setAttribute('aria-label','예제 미로. '+frame.text);
 scene.grid.forEach((row,r)=>row.forEach((v,c)=>{const key=r+','+c,wall=v===1||v==='+';const cell=el('div',wall?'■':key,'animation-cell'+(wall?' wall':'')+(frame.active.includes(key)?' active':''));cell.title=`(${r},${c})${wall?' 벽':' 빈칸'}`;grid.append(cell);}));return grid;
}
function renderGraph(scene,frame){
 const ns='http://www.w3.org/2000/svg';const svg=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
 const root=svg('svg',{viewBox:'0 0 800 400',role:'img','aria-label':frame.text});
 const defs=svg('defs');for(const [id,color]of [['arrow-dim','#64748b'],['arrow-hot','#63e6be']]){const marker=svg('marker',{id,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});marker.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:color}));defs.append(marker);}root.append(defs);
 const n=scene.nodes.length;const points=scene.nodes.map((_,i)=>{const a=-Math.PI/2+2*Math.PI*i/n;return n===1?[400,200]:[400+280*Math.cos(a),200+140*Math.sin(a)];});
 scene.edges.forEach(([u,v,label],i)=>{const a=points[u],b=points[v],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1,hot=frame.edges.includes(i);const line=svg('line',{x1:a[0]+dx/d*28,y1:a[1]+dy/d*28,x2:b[0]-dx/d*32,y2:b[1]-dy/d*32,class:hot?'animation-highlight':'',stroke:hot?'#63e6be':label==='red'?'#d16d77':'#64748b','stroke-width':hot?5:2,...(scene.directed?{'marker-end':`url(#arrow-${hot?'hot':'dim'})`}:{})});root.append(line);if(label!==undefined){const text=svg('text',{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2-9,'text-anchor':'middle',class:'animation-edge-label'},label);root.append(text);}});
 scene.nodes.forEach((label,i)=>{const [x,y]=points[i],hot=frame.active.includes(label);root.append(svg('circle',{class:hot?'animation-highlight':'',cx:x,cy:y,r:27,fill:hot?'#174d43':'#202d3d',stroke:hot?'#63e6be':'#64748b','stroke-width':hot?3:1.5}));root.append(svg('text',{x,y:y+(label.length>8?46:5),'text-anchor':'middle',class:'animation-node-label'},label));});return root;
}
