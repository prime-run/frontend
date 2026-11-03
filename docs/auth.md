# Authentication in the Cloudreve frontend

This document describes how user authentication works in this SPA. The backend (Cloudreve API, prefix `/api/v4`) issues tokens and enforces access. The frontend stores those tokens, attaches them to requests, and renders the login UI.

Default sign-in is email plus password, with optional captcha, TOTP, and WebAuthn passkeys. Third-party SSO (QQ, Logto, OIDC) is not implemented in this frontend. The admin screen for it is a placeholder that opens a Pro upsell.

## Where the pieces live

| Area | Path | Role |
| --- | --- | --- |
| Session store | `src/session/index.ts` | Reads and writes the logged-in user in `localStorage` |
| Session errors | `src/session/errors.ts` | Token-expired and "no session" errors |
| HTTP client | `src/api/request.ts` | Attaches `Authorization`, refreshes tokens, signs out on 401 |
| Auth API calls | `src/api/api.ts` | Login, refresh, signup, passkey, OAuth consent |
| Auth types | `src/api/user.ts` | `User`, `Token`, `LoginResponse`, permission bits |
| Site flags | `src/api/site.ts`, `src/redux/siteConfigSlice.ts`, `src/redux/thunks/site.ts` | Registration, captcha, WebAuthn, anonymous user |
| Session thunks | `src/redux/thunks/session.ts` | Apply a new login, sign out, desktop callback |
| Routes | `src/router/index.tsx` | `/session/*` is the unauthenticated shell |
| Sign-in wizard | `src/component/Pages/Login/Signin/SignIn.tsx` | Email, password, 2FA, forgot password, OAuth consent |
| Passkeys | `src/component/Pages/Login/Signin/PasskeyLoginButton.tsx` | WebAuthn login |
| Account security | `src/component/Pages/Setting/Security/` | Password change, 2FA, passkeys, OAuth grants |
| Admin account settings | `src/component/Admin/Settings/UserSession/UserSession.tsx` | Registration, email activation, WebAuthn |
| Token TTLs | `src/component/Admin/Settings/Server/ServerSetting.tsx` | Access and refresh token lifetimes |
| Captcha | `src/component/Common/Captcha/`, `src/component/Admin/Settings/Captcha/` | Graphic, reCAPTCHA, Turnstile, Cap |

Dev requests to `/api` are proxied to `http://localhost:5212` (`vite.config.ts`).

## Session model

There is no cookie session and no Redux slice for the logged-in user. A singleton `SessionManager` (`src/session/index.ts`) persists this object under the `localStorage` key `cloudreve_session`:

```ts
{
  current?: string;                 // active user id
  sessions: {
    [uid: string]: {
      user: User;
      token: {
        access_token: string;
        refresh_token: string;
        access_expires: string;     // ISO timestamp from the API
        refresh_expires: string;
      };
      settings: { [key: string]: any }; // UI prefs, not account security
      signedOut?: boolean;
    };
  };
  anonymousSettings: { [key: string]: any };
  anonymousUser?: User;
}
```

Several users can be stored at once, but only `current` is used for API calls. `upsert()` replaces that user's record and makes them current, keeping their existing `settings`. `signOutCurrent()` clears `current`, sets `signedOut`, and blanks the tokens. It does not delete the record. `removeSession()` exists and has no callers.

`user_hint` on the page URL is a deep-link check, not an account switcher. On startup, if the query is present:

- The hint matches `current` and that session is not signed out and its refresh token is still valid: the param is stripped with `history.replaceState`.
- Otherwise the browser is sent to `/session?redirect=<current path>`, unless the path already starts with `/session`.

A valid stored session for a different user is not selected automatically.

UI preferences (`UserSettings` in `src/session/index.ts`: theme, page size, sort, and so on) are stored inside the session. With no login they go to `anonymousSettings`.

## Boot and routing

`src/redux/store.ts` dispatches `updateSiteConfig()` as soon as the store is created. That loads `GET /api/v4/site/config/basic`. If the payload includes `user`, `SessionManager.updateUserIfExist` writes it:

- A real user id that already has a session updates that session's `user`.
- `user.anonymous === true` is stored as `anonymousUser`.

There is no route guard. `/home`, `/settings`, and `/admin/*` all render for anyone. The API decides what an anonymous caller may do. Admin links in the navbar are hidden unless group permission bit `is_admin` (0) is set (`GroupBS` in `src/session/utils.ts`). The dashboard itself is not blocked in the router.

`/` (`HomeRedirect`) sends a logged-in user to `/home` and everyone else to `/session`.

Login routes sit under a headless frame, not the file-manager navbar:

