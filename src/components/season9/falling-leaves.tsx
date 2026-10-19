'use client';

import { useState } from 'react';

export function FallingLeaves({ english = false }: { english?: boolean }) {
 const [enabled, setEnabled] = useState(true);
 return <div className="s9-falling-leaves">
  {enabled && <div aria-hidden="true" className="s9-leaf-particles">{Array.from({ length: 6 }, (_, index) => <span key={index} className={`s9-falling-leaf leaf-${index}`}><svg viewBox="0 0 32 40"><path d="M16 2 21 11 29 8 26 19 32 22 20 30 17 39 14 30 2 25 8 20 4 10 13 13Z" fill="currentColor"/><path d="M16 8 17 34" stroke="#fff8e6" strokeWidth="1"/></svg></span>)}</div>}
  <button type="button" aria-pressed={enabled} onClick={() => setEnabled(value => !value)}>{english ? `Leaf effect ${enabled ? 'off' : 'on'}` : `낙엽 효과 ${enabled ? '끄기' : '켜기'}`}</button>
 </div>;
}
