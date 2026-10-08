# Turnstile activation

The public Site Key `0x4AAAAAAFRZdAHQ487-gx99` is configured in `JS/auth-captcha.js`.
The signup, password login and recovery-email forms send `captchaToken` to Supabase
Auth. Tokens are consumed once locally and reset after each attempt; missing,
expired or failed challenges block form submission. Network/script failures show a
retry control. Server verification is performed by Supabase, not this JavaScript.

## Required dashboard steps

1. Cloudflare Turnstile: allow hostname `passitt.vercel.app`, use Managed mode.
2. Deploy the frontend and confirm that all three forms display and solve Turnstile.
3. Supabase Authentication > Bot and Abuse Protection (or Attack Protection): enable
   CAPTCHA, select Turnstile, enter the matching **Secret Key**, and save.
   Do not put the Secret Key in frontend code, Git, or chat.
4. Check email delivery/SMTP, then enable Confirm email in Authentication settings.
   At the previous read-only check, `mailer_autoconfirm` was true. Existing users
   marked confirmed by that setting are not retroactively verified or removed.
5. Review Auth rate limits appropriate for expected traffic. CAPTCHA and email
   confirmation reduce abuse; neither guarantees all spam is eliminated.

Enabling CAPTCHA before deploying the forms can block legitimate login/signup/reset
requests. The frontend alone does not prevent direct API abuse. No SQL migration is
required, and this commit does not change hosted Auth configuration or delete users.

## Verification

- Test missing, expired and failed CAPTCHA; Auth requests must not be sent by the form.
- Test successful signup/email confirmation, login, and password recovery in a real
  browser. Local automated tests mock Cloudflare; they do not prove live Site Key or
  Secret Key pairing.
- After enabling protection, verify Auth rejects a request with no/invalid CAPTCHA
  before considering the anti-bot protection active.

References: https://supabase.com/docs/guides/auth/auth-captcha and
https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/.
