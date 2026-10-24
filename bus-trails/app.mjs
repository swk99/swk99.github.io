import {setNavigationRoute,stopNavigation} from './navigation.mjs?v=1';
import {tflURL, normalizeTfl, normalizeGoogle, rankRoutes, choicesFrom, londonEpoch, londonParts} from './core.mjs?v=2';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = value => new DOMParser().parseFromString(String(value ?? ''), 'text/html').body.textContent || '';
const clock = epoch => Number.isFinite(epoch) ? new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'}).format(epoch) : '시간 미제공';
const mins = n => Math.ceil(n);
const state = {version:0, controller:null, routes:[], overrides:{}, keys:{google:'',tfl:''}, map:null, lines:[], googleReady:false, googlePromise:null, loadedKey:''};
try { state.keys = {...state.keys, ...JSON.parse(sessionStorage.getItem('bus-trails.keys') || '{}')}; } catch {}
const blankResults = $('results').innerHTML;

function connections() {
  $('connections').textContent = `TfL 경로 검색${state.keys.tfl ? ' · 키 설정됨' : ''} · Google ${state.googleReady ? '연결됨' : state.keys.google ? '검색 시 연결' : '미연결'}`;
}
function busy(value) {
  $('search').disabled = value;
  $('search').innerHTML = value ? '경로를 비교하고 있어요…' : '빠른 버스 경로 찾기 <span>→</span>';
  $('route-form').setAttribute('aria-busy', String(value));
}
function invalidate() {
  stopNavigation();
  state.version++; state.controller?.abort(); busy(false); state.routes=[];
  $('results').innerHTML=blankResults; $('detail').hidden=true; $('warnings').replaceChildren();
  $('status').textContent='조건을 바꿨어요. 경로를 다시 검색해 주세요.';
}
function warnings(messages) {
  $('warnings').innerHTML=[...new Set(messages.filter(Boolean))].map(m=>`<p class="warning">${esc(m)}</p>`).join('');
}
for (const id of ['from','to']) $(id).addEventListener('input',()=>{
  state.overrides={}; $('location-choices').hidden=true; invalidate();
});
$('walk-limit').addEventListener('input',()=>{$('walk-value').textContent=`${$('walk-limit').value}분 이내`; invalidate();});
$('departure').addEventListener('change',invalidate);

function londonInputValue(epoch) {
  const p=londonParts(epoch);
  return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;
}
$('departure-at').value=londonInputValue(Date.now()+3600000);
function updateDepartureInput() {
  const custom=$('departure').value==='custom';
  $('departure-custom').hidden=!custom;
  $('departure-at').required=custom;
  $('departure-at').disabled=!custom;
}
$('departure').addEventListener('change',updateDepartureInput);
$('departure-at').addEventListener('change',invalidate);
$('tomorrow').addEventListener('click',()=>{
  const p=londonParts(Date.now());
  const next=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)+1));
  $('departure-at').value=next.toISOString().slice(0,10)+'T08:00';
  $('departure').value='custom';updateDepartureInput();invalidate();
  $('status').textContent='내일 오전 8시로 입력했어요. 원하는 런던 출발 시각으로 바꿔 검색하세요.';
  $('departure-at').focus();
});
updateDepartureInput();

$('swap').addEventListener('click',()=>{
  [$('from').value,$('to').value]=[$('to').value,$('from').value];
  [state.overrides.from,state.overrides.to]=[state.overrides.to,state.overrides.from];
  $('location-choices').hidden=true; invalidate();
});
$('example').addEventListener('click',()=>{
  $('from').value='New Malden'; $('to').value='Clapham Junction'; state.overrides={};
  $('location-choices').hidden=true; invalidate(); $('search').focus();
});
$('locate').addEventListener('click',()=>{
  if (!navigator.geolocation) { $('status').textContent='이 브라우저에서는 위치를 사용할 수 없어요. 출발지를 입력해 주세요.'; return; }
  $('locate').disabled=true; $('status').textContent='현재 위치를 확인하고 있어요…';
  navigator.geolocation.getCurrentPosition(position=>{
    $('from').value=`${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`;
    state.overrides={}; $('location-choices').hidden=true; invalidate(); $('locate').disabled=false;
    $('status').textContent='현재 위치를 출발지로 입력했어요. 런던 TfL 버스 운행 지역에서 검색할 수 있어요.';
  },()=>{$('locate').disabled=false; $('status').textContent='위치를 가져오지 못했어요. 권한을 확인하거나 출발지를 입력해 주세요.';}, {timeout:10000,maximumAge:60000,enableHighAccuracy:false});
});

