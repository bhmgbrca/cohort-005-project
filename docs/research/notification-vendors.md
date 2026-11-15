# Which hosted notification vendors fit Cadence?

Research for [#6](https://github.com/bhmgbrca/cohort-005-project/issues/6), part of map [#4](https://github.com/bhmgbrca/cohort-005-project/issues/4). Gathered 2026-11-14 from vendor docs, pricing pages and the npm registry. This is a factual comparison with no recommendation. The decision belongs to a later grilling ticket.

Cadence context: React Router 8.3 (framework mode, SSR), React 19.2, Drizzle and better-sqlite3. Users are switched with the DevUI panel, so vendor identity has to key off our user id. Tests must run offline.

Vendors compared: Knock, Novu, MagicBell, Courier, SuprSend. All five still exist and ship maintained React SDKs (npm versions below, checked 2026-11-14). No other contender was added.

## Comparison table

| | Knock | Novu | MagicBell | Courier | SuprSend |
|---|---|---|---|---|---|
| **Free tier** | 10,000 messages/mo, unlimited environments, unlimited workflows, Knock branding [1] | 10,000 workflow runs/mo, 2 envs (Dev+Prod), max 5 workflows, 3 team members, 24h activity-feed retention [2] | 1,000 deliveries/mo, counted per channel, 1 project [3] | 10,000 sends/mo (Developer plan) [4] | 10,000 notifications/mo. The in-app feed shows SuprSend branding. **Batching is not on free** [5] |
| **First paid tier** | Starter $250/mo + usage [1] | Pro from $30/mo [2] | Startup $249/mo (50k deliveries) [3] | Pay-as-you-go $0.005/send [4] | Essentials $100/mo (50k) [5] |
| **React package** | `@knocklabs/react` 0.15.1. Peer: react 17–19. Optional `next` and `@tanstack/react-router` adapters, **no React Router adapter** [6] | `@novu/react` 3.19.2. Peer: react 18–19 [7][npm] | `@magicbell/react` 1.14.0 (`Provider` takes `token`; `Inbox`, `FloatingInbox`) [8] | `@trycourier/courier-react` 9.3.5. Peer: react ≥18 [9] | `@suprsend/react` 1.5.0. Peer: react ≥16.8. `@suprsend/react-inbox` is end-of-support [10] |
| **SSR guidance** | Not addressed in docs [6][11] | Not addressed (Next.js quickstart only) [7] | Not addressed [8] | Explicit: "render only on the client", `"use client"` in Next.js [9] | Not addressed [10] |
| **Headless option** | Yes, via `@knocklabs/client` underneath [11] | Yes, hooks in `@novu/react` / `@novu/js` [7] | `magicbell-js` client [8] | Yes, `inbox` hook / `registerFeeds` [9] | Yes, headless docs [12] |
| **User identity / signed token** | RS256 JWT signed **locally** with a private signing key (`signUserToken(userId, {expiresInSeconds})` from `@knocklabs/node`, default 1h expiry). Claims: `sub`, `iat`, `exp`, optional `grants`. "Enhanced security mode" makes it required [13] | `subscriberHash = HMAC-SHA256(secretKey, subscriberId)`, hex. Computed **locally**. **No expiry** [14] | HS256 JWT signed **locally** with the project secret key. Claims: `user_external_id` or `user_email`, plus `api_key`. Doc example uses `expiresIn: '1y'` [15] | JWT **minted by Courier over the network** (`POST /auth/issue-token`) with scopes like `user_id:<id> inbox:read:messages inbox:write:events`. Omitting `expires_in` gives a non-expiring token. The SDK does not refresh [16] | ES256 JWT signed **locally** with a dashboard signing key (PEM). Claims: `entity_type:'subscriber'`, `entity_id`, `iat`, `exp`. `refreshUserToken` callback. "Enhanced security mode" makes it required [17][18] |
| **Works with DevUI user switching?** | Yes in principle. Token is per user id and signed server-side per request (see gotchas on remounting) | Yes. Hash is deterministic per id | Yes. Token is per `user_external_id` | Yes, but each switch needs a network round trip to mint a token (or a cached one) | Yes. `distinctId` + `userToken`. `distinctId={null}` logs out [10] |
| **Trigger from Node** | `@knocklabs/node` 1.41.1, workflow trigger with `recipients`, `actor`, `data`. Inline identify of recipients. `Idempotency-Key` header [19] | `@novu/api` 3.19.1, `novu.trigger({ workflowId, to: { subscriberId, ... }, payload })` [20] | `POST /v2/broadcasts` (multiple recipients), `Idempotency-Key`, via `magicbell-js` / CLI [21] | `@trycourier/courier` 10.0.0 [npm] | `@suprsend/node-sdk` 1.15.1. Workflow / event trigger APIs [22] |
| **Live updates** | Websocket. Auto-disconnects inactive tabs. Optional cross-tab BroadcastChannel sync [11][23] | Real-time unread count. Self-host architecture has a dedicated WS service [7][24] | "Persistent connection". Package depends on `reconnecting-websocket` [25][npm] | WebSocket opened via `inbox.listenForUpdates()`. Without it the inbox loads once [9] | socket.io connection. Docs warn to keep only one socket active [26] |
| **Badge counts** | Feed API returns unread/read/seen counts [23] | Built-in unread count on bell [7] | Built-in (read/unread states) [8] | Built-in | Built-in |
| **Grouping** | Batch function, per recipient + optional batch key. `activities` (≤10 rendered), `total_activities`, `actors` [27] | Digest step, per subscriber + one aggregation key. Max window **1 day on Free**, 7 on Pro [28] | Not documented in channel docs (categories/topics only) [25] | Batching with global/user/dynamic scope, `count` + `items` [29] | Batch and digest nodes exist, **not on free tier** [5] |
| **Action buttons** | Yes. `onNotificationButtonClick(item, button)`. Action URL redirect [11] | Yes. `primaryAction` / `secondaryAction` with `redirect`, `onPrimaryActionClick`. `routerPush` for SPA navigation [30] | Not documented. `action_url` per notification [21] | "Per-message action buttons" / `actions` array [9][31] | Up to 2 buttons (text + URL), primary/secondary click handlers [26] |
| **Email later?** | Yes, email is a channel. Free tier has unlimited delivery channels [1] | Yes, email channel step / providers [20] | Yes, "All integrations" on free. Deliveries are counted per channel [3] | Yes, multi-channel sends [4] | Yes, "unlimited channels" on free [5] |
| **Local dev / testing** | Separate development environment. `sandbox_mode` per trigger (no provider delivery, still hits Knock). Node client `baseURL` / `KNOCK_BASE_URL` override [13][32][33] | `npx novu dev` opens a Local env **via a tunnel from Novu Cloud** (needs network). Code-first workflows on a local Bridge endpoint [34] | One project on free. No local emulator documented | No local emulator documented. Token issuance itself is a network call [16] | Postman collection / mock data. No local emulator documented [22] |
| **Self-host** | No | Community self-host docs exist (some cloud features unavailable). Supported self-host is Enterprise on pricing [2]. Docs: API + Worker + WS + Dashboard, MongoDB, 2× Redis, object storage (single-VM option: 4 vCPU/8 GB + Mongo + Redis) [24] | No | No | Self-hosted via Helm on Kubernetes [22] |

## Offline tests and the seam

None of the five offers a local emulator that runs without the network. Novu's `npx novu dev` still tunnels through Novu Cloud [34]. Knock's `sandbox_mode` only skips provider delivery, and the call still goes to Knock [32]. So `npm run test` stays offline only if the app talks to the vendor through our own interface, with an in-memory fake used in tests. Per vendor, that interface would wrap:

- **Send:** a `trigger`/`broadcast` call keyed by workflow, recipient user ids, actor and payload (all five).
- **Identity:** producing the client credential for a user id. For Knock, MagicBell, SuprSend and Novu this is pure local crypto (JWT or HMAC), so it can run in tests with a throwaway key. For Courier it is an HTTP call, so it must sit behind the seam too [16].
- **User sync (optional):** Knock can identify recipients inline on trigger [19], and Novu's `to` accepts profile fields [20]. Others need a separate upsert call.
- The React feed component talks to the vendor directly from the browser. Route/unit tests should not render it, or should render it behind a client-only boundary that the test environment stubs.

## Self-hosted vs hosted

No self-hosted option is clearly simpler. Novu self-host needs MongoDB, two Redis clusters, object storage and three services (or a sizeable single VM) [24], and the community edition lacks some cloud-only features, with supported self-hosting listed under Enterprise on the pricing page [2]. SuprSend self-host is a Helm/Kubernetes install [22]. Knock, MagicBell and Courier are hosted-only.

## Notable gotchas

- **SSR with React Router 8.** Only Courier states its components are client-only [9]. The others don't document SSR. All open a websocket in the browser, so the safe assumption is to mount the feed client-side only and sign the token in a loader. Knock ships `next` and `tanstack` entry points but no React Router one [6].
- **DevUI user switching.** The feed provider must get the new user id *and* a fresh token each time. SuprSend documents `distinctId={null}` as logout [10]. The others don't document switching. Re-mounting the provider when the user changes (e.g. `key={userId}`) is an inference, not a documented requirement, and needs checking in a prototype.
- **Token lifetimes.** Novu's HMAC hash never expires (it rotates only with the secret key) [14]. Courier tokens never expire unless `expires_in` is set, and the SDK won't refresh them [16]. Knock defaults to 1h with an `onUserTokenExpiring` hook [13]. SuprSend has `refreshUserToken` [10].
- **Enhanced security is opt-in** on Knock and SuprSend. Without it, the public key alone can read any user's feed [13][18]. With HMAC on, Novu's Inbox won't load if `subscriberHash` is missing [14].
- **Free-tier traps.** MagicBell is 1,000 deliveries, counted per channel, so adding email doubles usage [3]. On SuprSend free, batching is unavailable and the feed is branded [5]. Novu Free caps at 5 workflows and 1-day digests [2][28]. Knock's free tier carries Knock branding [1].
- **Price cliffs.** The first paid tier ranges from Novu Pro $30/mo and Courier pay-as-you-go to Knock/MagicBell at about $250/mo [1–5].
- **Knock batch rendering.** Only 10 `activities`/`actors` render by default. Raising that is Enterprise-only [27].
- **Courier package churn.** `@trycourier/react-inbox` and related packages are deprecated in favour of `@trycourier/courier-react` v9 [9]. Older tutorials use the dead API. SuprSend's `@suprsend/react-inbox` is similarly end-of-support [10].
- **Novu local dev needs a tunnel.** It is a dev convenience and does nothing for offline tests [34].

## Sources

1. Knock pricing: https://knock.app/pricing
2. Novu pricing: https://novu.co/pricing
3. MagicBell pricing: https://www.magicbell.com/pricing
4. Courier pricing: https://www.courier.com/pricing
5. SuprSend pricing: https://www.suprsend.com/pricing
6. `@knocklabs/react` package.json: https://github.com/knocklabs/javascript/blob/main/packages/react/package.json
7. Novu Inbox overview: https://docs.novu.co/platform/inbox/overview
8. MagicBell React library: https://www.magicbell.com/docs/libraries/magicbell-react
9. Courier React SDK: https://www.courier.com/docs/sdk-libraries/courier-react-web, Courier Inbox overview: https://www.courier.com/docs/platform/inbox/inbox-overview
10. SuprSend React SDK: https://docs.suprsend.com/docs/react-sdk, https://docs.suprsend.com/docs/inbox-react
11. Knock React feed: https://docs.knock.app/in-app-ui/react/feed, https://docs.knock.app/in-app-ui/react/sdk/overview
12. SuprSend headless: https://docs.suprsend.com/docs/react-headless
13. Knock security and authentication: https://docs.knock.app/in-app-ui/security-and-authentication. `signUserToken(userId, options)` confirmed in `@knocklabs/node@1.41.1` `lib/tokenSigner.d.ts`
14. Novu prepare for production (HMAC): https://docs.novu.co/platform/inbox/prepare-for-production
15. MagicBell user JWT: https://www.magicbell.com/docs/api/authentication/user
16. Courier authenticate users: https://www.courier.com/docs/in-app/authenticate-users
17. SuprSend client authentication: https://docs.suprsend.com/docs/client-authentication
18. SuprSend API keys / signing key: https://docs.suprsend.com/docs/developer/api-keys
19. Knock trigger API: https://docs.knock.app/send-notifications/triggering-workflows/api
20. Novu TypeScript SDK: https://docs.novu.co/platform/sdks/server/typescript
21. MagicBell API overview: https://www.magicbell.com/docs/api
22. SuprSend docs index (trigger API, testing, self-hosted): https://docs.suprsend.com/llms.txt
23. Knock feeds overview: https://docs.knock.app/in-app-ui/feeds/overview
24. Novu self-hosting overview: https://docs.novu.co/community/self-hosting-novu/overview
25. MagicBell in-app channel: https://www.magicbell.com/docs/channels/in_app
26. SuprSend in-app inbox template / React feed: https://docs.suprsend.com/docs/in-app-inbox-template, https://docs.suprsend.com/docs/react-in-app-feed
27. Knock batch function: https://docs.knock.app/designing-workflows/batch-function
28. Novu digest: https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/digest
29. Courier batching: https://www.courier.com/docs/platform/automations/batching
30. Novu Inbox component and click behavior: https://docs.novu.co/platform/inbox/react/components/inbox, https://docs.novu.co/platform/inbox/advanced-customization/notification-click-behavior
31. Courier Inbox: https://www.courier.com/docs/in-app/inbox
32. Knock testing workflows (sandbox mode): https://docs.knock.app/send-notifications/testing-workflows
33. Knock environments: https://docs.knock.app/concepts/environments. `baseURL` / `KNOCK_BASE_URL` option confirmed in `@knocklabs/node@1.41.1` `client.d.ts`
34. Novu Local Studio / `npx novu dev`: https://docs.novu.co/framework/studio

[npm] marks versions and peer dependencies read from the npm registry with `npm view` on 2026-11-14.
