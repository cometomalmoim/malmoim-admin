import { validDate } from './schedule-calendar.ts';
export function scheduleInput(data: FormData) {
  const title=String(data.get('title')??'').trim(), start_date=String(data.get('start_date')??''), end_date=String(data.get('end_date')??''), notes=String(data.get('notes')??'').trim();
  const tag_id=String(data.get('tag_id')??''), assignee_id=String(data.get('assignee_id')??'')||null;
  if(!title||title.length>150||!validDate(start_date)||!validDate(end_date)||start_date>end_date||notes.length>5000||!tag_id) throw new Error('제목, 날짜 범위, 태그 및 비고를 확인해주세요.');
  return {title,start_date,end_date,notes,tag_id,assignee_id};
}
