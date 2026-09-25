import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, doc, collection, setDoc, updateDoc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { makePoll, makeResponse, meetingSlots, isZone, copyPollData, mergeResponses } from './scheduling';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const configured = Object.values(config).every(Boolean);
let db, auth, identityPromise;
if (configured) {
  const app = initializeApp(config);
  db = getFirestore(app); auth = getAuth(app);
  if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) initializeAppCheck(app, { provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
}
export function friendlyError(error) {
  const code = error?.code;
  if (code === 'permission-denied') return 'This change could not be saved. The poll may have closed, or you may not have permission to change it.';
  if (code === 'unavailable' || code === 'auth/network-request-failed') return 'We could not connect. Check your connection and try again.';
  if (code === 'resource-exhausted' || code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') return 'The service has reached its free usage limit. Please try again later.';
  if (code === 'auth/operation-not-allowed') return 'The poll service is not ready for participants yet. Please contact the organizer.';
  return error?.message || 'Something went wrong. Please try again.';
}
export async function identity() {
  if (!configured) throw new Error('Shared polls are not connected yet.');
  if (!identityPromise) identityPromise = (async () => {
    await setPersistence(auth, browserLocalPersistence);
    await auth.authStateReady();
    return auth.currentUser || (await signInAnonymously(auth)).user;
  })().catch(error => { identityPromise = null; throw error; });
  return identityPromise;
}
export async function createPoll(input) {
  const user = await identity();
  const poll = makePoll(input, user.uid);
  const ref = doc(collection(db, 'polls'));
  await setDoc(ref, { ...poll, createdAt: serverTimestamp() });
  return ref.id;
}
export function watchPoll(id, onPoll, onResponses, onError) {
  let stopped = false, offPoll, offResponses, offCopied;
  let current = [], copied = [], currentReady = false, copiedReady = false, copyRequired;
  const emit = () => { if (currentReady && copyRequired !== undefined && (!copyRequired || copiedReady)) onResponses(mergeResponses(copied, current)); };
  identity().then(() => {
    if (stopped) return;
    offPoll = onSnapshot(doc(db, 'polls', id), snap => {
      if (!snap.exists()) return onPoll(null);
      const p = snap.data();
      if (typeof p.title !== 'string' || typeof p.organizerName !== 'string' || typeof p.description !== 'string' || !isZone(p.timezone) || ![30,60,90,120].includes(p.duration) || !Array.isArray(p.slotIds) || p.slotIds.length < 1 || p.slotIds.length > 672 || !p.slotIds.every(id => typeof id === 'string' && /^[0-9]{13}$/.test(id)) || !['open','closed'].includes(p.status) || (p.status === 'closed' && !p.slotIds.includes(p.selectedStart))) {
        onError(new Error('This poll contains invalid data and cannot be displayed.')); return;
      }
      copyRequired = p.schemaVersion === 2;
      onPoll({id: snap.id, ...p}); emit();
      if (p.schemaVersion === 2 && !offCopied) offCopied = onSnapshot(collection(db, 'polls', id, 'copiedResponses'), snap => { copied = snap.docs.map(d=>({uid:d.id,...d.data(),copied:true})); copiedReady = true; emit(); }, onError);
    }, onError);
    offResponses = onSnapshot(collection(db, 'polls', id, 'responses'), snap => { current = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() })); currentReady = true; emit(); }, onError);
  }).catch(onError);
  return () => { stopped = true; offPoll?.(); offResponses?.(); offCopied?.(); };
}
export async function saveResponse(poll, name, values) {
  const user = await identity();
  await setDoc(doc(db, 'polls', poll.id, 'responses', user.uid), { ...makeResponse(name, values, poll), updatedAt: serverTimestamp() });
}
export async function chooseTime(poll, start) {
  await identity();
  if (!meetingSlots(poll, start).length) throw new Error('Choose a time that fits the full meeting length.');
  await updateDoc(doc(db, 'polls', poll.id), { status: 'closed', selectedStart: start });
}
export async function reopenPoll(poll) {
  await identity();
  await updateDoc(doc(db, 'polls', poll.id), { status: 'open', selectedStart: '' });
}

export async function renamePoll(poll, title) {
  await identity();
  title = title.trim();
  if (!title || title.length > 100) throw new Error('Enter a title up to 100 characters.');
  await updateDoc(doc(db, 'polls', poll.id), {title});
}
export async function duplicatePoll(source, responses, title, dates) {
  const user = await identity();
  if (user.uid !== source.ownerUid) throw new Error('Only the organizer can copy this poll.');
  if (responses.length > 400) throw new Error('Copying supports up to 400 participants.');
  const copy = copyPollData(source, responses, title, dates, user.uid);
  const ref = doc(collection(db, 'polls'));
  const batch = writeBatch(db);
  batch.set(ref, {...copy.poll, createdAt:serverTimestamp()});
  for (const {uid, copied, ...response} of copy.responses) batch.set(doc(ref, 'copiedResponses', uid), {...response, updatedAt:serverTimestamp()});
  await batch.commit();
  return ref.id;
}
