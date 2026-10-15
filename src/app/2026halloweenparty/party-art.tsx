export function PartyArt({ title = "호박과 유령이 함께하는 할로윈 파티 일러스트" }: { title?: string }) {
  return <svg className="hw-art" viewBox="0 0 600 560" role="img" aria-labelledby="hw-art-title"><title id="hw-art-title">{title}</title>
    <circle cx="310" cy="270" r="220" fill="#fbbc18"/><circle cx="405" cy="135" r="54" fill="#fff4d6"/>
    <path d="m90 100 8 23 23 8-23 8-8 23-8-23-23-8 23-8Z M500 335l7 19 19 7-19 7-7 19-7-19-19-7 19-7Z" fill="#31bbc5"/>
    <path d="m248 166 19-47 23 12-6 48" fill="#087f8c" stroke="#191821" strokeWidth="8" strokeLinejoin="round"/>
    <ellipse cx="270" cy="298" rx="166" ry="141" fill="#f18035" stroke="#191821" strokeWidth="8"/>
    <ellipse cx="270" cy="298" rx="114" ry="141" fill="#ff9e36" stroke="#191821" strokeWidth="6"/>
    <ellipse cx="270" cy="298" rx="56" ry="141" fill="#ffb83f" stroke="#191821" strokeWidth="6"/>
    <path d="m174 266 41-35 24 45Z m151 10 24-45 41 35Z" fill="#191821"/>
    <path d="M177 319q93 128 186 0l-43 11-7 28-32-5-13-24-22 24-31-5-8-24Z" fill="#191821"/>
    <path d="M387 239c0-78 116-78 116 0v135l-27-20-31 23-28-22-30 19Z" fill="#fff9ee" stroke="#191821" strokeWidth="7" strokeLinejoin="round"/>
    <ellipse cx="426" cy="240" rx="8" ry="13" fill="#191821"/><ellipse cx="465" cy="240" rx="8" ry="13" fill="#191821"/><path d="M433 270q13 14 25 0" stroke="#191821" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <path d="m123 412 8 20 22 3-17 15 5 22-19-12-19 11 5-22-16-15 22-2Z" fill="#31bbc5" stroke="#191821" strokeWidth="5"/>
    <g transform="rotate(-12 440 440)"><rect x="356" y="408" width="170" height="58" rx="10" fill="#087f8c" stroke="#191821" strokeWidth="5"/><text x="441" y="446" textAnchor="middle" fill="white" fontSize="25" fontWeight="900">LET’S MEET!</text></g>
    <path d="m157 74 16 9m322 37 14-12M73 329l-17 7m406 153 9 15" stroke="#fff9ee" strokeWidth="7" strokeLinecap="round"/>
  </svg>;
}
