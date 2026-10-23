import type {ActivityStorageCommand,StoredActivity} from './activity-storage';
import {activityPhotoPolicy} from './photo-policy';
/** UI validation only; the trusted SQL transaction rechecks membership, CAS and state. */
export function layoutCommand(activity:StoredActivity,order:string[],coverId:string,requestId:string):ActivityStorageCommand{
 const expected=activity.order;
 if(activity.source!=='independent-storage'||!Number.isSafeInteger(activity.revision)||activity.revision<0||activity.revision>=Number.MAX_SAFE_INTEGER||expected.length<1||expected.length>activityPhotoPolicy.maxFiles||new Set(expected).size!==expected.length||activity.photos.length!==expected.length||activity.photos.some(p=>p.state!=='final'||p.deletePending||!expected.includes(p.id))||new Set(activity.photos.map(p=>p.id)).size!==expected.length||order.length!==expected.length||new Set(order).size!==order.length||order.some(id=>!expected.includes(id))||!order.includes(coverId))throw Error('해당 활동의 확정 사진을 중복·누락 없이 지정해주세요.');
 return {operation:'layout',requestId,activityId:activity.id,revision:activity.revision,order:[...order],coverId};
}
export function moveLayoutPhoto(order:string[],id:string,step:-1|1){const next=[...order],index=next.indexOf(id);if(index<0||index+step<0||index+step>=next.length)return next;[next[index],next[index+step]]=[next[index+step],next[index]];return next;}
export function savedLayoutMatches(saved:StoredActivity|undefined,previous:StoredActivity,order:string[],coverId:string){return !!saved&&saved.id===previous.id&&saved.revision===previous.revision+1&&saved.published===previous.published&&saved.coverId===coverId&&saved.order.length===order.length&&saved.order.every((id,i)=>id===order[i]);}
