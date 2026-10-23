// Optional official server SDK. No token/environment reads at module load, no caching
// or raw Request headers. The deploying application pins @vercel/oidc in its runtime dependencies.
exports.createPhotoVercelTokenProvider=function(loadSdk=()=>import('@vercel/oidc')){
 return async function(){try{const sdk=await loadSdk();const token=await sdk.getVercelOidcToken();if(typeof token!=='string')throw Error();return token;}catch{throw Error('Vercel workload identity unavailable');}};
};
exports.getPhotoVercelOidcToken=exports.createPhotoVercelTokenProvider();
