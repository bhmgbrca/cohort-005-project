# Refund Eligibility gates raising a request, not deciding one

The Refund Eligibility rules are checked when a Buyer raises a Refund Request:
- a Purchase for oneself: within 14 calendar days, under 2 hours watched, under half the lessons completed
- a Team Licence: within 14 calendar days and no Claimed Seat

Once a request is raised, the rules are only information for the Platform Admin. The admin screen flags any rule the Purchase now breaks, but Approve stays available. The only exception is a Claimed Seat, which blocks approval outright.

## Considered Options

- **Re-check the rules when deciding and block approval if they fail.** Rejected: the learner keeps watching while the request is Open (ADR-0002), so honest requests would go stale. It would also stop admins making goodwill exceptions.
- **Count the 14 days up to today on the admin screen.** Rejected: almost every request older than a few days would be flagged. Days are counted from purchase to when the request was raised. Lessons and hours are shown live.

## Consequences

Before this decision, the course page checked the half-the-lessons rule but the refund server action didn't. The server action has to enforce all three rules.
