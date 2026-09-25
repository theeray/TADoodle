import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DateTime } from 'luxon';
import { ArrowRight, ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Copy, Eraser, Globe2, Info, Link2, LockKeyhole, Plus, RotateCcw, Users, X } from 'lucide-react';
import * as data from './data';
import { DEFAULT_ZONE, localDate, safeZone, formatTime, makePoll, makeResponse, responseValues, rankTimes, groupGrid, slotLabel, slotTime, meetingSlots, STEP, copyPollData } from './scheduling';
import { demoPoll } from './demo';

function savedTemplates() { try { return JSON.parse(localStorage.getItem('tadoodle-templates') || '[]'); } catch { return []; } }
const ICON_SIZE = 18;
const browserZone = safeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
const topZones = ['America/Chicago', 'America/New_York', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney', 'Etc/UTC'];
const zones = [...new Set([...topZones, browserZone, ...(Intl.supportedValuesOf?.('timeZone') || [])])];
function zoneName(zone) { if (zone === 'America/Chicago') return 'Central Time'; return zone.replaceAll('_', ' ').replace('America/', '').replace('Etc/', ''); }
function ZoneSelect({ value, onChange, id = 'timezone' }) {
  return <div className="zone-select"><Globe2 size={16}/><select id={id} aria-label="Time zone" value={value} onChange={e => onChange(e.target.value)}>{zones.map(zone => <option key={zone} value={zone}>{zoneName(zone)}</option>)}</select></div>;
}
function getRoute() {
  const hash = location.hash.slice(1);
  if (hash === 'demo') return { type: 'demo' };
  const match = hash.match(/^poll\/([a-zA-Z0-9_-]{10,64})$/);
  return match ? { type: 'poll', id: match[1] } : { type: 'create' };
}
function Brand() { return <a className="brand" href="#" aria-label="TADoodle home"><img className="brand-logo" src={`${import.meta.env.BASE_URL}tadoodle-logo.svg`} alt="TADoodle" width="310" height="51"/></a>; }
function Notice({ children, error = false }) { return <div className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}><Info size={18}/><span>{children}</span></div>; }

export default function App() {
  const [route, setRoute] = useState(getRoute);
  const [preview, setPreview] = useState(null);
  const [toast, setToast] = useState('');
  useEffect(() => { const handler = () => setRoute(getRoute()); window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); }, [toast]);
  const openDemo = () => { setPreview(demoPoll()); location.hash = 'demo'; setRoute({type:'demo'}); };
  const startPreview = input => { setPreview({ poll: { id: 'demo', ...makePoll(input, 'demo-owner') }, responses: [] }); location.hash = 'demo'; setRoute({ type: 'demo' }); };
  const demo = useMemo(() => preview || demoPoll(), [preview]);
  return <div className="tadoodle-app">
    <header className="site-header"><div className="header-inner"><Brand/><div className="school-name">Technology, Art & Design<span>Bemidji State University</span></div><a className="header-action" href="#"><Plus size={18}/>New poll</a></div></header>
    {!data.configured && <div className="preview-banner"><span>PREVIEW MODE</span>Shared polls aren’t connected yet. Preview changes reset when you refresh.</div>}
    {route.type === 'create' ? <CreatePoll onDemo={openDemo} onPreview={startPreview} notify={setToast}/> : <PollView key={`${route.type}-${route.id || ''}-${preview?.poll.id || ''}`} id={route.id} demo={route.type === 'demo' ? demo : null} notify={setToast} onDemoCopy={copy=>setPreview({...copy,poll:{...copy.poll,id:`demo-${Date.now()}-${Math.random()}`}})}/>}
    <footer className="site-footer"><span>TADoodle · Find a time together.</span><div><a href="https://timeful.app/" target="_blank" rel="noreferrer">Inspired by Timeful</a><span>·</span><a href={`${import.meta.env.BASE_URL}source.zip`} download>Source code</a><span>·</span><a href={`${import.meta.env.BASE_URL}LICENSE`} target="_blank" rel="noreferrer">AGPL-3.0</a></div></footer>
    <div className={`toast ${toast ? 'visible' : ''}`} role="status"><Check size={18}/>{toast}</div>
  </div>;
}

