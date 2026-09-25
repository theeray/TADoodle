import test from 'node:test';
import assert from 'node:assert/strict';
import {createSlots, makePoll, makeResponse, rankTimes, groupGrid, slotTime} from '../src/scheduling.js';
const input = {title:'Team meeting',organizerName:'Eric',description:'',dates:['2026-10-01'],startMinute:540,endMinute:660,duration:60,timezone:'America/Chicago'};

test('uses UTC instants so different time zones refer to the same meeting',()=>{
 const slots=createSlots(input.dates,540,660,input.timezone);
 assert.equal(slots.length,4);
 assert.equal(slotTime(slots[0],'America/Chicago').hour,9);
 assert.equal(slotTime(slots[0],'America/New_York').hour,10);
 assert.equal(slotTime(slots[0],'Asia/Tokyo').hour,23);
});
test('ranking requires continuous availability for the entire meeting',()=>{
 const poll=makePoll(input,'owner'), [a,b,c,d]=poll.slotIds;
 const responses=[{name:'A',available:[a,c],ifNeeded:[]},{name:'B',available:[b,c,d],ifNeeded:[]}];
 const ranked=rankTimes(poll,responses);
 assert.equal(ranked.length,3);assert.equal(ranked[0].start,b);assert.equal(ranked[0].total,1);
 assert.equal(ranked.find(r=>r.start===a).total,0);
});
test('if-needed is counted only if the whole duration is covered',()=>{
 const poll=makePoll(input,'owner'),[a,b,c]=poll.slotIds;
 const ranked=rankTimes(poll,[{name:'A',available:[a],ifNeeded:[b]},{name:'B',available:[a,b],ifNeeded:[]}]);
 assert.equal(ranked[0].start,a);assert.equal(ranked[0].available,1);assert.equal(ranked[0].needed,1);assert.equal(ranked[0].total,2);
 assert.equal(ranked.find(r=>r.start===b).total,0);
});
test('does not bridge overnight gaps between separate dates',()=>{
 const poll=makePoll({...input,dates:['2026-10-01','2026-10-02'],startMinute:540,endMinute:600},'owner');
 const ranked=rankTimes(poll,[{name:'A',available:poll.slotIds,ifNeeded:[]}]);assert.equal(ranked.length,2);
});
test('spring-forward skips nonexistent hours and rejects a nonexistent boundary',()=>{
 const slots=createSlots(['2026-03-08'],60,240,'America/Chicago');assert.equal(slots.length,4);
 assert.ok(slots.every(id=>slotTime(id,'America/Chicago').hour!==2));
 assert.throws(()=>createSlots(['2026-03-08'],120,240,'America/Chicago'),/does not exist/);
});
test('fall-back retains both occurrences of the repeated hour',()=>{
 const slots=createSlots(['2026-11-01'],0,240,'America/Chicago');assert.equal(slots.length,10);
 const grid=groupGrid(slots,'America/Chicago');assert.equal(grid.rows.length,10);assert.equal(grid.days[0].cells.size,10);assert.equal(grid.showOffset,true);
});
test('time zone conversions can move a slot to the following date',()=>{
 const slots=createSlots(['2026-10-01'],1020,1080,'America/Chicago');
 assert.equal(groupGrid(slots,'Asia/Tokyo').days[0].date,'2026-10-02');
});
test('names are required, trimmed and never used as identity keys',()=>{
 const poll=makePoll(input,'owner');assert.equal(makeResponse('  Eric  ',{},poll).name,'Eric');assert.throws(()=>makeResponse('   ',{},poll));
 assert.throws(()=>makeResponse('Eric',{'not-a-slot':'available'},poll));
 assert.throws(()=>makeResponse('Eric',{[poll.slotIds[0]]:'bad'},poll));
});
test('empty availability is a valid named response',()=>{
 const poll=makePoll(input,'owner');assert.deepEqual(makeResponse('Eric',{},poll),{name:'Eric',available:[],ifNeeded:[]});
});
test('rejects invalid ranges, dates, zones, and meetings longer than the range',()=>{
 assert.throws(()=>createSlots([],540,600,'America/Chicago'));
 assert.throws(()=>createSlots(['2026-02-30'],540,600,'America/Chicago'));
 assert.throws(()=>createSlots(input.dates,600,540,'America/Chicago'));
 assert.throws(()=>createSlots(input.dates,541,600,'America/Chicago'));
 assert.throws(()=>createSlots(input.dates,540,600,'not/a-zone'));
 assert.throws(()=>makePoll({...input,duration:120,endMinute:600},'owner'));
});


test('copy preserves Central wall times across DST and remaps every response', async () => {
 const {copyPollData,mergeResponses}=await import('../src/scheduling.js');
 const old=makePoll({title:'Original',organizerName:'Eric',description:'Context',dates:['2026-10-30','2026-10-31'],timezone:'America/Chicago',startMinute:540,endMinute:660,duration:60},'owner');
 const response={uid:'alice',name:'Alice',available:[old.slotIds[0]],ifNeeded:[old.slotIds[1]]};
 const copy=copyPollData({...old,status:'closed',selectedStart:old.slotIds[0]},[response],'New title',['2026-11-06','2026-11-07'],'owner');
 assert.equal(copy.poll.title,'New title'); assert.equal(copy.poll.status,'open'); assert.equal(copy.poll.selectedStart,'');
 assert.equal(Number(copy.responses[0].available[0])-Number(response.available[0]),(7*24+1)*3600000);
 assert.equal(copy.responses[0].ifNeeded[0],copy.poll.slotIds[1]); assert.equal(copy.responses[0].copied,true);
 assert.equal(old.title,'Original');
 assert.deepEqual(mergeResponses(copy.responses,[{...copy.responses[0],available:[],copied:false}])[0].available,[]);
 assert.throws(()=>copyPollData(old,[response],'New',['2026-11-06','2026-11-06'],'owner'),/different replacement/);
});
test('copy rejects nonexistent and ambiguous local times instead of shifting availability',async()=>{
 const {copyPollData}=await import('../src/scheduling.js');
 const old=makePoll({title:'Original',organizerName:'Eric',dates:['2026-03-07'],timezone:'America/Chicago',startMinute:60,endMinute:240,duration:60},'owner');
 assert.throws(()=>copyPollData(old,[],'Spring',['2026-03-08'],'owner'),/daylight-saving/);
 assert.throws(()=>copyPollData(old,[],'Fall',['2026-11-01'],'owner'),/daylight-saving/);
});
