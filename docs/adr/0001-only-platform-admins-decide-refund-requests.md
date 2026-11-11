# Only Platform Admins decide Refund Requests

A Refund gives money back on behalf of the business, so only Platform Admins approve or decline Refund Requests. They do this from one screen that lists every Refund Request on the platform.

## Considered Options

- **The course's instructor as well** (the existing `requireStaff` check). Rejected: the instructor would be deciding whether to give back revenue that pays them.
- **Team Admins for their own Team Licence.** Rejected: a Team Admin is the Buyer. They can raise a Refund Request but never decide one.

## Consequences

The code calls Platform Admins `UserRole.Admin` and Team Admins `TeamMemberRole.Admin`. Both are just "admin" in code, so the glossary's names are the ones to use in conversation until the code is renamed.