function DatePicker({ dates, setDates, zone }) {
  const [month, setMonth] = useState(DateTime.now().setZone(zone).startOf('month'));
  const first = month.startOf('month');
  const offset = first.weekday % 7;
  const today = localDate(0, zone);
  const days = Array.from({ length: Math.ceil((offset + month.daysInMonth) / 7) * 7 }, (_, i) => i - offset + 1);
  function toggle(date) { setDates(dates.includes(date) ? dates.filter(d => d !== date) : dates.length < 14 ? [...dates, date].sort() : dates); }
  return <div className="date-picker">
    <div className="month-nav"><h3>{month.toFormat('LLLL yyyy')}</h3><div><button type="button" className="icon-button" aria-label="Previous month" onClick={() => setMonth(month.minus({ months: 1 }))}><ChevronLeft size={19}/></button><button type="button" className="icon-button" aria-label="Next month" onClick={() => setMonth(month.plus({ months: 1 }))}><ChevronRight size={19}/></button></div></div>
    <div className="calendar-weekdays" aria-hidden="true">{'SMTWTFS'.split('').map((d,i)=><span key={i}>{d}</span>)}</div>
    <div className="calendar-days">{days.map((n,i) => {
      if(n < 1 || n > month.daysInMonth) return <span key={i}/>;
      const date = month.set({day:n}).toISODate(), selected = dates.includes(date), past = date < today;
      return <button type="button" key={i} aria-label={month.set({day:n}).toFormat('cccc, LLLL d, yyyy')} aria-pressed={selected} disabled={past || (dates.length >= 14 && !selected)} className={`${selected ? 'selected' : ''} ${date === today ? 'today' : ''}`} onClick={() => toggle(date)}>{n}{selected && <span className="date-selected-dot"/>}</button>;
    })}</div>
    <div className="date-selection-summary"><span>{dates.length ? `${dates.length} date${dates.length === 1 ? '' : 's'} selected` : 'Select up to 14 dates'}</span>{dates.length > 0 && <button type="button" className="text-button" onClick={() => setDates([])}>Clear dates</button>}</div>
    {dates.length > 0 && <div className="date-chips">{dates.map(date => <button type="button" key={date} onClick={() => toggle(date)} aria-label={`Remove ${date}`}>{DateTime.fromISO(date).toFormat('LLL d')}<X size={12}/></button>)}</div>}
  </div>;
}

