'use client';
/* eslint-disable @next/next/no-img-element -- Local blob previews and authenticated image endpoint. */
import { useEffect, useRef, useState } from 'react';
import { boardImageUrl, BOARD_IMAGE_COUNT, BOARD_IMAGE_TOTAL } from '@/lib/board-images';
import { PHOTO_LIMIT } from '@/lib/people-photo';
function Thumbnail({ file }: { file: File }) {
  const preview = useRef<HTMLImageElement>(null);
  useEffect(() => { const url = URL.createObjectURL(file); if (preview.current) preview.current.src = url; return () => URL.revokeObjectURL(url); }, [file]);
  return <img ref={preview} alt={file.name}/>;
}
export function BoardImageInput({ images = [] }: { images?: string[] }) {
  const [retained, setRetained] = useState(images);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  function select(incoming: File[]) {
    const next = [...files, ...incoming];
    if (next.length + retained.length > BOARD_IMAGE_COUNT || next.reduce((n, f) => n + f.size, 0) > BOARD_IMAGE_TOTAL || next.some(f => !['image/jpeg','image/png','image/webp'].includes(f.type) || f.size > PHOTO_LIMIT)) {
      setMessage('JPG·PNG·WebP 최대 4장, 파일당 3MB, 새 파일 합계 4MB까지 가능합니다.'); return;
    }
    setFiles(next); setMessage('');
  }
  // File selection state is copied into FormData by the enclosing post form.
  useEffect(() => { if (input.current) { const transfer = new DataTransfer(); files.forEach(f => transfer.items.add(f)); input.current.files = transfer.files; } }, [files]);
  return <div className="board-image-input"><label>이미지 첨부<input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-describedby="board-image-help" onChange={e => { select(Array.from(e.target.files ?? [])); e.target.value = ''; }}/></label><input ref={input} type="file" name="images" multiple hidden/><p id="board-image-help">최대 4장 · 파일당 3MB · 새 첨부 합계 4MB (JPG, PNG, WebP)</p>{message && <p role="alert">{message}</p>}<div className="board-thumbnails">{retained.map((path, index) => <div key={path}><input type="hidden" name="retained_images" value={path}/><img src={boardImageUrl(path)} alt={`첨부 이미지 ${index + 1}`}/><button type="button" onClick={() => setRetained(retained.filter(p => p !== path))} aria-label={`첨부 이미지 ${index + 1} 삭제`}>✕ 삭제</button></div>)}{files.map((file, index) => <div key={`${index}-${file.name}`}><Thumbnail file={file}/><button type="button" onClick={() => setFiles(files.filter((_, i) => i !== index))} aria-label={`${file.name} 삭제`}>✕ 삭제</button></div>)}</div></div>;
}

