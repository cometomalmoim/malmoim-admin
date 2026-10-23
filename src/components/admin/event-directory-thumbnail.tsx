"use client";
export function EventDirectoryThumbnail({src}:{src?:string|null}) {
 const safe=src && ((src.startsWith('/')&&!src.startsWith('//'))||src.startsWith('https://'));
 return <span className="event-card-thumbnail" aria-hidden="true"><span>M</span>{safe && (
  // Event posters retain their original ratio inside a small decorative thumbnail.
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src!} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event=>{event.currentTarget.hidden=true;}}/>
 )}</span>;
}