function CreatePoll({ onDemo, onPreview, notify }) {
  const [templates,setTemplates] = useState(savedTemplates);
  const [title,setTitle] = useState(''), [organizerName,setName] = useState(''), [description,setDescription] = useState('');
  const [dates,setDates] = useState([]), [timezone,setZone] = useState(DEFAULT_ZONE);
  const [start,setStart] = useState(540), [end,setEnd] = useState(1020), [duration,setDuration] = useState(60);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const input = () => ({title, organizerName, description, dates, timezone, startMinute: Number(start), endMinute: Number(end), duration: Number(duration)});
  async function create(event) {
    event?.preventDefault(); setError(''); setBusy(true);
    try {
      if(!data.configured) { onPreview(input()); return; }
      const id = await data.createPoll(input()); location.hash = `poll/${id}`; notify('Your poll is ready to share.');
    } catch(error) { setError(data.friendlyError(error)); } finally { setBusy(false); }
  }
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    void Promise.resolve(context.registerTool({ name:'stage_poll', description:'Fill out the visible poll form without creating or sharing it.', inputSchema:{type:'object',properties:{title:{type:'string'},organizerName:{type:'string'}},required:['title','organizerName'],additionalProperties:false}, annotations:{readOnlyHint:false}, execute(input) { if(typeof input.title !== 'string' || !input.title.trim() || input.title.length>100 || typeof input.organizerName !== 'string' || !input.organizerName.trim() || input.organizerName.length>60) throw new Error('A title and organizer name are required.'); setTitle(input.title); setName(input.organizerName); return {staged:true}; } },{signal:controller.signal})).catch(()=>{});
    return () => controller.abort();
  },[]);
  return <main className="create-page">
    <div className="page-intro"><div><p className="eyebrow">LESS BACK-AND-FORTH. MORE TIME TOGETHER.</p><h1>Find a time to meet<span className="accent-period">.</span></h1><p>Pick a few dates. Share your poll. See what works for everyone.</p></div><button className="secondary-button" onClick={onDemo}>Try a sample poll<ArrowRight size={18}/></button></div>
    {templates.length > 0 && <section className="template-list form-card"><h2>Your templates</h2><p>Saved in this browser. Open a template, then choose Copy poll.</p>{templates.map(t=><div key={t.id}><a href={`#poll/${t.id}`}>{t.title}</a><button className="text-button" onClick={()=>{const next=templates.filter(x=>x.id!==t.id);localStorage.setItem('tadoodle-templates',JSON.stringify(next));setTemplates(next);}}>Remove from list</button></div>)}</section>}
    <form className="create-layout" onSubmit={create}>
      <section className="form-card meeting-details"><div className="section-title"><span className="step-number">01</span><h2>The meeting</h2></div>
        <label htmlFor="poll-title">What are you planning?</label><input id="poll-title" name="title" required maxLength={100} placeholder="e.g. Digital Corps team meeting" value={title} onChange={e=>setTitle(e.target.value)}/>
        <label htmlFor="organizer-name">Your name</label><input id="organizer-name" name="organizerName" required maxLength={60} autoComplete="name" placeholder="The name participants will see" value={organizerName} onChange={e=>setName(e.target.value)}/>
        <label htmlFor="description">A little context <span className="optional">optional</span></label><textarea id="description" maxLength={600} rows={3} placeholder="Where you’ll meet, what you’ll discuss…" value={description} onChange={e=>setDescription(e.target.value)}/>
        <div className="details-divider"/>
        <label htmlFor="duration">How long do you need?</label><div className="duration-options" id="duration" role="group" aria-label="Meeting length">{[30,60,90,120].map(min => <button type="button" key={min} className={duration===min?'active':''} aria-pressed={duration===min} onClick={()=>setDuration(min)}>{min<60?`${min} min`:`${min/60} ${min===60?'hour':'hours'}`}</button>)}</div>
        <div className="small-note"><Users size={18}/><p>Everyone responds with their name.<br/>No email address or account needed.</p></div>
      </section>
      <section className="form-card date-card"><div className="section-title"><span className="step-number">02</span><h2>Possible dates & times</h2></div>
        <div className="dates-times-layout"><DatePicker dates={dates} setDates={setDates} zone={timezone}/><div className="time-settings"><label htmlFor="start-time">Between</label><select id="start-time" value={start} onChange={e=>setStart(Number(e.target.value))}>{Array.from({length:48},(_,i)=>i*30).map(min=><option value={min} key={min}>{formatTime(min)}</option>)}</select><label htmlFor="end-time">And</label><select id="end-time" value={end} onChange={e=>setEnd(Number(e.target.value))}>{Array.from({length:48},(_,i)=>(i+1)*30).map(min=><option value={min} key={min}>{min===1440?'Midnight (end of day)':formatTime(min)}</option>)}</select><label htmlFor="create-zone">Time zone</label><ZoneSelect id="create-zone" value={timezone} onChange={setZone}/><p className="muted help-text">Participants can view these times in their own time zone.</p></div></div>
      </section>
      <div className="create-bottom"><div>{error && <Notice error>{error}</Notice>}<p><LockKeyhole size={15}/> Anyone with the poll link can see names and availability.</p></div><button className="primary-button" type="button" onClick={create} disabled={busy}>{busy?'Creating…':data.configured?'Create poll':'Preview this poll'}<ArrowRight size={18}/></button></div>
    </form>
  </main>;
}

