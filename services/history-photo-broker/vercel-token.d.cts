export function createPhotoVercelTokenProvider(loadSdk?:()=>Promise<Pick<typeof import('@vercel/oidc'),'getVercelOidcToken'>>):()=>Promise<string>;
export function getPhotoVercelOidcToken():Promise<string>;
