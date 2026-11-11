import { formatPrice } from "~/lib/utils";

// Vocabulary follows GLOSSARY.md: a Buyer raises a Refund Request against a
// Purchase; an approved one produces a Refund for the Refund Amount.

export const REFUND_WINDOW_DAYS = 14;
export const REFUND_WATCH_LIMIT_SECONDS = 2 * 60 * 60;
export const REFUND_COMPLETION_LIMIT = 0.5;

export type RefundIneligibility =
  | "open_request"
  | "claimed_seat"
  | "window_closed"
  | "too_much_completed"
  | "too_much_watched";

export type RefundEligibility =
  | { eligible: true; refundAmount: number; lastDayInWindow: string }
  | { eligible: false; reason: RefundIneligibility };

export const REFUND_INELIGIBILITY_MESSAGES: Record<RefundIneligibility, string> =
  {
    open_request: "You already have an open refund request for this purchase.",
    claimed_seat:
      "This team purchase cannot be refunded because one of its seats has been claimed.",
    window_closed: `The ${REFUND_WINDOW_DAYS}-day refund window has closed.`,
    too_much_completed:
      "You have completed too much of this course to request a refund.",
    too_much_watched:
      "You have watched too much of this course to request a refund.",
  };

// The window is counted in whole calendar days, not hours — someone who buys
// at 23:00 still gets the whole of their fourteenth day.
function calendarDay(when: Date): string {
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${when.getFullYear()}-${month}-${day}`;
}

export function checkRefundEligibility(input: {
  purchasedAt: string;
  amountPaid: number;
  hasOpenRequest: boolean;
  hasClaimedSeat: boolean;
  lessonCount: number;
  completedLessonCount: number;
  secondsWatched: number;
  now: Date;
}): RefundEligibility {
  if (input.hasOpenRequest) return { eligible: false, reason: "open_request" };
  if (input.hasClaimedSeat) return { eligible: false, reason: "claimed_seat" };

  const purchasedAt = new Date(input.purchasedAt);
  const windowEnd = new Date(purchasedAt);
  windowEnd.setDate(windowEnd.getDate() + REFUND_WINDOW_DAYS);

  const today = calendarDay(input.now);
  const lastDayInWindow = calendarDay(windowEnd);
  if (today < calendarDay(purchasedAt) || today > lastDayInWindow) {
    return { eligible: false, reason: "window_closed" };
  }

  if (
    input.lessonCount > 0 &&
    input.completedLessonCount / input.lessonCount >= REFUND_COMPLETION_LIMIT
  ) {
    return { eligible: false, reason: "too_much_completed" };
  }

  if (input.secondsWatched >= REFUND_WATCH_LIMIT_SECONDS) {
    return { eligible: false, reason: "too_much_watched" };
  }

  // The Refund Amount is always the full Amount Paid — never today's List
  // Price, and for a Team Purchase never a single seat's price.
  return { eligible: true, refundAmount: input.amountPaid, lastDayInWindow };
}

/**
 * The confirmation the Buyer gets in their inbox. There is no mail transport
 * wired up yet, so the built message goes to the server log.
 */
export function buildRefundRequestEmail(input: {
  buyerName: string;
  buyerEmail: string;
  courseTitle: string;
  refundAmount: number;
}) {
  return {
    to: input.buyerEmail,
    subject: `Refund requested — ${input.courseTitle}`,
    body: [
      `Hi ${input.buyerName},`,
      "",
      `We have your refund request for "${input.courseTitle}".`,
      `If it is approved, we will refund ${formatPrice(input.refundAmount)}, the full amount you paid.`,
      "",
      "Our team reviews every refund request by hand. You do not need to do anything else — we will email you again once it has been approved or declined.",
      "",
      "— The Cadence team",
    ].join("\n"),
  };
}