function PollView({ id, demo, notify, onDemoCopy }) {
  const [editingTitle,setEditingTitle] = useState(false), [copying,setCopying] = useState(false);
  const [poll,setPoll] = useState(demo?.poll || undefined), [responses,setResponses] = useState(demo?.responses || []);
  const [uid,setUid] = useState(demo ? 'demo-owner' : ''), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const [mode,setMode] = useState('group'), [name,setName] = useState(''), [values,setValues] = useState({}), [dirty,setDirty] = useState(false);
  const [zone,setZone] = useState(browserZone), [tool,setTool] = useState('available'), [selected,setSelected] = useState(''), [confirm,setConfirm] = useState(false), [share,setShare] = useState(false);
  const loadedMine = useRef(false);
  useEffect(() => {
    if(demo) return;
    if(!data.configured) { setError('Shared polls are not connected in this preview.'); return; }
    data.identity().then(user=>setUid(user.uid)).catch(error=>setError(data.friendlyError(error)));
    return data.watchPoll(id,setPoll,setResponses,error=>setError(data.friendlyError(error)));
  },[id,demo]);
  const mine = responses.find(response=>response.uid===uid);
  useEffect(() => { if(mine && !loadedMine.current && !dirty) { loadedMine.current=true; setName(mine.name); setValues(responseValues(mine)); } },[mine,dirty]);
  useEffect(() => { if(!dirty) return; const warn=e=>{e.preventDefault();e.returnValue='';}; window.addEventListener('beforeunload',warn); return ()=>window.removeEventListener('beforeunload',warn); },[dirty]);
  const ranked = useMemo(()=>poll ? rankTimes(poll,responses) : [],[poll,responses]);
  const best = ranked[0];
  const selectedResult = ranked.find(time=>time.start===(selected || poll?.selectedStart)) || best;
  const owner = poll?.ownerUid===uid;
  useEffect(() => { if(owner && !mine && !dirty && !name) setName(poll.organizerName); }, [owner,mine,dirty,name,poll?.organizerName]);
  const closed = poll?.status==='closed';
  const shareUrl = poll && !demo ? `${location.origin}${location.pathname}#poll/${poll.id}` : '';
  useEffect(() => { if(poll) document.title=`${poll.title} · TADoodle`; return ()=>{document.title='TADoodle · Find a time together';}; },[poll?.title]);
  useEffect(() => {
    const context=document.modelContext;if(!context?.registerTool || !poll)return;
    const lifecycle=new AbortController();
    void Promise.resolve(context.registerTool({name:'read_poll_results',description:'Read the current poll, participant names, and best meeting times.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(input && Object.keys(input).length)throw new Error('This tool takes no arguments.');return {title:poll.title,status:poll.status,participantNames:responses.map(r=>r.name),bestTimes:ranked.slice(0,5).map(r=>({start:r.start,label:slotLabel(r.start,zone),available:r.available,ifNeeded:r.needed}))};}},{signal:lifecycle.signal})).catch(()=>{});
    return ()=>lifecycle.abort();
  },[poll,responses,ranked,zone]);
  async function save(e) {
    e?.preventDefault(); if(!poll || closed) return;
    if(!name.trim()) { setError('Enter your name before saving availability.'); document.getElementById('participant-name')?.focus(); return; }
    setBusy(true);setError('');
    try {
      const response=makeResponse(name,values,poll);
      if(demo) setResponses(old=>[...old.filter(r=>r.uid!==uid),{...response,uid}]);
      else await data.saveResponse(poll,name,values);
      setDirty(false);loadedMine.current=true;setMode('group');notify(demo ? 'Saved in this preview. Refreshing will clear it.' : 'Your availability is saved.');
    }catch(error){setError(data.friendlyError(error));}finally{setBusy(false);}
  }
  async function choose() { setBusy(true);setError('');try { const start=selectedResult.start; if(demo)setPoll({...poll,status:'closed',selectedStart:start});else await data.chooseTime(poll,start);setConfirm(false);setMode('group');notify('Meeting time selected. Share the poll to let everyone know.'); }catch(error){setError(data.friendlyError(error));}finally{setBusy(false);} }
  async function reopen() { setBusy(true);try { if(demo)setPoll({...poll,status:'open',selectedStart:''});else await data.reopenPoll(poll);notify('Your poll is open again.'); }catch(error){setError(data.friendlyError(error));}finally{setBusy(false);} }
  async function copy() { try { await navigator.clipboard.writeText(shareUrl);notify('Poll link copied.'); }catch { setShare(true); } }
  const paint = (id,value) => {setValues(old=>{const next={...old};if(value==='erase')delete next[id];else next[id]=value;return next;});setDirty(true);};
  if(poll===null)return <main className="not-found"><CalendarDays size={42}/><h1>Poll not found</h1><p>Check the link with the organizer.</p><a href="#" className="primary-button">Create a poll</a></main>;
  if(!poll)return <main className="not-found">{error?<Notice error>{error}</Notice>:<p role="status">Opening your poll…</p>}<a href="#" className="text-button">Back to new poll</a></main>;
  return <main className="poll-page">
    {demo && <div className="demo-note"><Info size={17}/><span>Sample poll · Try adding your name and availability. Nothing here is shared or saved after a refresh.</span></div>}
    <a className="back-link" href="#"><ArrowLeft size={15}/>Create another poll</a>
    <div className="poll-heading"><div><div className="poll-status"><span className={closed?'status closed':'status'}>{closed?'TIME CHOSEN':'AVAILABILITY POLL'}</span><span>Organized by {poll.organizerName}</span></div><h1>{poll.title}</h1>{poll.description && <p>{poll.description}</p>}<div className="poll-meta"><span><Clock3 size={16}/>{poll.duration} minutes</span><span><Users size={16}/>{responses.length} {responses.length===1?'response':'responses'}</span><span><Globe2 size={16}/>{zoneName(poll.timezone)} when created</span></div></div><button className="primary-button" disabled={!!demo} title={demo?'Sharing becomes available when Firebase is connected.':undefined} onClick={()=>setShare(true)}><Link2 size={18}/>Share poll</button></div>
    {owner && <div className="poll-actions"><button className="secondary-button" onClick={()=>setEditingTitle(true)}>Edit title</button><button className="secondary-button" disabled={dirty} title={dirty?'Save your availability before copying.':undefined} onClick={()=>setCopying(true)}><Copy size={17}/>Copy poll</button><button className="text-button" disabled={!!demo} onClick={()=>{try {const list=savedTemplates().filter(t=>t.id!==poll.id);localStorage.setItem('tadoodle-templates',JSON.stringify([...list,{id:poll.id,title:poll.title}]));notify('Template saved. Find it on the New poll page in this browser.');}catch {setError('Your browser could not save this template shortcut. Bookmark the poll link instead.');}}}>Save as template</button></div>}
    {responses.some(r=>r.copied) && <Notice>Copied availability is a starting point, not confirmation for these dates. Participants can review and save their response using their original browser.</Notice>}
    {error && mode!=='edit' && <Notice error>{error}</Notice>}
    {closed && <div className="chosen-banner"><div className="chosen-icon"><Check size={24}/></div><div><p>WE HAVE A TIME</p><h2>{slotLabel(poll.selectedStart,zone)}</h2><span>{poll.duration} minutes · The organizer will share any meeting details separately.</span></div>{owner && <button className="secondary-button" disabled={busy} onClick={reopen}><RotateCcw size={16}/>Reopen poll</button>}</div>}
    <div className="poll-layout">
      <aside className="participants-card"><div className="participants-heading"><h2>Who's coming?</h2><span className="count-pill">{responses.length}</span></div><p className="muted">Names appear after people respond.</p><div className="participants-list">{responses.length===0?<div className="empty-people"><Users size={32}/><p>No responses yet.<br/>Be the first to add your times.</p></div>:responses.map((response,i)=><div className="participant" key={response.uid}><span className={`avatar avatar-${i%4}`}>{response.name.slice(0,1).toUpperCase()}</span><div><strong>{response.name}{response.uid===uid && <span className="you-label">you</span>}</strong><span>{response.available.length===0 && response.ifNeeded.length===0 ? 'No times available' : response.copied?'Copied · awaiting confirmation':'Availability added'}</span></div><Check size={15}/></div>)}</div><div className="participants-note"><LockKeyhole size={15}/><p>Names are self-entered. Everyone with this link can see the responses.</p></div>{owner && <div className="owner-note">You’re the organizer on this browser.</div>}</aside>
      <section className="availability-card">
        <div className="availability-toolbar"><div className="view-tabs" role="tablist" aria-label="Availability view"><button role="tab" aria-selected={mode==='group'} onClick={()=>setMode('group')}>Group availability</button><button role="tab" aria-selected={mode==='edit'} disabled={closed} onClick={()=>setMode('edit')}>{mine?'Your availability':'Add your availability'}{dirty && <span className="unsaved-dot" aria-label="Unsaved changes"/>}</button></div><ZoneSelect id="view-zone" value={zone} onChange={setZone}/></div>
        {mode==='edit'?<div className="edit-controls"><div className="name-field"><label htmlFor="participant-name">Your name</label><input id="participant-name" autoComplete="name" maxLength={60} placeholder="e.g. Eric Carlson" value={name} onChange={e=>{setName(e.target.value);setDirty(true);}}/></div><div className="paint-tools"><span>Mark times as</span><div role="group" aria-label="Availability marker">{[['available','Available',Check],['needed','If needed',Clock3],['erase','Clear',Eraser]].map(([value,label,Icon])=><button className={`${value} ${tool===value?'active':''}`} aria-pressed={tool===value} key={value} onClick={()=>setTool(value)}><Icon size={15}/>{label}</button>)}</div></div></div>:<div className="grid-caption"><p>{responses.length?'Darker cells mean more people are available.':'Share your poll to start finding a time together.'}</p><div className="heat-legend"><span>Fewer</span>{[0,1,2,3,4].map(i=><i key={i} className={`heat-${i}`}/>)}<span>More</span><span className="needed-legend">Striped = if needed</span></div></div>}
        <AvailabilityGrid poll={poll} responses={responses} mode={mode} values={values} paint={paint} tool={tool} zone={zone} selected={selectedResult?.start} onSelect={setSelected}/>
        {mode==='edit'?<div className="save-bar">{error && <Notice error>{error}</Notice>}<div><span>{Object.keys(values).length} half-hour slots marked</span><p>Unmarked times mean unavailable. Tap cells, or click and drag.</p></div><button className="primary-button" type="button" disabled={busy} onClick={save}>{busy?'Saving…':mine?'Save changes':'Save availability'}<Check size={18}/></button><p className="browser-note">{demo ? "Preview only: your response lasts until you refresh this page." : "To edit later, return in this browser. Clearing browser data removes your editing access."}</p></div>:<div className="grid-footer"><span><Info size={15}/>Tap a time to see who can attend the full {poll.duration} minutes.</span>{!closed && <button className="text-button" onClick={()=>setMode('edit')}>{mine?'Edit your response':'Add your availability'}<ArrowRight size={16}/></button>}</div>}
      </section>
      {mode==='group' && <section className="results-section"><div className="results-heading"><div><p className="eyebrow">LET’S MAKE IT HAPPEN</p><h2>{closed?'Meeting availability':'Times that work best'}</h2></div><span className="muted">For the full {poll.duration}-minute meeting</span></div>{!responses.length?<div className="empty-results"><CalendarDays size={28}/><p>The best times will appear here as people respond.</p></div>:<div className="results-layout"><div className="best-times">{ranked.slice(0,4).map((result,i)=><button key={result.start} className={`best-time ${selectedResult?.start===result.start?'selected':''}`} onClick={()=>setSelected(result.start)}><span className="rank">{String(i+1).padStart(2,'0')}</span><span className="best-time-label"><strong>{slotTime(result.start,zone).toFormat('ccc, LLL d')}</strong><span>{slotTime(result.start,zone).toFormat('h:mm a')} – {slotTime(result.start,zone).plus({minutes:poll.duration}).toFormat('h:mm a')}</span></span><span className="match-score"><strong>{result.total}<span>/{responses.length}</span></strong><span>can make it</span></span></button>)}</div><div className="time-detail">{selectedResult?<><div className="time-detail-header"><CalendarDays size={20}/><div><h3>{slotLabel(selectedResult.start,zone)}</h3><p>{selectedResult.available} available{selectedResult.needed>0?` · ${selectedResult.needed} if needed`:''} · {responses.length-selectedResult.total} unavailable</p></div></div><div className="detail-people">{selectedResult.statuses.map(r=><span key={r.uid} className={`person-status ${r.availability}`}><i/>{r.name}<small>{r.availability==='available'?'Available':r.availability==='needed'?'If needed':'Unavailable'}</small></span>)}</div>{owner && !closed && <button className="primary-button choose-button" onClick={()=>setConfirm(true)}>Choose this time<ArrowRight size={17}/></button>}{!owner && <p className="muted">{poll.organizerName} can choose the final meeting time.</p>}</>:<p>No full meeting fits in the selected range.</p>}</div></div>}</section>}
    </div>
    {editingTitle && <EditTitle poll={poll} onClose={()=>setEditingTitle(false)} onSave={async title=>{if(demo)setPoll({...poll,title});else await data.renamePoll(poll,title);const list=savedTemplates();try {localStorage.setItem('tadoodle-templates',JSON.stringify(list.map(t=>t.id===poll.id?{...t,title}:t)));}catch {} setEditingTitle(false);notify('Meeting title updated.');}}/>}
    {copying && <CopyPoll poll={poll} responses={responses} onClose={()=>setCopying(false)} onCopy={async (title,dates)=>{if(demo){onDemoCopy(copyPollData(poll,responses,title,dates,'demo-owner'));setCopying(false);}else {const nextId=await data.duplicatePoll(poll,responses,title,dates);location.hash=`poll/${nextId}`;}notify('Poll copied with the new dates.');}}/>}
    {share && <Modal title="Invite everyone to the poll" onClose={()=>setShare(false)}><p>Send this link to your group. They can add their name and availability without an account.</p><label htmlFor="share-link">Poll link</label><div className="share-link"><input id="share-link" readOnly value={shareUrl} onFocus={e=>e.target.select()}/><button className="primary-button" onClick={copy}><Copy size={17}/>Copy</button></div><Notice>Anyone with the link can view names and availability. Only you can choose the meeting time, using this browser.</Notice></Modal>}
    {confirm && selectedResult && <Modal title="Choose this meeting time?" onClose={()=>setConfirm(false)}><div className="confirm-time"><CalendarDays size={26}/><strong>{slotLabel(selectedResult.start,zone)}</strong><span>{poll.duration} minutes</span></div><p>{selectedResult.total} of {responses.length} participants can make this time{selectedResult.needed?`, including ${selectedResult.needed} marked “If needed”`:''}.</p><p>Choosing a time closes responses. You can reopen the poll from this browser. No invitations or emails are sent automatically.</p><div className="modal-actions"><button className="secondary-button" onClick={()=>setConfirm(false)}>Keep looking</button><button className="primary-button" disabled={busy} onClick={choose}>{busy?'Saving…':'Confirm time'}<Check size={17}/></button></div></Modal>}
  </main>;
}

function AvailabilityGrid({poll,responses,mode,values,paint,tool,zone,selected,onSelect}) {
  const {days,rows,showOffset}=useMemo(()=>groupGrid(poll.slotIds,zone),[poll.slotIds,zone]);
  const [page,setPage]=useState(0), [pageSize,setPageSize]=useState(window.innerWidth<680?3:5);
  const drag=useRef(null);
  useEffect(()=>{const up=()=>{drag.current=null;};window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);const media=window.matchMedia('(max-width: 679px)');const resize=()=>{setPageSize(media.matches?3:5);setPage(0);};media.addEventListener('change',resize);return()=>{window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);media.removeEventListener('change',resize);};},[]);
  useEffect(()=>{setPage(0);},[zone]);
  const pages=Math.ceil(days.length/pageSize), visible=days.slice(page*pageSize,(page+1)*pageSize);
  const totals=useMemo(()=>Object.fromEntries(poll.slotIds.map(id=>[id,{yes:responses.filter(r=>r.available.includes(id)).length,maybe:responses.filter(r=>r.ifNeeded.includes(id)).length}])),[poll.slotIds,responses]);
  const selectCell=(id)=>{if(mode==='edit'){const mark=tool!=='erase' && values[id]===tool?'erase':tool;paint(id,mark);return mark;}onSelect(id);};
  return <div className="grid-area"><div className="grid-date-nav"><strong>{visible.length?`${DateTime.fromISO(visible[0].date).toFormat('LLLL yyyy')}`:''}</strong><div><button className="icon-button" aria-label="Earlier dates" disabled={page===0} onClick={()=>setPage(page-1)}><ChevronLeft size={18}/></button><span>{page+1} / {pages}</span><button className="icon-button" aria-label="Later dates" disabled={page>=pages-1} onClick={()=>setPage(page+1)}><ChevronRight size={18}/></button></div></div><div className="schedule-scroll"><div className="schedule-grid" style={{gridTemplateColumns:`${showOffset?'100':'72'}px repeat(${visible.length}, minmax(64px, 1fr))`}} role="group" aria-label={mode==='edit'?'Mark your availability':'Group availability by time'}><div className="time-column-heading">{showOffset?'Time / zone':'Time'}</div>{visible.map(day=><div className="day-heading" key={day.date}><span>{day.label}</span><strong>{day.number}</strong><small>{day.month}</small></div>)}{rows.map(row=><React.Fragment key={row.key}><div className="time-label">{row.time}{showOffset && <small>{row.offset}</small>}</div>{visible.map(day=>{
    const id=day.cells.get(row.key);if(!id)return <span key={day.date} className="empty-slot"/>;
    const count=totals[id],level=responses.length?Math.round(count.yes/responses.length*4):0;
    const mark=values[id], editing=mode==='edit', fits=meetingSlots(poll,id).length>0;
    const label=`${slotLabel(id,zone)}: ${editing?(mark==='available'?'Available':mark==='needed'?'If needed':'Unavailable'):`${count.yes} available, ${count.maybe} if needed`}`;
    return <button key={day.date} type="button" disabled={!editing && !fits} className={`time-cell ${editing?mark||'unmarked':`heat-${level}`} ${!editing && count.maybe>0?'has-maybe':''} ${!editing && selected===id?'inspected':''}`} aria-label={label} aria-pressed={editing?!!mark:selected===id} title={label} onPointerDown={e=>{if(e.pointerType!=='mouse'||e.button!==0)return;e.preventDefault();const action=selectCell(id);if(editing)drag.current=action;}} onPointerEnter={e=>{if(editing && e.pointerType==='mouse' && e.buttons===1 && drag.current)paint(id,drag.current);}} onClick={e=>{if(e.detail===0||e.nativeEvent.pointerType==='touch'||e.nativeEvent.pointerType==='pen')selectCell(id);}}>{editing?(mark==='available'?<Check size={14}/>:mark==='needed'?<span className="needed-mark">~</span>:null):count.yes>0?<span>{count.yes}/{responses.length}</span>:count.maybe>0?<span className="maybe-count">~{count.maybe}</span>:null}</button>;
  })}</React.Fragment>)}</div></div></div>;
}

function Modal({ title, onClose, children }) {
  const ref=useRef();
  useEffect(()=>{const dialog=ref.current;dialog.showModal();const cancel=e=>{e.preventDefault();onClose();};dialog.addEventListener('cancel',cancel);return()=>dialog.removeEventListener('cancel',cancel);},[]);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onClick={e=>{if(e.target===ref.current){const rect=ref.current.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)onClose();}}}><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}</dialog>;
}

