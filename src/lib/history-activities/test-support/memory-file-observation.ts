import "server-only";
import type { EvidenceBinding } from "../upload-evidence";
import type { FileTrackingRecord, FileObservation, FileObservationAdapters, StorageFileSnapshot } from "../file-observation";

/** TEST ONLY: heap durability and reliable generation changes are simulations.
 * No Storage/DB/network access, file deletion or real server authentication. */
export function createMemoryFileObservationLab(initial:FileTrackingRecord[]){
  if(process.env.NODE_ENV!=="test")throw new Error("File observation lab is test-only");
  const clone=<T>(value:T):T=>structuredClone(value);
  const states=new Map(initial.map(r=>[`${r.binding.requestId}:${r.binding.slot}`,clone(r)]));
  const files=new Map<string,StorageFileSnapshot['file']>();const generations=new Map<string,number>();
  const observations:FileObservation[]=[];const handles=new WeakSet<object>();let time=1000;
  const key=(b:EvidenceBinding)=>`${b.bucket}:${b.path}`;
  const adapters:FileObservationAdapters={
    async authorize(context){return context&&typeof context==='object'&&handles.has(context)?{subject:'mock-observer',capability:'observe_activity_files'}:null;},
    now:()=>time,
    records:{async get(id,slot){return clone(states.get(`${id}:${slot}`)??null);},
      async tracked(){return clone([...states.values()]);},
      async append(expected,observation){
        const state=states.get(`${expected.binding.requestId}:${expected.binding.slot}`);
        if(!state || JSON.stringify(state)!==JSON.stringify(expected) || observation.generation!==String(generations.get(key(state.binding))??0) ||
          time-observation.checkedAt>5000)return false;
        observations.push(clone(observation));
        // Never drop tombstones, even on absence/expired permits. New file => review.
        states.set(`${state.binding.requestId}:${state.binding.slot}`,{...state,revision:state.revision+1,needsRecheck:true});return true;
      }},
    storage:{async inspect(binding){return {binding:clone(binding),generation:String(generations.get(key(binding))??0),observedAt:time,file:clone(files.get(key(binding))??null)};}},
  };
  return {adapters,
    authorize(){const handle=Object.freeze({});handles.add(handle);return handle;},
    put(binding:EvidenceBinding,file:StorageFileSnapshot['file']){files.set(key(binding),clone(file));generations.set(key(binding),(generations.get(key(binding))??0)+1);},
    deleteIntent(requestId:string,slot:number){const k=`${requestId}:${slot}`;const state=states.get(k);if(!state)throw Error('Unknown mock record');states.set(k,{...state,revision:state.revision+1,deleteRequested:true,tombstone:true,needsRecheck:true});},
    advance(ms:number){time+=ms;},
    observations(){return clone(observations);},
    exists(binding:EvidenceBinding){return files.get(key(binding))!=null;},
  };
}
