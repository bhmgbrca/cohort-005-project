# Approving refunds is separate from moving the money

This work covers deciding Refund Requests and what happens to access when one is approved. Approving creates a Pending Refund in the domain, but nothing yet records or moves the money. That means no Issued Refunds or Failed Refunds, and no payment provider. These are also deliberately left out:
- subtracting Approved Refund Requests from instructor revenue analytics
- renaming the `refunds` table, which stores Refund Requests, to match the glossary
- renaming `UserRole.Admin` and `TeamMemberRole.Admin`

## Consequences

Until those follow-ups are done, every Refund stays Pending forever, revenue figures include refunded Purchases, and the table name differs from the glossary.
