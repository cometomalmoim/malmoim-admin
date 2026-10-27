'use client';
import {useId,useState} from 'react';
import {season9OptionalGenders} from '@/lib/season9-gender';
export function GenderField({english=false}:{english?:boolean}){
 const [value,setValue]=useState('');const id=useId();
 return <fieldset className="s9-optional-gender"><legend>{english?'Gender (optional)':'성별 (선택)'}</legend><label htmlFor={id} className="s9-visually-hidden">{english?'Gender':'성별'}</label><select id={id} name="gender" value={value} onChange={event=>setValue(event.target.value)}><option value="">{english?'Select (optional)':'선택하지 않아도 됩니다'}</option>{season9OptionalGenders.map(item=><option key={item.value} value={item.value}>{english?item.en:item.ko}</option>)}</select>{value==='self_describe'&&<label htmlFor={`${id}-description`}>{english?'Describe in your own words (optional)':'성별을 직접 입력해주세요 (선택)'}<input id={`${id}-description`} name="gender_description" maxLength={35} autoComplete="off"/></label>}<small>{english?'You can leave this blank or choose “Prefer not to say”.':'선택하지 않거나 응답하지 않아도 신청할 수 있어요.'}</small></fieldset>;
}
