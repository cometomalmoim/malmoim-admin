import 'server-only';
import {createVercelPhotoOperationClient,type PhotoClientOptions} from './vercel-photo-client';
/** Explicit operator opt-in; settings alone do not authenticate the broker or its dependencies. */
export function photoRuntime(env:NodeJS.ProcessEnv=process.env){
 if(env.HISTORY_PHOTO_ENABLED!=='true'||env.HISTORY_PHOTO_CONNECTION_REVIEWED!=='true')return null;
 const required=['HISTORY_PHOTO_BROKER_ORIGIN','HISTORY_PHOTO_STORAGE_ORIGIN','HISTORY_PHOTO_OIDC_ISSUER','HISTORY_PHOTO_OIDC_AUDIENCE','HISTORY_PHOTO_OIDC_PROJECT_ID','HISTORY_PHOTO_OIDC_OWNER_ID','HISTORY_PHOTO_OIDC_SUBJECT','HISTORY_PHOTO_OIDC_ENVIRONMENT'] as const;
 if(required.some(k=>!env[k])||!['preview','production'].includes(env.HISTORY_PHOTO_OIDC_ENVIRONMENT??''))return null;
 const policy={issuer:env.HISTORY_PHOTO_OIDC_ISSUER!,audience:env.HISTORY_PHOTO_OIDC_AUDIENCE!,projectId:env.HISTORY_PHOTO_OIDC_PROJECT_ID!,ownerId:env.HISTORY_PHOTO_OIDC_OWNER_ID!,subject:env.HISTORY_PHOTO_OIDC_SUBJECT!,environment:env.HISTORY_PHOTO_OIDC_ENVIRONMENT as 'preview'|'production',maxAgeSeconds:3600,maxLifetimeSeconds:7200};
 const options:PhotoClientOptions={brokerOrigin:env.HISTORY_PHOTO_BROKER_ORIGIN!,storageOrigin:env.HISTORY_PHOTO_STORAGE_ORIGIN!,jwksUrl:policy.issuer.replace(/\/$/,'')+'/.well-known/jwks',policy,operationsReviewed:true};
 try{for(const s of [options.brokerOrigin,options.storageOrigin]){const u=new URL(s);if(u.protocol!=='https:'||u.origin!==s||u.username||u.password)return null;}return {client:createVercelPhotoOperationClient(options),storageOrigin:options.storageOrigin};}catch{return null;}
}
