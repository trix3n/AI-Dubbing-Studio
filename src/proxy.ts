import { NextResponse, type NextRequest } from 'next/server';
import { accessState } from './lib/access';

// Protect every route and static asset. Never place this password in NEXT_PUBLIC_.
export function proxy(request: NextRequest) {
  const state = accessState(request.headers.get('authorization'), process.env.STUDIO_ACCESS_PASSWORD, process.env.VERCEL === '1');
  const response = state === 'allowed' ? NextResponse.next() : new NextResponse(
    state === 'unconfigured' ? 'Private test deployment. The owner must configure STUDIO_ACCESS_PASSWORD (at least 16 characters) and redeploy.' : 'Authentication required.',
    { status: state === 'unconfigured' ? 503 : 401 },
  );
  if (state === 'unauthorized') response.headers.set('WWW-Authenticate', 'Basic realm="LONGRAY Private Studio", charset="UTF-8"');
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}
