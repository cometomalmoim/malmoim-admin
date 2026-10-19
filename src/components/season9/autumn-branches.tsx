function MapleLeaf({x,y,angle=0,color='#c66a35',scale=1}:{x:number;y:number;angle?:number;color?:string;scale?:number}){
 return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}><path d="m0-43 9 25 17-13-3 25 22-5-14 22 15 9-32 16-10 21-4-22-31-14 14-12-18-19 24 2-3-23 15 12Z" fill={color}/><path d="M0-28 0 45M0 4-21-9M0 15 24-4" stroke="#fff0c8" strokeWidth="1.5" fill="none"/></g>;
}
function GinkgoLeaf({x,y,angle=0,scale=1}:{x:number;y:number;angle?:number;scale?:number}){
 return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}><path d="M0 27C-10 12-33 10-44-13c9-20 25-28 40-22L0-23l5-12c18-6 33 5 40 23C31 10 10 13 0 27Z" fill="#edbd32"/><path d="M0 45V26M0 26-32-17M0 26-15-29M0 26 16-29M0 26 33-15" stroke="#c28f25" strokeWidth="1.4" fill="none"/></g>;
}
export function AutumnBranches(){
 return <div className="s9-autumn-branches" aria-hidden="true">
  <svg className="s9-maple-branch" viewBox="0 0 240 500" fill="none"><path d="M45 510Q68 330 100 186T114-15M75 340q50-25 105-88M92 220q55-24 108-100M105 110q42-14 94-73M69 391q31-3 102-42" stroke="#a77d4e" strokeWidth="4" strokeLinecap="round"/>
   <MapleLeaf x={201} y={49} angle={32} scale={.9}/><MapleLeaf x={159} y={91} angle={-26} color="#dc953a" scale={.7}/><MapleLeaf x={202} y={143} angle={45} color="#c85533"/><MapleLeaf x={145} y={193} angle={-18} color="#e7ac43" scale={.7}/><MapleLeaf x={181} y={258} angle={54} scale={.9}/><MapleLeaf x={119} y={310} angle={-30} color="#dca33d" scale={.65}/><MapleLeaf x={173} y={353} angle={30} color="#c85533" scale={.8}/>
  </svg>
  <svg className="s9-ginkgo-branch" viewBox="0 0 240 500" fill="none"><path d="M45 510Q68 330 100 186T114-15M75 340q50-25 105-88M92 220q55-24 108-100M105 110q42-14 94-73M69 391q31-3 102-42" stroke="#a1884d" strokeWidth="4" strokeLinecap="round"/>
   <GinkgoLeaf x={199} y={48} angle={36} scale={.92}/><GinkgoLeaf x={150} y={98} angle={-16} scale={.72}/><GinkgoLeaf x={197} y={152} angle={38}/><GinkgoLeaf x={142} y={209} angle={-24} scale={.7}/><GinkgoLeaf x={184} y={266} angle={36} scale={.9}/><GinkgoLeaf x={122} y={309} angle={-27} scale={.65}/><GinkgoLeaf x={173} y={357} angle={32} scale={.8}/>
  </svg>
 </div>;
}