for (const id of ['settings','privacy']) {
  $(id+'-open').addEventListener('click',()=>{
    if (id==='settings') { $('google-key').value=state.keys.google; $('tfl-key').value=state.keys.tfl; }
    $(id).showModal();
  });
}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
function saveKeys(next) {
  let saved=true; try { sessionStorage.setItem('bus-trails.keys',JSON.stringify(next)); } catch { saved=false; }
  const needsReload=!!state.loadedKey && state.keys.google!==next.google;
  state.keys=next; invalidate(); connections();
  if (needsReload && saved) { location.reload(); return; }
  $('key-status').textContent=saved?'저장했어요. 다음 검색부터 적용됩니다.':'세션 저장소를 사용할 수 없어 이 화면이 열려 있는 동안만 사용합니다.';
  if (needsReload && !saved) $('key-status').textContent+=' Google 키를 바꾸려면 새로고침 후 다시 입력해 주세요.';
}
$('key-form').addEventListener('submit',event=>{event.preventDefault();saveKeys({google:$('google-key').value.trim(),tfl:$('tfl-key').value.trim()});});
$('clear-keys').addEventListener('click',()=>{
  $('google-key').value=''; $('tfl-key').value=''; saveKeys({google:'',tfl:''});
  try { sessionStorage.removeItem('bus-trails.keys'); } catch {}
});
connections();

const placeStorageKey='bus-trails.places.v1';
let savedPlaces={home:'',work:''};
try {
  const stored=JSON.parse(localStorage.getItem(placeStorageKey)||'{}');
  for(const name of ['home','work']) if(typeof stored?.[name]==='string')savedPlaces[name]=stored[name].slice(0,160);
} catch {}
function openPlaces(focusName) {
  $('home-address').value=savedPlaces.home;
  $('work-address').value=savedPlaces.work;
  $('places-status').textContent='';
  $('places').showModal();
  if(focusName)$(focusName+'-address').focus();
}
function refreshPlaces() {
  document.querySelectorAll('[data-place]').forEach(button=>{
    const name=button.dataset.place;
    button.title=savedPlaces[name] || ((name==='home'?'집':'직장')+' 주소 저장하기');
  });
}
$('places-open').addEventListener('click',()=>openPlaces());
document.querySelectorAll('[data-copy-place]').forEach(button=>button.addEventListener('click',()=>{
  const name=button.dataset.copyPlace;
  $(name+'-address').value=$(name==='home'?'from':'to').value.trim();
}));
$('places-form').addEventListener('submit',event=>{
  event.preventDefault();
  const next={home:$('home-address').value.trim(),work:$('work-address').value.trim()};
  try {
    if(next.home||next.work)localStorage.setItem(placeStorageKey,JSON.stringify(next));
    else localStorage.removeItem(placeStorageKey);
  } catch {
    $('places-status').textContent='브라우저가 저장을 허용하지 않아 저장하지 못했어요. 브라우저의 사이트 데이터 설정을 확인해 주세요.';
    return;
  }
  savedPlaces=next;refreshPlaces();
  $('places').close();
  $('status').textContent='집·직장 설정을 저장했어요. 입력칸 아래 집·직장 버튼을 눌러 사용하세요.';
});
document.querySelectorAll('[data-place]').forEach(button=>button.addEventListener('click',()=>{
  const name=button.dataset.place,field=button.dataset.field;
  if(!savedPlaces[name]){openPlaces(name);return;}
  $(field).value=savedPlaces[name];
  delete state.overrides[field];
  $('location-choices').hidden=true;invalidate();
  $('status').textContent=(name==='home'?'집':'직장')+'을 '+(field==='from'?'출발지':'도착지')+'에 입력했어요.';
}));
$('commute').addEventListener('click',()=>{
  if(!savedPlaces.home||!savedPlaces.work){openPlaces(!savedPlaces.home?'home':'work');return;}
  $('from').value=savedPlaces.home;$('to').value=savedPlaces.work;
  state.overrides={};$('location-choices').hidden=true;invalidate();
  $('status').textContent='집 → 직장을 입력했어요. 경로 찾기를 누르세요. 퇴근길은 출발·도착 바꾸기를 누르면 돼요.';
});
refreshPlaces();