| Path | Component | Purpose |
| --- | --- | --- |
| `/session` | `SignIn` | Default sign-in |
| `/session/signup` | `Signup` | Registration |
| `/session/activate` | `Activate` | Email activation link |
| `/session/reset` | `Reset` | Set a new password from a reset link |
| `/session/authorize` | `Authorize` | OAuth consent (this site as the identity provider) |
| `/callback/desktop` | `DesktopCallback` | Native desktop app mount, not user login |
| `/callback/ios` | `MobileCallback` | Native iOS app mount, not user login |

`SessionIntro` wraps every `/session/*` page and loads `GET /api/v4/site/config/login` before rendering the form. That config supplies `register_enabled`, `authn` (WebAuthn), `login_captcha`, `reg_captcha`, `forget_captcha`, `tos_url`, and `privacy_policy_url`.

The avatar in the top bar (`UserAction`) reads `SessionManager.currentLogin()`. With no session it is a person icon that navigates to `/session`. With a session it opens the menu that calls `signout()`.

## Sign-in

`SignIn` is a phase wizard in `src/component/Pages/Login/Signin/SignIn.tsx`.

```
Collect email
    GET /session/prepare?email=
        404  -> SignupNeeded (offer signup only if register_enabled)
        200  -> Collect password
Collect password
    POST /session/token
        203 Continue -> Collect 2FA (body is a session id)
        200          -> session stored, leave the page
Collect 2FA
    POST /session/token/2fa
        200 -> session stored, leave the page
```

### Prepare

`sendPrepareLogin` calls `GET /api/v4/session/prepare?email=` with no credential. HTTP 404 is `Code.NodeFound` and is treated as "this email is not registered". Any other error stays on the email step (the request layer shows a snackbar).

A successful body is `PrepareLoginResponse`:

- `password_enabled` — show the password field
- `webauthn_enabled` — show the passkey button on the password step (also requires site flag `authn`)
- `sso_enabled`, `qq_enabled` — returned by the API and unused by the UI

If password login is disabled, the password step only shows the passkey hint (`login.paswordlessHint`).

### Password

`POST /api/v4/session/token` with `{ email, password, ...captcha }` and `noCredential: true`. Password length in the form is 4–128.

When `login_captcha` is on, the captcha widget adds its fields to that body. The graphic captcha sends `{ captcha, ticket }` from `GET /api/v4/site/captcha`. The provider (graphic, reCAPTCHA v2, Turnstile, Cap) comes from `basic.captcha_type`.

Response code `203` (`Code.Continue`) is not a failure. The snackbar is suppressed and `response.data` is kept as the 2FA `session_id`. Any other error refreshes the captcha.

### Two-factor

The 2FA step is a 6-digit OTP. It submits itself when the sixth digit is entered.

`POST /api/v4/session/token/2fa` with `{ otp, session_id }`.

