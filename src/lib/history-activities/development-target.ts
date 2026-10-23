/** Exact local development boundary. No environment values, credentials or IO. */
export function isPhotoLabRequest(nodeEnv:string|undefined,host:string|null|undefined){
 return nodeEnv==='development'&&host==='127.0.0.1:3004';
}