async function requestTfl(from,to,options,signal) {
  const controller=new AbortController();
  const abort=()=>controller.abort(); signal.addEventListener('abort',abort,{once:true});
  const timeout=setTimeout(abort,20000);
  try {
    const response=await fetch(tflURL(from,to,options),{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if ([401,403].includes(response.status)) throw new Error('TfL 인증이 필요합니다. 지도 연결에서 TfL API 키를 설정해 주세요.');
    if (response.status===429) throw new Error('TfL 요청 한도에 도달했어요. 잠시 후 다시 검색해 주세요.');
    if (response.status>=500) throw new Error('TfL 서버가 잠시 응답하지 않아요. 조금 뒤 다시 검색해 주세요.');
    if (!response.ok && response.status!==300) throw new Error('TfL에서 위치나 경로를 찾지 못했어요. 런던 우편번호·정류장 이름을 확인해 주세요.');
    return await response.json();
  } catch (error) {
    if (signal.aborted) throw new DOMException('Cancelled','AbortError');
    if (error.name==='AbortError') throw new Error('TfL 응답 시간이 초과됐어요. 다시 검색해 주세요.');
    if (error instanceof TypeError) throw new Error('TfL에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
    throw error;
  } finally { clearTimeout(timeout); signal.removeEventListener('abort',abort); }
}

function showChoices(choices) {
  $('location-choices').hidden=false;
  $('location-choices').innerHTML='<p>같은 이름의 장소가 여러 곳이에요. 원하는 위치를 골라 주세요.</p>'+
    Object.entries(choices).map(([field,list])=>`<label for="choice-${field}">${field==='from'?'출발지':'도착지'} 선택</label><select id="choice-${field}"><option value="">위치를 선택해 주세요</option>${list.map((o,i)=>`<option value="${i}">${esc(o.label)}</option>`).join('')}</select>`).join('')+
    '<button id="use-choices" type="button" class="primary">선택한 위치로 검색 →</button>';
  $('use-choices').addEventListener('click',()=>{
    for (const [field,list] of Object.entries(choices)) {
      const select=$('choice-'+field);
      if (!select.value) { select.focus(); $('status').textContent='출발지와 도착지의 위치를 모두 선택해 주세요.'; return; }
      state.overrides[field]={...list[Number(select.value)],input:$(field).value.trim()};
    }
    $('location-choices').hidden=true; $('route-form').requestSubmit();
  });
  $('status').textContent='장소를 선택하면 버스 경로를 비교할게요.';
  $('location-choices').querySelector('select').focus();
}

function loadGoogle() {
  if (state.loadedKey && state.loadedKey!==state.keys.google) return Promise.reject(new Error('Google 키가 변경됐어요. 새로고침 후 다시 연결해 주세요.'));
  if (state.googleReady) return Promise.resolve();
  if (state.googlePromise) return state.googlePromise;
  state.loadedKey=state.keys.google;
  state.googlePromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script'); let complete=false;
    const fail=()=>{
      state.googleReady=false; connections();
      if (!complete) { complete=true; clearTimeout(timer); reject(new Error('Google 연결에 실패했어요. API 키·허용 웹사이트·두 API 활성화·결제 설정을 확인해 주세요.')); }
      else { $('map').hidden=true; warnings(['Google 지도 인증이 거부됐어요. 설정을 확인하고 새로고침해 주세요.']); }
    };
    const timer=setTimeout(fail,20000);
    window.gm_authFailure=fail;
    window.busTrailsGoogleReady=async()=>{
      if (complete) return;
      try {
        await Promise.all([google.maps.importLibrary('maps'),google.maps.importLibrary('routes')]);
        if (complete) return;
        complete=true; clearTimeout(timer); state.googleReady=true; connections(); resolve();
      } catch { fail(); }
    };
    const params=new URLSearchParams({key:state.keys.google,callback:'busTrailsGoogleReady',loading:'async',v:'weekly',language:'en',region:'GB'});
    script.src='https://maps.googleapis.com/maps/api/js?'+params; script.async=true; script.onerror=fail; document.head.append(script);
  });
  return state.googlePromise;
}
function googleLocation(field) {
  const override=state.overrides[field]; const value=override?.value || $(field).value.trim();
  if (override?.point) return override.point;
  const match=/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(value);
  if (match) return {lat:Number(match[1]),lng:Number(match[2])};
  return (override?.label || value)+', London, UK';
}
async function googleCandidates(requested,origin,destination) {
  await loadGoogle();
  const base={origin,destination,travelMode:'TRANSIT',departureTime:new Date(requested),computeAlternativeRoutes:true,fields:['path','legs','durationMillis','warnings','viewport']};
  // BUS is a preference, so every returned step is independently validated in core.mjs.
  const answers=await Promise.allSettled([
    google.maps.routes.Route.computeRoutes({...base,transitPreference:{allowedTransitModes:['BUS']}}),
    google.maps.routes.Route.computeRoutes({...base,transitPreference:{allowedTransitModes:['BUS'],routingPreference:'FEWER_TRANSFERS'}})
  ]);
  const fulfilled=answers.filter(a=>a.status==='fulfilled');
  if (!state.googleReady) throw new Error('Google 지도 인증이 거부됐어요. API 키 설정을 확인하고 새로고침해 주세요.');
  if (!fulfilled.length) throw new Error('Google 경로를 가져오지 못했어요. Routes API·키 제한·사용량 한도를 확인해 주세요.');
  return {routes:fulfilled.flatMap(a=>(a.value.routes||[]).map(r=>normalizeGoogle(r,requested))),partial:fulfilled.length<2};
}

$('route-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const from=$('from').value.trim(),to=$('to').value.trim();
  if (!from || !to) { $('status').textContent='출발지와 도착지를 입력해 주세요.'; return; }
  state.controller?.abort(); const controller=new AbortController(); state.controller=controller;
  const version=++state.version, current=()=>version===state.version;
  const customDeparture=$('departure').value==='custom';
  const requested=customDeparture?londonEpoch($('departure-at').value+':00',Date.now()):Date.now()+Number($('departure').value)*60000;
  const walkLimit=Number($('walk-limit').value);
  if(!Number.isFinite(requested)) { $('status').textContent='유효한 런던 날짜와 시간을 입력해 주세요. 서머타임 시작으로 존재하지 않는 시각은 선택할 수 없어요.';return; }
  if(customDeparture && requested<Date.now()) { $('status').textContent='출발 시각이 지났어요. 미래의 날짜와 시간을 선택해 주세요.';return; }
  if(requested>Date.now()+90*86400000) { $('status').textContent='출발 날짜는 앞으로 90일 이내로 선택해 주세요.';return; }
  const args={departure:requested,walkLimit,key:state.keys.tfl};
  const resolved=field=>state.overrides[field]?.input===$(field).value.trim()?state.overrides[field].value:$(field).value.trim();
  const origin=googleLocation('from'),destination=googleLocation('to');
  const start=resolved('from'),end=resolved('to');
  stopNavigation(); busy(true); $('detail').hidden=true; $('location-choices').hidden=true; $('results').replaceChildren(); warnings([]);
  $('status').textContent='TfL에서 위치와 첫 버스 경로를 확인하고 있어요…';
  const notices=[]; let candidates=[],successful=0;
  try {
    let first;
    try { first=await requestTfl(start,end,args,controller.signal); }
    catch(error) { if(!current()) return; notices.push(error.message); }
    if(!current())return;
    if (first) {
      const choices=choicesFrom(first);
      if (Object.keys(choices).length) { showChoices(choices); return; }
      successful++; candidates.push(...(first.journeys||[]).map(j=>normalizeTfl(j,requested)));
    }
    $('status').textContent='도보·환승 조건을 바꿔 더 빠른 후보를 비교하고 있어요…';
    const jobs=[];
    if (first) for (const variant of [{preference:'LeastTime',optimize:false},{preference:'LeastInterchange',optimize:true}]) {
      jobs.push(requestTfl(start,end,{...args,...variant},controller.signal).then(data=>({provider:'TfL',routes:(data.journeys||[]).map(j=>normalizeTfl(j,requested))})));
    }
    if(state.keys.google)jobs.push(googleCandidates(requested,origin,destination).then(data=>({...data,provider:'Google Maps'})));
    const answers=await Promise.allSettled(jobs);
    if(!current())return;
    for (const answer of answers) {
      if(answer.status==='fulfilled') {
        successful++; candidates.push(...answer.value.routes);
        if(answer.value.partial)notices.push('Google의 일부 조회가 실패해 받은 후보만 비교했어요.');
      } else notices.push(answer.reason.message || '일부 경로를 조회하지 못했어요.');
    }
    state.routes=rankRoutes(candidates,walkLimit);
    warnings(notices);
    if(!state.routes.length) {
      $('status').textContent=successful?'조건에 맞는 버스 경로가 없어요.':'경로 조회에 실패했어요.';
      $('results').innerHTML=`<div class="empty panel"><span class="empty-icon" aria-hidden="true">⌁</span><h2>${successful?'버스만으로 갈 수 있는 후보를 찾지 못했어요.':'연결을 확인하고 다시 시도해 주세요.'}</h2><p>${successful?'도보 제한을 늘리거나, 출발 시점·주변 정류장을 바꿔 보세요.<br>전철이 섞이거나 총 도보 제한을 넘는 경로는 제외했어요.':'위 안내를 확인해 주세요. Google을 연결하면 TfL 오류 시에도 Google 후보를 조회할 수 있어요.'}</p></div>`;
      return;
    }
    $('status').textContent=`${state.routes.length}개 후보 · 총 도보 ${walkLimit}분 이내 · ${londonInputValue(requested).replace('T',' ')} 출발 기준 (런던 시간)`;
    renderCards(); selectRoute(0);
  } catch(error) {
    if(!current())return;
    warnings([error.message || '경로를 처리하지 못했어요. 다시 검색해 주세요.']);
    $('status').textContent='경로 조회에 실패했어요.';
  } finally { if(current())busy(false); }
});

