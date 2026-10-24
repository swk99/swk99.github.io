// Provider-independent validation and ranking. Unknown modes fail closed.
export const isMinutes=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export const londonParts=epoch=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(epoch)).map(p=>[p.type,p.value]));
export function londonEpoch(text,reference=Date.now()){
 if(!text)return NaN;
 if(/Z$|[+-]\d\d:\d\d$/.test(text))return Date.parse(text);
 const base=Date.parse(text+'Z');if(!Number.isFinite(base))return NaN;
 const target=text.slice(0,19);const possible=[base,base-3600000].filter(t=>{const p=londonParts(t);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`===target});
 return possible.sort((a,b)=>Math.abs(a-reference)-Math.abs(b-reference))[0]??NaN;
}
export function tflURL(from,to,{departure,walkLimit,preference='LeastTime',optimize=true,key=''}){
 const p=londonParts(departure);const q=new URLSearchParams({mode:'bus',date:p.year+p.month+p.day,time:p.hour+p.minute,timeIs:'Departing',journeyPreference:preference,maxWalkingMinutes:String(walkLimit),maxTransferMinutes:String(walkLimit),walkingSpeed:'Average',walkingOptimization:String(optimize),useRealTimeLiveArrivals:'true',applyHtmlMarkup:'false',useMultiModalCall:'false'});if(key)q.set('app_key',key);
 return `https://api.tfl.gov.uk/Journey/JourneyResults/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}?${q}`;
}
const point=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)?{lat:p.lat,lng:p.lon}:null;
export function normalizeTfl(j,requested){
 if(!j.legs?.length||!isMinutes(j.duration))return null;
 let start=londonEpoch(j.startDateTime,requested);if(!Number.isFinite(start))return null;
 const segments=j.legs.map(l=>{const raw=l.mode?.id;let path=[];try{path=JSON.parse(l.path?.lineString||'[]').filter(p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite)).map(p=>({lat:p[0],lng:p[1]}))}catch{}
 const dep=point(l.departurePoint),arr=point(l.arrivalPoint);const options=l.routeOptions||[];
 return {mode:['bus','public-bus'].includes(raw)?'bus':raw==='walking'?'walk':'unsupported',minutes:l.duration,from:l.departurePoint?.commonName||'출발 지점',to:l.arrivalPoint?.commonName||'도착 지점',fromPoint:dep,toPoint:arr,path,line:options.map(o=>o.name).filter(Boolean).join(' / '),stop:l.departurePoint?.stopLetter||l.departurePoint?.platformName||'',headsign:options[0]?.directions?.join(', ')||'',summary:l.instruction?.summary||'',instructions:(l.instruction?.steps||[]).map(s=>[s.descriptionHeading,s.streetName,s.description].filter(Boolean).join(' ')),departure:londonEpoch(l.departureTime,start),arrival:londonEpoch(l.arrivalTime,start),disruptions:(l.disruptions||[]).map(d=>d.description||d.summary||'').filter(Boolean)};});
 return {provider:'TfL',start,arrival:start+j.duration*60000,minutes:j.duration,segments,requested};
}
function latlng(p){p=p?.latLng||p;if(!p)return null;const lat=typeof p.lat==='function'?p.lat():p.lat;const lng=typeof p.lng==='function'?p.lng():p.lng;return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;}
export function normalizeGoogle(route,requested){
 const steps=(route.legs||[]).flatMap(l=>l.steps||[]);if(!steps.length||!Number.isFinite(route.durationMillis))return null;
 const rawSegments=steps.map(s=>{const t=s.transitDetails;const type=t?.transitLine?.vehicle?.vehicleType;const mode=s.travelMode==='WALKING'?'walk':s.travelMode==='TRANSIT'&&['BUS','INTERCITY_BUS','TROLLEYBUS'].includes(type)?'bus':'unsupported';const start=latlng(s.startLocation),end=latlng(s.endLocation);let ms=s.staticDurationMillis;if(mode==='bus'&&t?.arrivalTime&&t?.departureTime)ms=new Date(t.arrivalTime)-new Date(t.departureTime);
 return {mode,minutes:Number.isFinite(ms)?ms/60000:NaN,from:t?.departureStop?.name||'도보 시작',to:t?.arrivalStop?.name||'도보 도착',fromPoint:start,toPoint:end,path:(s.path||[]).map(latlng).filter(Boolean),line:t?.transitLine?.shortName||t?.transitLine?.name||'',headsign:t?.headsign||'',stop:'',summary:s.instructions||'',instructions:[],departure:t?.departureTime?+new Date(t.departureTime):NaN,arrival:t?.arrivalTime?+new Date(t.arrivalTime):NaN,disruptions:[],agencies:(t?.transitLine?.agencies||[]).map(a=>({name:a.name||'',url:String(a.url||'')}))};});
 const segments=[];for(const segment of rawSegments){const previous=segments.at(-1);if(segment.mode==='walk'&&previous?.mode==='walk'){previous.minutes+=segment.minutes;previous.to=segment.to;previous.toPoint=segment.toPoint;previous.path.push(...segment.path);previous.instructions.push(segment.summary);}else segments.push({...segment,instructions:[]});}
 for(let i=0;i<segments.length;i++)if(segments[i].mode==='walk'){segments[i].from=segments[i-1]?.to||'출발지';segments[i].to=segments[i+1]?.from||'도착지';}
 const buses=segments.filter(s=>s.mode==='bus'),first=segments.findIndex(s=>s.mode==='bus');let start=requested;
 if(buses[0]&&Number.isFinite(buses[0].departure)){const initialWalk=segments.slice(0,first).reduce((n,s)=>n+s.minutes,0);start=buses[0].departure-initialWalk*60000;}
 const lastBus=segments.map(s=>s.mode).lastIndexOf('bus');const endWalk=segments.slice(lastBus+1).reduce((n,s)=>n+s.minutes,0);const arrival=buses.length&&Number.isFinite(buses.at(-1).arrival)?buses.at(-1).arrival+endWalk*60000:start+route.durationMillis;
 return {provider:'Google Maps',start,arrival,minutes:(arrival-start)/60000,segments,requested,googleRoute:route,warnings:route.warnings||[]};
}
export function eligible(route,limit){return !!route&&route.segments.length>0&&route.segments.every(s=>['walk','bus'].includes(s.mode)&&isMinutes(s.minutes))&&route.segments.some(s=>s.mode==='bus')&&route.segments.filter(s=>s.mode==='walk').reduce((n,s)=>n+s.minutes,0)<=limit+1e-8&&Number.isFinite(route.arrival)&&route.arrival>route.requested&&route.start>=route.requested-60000&&route.arrival>=route.start;}
export function rankRoutes(routes,limit){const seen=new Set();return routes.filter(r=>eligible(r,limit)).map(r=>({...r,walkMinutes:r.segments.filter(s=>s.mode==='walk').reduce((n,s)=>n+s.minutes,0),transfers:Math.max(0,r.segments.filter(s=>s.mode==='bus').length-1),totalMinutes:(r.arrival-r.requested)/60000})).sort((a,b)=>a.arrival-b.arrival||a.walkMinutes-b.walkMinutes||a.transfers-b.transfers).filter(r=>{const key=JSON.stringify([r.provider,r.segments.filter(s=>s.mode==='bus').map(s=>[s.line,s.from,s.to]),Math.round(r.arrival/60000)]);if(seen.has(key))return false;seen.add(key);return true});}
export function choicesFrom(data){const result={};for(const field of ['from','to']){const d=data[field+'LocationDisambiguation'];if(d?.disambiguationOptions?.length)result[field]=d.disambiguationOptions.slice(0,12).map(o=>({label:o.place?.commonName||o.parameterValue,value:point(o.place)?`${o.place.lat},${o.place.lon}`:o.parameterValue||o.place?.icsCode,point:point(o.place)})).filter(o=>o.label&&o.value);}return result;}
