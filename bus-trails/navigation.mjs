
const $=id=>document.getElementById(id);
export function metresBetween(a,b){
 if(!a||!b||![a.lat,a.lng,b.lat,b.lng].every(Number.isFinite))return NaN;
 const r=Math.PI/180,h=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;
 return 12742000*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
let watch=null,token=0,buses=[],map=null,pos=null,dot=null,targetDot=null;
function clearDots(){dot?.setMap(null);targetDot?.setMap(null);dot=null;targetDot=null;}
export function stopNavigation(){
 token++;if(watch!==null)navigator.geolocation.clearWatch(watch);
 watch=null;pos=null;clearDots();
 if($('nav-start')){$('nav-start').disabled=!buses.length;$('nav-stop').disabled=true;$('nav-center').disabled=true;$('nav-distance').textContent='';$('nav-distance').classList.remove('near');$('nav-status').textContent='위치 안내가 꺼져 있어요.';}
}
function target(){return buses[Number($('nav-leg').value)];}
function update(p){
 pos=p;const here={lat:p.coords.latitude,lng:p.coords.longitude},acc=p.coords.accuracy,d=metresBetween(here,target()?.toPoint);
 const good=Date.now()-p.timestamp<=30000&&Number.isFinite(acc)&&acc<=100;
 $('nav-distance').textContent=Number.isFinite(d)?'하차 정류장까지 직선거리 약 '+(d>=1000?(d/1000).toFixed(1)+' km':Math.round(d/10)*10+' m'):'정류장 좌표가 없어 거리를 표시할 수 없어요.';
 $('nav-distance').classList.toggle('near',good&&d<=300);
 $('nav-status').textContent=(!good?'위치가 오래됐거나 오차가 커요. 정류장 안내를 확인하세요.':d<=300?'하차 정류장 근처예요! 버스 안내 방송과 정류장 이름을 확인하고 하차를 준비하세요.':'선택한 버스 구간의 하차 위치를 안내하고 있어요.')+' · 위치 오차 약 '+Math.round(acc)+' m · '+new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(p.timestamp)+' 갱신';
 $('nav-center').disabled=!map;
 if(map){if(!dot)dot=new google.maps.Circle({map,strokeColor:'#287bc1',fillColor:'#4285f4',fillOpacity:.25,strokeWeight:2});dot.setCenter(here);dot.setRadius(Math.max(acc,15));}
}
function showTarget(){
 const bus=target();$('nav-target').textContent=bus?'내릴 곳: '+bus.to:'안내할 버스 구간이 없어요.';
 $('nav-next').disabled=Number($('nav-leg').value)>=buses.length-1;
 targetDot?.setMap(null);targetDot=null;
 if(map&&bus?.toPoint)targetDot=new google.maps.Circle({map,center:bus.toPoint,radius:30,strokeColor:'#b7663e',fillColor:'#e9a269',fillOpacity:.65,strokeWeight:3});
 if(pos)update(pos);
}
export function setNavigationRoute(route,googleMap){
 stopNavigation();map=googleMap;buses=route.segments.filter(s=>s.mode==='bus');$('nav-leg').replaceChildren();
 buses.forEach((s,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=(i+1)+'. 버스 '+(s.line||'노선')+' → '+s.to;$('nav-leg').append(o);});
 $('nav-start').disabled=!buses.length;showTarget();
}
if(typeof document!=='undefined'){
 $('nav-start').addEventListener('click',()=>{
  if(!navigator.geolocation){$('nav-status').textContent='위치를 지원하지 않는 브라우저예요.';return;}
  stopNavigation();showTarget();const current=token;
  $('nav-start').disabled=true;$('nav-stop').disabled=false;$('nav-status').textContent='위치 권한을 허용해 주세요. 현재 위치를 기다리고 있어요…';
  watch=navigator.geolocation.watchPosition(p=>{if(current===token)update(p);},e=>{
   if(current!==token)return;
   if(e.code===1){stopNavigation();$('nav-status').textContent='브라우저의 사이트 위치 권한을 허용하고 다시 시작해 주세요.';}
   else{$('nav-status').textContent='위치를 받지 못했어요. 새 위치를 기다리고 있습니다.';$('nav-distance').textContent='위치 갱신 대기 중';$('nav-distance').classList.remove('near');}
  },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 });
 $('nav-stop').addEventListener('click',stopNavigation);
 $('nav-leg').addEventListener('change',showTarget);
 $('nav-next').addEventListener('click',()=>{const i=Number($('nav-leg').value);if(i<buses.length-1){$('nav-leg').value=String(i+1);showTarget();}});
 $('nav-center').addEventListener('click',()=>{if(map&&pos){map.panTo({lat:pos.coords.latitude,lng:pos.coords.longitude});map.setZoom(16);}});
 window.addEventListener('pagehide',stopNavigation);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&watch!==null&&(!pos||Date.now()-pos.timestamp>30000)){$('nav-status').textContent='새로운 위치를 기다리고 있어요.';$('nav-distance').textContent='위치 갱신 대기 중';$('nav-distance').classList.remove('near');}});
}
