import test from 'node:test';
import assert from 'node:assert/strict';
import {londonEpoch,londonParts,tflURL,normalizeTfl,normalizeGoogle,eligible,rankRoutes,choicesFrom} from './core.mjs';

const requested=Date.parse('2026-07-01T09:00:00Z');
const segment=(mode,minutes,line='131')=>({mode,minutes,line,from:'A',to:'B'});
const route=(segments,extra={})=>({provider:'TfL',requested,start:requested,arrival:requested+60*60000,segments,...extra});
test('walking limit is the sum of origin, transfer and final walking, including seconds',()=>{
  assert.equal(eligible(route([segment('walk',12),segment('bus',10),segment('walk',8),segment('bus',12),segment('walk',10)]),30),true);
  assert.equal(eligible(route([segment('walk',12),segment('bus',10),segment('walk',8),segment('bus',12),segment('walk',10.01)]),30),false);
});
test('unknown, rail, walking-only and missing/negative durations are rejected',()=>{
  for(const mode of ['tube','rail','unsupported',undefined])assert.equal(eligible(route([segment('bus',10),segment(mode,2)]),30),false);
  assert.equal(eligible(route([segment('walk',20)]),30),false);
  for(const time of [undefined,NaN,-1,Infinity,'3'])assert.equal(eligible(route([segment('bus',10),segment('walk',time)]),30),false);
});
test('rank by arrival from the requested time, not in-vehicle duration',()=>{
  const later=route([segment('bus',15,'2')],{start:requested+30*60000,arrival:requested+45*60000});
  const earlier=route([segment('bus',30,'1')],{arrival:requested+30*60000});
  const result=rankRoutes([later,earlier],30);assert.equal(result[0].segments[0].line,'1');assert.equal(result[1].totalMinutes,45);
});
test('departures in the past and expired arrivals are excluded',()=>{
  assert.equal(eligible(route([segment('bus',10)],{start:requested-120000}),30),false);
  assert.equal(eligible(route([segment('bus',10)],{arrival:requested-1}),30),false);
});
test('deduplicate identical provider alternatives but retain source comparison',()=>{
  const a=route([segment('walk',5),segment('bus',10)]);
  assert.equal(rankRoutes([a,a,{...a,provider:'Google Maps'}],30).length,2);
});
test('London date parsing is independent of the browser timezone',()=>{
  assert.equal(londonEpoch('2026-07-01T10:00:00'),Date.parse('2026-07-01T09:00:00Z'));
  assert.equal(londonEpoch('2026-12-01T10:00:00'),Date.parse('2026-12-01T10:00:00Z'));
  assert.equal(londonEpoch('2026-07-01T10:00:00+01:00'),Date.parse('2026-07-01T09:00:00Z'));
  assert.equal(Number.isNaN(londonEpoch('2026-03-29T01:30:00')),true);
});
test('DST repeated hour resolves using request-time context',()=>{
  const a=Date.parse('2026-10-25T00:20:00Z'),b=Date.parse('2026-10-25T01:20:00Z');
  assert.equal(londonEpoch('2026-10-25T01:30:00',a),Date.parse('2026-10-25T00:30:00Z'));
  assert.equal(londonEpoch('2026-10-25T01:30:00',b),Date.parse('2026-10-25T01:30:00Z'));
});
test('TfL request sets bus-only and both walking bounds in London local time',()=>{
  const u=new URL(tflURL('New Malden','SW11 2QP',{departure:requested,walkLimit:30}));
  assert.equal(u.searchParams.get('mode'),'bus');assert.equal(u.searchParams.get('time'),'1000');
  assert.equal(u.searchParams.get('date'),'20260701');assert.equal(u.searchParams.get('maxWalkingMinutes'),'30');
  assert.equal(u.searchParams.get('maxTransferMinutes'),'30');assert.equal(u.searchParams.has('app_key'),false);
});
test('TfL normalization rejects mixed modes and tolerates missing geometry',()=>{
  const data={duration:30,startDateTime:'2026-07-01T10:00:00',legs:[{mode:{id:'bus'},duration:15},{mode:{id:'walking'},duration:5}]};
  const r=normalizeTfl(data,requested);assert.equal(eligible(r,30),true);assert.deepEqual(r.segments[0].path,[]);
  data.legs.push({mode:{id:'tube'},duration:5});assert.equal(eligible(normalizeTfl(data,requested),30),false);
});
const walk=minutes=>({travelMode:'WALKING',staticDurationMillis:minutes*60000,startLocation:{latLng:{lat:51.4,lng:-.2}},endLocation:{latLng:{lat:51.5,lng:-.1}},path:[],instructions:'Walk straight'});
const transit=(vehicleType='BUS')=>({travelMode:'TRANSIT',staticDurationMillis:20*60000,path:[],transitDetails:{departureTime:new Date(requested+15*60000),arrivalTime:new Date(requested+35*60000),departureStop:{name:'A'},arrivalStop:{name:'B'},transitLine:{shortName:'131',vehicle:{vehicleType},agencies:[{name:'TfL',url:new URL('https://tfl.gov.uk/')}]} }});
test('Google steps merge consecutive walk instructions while preserving duration and waiting',()=>{
  const r=normalizeGoogle({durationMillis:40*60000,legs:[{steps:[walk(3),walk(2),transit(),walk(5)]}]},requested);
  assert.equal(r.segments.length,3);assert.equal(r.segments[0].minutes,5);assert.equal(r.segments[0].to,'A');
  const ranked=rankRoutes([r],30)[0];assert.equal(ranked.totalMinutes,40);assert.equal(ranked.walkMinutes,10);assert.equal(ranked.transfers,0);
  assert.equal(r.segments[1].agencies[0].name,'TfL');
});
test('Google BUS preference cannot admit subway, ferry or an unspecified vehicle',()=>{
  for(const type of ['SUBWAY','FERRY','RAIL','UNKNOWN','']){
    const r=normalizeGoogle({durationMillis:40*60000,legs:[{steps:[walk(5),transit(type),walk(5)]}]},requested);
    assert.equal(eligible(r,30),false);
  }
});
test('Google fractional walking time remains precise after merging',()=>{
  const r=normalizeGoogle({durationMillis:60*60000,legs:[{steps:[walk(10),transit(),walk(10),walk(10.1)]}]},requested);
  assert.equal(eligible(r,30),false);
});
test('disambiguation retains exact coordinates to align Google and TfL origins',()=>{
  const result=choicesFrom({fromLocationDisambiguation:{disambiguationOptions:[{parameterValue:'1001206',place:{commonName:'New Malden Station',lat:51.4,lon:-.25}}]}});
  assert.deepEqual(result.from[0],{label:'New Malden Station',value:'1001206',point:{lat:51.4,lng:-.25}});
  assert.deepEqual(choicesFrom({journeys:[]}),{});
});
