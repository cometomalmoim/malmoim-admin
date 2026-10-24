import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import nextEnv from '@next/env';
import {resolveExternalAccountKey,EXTERNAL_ACCOUNT_KEY_NAME} from '../src/lib/external-account-key.mjs';

// Reuse Next's loader so existing .env.local/.env values and quoting are respected.
if(process.env.NODE_ENV==='production')throw new Error('Run this initializer only for development. Configure production secrets in the hosting environment.');
nextEnv.loadEnvConfig(process.cwd(),true);
const configured=process.env[EXTERNAL_ACCOUNT_KEY_NAME]?.trim();
const key=resolveExternalAccountKey({env:{...process.env,NODE_ENV:'development'}});
if(configured) {
  console.log(`${EXTERNAL_ACCOUNT_KEY_NAME} is already configured and valid; preserved without rotation.`);
} else {
  const path=join(process.cwd(),'.env.local');
  let content=existsSync(path)?readFileSync(path,'utf8'):'';
  const assignment=new RegExp(`^\\s*(?:export\\s+)?${EXTERNAL_ACCOUNT_KEY_NAME}\\s*=.*$`,'m');
  const line=`${EXTERNAL_ACCOUNT_KEY_NAME}=${key.toString('hex')}`;
  content=assignment.test(content)?content.replace(assignment,line):content.replace(/\s*$/,'')+'\n\n# Server-only external account encryption key. Do not commit or rotate without migration.\n'+line+'\n';
  writeFileSync(path,content,{mode:0o600});
  console.log(`${EXTERNAL_ACCOUNT_KEY_NAME} was configured in .env.local. Secret value was not printed. Restart npm run dev.`);
}
