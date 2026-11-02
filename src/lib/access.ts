import { createHash, timingSafeEqual } from 'node:crypto';

export function accessState(header: string | null, password: string | undefined, hosted: boolean): 'allowed' | 'unauthorized' | 'unconfigured' {
  if (!password || password.length < 16) return hosted || password !== undefined ? 'unconfigured' : 'allowed';
  if (!header?.startsWith('Basic ')) return 'unauthorized';
  const supplied = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(supplied), digest(`longray:${password}`)) ? 'allowed' : 'unauthorized';
}
