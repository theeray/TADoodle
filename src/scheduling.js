import { DateTime, IANAZone } from 'luxon';

export const STEP = 30;
export const DEFAULT_ZONE = 'America/Chicago';
export function isZone(zone) { return typeof zone === 'string' && IANAZone.isValidZone(zone); }
export function safeZone(zone) { return isZone(zone) ? zone : DEFAULT_ZONE; }
export function localDate(offset = 0, zone = DEFAULT_ZONE) { return DateTime.now().setZone(zone).plus({ days: offset }).toISODate(); }
export function formatTime(minutes) { return DateTime.fromObject({ hour: 0 }).plus({ minutes }).toFormat('h:mm a'); }
export function slotTime(id, zone) { return DateTime.fromMillis(Number(id)).setZone(safeZone(zone)); }
export function slotLabel(id, zone) { return slotTime(id, zone).toFormat('ccc, LLL d · h:mm a ZZZZ'); }

export function createSlots(dates, startMinute, endMinute, zone) {
  if (!isZone(zone)) throw new Error('Choose a valid time zone.');
  if (!Array.isArray(dates) || !dates.length || dates.length > 14) throw new Error('Choose between 1 and 14 dates.');
  if (![startMinute, endMinute].every(Number.isInteger) || startMinute < 0 || endMinute > 1440 || endMinute <= startMinute || startMinute % STEP || endMinute % STEP) throw new Error('Choose an end time after the start time, in 30-minute steps.');
  const slots = [];
  for (const date of [...new Set(dates)].sort()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose valid dates.');
    const day = DateTime.fromISO(date, { zone });
    if (!day.isValid || day.toISODate() !== date) throw new Error('Choose valid dates.');
    const wall = (minute) => minute === 1440 ? day.plus({ days: 1 }).startOf('day') : day.set({ hour: Math.floor(minute / 60), minute: minute % 60, second: 0, millisecond: 0 });
    const start = wall(startMinute), end = wall(endMinute);
    if ((start.hour * 60 + start.minute) !== startMinute || (endMinute !== 1440 && end.hour * 60 + end.minute !== endMinute)) throw new Error('This time does not exist on a daylight-saving change. Choose a different time range.');
    for (let time = start; time.toMillis() < end.toMillis(); time = time.plus({ minutes: STEP })) slots.push(String(time.toMillis()));
  }
  if (slots.length > 672) throw new Error('Choose a shorter time range or fewer dates (maximum 672 half-hour slots).');
  return [...new Set(slots)].sort();
}

export function makePoll(input, uid) {
  const title = String(input.title || '').trim();
  if (!title || title.length > 100) throw new Error('Give your poll a name (up to 100 characters).');
  const description = String(input.description || '').trim();
  if (description.length > 600) throw new Error('Keep the description under 600 characters.');
  const organizerName = String(input.organizerName || '').trim();
  if (!organizerName || organizerName.length > 60) throw new Error('Enter your name (up to 60 characters).');
  const duration = Number(input.duration);
  if (![30, 60, 90, 120].includes(duration)) throw new Error('Choose a meeting length.');
  if (duration > input.endMinute - input.startMinute) throw new Error('The time range must fit the meeting length.');
  const slotIds = createSlots(input.dates, Number(input.startMinute), Number(input.endMinute), input.timezone);
  return { title, description, organizerName, ownerUid: uid, timezone: input.timezone, duration, slotIds, status: 'open', selectedStart: '', schemaVersion: 1 };
}

