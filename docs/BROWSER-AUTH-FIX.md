# Browser Auth and public API review — 2026-10-08

Normal page modules now obtain the same Supabase client from `IUHCore.getClient()`.
The runtime also publishes the legacy `IUH_SUPABASE` alias and survives repeated script loading.
All HTML entry points load the pinned local SDK and shared runtime before their consumers.
Password recovery intentionally retains its separate, nonpersistent client and storage key;
recovery credentials must never replace a normal browsing session.

Public page identity reads use `IUHCore.getUser()`. No session means an ordinary guest,
without calling Auth.getUser or logging AuthSessionMissingError. Signed-in identity is
still verified by Auth.getUser; getSession is not an authorization decision. Concurrent
identity requests share an in-flight request. A session change during verification
discards the old identity, and genuine Auth/network errors remain errors.
UI auth subscribers that may call Auth are deferred outside the SDK auth lock.
Synchronous cache invalidation subscribers remain synchronous.

Removed diagnostic product/profile/auth dumps from browser scripts. The API URL,
publishable key, public product data and seller identifiers remain visible to browsers.
These are not secret credentials. Hiding Console output is not access control; API
authorization still belongs to database policies and authenticated RPC checks.

Read-only checks against the connected Supabase project confirmed that authenticated
users cannot update `users.role` or directly insert `users` rows. No public table readable
by anon/authenticated was found with RLS disabled. These checks are limited evidence,
not a claim that every policy and RPC has received a complete security audit.
The frontend scan checks for Supabase secret keys and service-role JWTs.

Regression coverage includes singleton creation, guests, concurrent verified reads,
signout during verification, retry after errors, auth callback scheduling/unsubscribe,
script ordering, and public logging/credential checks. Existing UI fixtures now load
the shared runtime. Signup fixtures were updated to the current card-free signup flow,
including validation, duplicate submission, email confirmation and failure retries.

No database migration is required for this frontend fix. Live deployment/browser
verification is separate from the local test suite and read-only database checks.
