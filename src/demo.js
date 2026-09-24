import { makePoll, localDate } from './scheduling';
export function demoPoll() {
  const poll = { id: 'demo', ...makePoll({ title: 'Digital Corps team meeting', organizerName: 'Eric', description: 'Let’s find an hour to get together. Mark the times that work for you.', dates: [1,2,3,4,5].map(day => localDate(day)), startMinute: 540, endMinute: 1020, duration: 60, timezone: 'America/Chicago' }, 'demo-owner') };
  const names = ['Maya (sample)', 'Alex (sample)', 'Jordan (sample)'];
  const responses = names.map((name, person) => ({ uid: `sample-${person}`, name, available: poll.slotIds.filter((_, i) => (i + person * 2) % 16 >= 4 && (i + person * 2) % 16 < 12), ifNeeded: poll.slotIds.filter((_, i) => (i + person * 2) % 16 === 3 || (i + person * 2) % 16 === 12) }));
  return { poll, responses };
}
