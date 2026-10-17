import { validDate } from './schedule-calendar.ts';
export function scheduleInput(data: FormData) {
  const title=String(data.get('title')??'').trim(), start_date=String(data.get('start_date')??''), end_date=String(data.get('end_date')??''), notes=String(data.get('notes')??'').trim();
  const tag_id=String(data.get('tag_id')??''), assignee_id=String(data.get('assignee_id')??'')||null;
  if(!title||title.length>150||!validDate(start_date)||!validDate(end_date)||start_date>end_date||notes.length>5000||!tag_id) throw new Error('제목, 날짜 범위, 태그 및 비고를 확인해주세요.');
  function time(key:string){const value=String(data.get(key)??'');if(!value)return null;if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('시간은 00:00~23:59 범위로 입력해주세요.');return value;}
  const start_time=time('start_time'),end_time=time('end_time');
  if(start_date===end_date&&start_time&&end_time&&end_time<start_time)throw new Error('끝나는 시간은 시작 시간과 같거나 이후여야 합니다.');
  return {title,start_date,end_date,start_time,end_time,notes,tag_id,assignee_id};
}