export function makeResponse(name, values, poll) {
  name = String(name || '').trim();
  if (!name || name.length > 60) throw new Error('Enter your name (up to 60 characters).');
  const valid = new Set(poll.slotIds);
  const available = [], ifNeeded = [];
  for (const [id, value] of Object.entries(values)) {
    if (!valid.has(id)) throw new Error('One of these times is no longer part of the poll.');
    if (value === 'available') available.push(id);
    else if (value === 'needed') ifNeeded.push(id);
    else throw new Error('Choose Available, If needed, or clear the time.');
  }
  return { name, available: available.sort(), ifNeeded: ifNeeded.sort() };
}
export function responseValues(response) {
  return Object.fromEntries([...(response?.available || []).map(id => [id, 'available']), ...(response?.ifNeeded || []).map(id => [id, 'needed'])]);
}
export function availability(response, ids) {
  const yes = new Set(response.available), maybe = new Set(response.ifNeeded);
  if (ids.every(id => yes.has(id))) return 'available';
  if (ids.every(id => yes.has(id) || maybe.has(id))) return 'needed';
  return 'unavailable';
}
export function meetingSlots(poll, start) {
  const ids = Array.from({ length: poll.duration / STEP }, (_, i) => String(Number(start) + i * STEP * 60_000));
  const valid = new Set(poll.slotIds);
  return ids.every(id => valid.has(id)) ? ids : [];
}
export function rankTimes(poll, responses) {
  if (!responses.length) return [];
  return poll.slotIds.map(start => {
    const ids = meetingSlots(poll, start);
    if (!ids.length) return null;
    const statuses = responses.map(response => ({ ...response, availability: availability(response, ids) }));
    const available = statuses.filter(r => r.availability === 'available').length;
    const needed = statuses.filter(r => r.availability === 'needed').length;
    return { start, ids, available, needed, total: available + needed, statuses };
  }).filter(Boolean).sort((a, b) => b.total - a.total || b.available - a.available || Number(a.start) - Number(b.start));
}
export function groupGrid(slotIds, zone) {
  const days = new Map(), rows = new Map();
  for (const id of slotIds) {
    const time = slotTime(id, zone), day = time.toISODate();
    if (!days.has(day)) days.set(day, { date: day, label: time.toFormat('ccc'), number: time.toFormat('d'), month: time.toFormat('LLL'), cells: new Map() });
    // Offset is part of the key so repeated fall-back hours remain separate.
    const key = `${time.toFormat('HH:mm')}|${time.offset}`;
    days.get(day).cells.set(key, id);
    rows.set(key, { key, time: time.toFormat('h:mm a'), offset: time.toFormat('ZZZZ'), minute: time.hour * 60 + time.minute, utcOffset: time.offset });
  }
  const offsets = new Set([...rows.values()].map(r => r.utcOffset));
  return { days: [...days.values()].sort((a,b) => a.date.localeCompare(b.date)), rows: [...rows.values()].sort((a,b) => a.minute - b.minute || b.utcOffset - a.utcOffset), showOffset: offsets.size > 1 };
}

// Copies preserve wall-clock times in the poll's original zone, not UTC offsets.
export function copyPollData(source, responses, title, dates, uid) {
  title = String(title || '').trim();
  if (!title || title.length > 100) throw new Error('Enter a title up to 100 characters.');
  const sourceDates = [...new Set(source.slotIds.map(id => slotTime(id, source.timezone).toISODate()))].sort();
  if (dates.length !== sourceDates.length || new Set(dates).size !== dates.length) throw new Error('Choose a different replacement date for every original date.');
  const map = new Map();
  for (const id of source.slotIds) {
    const old = slotTime(id, source.timezone);
    const date = dates[sourceDates.indexOf(old.toISODate())];
    const next = DateTime.fromISO(`${date}T${old.toFormat('HH:mm')}`, {zone: source.timezone});
    if (!next.isValid || next.toISODate() !== date || next.toFormat('HH:mm') !== old.toFormat('HH:mm') || next.getPossibleOffsets().length !== 1 || old.getPossibleOffsets().length !== 1) throw new Error('These dates include a missing or repeated daylight-saving hour. Choose dates outside that clock change.');
    map.set(id, String(next.toMillis()));
  }
  const poll = {title, description: source.description, organizerName: source.organizerName, ownerUid: uid, timezone: source.timezone, duration: source.duration, slotIds: [...map.values()].sort(), status: 'open', selectedStart: '', schemaVersion: 2};
  const copied = responses.map(r => ({uid:r.uid, ...makeResponse(r.name, Object.fromEntries(Object.entries(responseValues(r)).map(([id,value])=>[map.get(id),value])), poll), copied:true}));
  return {poll, responses:copied};
}
export function mergeResponses(copied, current) {
  return [...new Map([...copied, ...current].map(r=>[r.uid,r])).values()];
}
