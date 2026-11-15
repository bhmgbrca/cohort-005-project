# Use Knock for in-app Notifications

Cadence shows Notifications through Knock, a hosted vendor, instead of storing and rendering them itself. Knock's free tier has no cap on workflows, so each launch Notification gets its own workflow. It signs user tokens locally (RS256), and those tokens expire, which is the production-grade identity we wanted, and it keeps working for whichever user the DevUI selects. Recipients are identified as part of each send, so there is no separate job to sync users. A prototype showed the token signing, the client-side feed under React Router SSR, sending from a route action, user switching and live updates all working inside Cadence.

## Considered Options

- **Novu.** The closest runner-up, and much cheaper past the free tier ($30/mo against Knock's ~$250/mo). Rejected because its free tier caps at 5 workflows (we launch with six Notifications) and its user hash never expires.
- **Courier.** Rejected: every user token is created by a network call to Courier, and tokens don't expire unless we manage that ourselves.
- **MagicBell.** Rejected: 1,000 deliveries a month, counted per channel.
- **SuprSend.** Rejected: the free feed is branded and can't group Notifications.
- **Building our own store and feed.** Out of scope for this effort. Self-hosting Novu or SuprSend was not simpler.

## Consequences

- The feed carries Knock branding on the free tier, and going past it costs ~$250/mo.
- No vendor can run offline, so `npm run test` only stays offline if Cadence talks to Knock through its own seam, with an in-memory fake.
- Knock only *requires* a signed user token once "enhanced security mode" is on. Without it, anyone holding the public key (which ships to the browser) can read any user's feed. It must be on before launch.
- Knock silently skips recipients it has never seen, so every send must identify its recipients inline.
