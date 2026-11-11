# Access ends when a Refund Request is approved

When a Refund Request is approved, the Purchase becomes a Refunded Purchase and the learner loses access to the course straight away. While the request is Open, they keep full access.

## Considered Options

- **When the request is raised, restored if it's declined.** Rejected: it locks out every learner whose request is later declined, for something they did nothing wrong in.
- **When the Refund is Issued.** Rejected: too late, and moving the money is out of scope, so access would never end. A Failed Refund also leaves the request Approved, so access shouldn't depend on whether the money moves.

## Consequences

A learner can keep watching while their request is Open. The admin screen therefore shows live progress next to the eligibility as it stood when the request was raised (see ADR-0004).
