'use client';
import {useState} from 'react';
import {HISTORY_COHORTS,PHOTO_CATEGORIES,type PhotoCategory,type StoredPhotoCategory,displayPhotoCategory} from '@/lib/history-simple/categories';
export function HistoryPhotoClassification({category='special',cohort=null}:{category?:StoredPhotoCategory;cohort?:number|null}){
 const [kind,setKind]=useState<PhotoCategory>(displayPhotoCategory(category));
 const [preserveLegacy,setPreserveLegacy]=useState(category==='event'||category==='study');
 const [season,setSeason]=useState(String(cohort??HISTORY_COHORTS[0]));
 const options=Array.from(new Set([...HISTORY_COHORTS,...(cohort?[cohort]:[])])).sort((a,b)=>b-a);
 return <>{preserveLegacy&&<><input type="hidden" name="preserveClassification" value="1"/><p>기존 분류는 유지됩니다. 활동 유형을 선택하면 새 분류로 저장됩니다.</p></>}<label>활동 유형<select aria-label="활동 유형" name="category" value={kind} onChange={e=>{setKind(e.target.value as PhotoCategory);setPreserveLegacy(false);}}>{PHOTO_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
 {kind==='regular'&&<><label>기수<select aria-label="기수" name={season==='new'?undefined:'cohort'} value={season} onChange={e=>setSeason(e.target.value)}>{options.map(n=><option key={n} value={n}>{n}기 / Season {n}</option>)}<option value="new">새 기수 직접 입력</option></select></label>{season==='new'&&<label>새 기수<input aria-label="새 기수" type="number" name="cohort" min={1} max={32767} step={1} required/></label>}</>}</>;
}
export function classificationForm(data:FormData){if(data.get('preserveClassification')==='1')return {};return {category:String(data.get('category')),cohort:data.get('category')==='regular'?Number(data.get('cohort')):null};}