function renderCards() {
  $('results').innerHTML=state.routes.slice(0,10).map((r,i)=>`<button class="route-card" data-route="${i}" aria-pressed="false"><div class="route-badges">${i===0?'<span class="fastest">조회 후보 중 가장 빠름</span>':''}<span>${esc(r.provider)}</span></div><div class="route-top"><span class="duration">${mins(r.totalMinutes)}<small>분</small></span><span class="arrival">${clock(r.arrival)} 도착<br>대기 시간 포함</span></div><div class="route-line">${r.segments.map(s=>s.mode==='bus'?`<span class="bus-pill">버스 ${esc(s.line||'노선')}</span>`:`<span class="walk-pill">도보 ${mins(s.minutes)}분</span>`).join('<span aria-hidden="true">›</span>')}</div><div class="route-meta"><span>총 도보 ${mins(r.walkMinutes)}분</span><span>${r.transfers?`환승 ${r.transfers}회`:'환승 없음'}</span><span>상세 보기 ↓</span></div></button>`).join('')+'<p class="count-note">모든 시간은 런던 현지 시각입니다. 현재 운행 상황에 따라 달라질 수 있어요.</p>';
  $('results').querySelectorAll('[data-route]').forEach(button=>button.addEventListener('click',()=>selectRoute(Number(button.dataset.route),true)));
}
function selectRoute(index, reveal=false) {
  const route=state.routes[index]; if(!route)return;
  $('results').querySelectorAll('[data-route]').forEach(button=>{
    const active=Number(button.dataset.route)===index;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  });
  $('detail').hidden=false; $('detail-title').textContent=`${mins(route.totalMinutes)}분, 버스와 함께 가는 길`;
  if (reveal) requestAnimationFrame(()=>{
    $('detail-title').setAttribute('tabindex','-1');
    $('detail-title').focus({preventScroll:true});
    $('detail').scrollIntoView({behavior:'instant',block:'start'});
  });
  $('detail-provider').textContent=route.provider;
  $('steps').innerHTML=route.segments.map((s,i)=>{
    const walking=s.mode==='walk';
    let link='';
    if(walking && s.fromPoint && s.toPoint) {
      const query=new URLSearchParams({api:'1',origin:`${s.fromPoint.lat},${s.fromPoint.lng}`,destination:`${s.toPoint.lat},${s.toPoint.lng}`,travelmode:'walking'});
      link=`<a href="https://www.google.com/maps/dir/?${esc(query)}" target="_blank" rel="noopener noreferrer">이 도보 구간을 Google Maps에서 확인 ↗</a>`;
    }
    const instructions=[s.summary,...s.instructions,...s.disruptions].map(plain).filter(Boolean);
    return `<li class="${walking?'walk':'bus'}"><h3>${walking?'걷기':'버스 '+esc(s.line||'노선')} · ${mins(s.minutes)}분</h3><p>${esc(s.from)} → ${esc(s.to)}</p>${walking?'':`<p class="step-meta">${s.stop?'정류장 '+esc(s.stop)+' · ':''}${clock(s.departure)} 승차 → ${clock(s.arrival)} 하차</p>${s.headsign?`<p class="step-meta">${esc(s.headsign)} 방면</p>`:''}`}${link}${instructions.length?`<details><summary>${walking?'도보 안내':'운행 안내'} 펼치기</summary>${[...new Set(instructions)].map(t=>`<p>${esc(t)}</p>`).join('')}</details>`:''}</li>`;
  }).join('');
  const wait=Math.max(0,route.totalMinutes-route.segments.reduce((n,s)=>n+s.minutes,0));
  $('map-note').textContent=`총 도보 ${mins(route.walkMinutes)}분 · 대기 약 ${Math.round(wait)}분 포함. ${state.googleReady?'지도에서 정류장과 도보 구간을 확인하세요.':'점선은 도보, 실선은 버스입니다. 배경지도 없는 경로 개요이므로 도보 링크로 실제 길을 확인하세요.'}`;
  $('attribution').textContent=(route.provider==='TfL'?'Powered by TfL Open Data. ':'Google Maps. ')+(route.warnings||[]).map(plain).join(' ');
  const agencies=new Map(route.segments.flatMap(s=>s.agencies||[]).map(a=>[a.name,a]));
  for(const agency of agencies.values()) {
    const label=document.createElement('span');label.textContent=' · '+agency.name;
    try { const url=new URL(agency.url);if(['https:','http:'].includes(url.protocol)){const link=document.createElement('a');link.href=url.href;link.textContent=agency.name;link.target='_blank';link.rel='noopener noreferrer';label.replaceChildren(' · ',link);} }catch{}
    $('attribution').append(label);
  }
  if(state.googleReady) {
    try { drawGoogle(route); }
    catch { $('map').hidden=true; $('sketch').hidden=false; if(route.provider==='TfL')drawSketch(route); else $('sketch').textContent='Google 지도를 표시하지 못했어요. 새로고침 후 다시 검색해 주세요.'; }
  } else { $('map').hidden=true; $('sketch').hidden=false; drawSketch(route); }
  setNavigationRoute(route,state.googleReady&&!$('map').hidden?state.map:null);
}
function segmentPath(segment) { return segment.path.length?segment.path:[segment.fromPoint,segment.toPoint].filter(Boolean); }
function drawGoogle(route) {
  $('sketch').hidden=true; $('map').hidden=false;
  if(!state.map)state.map=new google.maps.Map($('map'),{center:{lat:51.5074,lng:-.1278},zoom:12,mapTypeControl:false,streetViewControl:false,fullscreenControl:true});
  state.lines.forEach(line=>line.setMap(null)); state.lines=[];
  const bounds=new google.maps.LatLngBounds();
  for(const s of route.segments) {
    const path=segmentPath(s);path.forEach(p=>bounds.extend(p));
    state.lines.push(new google.maps.Polyline({map:state.map,path,strokeColor:s.mode==='bus'?'#a4634b':'#43674c',strokeWeight:5,strokeOpacity:s.mode==='walk'?0:.9,icons:s.mode==='walk'?[{icon:{path:'M 0,-1 0,1',strokeOpacity:1,scale:3},offset:'0',repeat:'14px'}]:[]}));
  }
  if(!bounds.isEmpty())state.map.fitBounds(bounds,35);
}
function drawSketch(route) {
  // TfL geometry only. Google results are always shown with a Google map.
  if(route.provider!=='TfL') { $('sketch').textContent='Google 지도를 연결해야 경로를 표시할 수 있어요.'; return; }
  const paths=route.segments.map(segmentPath),points=paths.flat();
  if(!points.length){$('sketch').textContent='이 경로는 좌표를 제공하지 않아요. 오른쪽 정류장 안내를 확인해 주세요.';return;}
  const lat0=points.reduce((a,p)=>a+p.lat,0)/points.length;
  const xy=p=>({x:p.lng*Math.cos(lat0*Math.PI/180),y:-p.lat});
  const coords=points.map(xy),minX=Math.min(...coords.map(p=>p.x)),maxX=Math.max(...coords.map(p=>p.x)),minY=Math.min(...coords.map(p=>p.y)),maxY=Math.max(...coords.map(p=>p.y));
  const scale=Math.min(420/Math.max(maxX-minX,.0001),230/Math.max(maxY-minY,.0001));
  const project=p=>{const q=xy(p);return {x:250+(q.x-(minX+maxX)/2)*scale,y:178+(q.y-(minY+maxY)/2)*scale};};
  const first=project(points[0]),last=project(points.at(-1));
  $('sketch').innerHTML=`<svg viewBox="0 0 500 340" role="img" aria-label="TfL 경로 개요. 점선은 도보, 실선은 버스입니다."><text x="24" y="28" fill="#657659" font-size="11">경로 개요 · 실제 배경지도 아님</text>${paths.map((p,i)=>`<polyline points="${p.map(v=>{const q=project(v);return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;}).join(' ')}" fill="none" stroke="${route.segments[i].mode==='bus'?'#a4634b':'#68845b'}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" ${route.segments[i].mode==='walk'?'stroke-dasharray="5 7"':''}/>`).join('')}${[[first,'출발'],[last,'도착']].map(([p,label])=>`<circle cx="${p.x}" cy="${p.y}" r="6" fill="#fffdf7" stroke="#43674c" stroke-width="3"/><text x="${p.x+11}" y="${p.y-9}" fill="#34463a" font-size="12">${label}</text>`).join('')}<text x="24" y="321" fill="#75836a" font-size="10">Powered by TfL Open Data</text></svg>`;
}
