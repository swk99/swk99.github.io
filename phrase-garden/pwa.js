(() => {
const status=document.getElementById('offline-status');
const panel=document.getElementById('install-guide');
const button=document.getElementById('install-button');
const update=document.getElementById('update-button');
let promptEvent,waiting;
function installed(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}
function reflect(){button.textContent=installed()?'앱 사용 안내':'아이폰에 앱 추가';}
button.addEventListener('click',async()=>{
 if(promptEvent){await promptEvent.prompt();promptEvent=null;reflect();}else panel.showModal();
});
document.getElementById('close-install').addEventListener('click',()=>panel.close());
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;button.textContent='앱 설치하기';});
window.addEventListener('appinstalled',reflect);
reflect();
if(!('serviceWorker' in navigator)){status.textContent='온라인으로 공부할 수 있어요.';return;}
(async()=>{
 try{
 const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
 function offer(worker){waiting=worker;update.hidden=false;}
 if(reg.waiting)offer(reg.waiting);
 reg.addEventListener('updatefound',()=>{const w=reg.installing;if(w)w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)offer(w);});});
 await navigator.serviceWorker.ready;
 status.textContent='오프라인 학습 준비 완료 · 카드·퀴즈 1,000개';
 }catch(_){status.textContent='오프라인 저장을 완료하지 못했어요. 인터넷 연결 후 다시 열어주세요.';}
})();
let refreshing=false;
navigator.serviceWorker.addEventListener('controllerchange',()=>{if(waiting&&!refreshing){refreshing=true;location.reload();}});
update.addEventListener('click',()=>{if(waiting)waiting.postMessage({type:'ACTIVATE_UPDATE'});});
})();