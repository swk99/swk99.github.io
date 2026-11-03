// Guided example visualizations, separate from execution of the user's Python.
export function installAnimations(anchor,getProblem){
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=el('button','▶ Animate example','animation-launch');button.id='animation-button';button.title='Explore example 1 step by step in English';anchor.before(button);
 const dialog=el('dialog',undefined,'animation-dialog');dialog.lang='en';dialog.setAttribute('aria-labelledby','animation-title');document.body.append(dialog);
 let dataPromise,scene,index=0,timer=null,draw,play,slider,prev,next,counter,speed,request=0;
 const pause=()=>{clearTimeout(timer);timer=null;if(play)play.textContent='▶ Play';};
 const close=()=>{request++;pause();if(dialog.open)dialog.close();};window.workspaceAnimationClose=close;
 dialog.addEventListener('close',pause);dialog.addEventListener('cancel',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 const tick=()=>{timer=setTimeout(()=>{index++;draw();if(index<scene.steps.length-1)tick();else pause();},Number(speed.value));};
 button.onclick=async()=>{
  const p=getProblem();if(!p)return;close();const token=++request;
  dialog.replaceChildren();const head=el('div',undefined,'editorial-head');const title=el('h2',p.id+' · '+p.title);title.id='animation-title';const x=el('button','Close ×');x.onclick=close;head.append(title,x);
  const body=el('div',undefined,'animation-body');body.textContent='Loading animation…';dialog.append(head,body);dialog.showModal();
  try{
   dataPromise ||=fetch('animations.json?v=readable-en-v1').then(r=>{if(!r.ok)throw Error('Could not load the animation.');return r.json();}).catch(e=>{dataPromise=null;throw e;});
   const all=await dataPromise;if(token!==request||!dialog.open)return;scene=all[String(p.id)];if(!scene)throw Error('No animation was found for this problem.');index=0;body.replaceChildren();
   body.append(el('p','EXAMPLE 01 / UNDERSTAND THE PROBLEM','animation-kicker'),el('p','This guide explains the first example. Use Run or Debug to inspect the execution of your own code.','note'));
   const stage=el('div',undefined,'animation-stage');const caption=el('p',undefined,'animation-caption');caption.setAttribute('aria-live','polite');
   const controls=el('div',undefined,'animation-controls');const reset=el('button','↺ Restart');prev=el('button','← Previous');play=el('button','▶ Play');next=el('button','Next →');
   speed=el('select');speed.setAttribute('aria-label','Playback speed');[[3200,'Slow'],[2000,'Normal'],[1000,'Fast']].forEach(([v,t])=>speed.add(new Option(t,v)));speed.value='2000';speed.onchange=()=>{if(timer){pause();play.textContent='Ⅱ Pause';tick();}};
   counter=el('span');slider=el('input');slider.type='range';slider.min=0;slider.max=scene.steps.length-1;slider.value=0;slider.setAttribute('aria-label','Animation step');
   const jump=n=>{pause();index=n;draw();};reset.onclick=()=>jump(0);prev.onclick=()=>jump(Math.max(0,index-1));next.onclick=()=>jump(Math.min(scene.steps.length-1,index+1));slider.oninput=()=>jump(Number(slider.value));
   play.onclick=()=>{if(timer){pause();return;}if(index===scene.steps.length-1){index=0;draw();}play.textContent='Ⅱ Pause';tick();};
   controls.append(reset,prev,play,next,speed,counter);body.append(stage,caption,controls,slider);
   const details=el('details');details.append(el('summary','Example input / output'));details.append(el('pre','Arguments: '+JSON.stringify(scene.input)+'\nExpected: '+JSON.stringify(scene.expected)));body.append(details);
   body.append(el('p','Highlights show the nodes, edges, or cells being discussed. This guide does not enumerate every possible search path.','note'));
   draw=()=>{const f=scene.steps[index];caption.textContent=f.text;counter.textContent=`${index+1} / ${scene.steps.length}`;slider.value=index;prev.disabled=index===0;next.disabled=index===scene.steps.length-1;stage.replaceChildren(scene.grid?renderGrid(scene,f,el):renderGraph(scene,f));};draw();
  }catch(e){if(token===request)body.textContent=e.message;}
 };
}
function renderGrid(scene,frame,el){
 const grid=el('div',undefined,'animation-grid');grid.style.gridTemplateColumns=`repeat(${scene.grid[0].length}, minmax(30px, 64px))`;grid.setAttribute('role','img');grid.setAttribute('aria-label','Example grid. '+frame.text);
 scene.grid.forEach((row,r)=>row.forEach((v,c)=>{const key=r+','+c,wall=scene.gridKind!=='islands'&&(v===1||v==='+');const cell=el('div',wall?'■':key,'animation-cell'+(wall?' wall':'')+(scene.gridKind==='islands'&&v===1?' land':'')+(frame.active.includes(key)?' active':''));cell.title=`(${r},${c})${wall?' Wall':scene.gridKind==='islands'?(v===1?' Land':' Water'):' Empty cell'}`;grid.append(cell);}));return grid;
}
function renderGraph(scene,frame){
 const ns='http://www.w3.org/2000/svg';const svg=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
 const root=svg('svg',{viewBox:'0 0 800 400',role:'img','aria-label':frame.text});
 const defs=svg('defs');for(const [id,color]of [['arrow-dim','#64748b'],['arrow-hot','#63e6be']]){const marker=svg('marker',{id,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});marker.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:color}));defs.append(marker);}root.append(defs);
 const n=scene.nodes.length;const points=scene.nodes.map((_,i)=>{const a=-Math.PI/2+2*Math.PI*i/n;return n===1?[400,200]:[400+280*Math.cos(a),200+140*Math.sin(a)];});
 scene.edges.forEach(([u,v,label],i)=>{const a=points[u],b=points[v],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1,hot=frame.edges.includes(i);const line=svg('line',{x1:a[0]+dx/d*28,y1:a[1]+dy/d*28,x2:b[0]-dx/d*32,y2:b[1]-dy/d*32,class:hot?'animation-highlight':'',stroke:hot?'#63e6be':label==='red'?'#d16d77':'#64748b','stroke-width':hot?5:2,...(scene.directed?{'marker-end':`url(#arrow-${hot?'hot':'dim'})`}:{})});root.append(line);if(label!==undefined){const text=svg('text',{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2-9,'text-anchor':'middle',class:'animation-edge-label'},label);root.append(text);}});
 scene.nodes.forEach((label,i)=>{const [x,y]=points[i],hot=frame.active.includes(label);root.append(svg('circle',{class:hot?'animation-highlight':'',cx:x,cy:y,r:27,fill:hot?'#174d43':'#202d3d',stroke:hot?'#63e6be':'#64748b','stroke-width':hot?3:1.5}));root.append(svg('text',{x,y:y+(label.length>8?46:5),'text-anchor':'middle',class:'animation-node-label'},label));});return root;
}
