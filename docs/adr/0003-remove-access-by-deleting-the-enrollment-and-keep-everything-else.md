# Remove access by deleting the enrollment, and keep everything else

Approving a Refund Request deletes the learner's `enrollments` row and nothing else. Lesson progress, video watch history, quiz attempts, comments and ratings all stay, and the rating still counts in the course average.

## Considered Options

- **Add an `endedAt` column to enrollments.** Rejected: every enrollment query in the app (access checks, enrollment counts, the purchase flow's "already enrolled" check) would have to remember to filter on it. The history already lives on the Purchase and the Approved Refund Request, so the enrollment row adds nothing to it.
- **Delete the learner's progress as well.** Rejected: it can't be undone. The watch history is also the evidence behind the approval decision, and a learner who buys again would lose their place for no reason.

## Consequences

Progress is stored per user and lesson, not per enrollment or Purchase. So after buying again, a learner picks up where they left off (see ADR-0007).
