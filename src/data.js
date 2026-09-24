import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, doc, collection, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { makePoll, makeResponse, meetingSlots, isZone } from './scheduling';

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
  let stopped = false, offPoll, offResponses;
  identity().then(() => {
    if (stopped) return;
    offPoll = onSnapshot(doc(db, 'polls', id), snap => {
      if (!snap.exists()) return onPoll(null);
      const p = snap.data();
      if (typeof p.title !== 'string' || typeof p.organizerName !== 'string' || typeof p.description !== 'string' || !isZone(p.timezone) || ![30,60,90,120].includes(p.duration) || !Array.isArray(p.slotIds) || p.slotIds.length < 1 || p.slotIds.length > 672 || !p.slotIds.every(id => typeof id === 'string' && /^[0-9]{13}$/.test(id)) || !['open','closed'].includes(p.status) || (p.status === 'closed' && !p.slotIds.includes(p.selectedStart))) {
        onError(new Error('This poll contains invalid data and cannot be displayed.')); return;
      }
      onPoll({id: snap.id, ...p});
    }, onError);
    offResponses = onSnapshot(collection(db, 'polls', id, 'responses'), snap => onResponses(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }))), onError);
  }).catch(onError);
  return () => { stopped = true; offPoll?.(); offResponses?.(); };
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