Enabling 2FA later is a signed-in settings action, not part of this wizard. See [Account security](#account-security).

### After a successful login

`refreshUserSession` in `src/redux/thunks/session.ts`:

1. `setTargetSession` calls `SessionManager.upsert`, applies the user's theme and language, restores drawer width and dark mode from session settings, and clears file-manager caches.
2. Reloads the `basic` site config.
3. Navigates to the `redirect` query param, or `/home` if it is missing.

The OAuth consent flow uses `setTargetSession` only and stays on the page. See [OAuth provider](#oauth-this-site-as-an-identity-provider).

### Passkeys (WebAuthn)

Shown when site config `authn` is true.

On the email step, `PasskeyLoginButton` with `autoComplete` starts conditional mediation (`navigator.credentials.get({ mediation: "conditional" })`) if the browser supports it. The email field's autocomplete is `username webauthn`, so the browser can offer a saved passkey.

On the password step the same button is a normal click, and only if `prepare` said `webauthn_enabled`.

Both paths:

1. `PUT /api/v4/session/authn` — returns `{ options, session_id }`. `options.publicKey` has `challenge`, `timeout`, and `rpId`.
2. `navigator.credentials.get` with the decoded challenge.
3. `POST /api/v4/session/authn` with `{ session_id, response }` where `response` is a JSON string of the credential (base64url fields).
4. The body is a `LoginResponse`, handled like a password login.

Registration of a new passkey is under Settings, not on this page: `PUT /api/v4/user/authn` then `POST /api/v4/user/authn`. Deleting one is `DELETE /api/v4/user/authn?id=`.

## Sign-up, activation, and password reset

Sign-up (`src/component/Pages/Login/Signup.tsx`) is linked from the email step when `register_enabled` is true. Unknown emails also land on `SignupNeeded`, which links to `/session/signup?email=`.

`POST /api/v4/user` with `{ email, password, language, ...captcha }`. Password length here is 6–128. Captcha is included when `reg_captcha` is set.

- Code `203`: the signup page switches to an "check your email" panel. The account is not logged in.
- Success: snackbar, then navigate to `/session?email=<email>`. The `phase=email` query that the code also sets is not read by `SignIn`.

Activation (`/session/activate?id=&sign=`) calls `GET /api/v4/user/activate/:id?sign=`. Success shows a confirmation and a button back to `/session?email=`. Missing params or a failed request go back to `/session`.

Forgot password is a phase inside sign-in, reached from the password field. It calls `POST /api/v4/user/reset` with `{ email, ...captcha }` when `forget_captcha` is set, then returns to the email step.

The email link opens `/session/reset?id=&secret=`, which calls `PATCH /api/v4/user/reset/:id` with `{ password, secret }` and then returns to sign-in. This does not create a session.

## How requests stay authenticated

Every API helper goes through `send()` in `src/api/request.ts`. Axios `baseURL` is `/api/v4`.

Unless the call sets `noCredential: true` (login, refresh, signup, captcha, reset, passkey ceremony), `send()` does this:

1. `SessionManager.getAccessToken()`.
2. If the access token expires within 10 minutes, and the refresh token does not, throw `ErrAccessTokenExpired`.
3. `getAccessToken()` catches that, calls `POST /api/v4/session/token/refresh` with `{ refresh_token }` (no `Authorization` header), stores the new `Token` on that user, and retries the header as `Bearer <new access token>`.
4. If there is no session, the refresh token is inside the 10-minute window, or refresh itself fails, the original request goes out with no `Authorization` header (or fails, for a refresh error).
5. The header is `Authorization: Bearer <access_token>`.

Response codes that force a local sign-out and `router.navigate("/session?redirect=...")`:

- `401` (`Code.CodeLoginRequired`)
- `40020` (`Code.CredentialInvalid`)

A module-level `signOutLock` allows that redirect once, so parallel 401s do not loop. It is never cleared for the lifetime of the page.

`40088` (`Code.AnonymouseAccessDenied`) does not sign anyone out. The file list renders a lock and a sign-in button that goes to `/session?redirect=<current url>` (`ExplorerError`).

Explicit sign-out (`signout` thunk, user menu):

1. `DELETE /api/v4/session/token` with `{ refresh_token }`.
2. Navigate to `/session`.
3. Close the music player and call `SessionManager.signOutCurrent()`.

Changing the password in Settings (`PATCH /api/v4/user/setting` with `current_password` and `new_password`) only calls `signOutCurrent()` and navigates to `/session`. It does not call the sign-out endpoint, so the refresh token is not revoked by that path.

## Anonymous use

A visitor with no `current` session can still open `/home`. List and download calls go out without a bearer token. The backend's anonymous group decides what is visible.

`GET /site/config/basic` may return that anonymous user. It is kept on `SessionManager` as `anonymousUser` and is what `currentUser()` returns when nobody is logged in. Group permission bit `is_anonymous` (1) marks that group.

Pinned UI such as capacity is skipped when `currentLoginOrNull()` is null.

## Group permissions

`user.group.permission` is a boolset string. Bits the frontend knows about are in `GroupPermission` (`src/api/user.ts`):

| Bit | Name | Used for |
| --- | --- | --- |
| 0 | `is_admin` | Show dashboard links |
| 1 | `is_anonymous` | Anonymous group |
| 2 | `share` | Create share links |
| 3 | `webdav` | WebDAV / devices UI |
| 4 | `archive_download` | Archive download |
| 5 | `archive_task` | Archive tasks |
| 6 | `webdav_proxy` | WebDAV proxy |
| 7 | `share_download` | Download via share |
| 9 | `remote_download` | Remote download nav item |
| 11 | `redirected_source` | Redirected sources |
| 12 | `advance_delete` | Advanced delete |
| 17 | `unique_direct_link` | Direct link behavior |

These bits gate buttons and nav items. They are not a substitute for API authorization.

## Account security

Settings → Security (`src/component/Pages/Setting/Security/SecuritySetting.tsx`) loads `GET /api/v4/user/setting`.

| Action | Call |
| --- | --- |
| Change password | `PATCH /user/setting` `{ current_password, new_password }`, then local sign-out |
| Start 2FA | `GET /user/setting/2fa` returns an otpauth secret, shown as a QR code |
| Confirm 2FA | `PATCH /user/setting` `{ two_fa_enabled: true, two_fa_code }` |
| Disable 2FA | `PATCH /user/setting` `{ two_fa_enabled: false, two_fa_code }` |
| Add passkey | `PUT /user/authn`, then `navigator.credentials.create`, then `POST /user/authn` |
| Remove passkey | `DELETE /user/authn?id=` |
| Revoke an OAuth app | `DELETE /session/oauth/grant/:clientId` |

Admin can clear a user's 2FA from the user dialog by sending `two_fa: "clear"`.

## OAuth: this site as an identity provider

Cloudreve can authorize other apps. The SPA implements the browser half of the authorization-code (+ PKCE) flow. Token exchange is a backend endpoint the SPA does not call.

An app sends the user to:

```
/session/authorize
  ?client_id=
  &response_type=code
  &redirect_uri=
  &state=
  &scope=
  &code_challenge=
  &code_challenge_method=
```

`Authorize` renders the same `SignIn` wizard with those query params.

1. `GET /api/v4/session/oauth/app/:clientId` loads the app name, logo, and scopes this user already granted. This call uses the current credential if one exists.
2. If nobody is logged in, the normal email/password/passkey wizard runs. On success it does not leave for `/home`. It reloads the app registration.
3. If every requested scope is already in `consented_scopes`, consent is posted immediately.
4. Otherwise `PhaseConsent` lists the new scopes. Authorize posts consent. Deny posts the deny endpoint. Back on the consent step is deny, not "previous step".

`POST /api/v4/session/oauth/consent` or `POST /api/v4/session/oauth/consent/deny` with:

```
{
  client_id, response_type, redirect_uri, state, scope,
  code_challenge?, code_challenge_method?
}
```

The browser is then sent to `redirect_uri` with `code` or `error`, plus `state`. Relative redirect URIs are resolved against this origin.

Scope names the consent screen knows: `profile`, `email`, `UserInfo.Read`, `UserInfo.Write`, `offline_access`, `UserSecurityInfo.Read`, `Workflow.Read`, `Admin.Read`, `Files.Read`, `Shares.Read`, `Finance.Read`, `DavAccount.Read`, and the matching `*.Write` variants. `openid` is hidden. Read and write for the same resource are shown as one row.

The admin OAuth client editor (`src/component/Admin/OAuthClient/`) shows the endpoints an external app should use:

| Purpose | URL |
| --- | --- |
| Authorize | `{origin}/session/authorize` |
| Token | `{origin}/api/v4/session/oauth/token` |
| Refresh | `{origin}/api/v4/session/token/refresh` |
| Userinfo | `{origin}/api/v4/session/oauth/userinfo` |

Admin CRUD is under `/api/v4/admin/oauthClient`. That is management of client apps, not the end-user login.

## Things that look like auth and are not

**Storage-policy OAuth** (`/admin/policy/oauth`, `OauthCallback`, OneDrive wizard) connects a storage backend (OneDrive and similar) to the server. It finishes with `finishOauthCallback` and returns to the policy editor. It does not create a user session.

**Desktop and iOS callbacks** (`/callback/desktop`, `/callback/ios`) read `code` / `state` / `error` and hand them to the `cloudreve://mount` URL scheme so the native app can finish mounting. `AppPromotion` also builds a `refresh_token` URL aimed at a legacy `/login?refresh_token=` path. Nothing in this router reads `refresh_token` from the query string.

**SSO settings** in Admin → User session (`SSOSettings.tsx`) render disabled QQ Connect, Logto, and OIDC rows. Clicking them opens `ProDialog`. `sso_enabled` and `qq_enabled` from `prepare` are never read.

## Admin switches that change the login UI

Saved through the generic admin settings API (`POST /api/v4/admin/settings`), then returned to the SPA inside site config.

| Setting | Effect in this frontend |
| --- | --- |
| `register_enabled` | Signup link and the "create account" step |
| `email_active` | Backend sends the activation email; the SPA only shows the "check your email" panel when signup returns 203 |
| `authn_enabled` | Site config `authn`; passkey button and passkey settings |
| `login_captcha`, `reg_captcha`, `forget_captcha` | Captcha on sign-in, sign-up, and forgot-password |
| `captcha_type` and provider keys | Which captcha widget renders |
| `access_token_ttl`, `refresh_token_ttl` | Server-side lifetimes. The SPA only compares the expiry timestamps it stored |
| `tos_url`, `privacy_policy_url` | Legal links under the email step |
| `default_group` | Group assigned to new users (server-side) |

## If you change the default login

The password wizard is `EmailLogin` inside `src/component/Pages/Login/Signin/SignIn.tsx`, with one component per phase under `src/component/Pages/Login/Phases/`. A new method has to end by producing a `LoginResponse` (`{ user, token }`) and calling `refreshUserSession` (normal login) or `setTargetSession` (OAuth consent, so the user is not redirected away before they approve scopes).

Anything that must work before a session exists has to pass `noCredential: true` into `send()`, or `getAccessToken()` will treat a missing session as "call the API anonymously" only after it fails to find one — and a half-expired session will try to refresh first.

Token persistence, the `Authorization` header, and the 401 sign-out all go through `SessionManager` and `src/api/request.ts`. Replacing the login form without going through `upsert()` leaves the rest of the app anonymous.
