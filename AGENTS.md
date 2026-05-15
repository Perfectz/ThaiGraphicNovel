# Project Instructions

## Completion Gate

Do not tell the user a task is complete until the relevant verification has been run.

For code, UI, API, voice, asset, or gameplay changes, run the strongest practical checks before the final response:

- Run `npm run build` after source changes.
- Run focused tests for the touched system, such as `npm run test:whisper` for Whisper or pronunciation changes.
- For browser-visible UI/gameplay changes, open the app at `http://127.0.0.1:5188/` and verify the changed flow in the browser.
- For Realtime or Whisper work, verify the local service health endpoints through the Vite app:
  - `http://127.0.0.1:5188/api/realtime/health`
  - `http://127.0.0.1:5188/api/whisper/health`
- If a service is required, start or restart it before testing:
  - `npm run realtime:session`
  - `npm run whisper:service`

If a check cannot be run, say exactly which check was skipped and why. Do not imply the work is fully verified when any required check is missing.

## Secrets

Never print, commit, or persist real OpenAI API keys. Use the in-app settings or local environment only, and report key status without revealing the key.
