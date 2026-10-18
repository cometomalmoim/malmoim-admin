import Image from 'next/image';
export function HalloweenDokkaebi({english=false}:{english?:boolean}){
 return <Image className="hw-dokkaebi" src="/events/halloween-2026/dokkaebi-cinematic-v2.png" width={1024} height={1024} loading="eager" sizes="(max-width: 500px) 280px, 410px" alt={english?'A horned Halloween goblin emerging from crimson fog':'붉은 안개 속에서 나타나는 뿔 달린 할로윈 도깨비'}/>;
}
