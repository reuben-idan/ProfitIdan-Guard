# Deploy the backend API on Render (free tier)

Blueprint is [render.yaml](../render.yaml). The API serves the demo data
from the repo plus any sessions uploaded at runtime.

## Steps

1. Push this repo to GitHub (`git push origin main` from your own shell).
2. Render dashboard -> New -> Blueprint -> select `ProfitIdan-Guard`.
3. When prompted for `MODEL_API_KEY`, paste the Meta Model API key.
   `MODEL_NAME` and `META_API_BASE_URL` come from the blueprint.
4. Deploy. Note the service URL, e.g.
   `https://profitpilot-api.onrender.com`. Check `/health`.
5. CORS is preconfigured: any `https://*.vercel.app` origin is accepted
   via `CORS_ORIGIN_REGEX`, so production and preview deployments work
   without changes. Only if you serve the frontend from a custom domain,
   add it to `CORS_ORIGINS` on the Render service (comma-separated if
   several), then redeploy the service.
6. On the Vercel project, set `NEXT_PUBLIC_API_URL` to the Render service
   URL (no trailing slash) and redeploy the frontend.

## Free-tier limits (know before demo day)

- The service sleeps after ~15 minutes idle; the first request after sleep
  takes up to a minute. Warm it by opening `/health` before the demo.
- The SQLite DB and uploaded sessions are ephemeral: restarts wipe
  investigations, actions, and audit history. The repo-shipped demo data
  is unaffected, and a fresh investigation always works.
- Paid upgrade path if needed: Render persistent disk for the SQLite file,
  or move the store to Postgres.

## Verify

- `GET <render-url>/health` -> `{"status": "ok"}`
- `GET <render-url>/docs` -> API docs in a browser
- From the Vercel frontend: run the demo question end to end.

## If Full AI investigation fails

- Open the `profitpilot-api` service -> Environment: `MODEL_API_KEY`
  must be set there (the blueprint prompt alone is not enough if it was
  skipped). Paste the key with no quotes or surrounding whitespace.
- After any env change: click **Save Changes**, then **Manual Deploy** ->
  **Deploy latest commit**. The service must restart to pick up new vars.
- If it still fails, the app now reports the reason instead of a CORS
  error: a `502` names what the model API returned, and the Render
  **Logs** tab shows the backend line. `MODEL_NAME` and
  `META_API_BASE_URL` only need changing if Meta instructs otherwise.