function EditTitle({poll,onClose,onSave}) {
  const [title,setTitle]=useState(poll.title), [busy,setBusy]=useState(false), [error,setError]=useState('');
  async function save() {setBusy(true);setError('');try {const value=title.trim();if(!value || value.length>100)throw new Error('Enter a title up to 100 characters.');await onSave(value);}catch(e){setError(e.code==='permission-denied'?'Title editing needs the updated TADoodle Firebase rules. Ask the project administrator to publish firestore.rules.':data.friendlyError(e));}finally{setBusy(false);}}
  return <Modal title="Edit meeting title" onClose={()=>!busy&&onClose()}><label htmlFor="new-title">Meeting title</label><input id="new-title" maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/>{error&&<Notice error>{error}</Notice>}<div className="modal-actions"><button className="secondary-button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="primary-button" disabled={busy} onClick={save}>{busy?'Saving…':'Save title'}</button></div></Modal>;
}
function CopyPoll({poll,responses,onClose,onCopy}) {
  const original=[...new Set(poll.slotIds.map(id=>slotTime(id,poll.timezone).toISODate()))].sort();
  const [title,setTitle]=useState(`${poll.title.slice(0,93)} (copy)`), [dates,setDates]=useState(original), [busy,setBusy]=useState(false), [error,setError]=useState('');
  async function copy() {setBusy(true);setError('');try {if(dates.some(d=>d<localDate(0,poll.timezone)))throw new Error('Choose today or a future date for each replacement.');await onCopy(title,dates);}catch(e){setError(e.code==='permission-denied'?'Copying needs the updated TADoodle Firebase rules. Ask the project administrator to publish firestore.rules.':data.friendlyError(e));}finally{setBusy(false);}}
  return <Modal title="Copy poll to new dates" onClose={()=>!busy&&onClose()}><p>Keep the meeting length, local times, names, and availability. Choose a replacement for each date. Your original poll stays available as a template.</p><label htmlFor="copy-title">New meeting title</label><input id="copy-title" maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/><p className="copy-zone">Times stay in {zoneName(poll.timezone)}.</p><div className="copy-dates">{original.map((date,i)=><div key={date}><label htmlFor={`copy-date-${i}`}>{DateTime.fromISO(date).toFormat('ccc, LLL d, yyyy')} →</label><input type="date" id={`copy-date-${i}`} min={localDate(0,poll.timezone)} value={dates[i]} onInput={e=>setDates(old=>old.map((d,j)=>i===j?e.target.value:d))}/></div>)}</div><Notice>{responses.length} responses will be copied and labeled as awaiting confirmation for the new dates. The new poll will be open for responses.</Notice>{error&&<Notice error>{error}</Notice>}<div className="modal-actions"><button className="secondary-button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="primary-button" disabled={busy} onClick={copy}>{busy?'Copying…':'Create copy'}</button></div></Modal>;
}
