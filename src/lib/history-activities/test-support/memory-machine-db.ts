/** TEST ONLY. This adapter cannot establish a connection and is never durable. */
import type { DbRow, PhotoPool, PhotoTransaction } from "../server-db";
export function createMemoryMachineDriver(audit: DbRow) {
  const claims=new Map<string,readonly unknown[]>();
  const calls:{sql:string;values:readonly unknown[]}[]=[];
  let queue=Promise.resolve();let opens=0;let closes=0;let loseCommit=false;
  return {
    calls,claims,
    get opens(){return opens;},get closes(){return closes;},
    loseNextCommitResponse(){loseCommit=true;},
    driver:{async open():Promise<PhotoPool>{opens++;let closed=false;
      return {async transaction<T>(work:(tx:PhotoTransaction)=>Promise<T>):Promise<T>{
        if(closed)throw Error("Pool closed");
        let live=true;let release!:()=>void;const previous=queue;queue=new Promise<void>(r=>{release=r;});await previous;
        const pending=new Map(claims);
        try{
          const answer=await work({async query(sql,values){if(!live)throw Error("Transaction closed");calls.push({sql,values});
            if(sql.startsWith("SELECT current_user"))return [{...audit}];
            if(sql!=="SELECT photo_finish_v2.commit($1::jsonb) AS completion")throw Error("Unexpected query");
            const c=JSON.parse(String(values[0]));const request=c.requestId;if(pending.has(request)||c.revision!==0)throw Object.assign(Error("Receipt or CAS rejected"),{code:"P0001"});
            pending.set(request,[...values]);return [{completion:""}];
          }});
          claims.clear();for(const [key,value] of pending)claims.set(key,value);
          if(loseCommit){loseCommit=false;throw Error("Simulated lost commit response");}
          return answer;
        }finally{live=false;release();}
      },async close(){if(!closed){closed=true;closes++;}}};
    }},
  };
}
