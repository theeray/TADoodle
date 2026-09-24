import {readFileSync} from 'node:fs';
import test,{before,after,beforeEach} from 'node:test';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDoc,getDocs,collection,serverTimestamp} from 'firebase/firestore';
import {makePoll} from '../src/scheduling.js';
let env;
const id='unit-test-poll';
const input={title:'Test poll',organizerName:'Eric',description:'',dates:['2026-10-01'],startMinute:540,endMinute:660,duration:60,timezone:'America/Chicago'};
const poll=makePoll(input,'owner');
const db=uid=>env.authenticatedContext(uid,{firebase:{sign_in_provider:'anonymous'}}).firestore();
const response=(name='Maya')=>({name,available:[poll.slotIds[0]],ifNeeded:[poll.slotIds[1]],updatedAt:serverTimestamp()});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-tad-meet',firestore:{rules:readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await setDoc(doc(db('owner'),'polls',id),{...poll,createdAt:serverTimestamp()});});
test('named participants save and update only their own response',async()=>{
 const a=db('a');await assertSucceeds(setDoc(doc(a,'polls',id,'responses','a'),response()));
 await assertSucceeds(setDoc(doc(a,'polls',id,'responses','a'),response('Maya updated')));
 await assertFails(setDoc(doc(db('b'),'polls',id,'responses','a'),response('Impersonator')));
 await assertSucceeds(getDoc(doc(db('b'),'polls',id,'responses','a')));
});
test('only the organizer can select the time or reopen the poll',async()=>{
 const ref=doc(db('owner'),'polls',id);
 await assertFails(updateDoc(doc(db('a'),'polls',id),{status:'closed',selectedStart:poll.slotIds[0]}));
 await assertSucceeds(updateDoc(ref,{status:'closed',selectedStart:poll.slotIds[0]}));
 await assertFails(setDoc(doc(db('a'),'polls',id,'responses','a'),response()));
 await assertSucceeds(updateDoc(ref,{status:'open',selectedStart:''}));
 await assertSucceeds(setDoc(doc(db('a'),'polls',id,'responses','a'),response()));
});
test('poll timing and ownership cannot change after creation',async()=>{
 const ref=doc(db('owner'),'polls',id);
 await assertFails(updateDoc(ref,{ownerUid:'a'}));
 await assertFails(updateDoc(ref,{slotIds:['bad']}));
 await assertFails(updateDoc(ref,{status:'closed',selectedStart:'bad'}));
});
test('rejects blank names, overlapping statuses and invented times',async()=>{
 const ref=doc(db('a'),'polls',id,'responses','a');
 await assertFails(setDoc(ref,response('  ')));
 await assertFails(setDoc(ref,{...response(),available:['made-up']}));
 await assertFails(setDoc(ref,{...response(),ifNeeded:[poll.slotIds[0]]}));
 await assertFails(setDoc(ref,{...response(),extra:'no'}));
 await assertSucceeds(setDoc(ref,{...response(),available:[],ifNeeded:[]}));
});
test('does not expose a public list of polls or accept unauthenticated writes',async()=>{
 await assertFails(getDocs(collection(db('a'),'polls')));
 const unauth=env.unauthenticatedContext().firestore();
 await assertFails(setDoc(doc(unauth,'polls',id,'responses','a'),response()));
 await assertFails(getDoc(doc(unauth,'polls',id)));
});
test('cannot create a poll owned by someone else or with unexpected fields',async()=>{
 await assertFails(setDoc(doc(db('a'),'polls','forged'),{...poll,createdAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db('owner'),'polls','extra'),{...poll,createdAt:serverTimestamp(),secret:'no'}));
});
