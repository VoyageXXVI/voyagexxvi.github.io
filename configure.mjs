import {writeFileSync} from 'node:fs';
const url = new URL(process.env.SUPABASE_URL);
const key = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.port || url.username || url.password) {
  throw Error('Use the HTTPS project URL from the Supabase Connect dialog.');
}
function isPublicKey(value) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  try {
    return value.split('.').length === 3 && JSON.parse(Buffer.from(value.split('.')[1], 'base64url')).role === 'anon';
  } catch { return false; }
}
if (!isPublicKey(key)) throw Error('Use a publishable key or legacy anon key.');
writeFileSync(new URL('../dist/config.js', import.meta.url), 'window.VOYAGE_CONFIG=' + JSON.stringify({
  url: url.origin, key, google: process.env.VOYAGE_GOOGLE_OAUTH === 'true'
}) + ';\n');
