import "server-only";
import type { CompletionAdapters, CompletionState, VerifiedEvidence } from "../upload-evidence";

/** TEST ONLY: opaque object identity simulates trusted authentication/provenance.
 * No cryptographic identity, actual observation or process persistence is provided.
 * Never wire this issuer into an API/production worker. */
export function createMemoryEvidenceLab(initial: CompletionState[]) {
  if (process.env.NODE_ENV !== "test") throw new Error("Evidence lab is test-only");
  const clone = <T>(v:T):T=>structuredClone(v);
  const admins = new WeakMap<object,string>(); const reporters = new WeakMap<object,string>();
  const proofs = new WeakMap<object,{fact:VerifiedEvidence;subject:string}>();
  const states = new Map(initial.map(s=>[`${s.binding.requestId}:${s.binding.slot}`,clone(s)]));
  const consumed = new Set<string>();
  const key = (s:CompletionState)=>`${s.binding.requestId}:${s.binding.slot}`;
  const isObject = (v:unknown):v is object=>typeof v==="object" && v!==null;
  const adapters: CompletionAdapters = {
    administrator:{async verify(context){ const actorId=isObject(context)?admins.get(context):undefined;return actorId?{actorId}:null;}},
    reporter:{async verify(context){ const subjectId=isObject(context)?reporters.get(context):undefined;return subjectId?{subjectId,capability:"completion_report"}:null;}},
    evidence:{async resolve(proof,subject){const entry=isObject(proof)?proofs.get(proof):undefined;return entry?.subject===subject?clone(entry.fact):null;}},
    ledger:{async read(id,slot){const state=states.get(`${id}:${slot}`);return state?clone(state):null;},
      async commit({expected,evidenceIds}){
        const state=states.get(key(expected));
        if(!state || state.revision!==expected.revision || state.deleteRequested || state.phase!=="awaiting_evidence" ||
          JSON.stringify(state)!==JSON.stringify(expected) || evidenceIds.some(id=>consumed.has(id)))return false;
        // One synchronous critical section: no await between recheck/consume/write.
        evidenceIds.forEach(id=>consumed.add(id));
        states.set(key(state),{...clone(state),revision:state.revision+1,phase:"completed"});return true;
      }},
  };
  return {adapters,
    issueAdministrator(actorId:string){const handle=Object.freeze({});admins.set(handle,actorId);return handle;},
    issueReporter(subject:string){const handle=Object.freeze({});reporters.set(handle,subject);return handle;},
    issueEvidence(fact:VerifiedEvidence,subject:string){const handle=Object.freeze({});proofs.set(handle,{fact:clone(fact),subject});return handle;},
    revoke(handle:object){admins.delete(handle);reporters.delete(handle);},
    /** Simulates atomic external mutation; increments version, preserves all binding data. */
    interrupt(id:string,slot:number,change:"timeout"|"delete"|"version"){
      const k=`${id}:${slot}`;const state=states.get(k);if(!state)throw new Error("Missing mock state");
      states.set(k,{...state,revision:state.revision+1,phase:change==="timeout"?"uncertain":state.phase,
        deleteRequested:state.deleteRequested||change==="delete"});
    },
  };
}
