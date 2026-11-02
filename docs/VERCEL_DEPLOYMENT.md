# Private Vercel test deployment — Task 01.5

Use the existing `trix3n/AI-Dubbing-Studio` repository. No database, worker, storage, paid API, or paid plan is needed for this demo. Vercel's Hobby plan is intended for personal/noncommercial use; confirm eligibility and stay on the free plan. Do not enable paid add-ons.

## Browser-only owner steps

1. Sign in at https://vercel.com using your GitHub account.
2. Choose **Add New → Project**, authorize access to `trix3n/AI-Dubbing-Studio` if prompted, and choose **Import**.
3. Keep the framework as **Next.js**, Root Directory as the repository root, Node.js **24.x**, install command `npm ci`, and build command `npm run build`. Keep the default output directory.
4. Before deploying, expand **Environment Variables** and add `STUDIO_ACCESS_PASSWORD`. Generate a unique password with at least 16 characters using your password manager. Apply it to Production and Preview. Do not use a `NEXT_PUBLIC_` prefix and do not send the password in chat. No API keys are required.
5. Click **Deploy**. After the deployment reaches **Ready**, click **Visit** and copy the exact HTTPS address Vercel provides. Do not infer the URL from the project name.
6. The browser will request credentials: username `longray`, password from step 4. If Vercel also requests a Vercel login, sign in as the project owner; keep Deployment Protection enabled where available. No sharing/bypass link is needed.
7. In a private browser window without credentials, confirm the app does not open. Cancel the login dialog: the request should return authentication required. The site must not reveal the editor or static assets without credentials.
8. Confirm editing, browser-local save/restore, voice selection, media playback and SRT export in Safari or Chrome on your Mac. Saved projects belong to that browser and URL; they are not cloud backups.

If you forgot the variable, the app returns 503 rather than becoming public. Set it under **Project → Settings → Environment Variables**, then open **Deployments**, choose the latest deployment and **Redeploy**. Changes to environment variables require redeployment. To change the password, update it and redeploy; archive/delete older deployments that still use the old password.

## Access protection

`src/proxy.ts` protects every request, including Next.js assets, with server-side HTTP Basic authentication. Password comparison uses fixed-length SHA-256 digests and constant-time comparison. Missing/short passwords fail closed when Vercel's system variable `VERCEL=1` is present. Keep Vercel system environment variables enabled (the default). Responses are private/no-store and noindex. Use only HTTPS. This is a minimal gate for a personal demo; production session authentication, rate limiting and ownership checks remain future scope. Browsers can retain Basic credentials until the browser session is closed.

## Verification and limits

Run typecheck, lint, unit tests and production build before deploying. Browser tests can use the production server via `E2E_SERVER_COMMAND='npm start' npm run test:e2e`; this starts a server solely for automated validation, not presentation. No screenshots, videos or visual previews are part of Task 01.5.

No provider calls occur. Local media, edits and subtitle export work; recognition, machine translation, voice preview audio, WAV/MP4 generation and background jobs remain unavailable. No real media is uploaded to Vercel by this UI.
