# Cadence

An online course platform where learners buy courses and work through their lessons.

## Language

### Purchasing

**Purchase**:
A Buyer paying for access to a course, either for themselves or for a set of Seats for a team.
_Avoid_: Order, transaction, enrollment

**Buyer**:
The person who paid for a Purchase. For a Team Purchase, this is not necessarily anyone who learns from it.
_Avoid_: Customer, purchaser

**List Price**:
The price a course is currently advertised at, before any PPP discount.
_Avoid_: Full price, base price

**PPP Price**:
The List Price reduced by the discount for the Buyer's country (purchasing-power parity).
_Avoid_: Regional price, discount price

**Amount Paid**:
What the Buyer was charged for a Purchase, fixed at checkout and unaffected by later changes to the List Price.
_Avoid_: Price paid, total

**Team Purchase**:
A single Purchase that buys several Seats of one course for a team.
_Avoid_: Bulk purchase, licence

**Seat**:
One learner's access to a course, bought as part of a Team Purchase.
_Avoid_: Coupon, licence, code

**Claimed Seat**:
A Seat that a learner has taken up for themselves.
_Avoid_: Redeemed coupon, used seat

### Refunds

**Refund Request**:
A Buyer's ask, with a reason, to get their money back for a Purchase. It is Open until it becomes Approved or Declined, and a Buyer may raise a new one after a decline. Staff may raise one on a Buyer's behalf.
_Avoid_: Reversal, Cancellation, cancel request, Chargeback, Pending Chargeback

**Refund Window**:
The period in which a Buyer can raise a Refund Request: from the day of the Purchase through the end of the fourteenth calendar day after it.
_Avoid_: Cancellation window, cancel window, grace period

**Open**:
The state of a Refund Request that has been raised but is not yet Approved or Declined.
_Avoid_: Requested, Pending, in review

**Refund**:
Money returned to a Buyer as the result of exactly one Approved Refund Request. It exists from the moment of approval, is always for the Refund Amount, and ends the Purchase.
_Avoid_: Reversal, Cancellation

**Refund Amount**:
The money a Refund returns, which is always the full Amount Paid for the Purchase and never part of it.
_Avoid_: Refundable amount, reversal amount

A Team Purchase can only get a Refund while none of its Seats is a Claimed Seat.
