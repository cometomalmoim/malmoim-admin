'use client';
import { useEffect, useState } from 'react';
import { PHOTO_LIMIT } from '@/lib/people-photo';
export function PeoplePhotoInput({ current = '' }: {current?: string}) {
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return <div className="people-photo-upload"><input type="hidden" name="photo_url" value={current}/><div className="people-photo-preview">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {preview || current ? <img src={preview || current} alt="선택한 프로필 사진 미리보기"/> : <span aria-hidden="true">＋</span>}
  </div><label className="people-photo-picker">프로필 사진 업로드<input type="file" name="photo_file" accept="image/jpeg,image/png,image/webp" onChange={event => {
    const file = event.target.files?.[0]; setError('');
    if (!file) { setPreview(''); return; }
    if (file.size > PHOTO_LIMIT || !['image/jpeg','image/png','image/webp'].includes(file.type)) {
      event.target.value = ''; setPreview(''); setError('JPG, PNG, WebP 파일을 3MB 이하로 선택해주세요.'); return;
    }
    // Preview the original file directly, preserving its resolution and encoding.
    setPreview(URL.createObjectURL(file));
  }}/><small>JPG · PNG · WebP, 최대 3MB · 원본 해상도 유지<br/>사진을 선택한 후 저장을 눌러주세요.</small></label>{error && <p role="alert">{error}</p>}</div>;
}
