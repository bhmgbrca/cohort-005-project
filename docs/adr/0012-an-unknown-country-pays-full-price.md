# An unknown country pays full price; we never look it up over the network

Purchasing-power prices depend on the buyer's country. `resolveCountry` takes it from the dev session override or the Cloudflare `CF-IPCountry` header, and when neither gives a country the buyer pays full price. We do not fall back to an IP geolocation service: the course list, the purchase page and every lesson page for a discounted purchase would wait on a network call, and the free endpoint we used (ip-api.com) is plain HTTP and limited to 45 requests a minute.

## Consequences

A learner whose request arrives without a country is overcharged: they're exactly the learner purchasing-power pricing is for. Don't "fix" this by adding a lookup back. Get the country onto the request instead.
