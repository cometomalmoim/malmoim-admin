'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { mutatePerson } from '@/app/actions/people';
import { personFields, type PeopleData, type Person } from '@/lib/people-types';
import './people.css';
import { PeoplePhotoInput } from './people-photo-input';

function instagramId(value: string) {
  return value.replace(/^https:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '').replace(/^@/, '');
}

function Portrait({ person, large = false }: {person: Partial<Person>; large?: boolean}) {
  return <span className={`people-avatar${large ? ' large' : ''}`}>
    {/* Remote profile images use their original HTTPS URL. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {person.photo_url ? <img src={person.photo_url} alt={`${person.name || "운영진"} 프로필 사진`} referrerPolicy="no-referrer" onError={e => { e.currentTarget.hidden = true; }} /> : null}<span>{person.name?.slice(0, 1) || '+'}</span>
  </span>;
}
export function PeopleWorkspace({ data }: {data: PeopleData}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [generation, setGeneration] = useState('');
  const [role, setRole] = useState('');
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const person = data.people.find(p => p.id === selected && p.status === 'active');
  const archived = data.people.find(p => p.id === archiveId && p.status === 'inactive');
  const active = data.people.filter(p => p.status === 'active');
  const filtered = active.filter(p => (!generation || p.generation === generation) && (!role || p.role === role) && `${p.name} ${p.generation} ${p.role} ${p.education}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  function closePanel() { setSelected(null); setCreating(false); setEditing(false); }
  function run(kind: 'save' | 'active' | 'inactive' | 'delete', form: FormData) {
    if (kind === 'delete' && !window.confirm('프로필을 영구 삭제할까요? 연결된 이벤트와 자료 원본은 유지됩니다.')) return;
    setMessage('');
    startTransition(async () => {
      try {
        const result = await mutatePerson(kind, form);
        setMessage(result.message);
        if (result.success) {
          setEditing(false); setCreating(false);
          if (kind === 'save') setSelected(result.id ?? null);
          else { closePanel(); setArchiveId(null); }
          router.refresh();
        }
      } catch { setMessage('연결에 실패했습니다. 입력을 유지한 채 다시 시도해주세요.'); }
    });
  }
  function change(kind: 'active' | 'inactive' | 'delete', p: Person) {
    const form = new FormData(); form.set('id', p.id); form.set('updated_at', p.updated_at); run(kind, form);
  }
  function detail(p: Person, inArchive = false) {
    return <><div className="people-actions"><button type="button" disabled={pending} onClick={() => inArchive ? setArchiveId(null) : closePanel()}>✕ 닫기</button><button type="button" disabled={pending} onClick={() => change(inArchive ? 'active' : 'inactive', p)}>{inArchive ? '활동 복구' : '비활동으로 전환'}</button>{!inArchive && <button type="button" disabled={pending} onClick={() => setEditing(true)}>✎ 수정</button>}<button type="button" className="people-danger" disabled={pending} onClick={() => change('delete', p)}>삭제</button></div><div className="people-identity"><Portrait person={p} large /><div className="people-identity-text"><span className="people-eyebrow">MALMOIM PEOPLE</span><h2>{p.name}</h2><p>{p.generation || '기수 미등록'} · {p.role || '역할 미등록'}</p></div></div><dl className="people-details">{personFields.filter(([key]) => !['name', 'photo_url', 'generation', 'role'].includes(key)).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{key === 'instagram' && p[key] ? <a href={p[key]} target="_blank" rel="noreferrer">@{instagramId(p[key])}</a> : p[key] || '—'}</dd></div>)}</dl><section className="people-related"><h3>담당 이벤트 <span>{p.event_ids.length}</span></h3>{p.event_ids.length ? data.events.filter(e => p.event_ids.includes(e.id)).map(e => <Link key={e.id} href={`/admin/events/${e.slug}/overview`}>{e.title} ↗</Link>) : <p>연결된 이벤트가 없습니다.</p>}<h3>담당 자료 <span>{p.resource_ids.length}</span></h3>{p.resource_ids.length ? data.resources.filter(r => p.resource_ids.includes(r.id)).map(r => <Link key={r.id} href={`/admin/resources/${r.id}`}>{r.title} ↗</Link>) : <p>연결된 자료가 없습니다.</p>}</section></>;
  }
  return <div className="people-workspace"><p className="people-notice" role="status" aria-live="polite">{message}</p><div className="people-split"><section className="people-list-panel" aria-label="활동 운영진"><div className="people-toolbar"><button className="people-primary" disabled={pending} onClick={() => { closePanel(); setCreating(true); }}>+ 새 프로필 등록</button><button onClick={() => { setArchiveId(null); dialog.current?.showModal(); }}>📁 비활동 운영진 보관함 <span>{data.people.filter(p => p.status === 'inactive').length}</span></button></div><input className="people-search" aria-label="프로필 검색" placeholder="이름, 기수, 역할로 검색" value={search} onChange={e => setSearch(e.target.value)} /><div className="people-filters"><select aria-label="기수 필터" value={generation} onChange={e => setGeneration(e.target.value)}><option value="">모든 기수</option>{[...new Set(active.map(p => p.generation))].filter(Boolean).sort().map(v => <option key={v}>{v}</option>)}</select><select aria-label="역할 필터" value={role} onChange={e => setRole(e.target.value)}><option value="">모든 역할</option>{[...new Set(active.map(p => p.role))].filter(Boolean).sort().map(v => <option key={v}>{v}</option>)}</select></div><p className="people-count">활동 운영진 <strong>{filtered.length}</strong></p><div className="people-cards">{filtered.map(p => <button key={p.id} className={`people-card${selected === p.id ? ' selected' : ''}`} aria-pressed={selected === p.id} disabled={pending} onClick={() => { setSelected(p.id); setCreating(false); setEditing(false); setMessage(''); }}><Portrait person={p}/><span><strong>{p.name}</strong><small>{p.generation || '기수 미등록'}</small><small>{p.role || '역할 미등록'}</small></span></button>)}</div>{!filtered.length && <p className="people-no-results">{active.length ? '검색 조건에 맞는 프로필이 없습니다.' : '활동 중인 프로필이 없습니다.'}</p>}</section>{(creating || person) && <section className="people-detail-panel" aria-label="프로필 상세" aria-busy={pending}>{creating || (editing && person) ? <form key={creating ? 'new' : person!.id} onSubmit={event => { event.preventDefault(); run('save', new FormData(event.currentTarget)); }}><div className="people-actions"><h2>{creating ? '새 프로필 등록' : '프로필 수정'}</h2><button type="button" disabled={pending} onClick={() => { setEditing(false); setCreating(false); }}>취소</button><button className="people-primary" disabled={pending}>{pending ? '저장 중…' : '저장'}</button></div>{!creating && <><input type="hidden" name="id" value={person!.id}/><input type="hidden" name="updated_at" value={person!.updated_at}/></>}<fieldset disabled={pending} className="people-form-fields"><PeoplePhotoInput current={creating ? "" : person?.photo_url}/>{personFields.filter(([key]) => key !== "photo_url").map(([key, label, limit]) => <label key={key}>{label}{key === 'name' && ' *'}{['bio', 'tmi'].includes(key) ? <textarea name={key} maxLength={limit} rows={4} defaultValue={creating ? '' : key === 'instagram' ? instagramId(person?.instagram || '') : person?.[key]}/> : <input name={key} maxLength={limit} required={key === 'name'} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} placeholder={key === 'instagram' ? '@malmoim' : undefined} defaultValue={creating ? '' : key === 'instagram' ? instagramId(person?.instagram || '') : person?.[key]}/>}</label>)}{(['events', 'resources'] as const).map(kind => <label key={kind}>담당 {kind === 'events' ? '이벤트' : '자료'}<select multiple name={kind === 'events' ? 'event_ids' : 'resource_ids'} defaultValue={creating ? [] : kind === 'events' ? person?.event_ids : person?.resource_ids}>{data[kind].map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><small>Ctrl / Command 키로 여러 항목을 선택하거나 해제할 수 있습니다.</small></label>)}</fieldset></form> : person ? detail(person) : null}</section>}</div><dialog ref={dialog} className="people-archive" aria-labelledby="people-archive-title" onCancel={e => { if (pending) e.preventDefault(); }}><div className="people-actions"><h2 id="people-archive-title">비활동 운영진 보관함</h2><button disabled={pending} onClick={() => dialog.current?.close()}>✕ 보관함 닫기</button></div><p role="status">{message}</p><div className="people-archive-body"><div className="people-archive-list">{data.people.filter(p => p.status === 'inactive').map(p => <button className={`people-card${p.id === archiveId ? ' selected' : ''}`} key={p.id} aria-pressed={p.id === archiveId} disabled={pending} onClick={() => setArchiveId(p.id)}><Portrait person={p}/><span><strong>{p.name}</strong><small>{p.generation} · {p.role}</small></span></button>)}{!data.people.some(p => p.status === 'inactive') && <p>보관된 프로필이 없습니다.</p>}</div><section aria-label="비활동 프로필 상세">{archived ? detail(archived, true) : null}</section></div></dialog></div>;
}
