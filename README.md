# Survival Survey Participant Form

Static GitHub Pages form for high-concurrency anonymous survey collection.

Before publishing:

1. Set the deployed Supabase Edge Function URL in `config.js`.
2. Set the Cloudflare Turnstile site key in `config.js`.
3. Add the final GitHub Pages origin to the Edge Function secret `PUBLIC_FORM_ORIGIN`.

No Supabase secret or Turnstile secret belongs in this repository.
