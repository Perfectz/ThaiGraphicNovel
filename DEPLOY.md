# Deploying the Demo

The repo ships configs for **three** zero-effort deploy targets — pick whichever you already have an account on. All three serve `dist/` as a static site after `npm run build`.

## Quick decision tree

| You want… | Use |
|---|---|
| Best DX, free tier, custom domains, instant rollbacks | **Vercel** |
| Same as Vercel, slightly different UI, also free | **Netlify** |
| Truly free forever, lives at `<user>.github.io/<repo>`, no account beyond GitHub | **GitHub Pages** |

You can ship to all three at once — they're not mutually exclusive.

---

## Vercel

1. Push the repo to GitHub.
2. [vercel.com/new](https://vercel.com/new) → Import this repo.
3. Vercel reads `vercel.json` automatically — no dashboard config needed.
4. (Optional) Add `OPENAI_API_KEY` under Settings → Environment Variables if you want Realtime mode to work for visitors without their own key. Set scope to Production + Preview.
5. (Optional) Connect a custom domain under Settings → Domains.

Build settings are inferred from `vercel.json` (`vite` framework, `npm run build`, `dist/` output). Hashed assets get a 1-year `Cache-Control`; `index.html` gets `must-revalidate` so deploys roll out instantly.

---

## Netlify

1. Push the repo to GitHub.
2. [app.netlify.com](https://app.netlify.com) → Add new site → Import from Git → pick the repo.
3. Netlify reads `netlify.toml` automatically.
4. (Optional) Add `OPENAI_API_KEY` under Site settings → Environment variables.
5. (Optional) Connect a custom domain under Site settings → Domain management.

Same caching strategy as Vercel. SPA fallback is configured so every path serves `index.html`.

---

## GitHub Pages

1. Push the repo to GitHub.
2. Settings → Pages → Source = "GitHub Actions".
3. The workflow at [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) runs on every push to `main` and deploys automatically.
4. Site is served at `https://<your-user>.github.io/<repo-name>/`.

⚠️ **Realtime voice mode won't work on GitHub Pages** — Pages is static-only and can't run `server/realtime-session.mjs`. Visitors will use Whisper or No-mic mode. (Vercel and Netlify support serverless functions; if you need Realtime in production, port the relay to a serverless function and use one of those instead.)

If you're deploying to a project repo (`<user>.github.io/<repo>/`), the workflow already sets `VITE_BASE_PATH` correctly. If you're deploying to a user/org apex repo (`<user>.github.io/`), edit the workflow to set `VITE_BASE_PATH="/"`.

---

## After deploying

1. Open the deploy URL in an incognito window — first impression matters.
2. Check the share preview by pasting the URL into Slack / Discord / a tweet draft. You should see the OG card from `public/og-card.png`.
   - Need to regenerate the OG card? `npm run promo:og-card` (see `scripts/generate-og-card.mjs`).
3. Run `npm run test:multi-engine -- --base https://your-url.example.com` to smoke the deployed build across Chromium / Firefox / WebKit.
4. Update the `feedbackMailto` link in [`src/components/DemoEndSplash.tsx`](src/components/DemoEndSplash.tsx) and the `StageErrorBoundary.tsx` mailto if you want feedback to go somewhere other than the placeholder.

## What about Realtime mode in production?

Three options:

1. **No-mic only.** Set `voiceJudgeMode = 'no-mic'` as the default. Smallest infra. Most accessible.
2. **Whisper only.** Local Whisper runs entirely in the browser. No backend needed. First load is ~75 MB for the model.
3. **Realtime + Whisper + No-mic.** Deploy `server/realtime-session.mjs` as a serverless function (Vercel Functions / Netlify Functions / Fly.io / Cloud Run) with `OPENAI_API_KEY` set. Visitors who want Realtime get it; everyone else falls through to Whisper / No-mic.

Option 3 needs a few minutes of porting work since the relay is a plain Node HTTP server, not a serverless handler. The mic-denied auto-fallback in `Stage3DAdventure.tsx` means options 1 and 2 don't strand any users.
