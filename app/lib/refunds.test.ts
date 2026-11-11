import { describe, it, expect } from "vitest";
import {
  buildRefundRequestEmail,
  checkRefundEligibility,
  REFUND_WATCH_LIMIT_SECONDS,
} from "./refunds";

const eligibleInput = {
  purchasedAt: new Date(2026, 0, 1, 23, 0).toISOString(),
  amountPaid: 10000,
  hasOpenRequest: false,
  hasClaimedSeat: false,
  lessonCount: 10,
  completedLessonCount: 0,
  secondsWatched: 0,
  now: new Date(2026, 0, 5, 12, 0),
};

describe("checkRefundEligibility", () => {
  it("offers the Amount Paid as the Refund Amount", () => {
    expect(checkRefundEligibility(eligibleInput)).toEqual({
      eligible: true,
      refundAmount: 10000,
      lastDayInWindow: "2026-01-15",
    });
  });

  it("refunds the whole Amount Paid for a Team Purchase, not one seat", () => {
    const result = checkRefundEligibility({
      ...eligibleInput,
      amountPaid: 50000,
    });
    expect(result).toMatchObject({ eligible: true, refundAmount: 50000 });
  });

  it("refuses when a Refund Request is already open", () => {
    expect(
      checkRefundEligibility({ ...eligibleInput, hasOpenRequest: true })
    ).toEqual({ eligible: false, reason: "open_request" });
  });

  it("refuses a Team Purchase with a Claimed Seat", () => {
    expect(
      checkRefundEligibility({ ...eligibleInput, hasClaimedSeat: true })
    ).toEqual({ eligible: false, reason: "claimed_seat" });
  });

  it("allows the whole of the fourteenth day, counted in calendar days", () => {
    const result = checkRefundEligibility({
      ...eligibleInput,
      now: new Date(2026, 0, 15, 23, 59),
    });
    expect(result).toMatchObject({ eligible: true });
  });

  it("refuses after the window has closed", () => {
    expect(
      checkRefundEligibility({
        ...eligibleInput,
        now: new Date(2026, 0, 16, 0, 1),
      })
    ).toEqual({ eligible: false, reason: "window_closed" });
  });

  it("refuses once half the lessons are completed", () => {
    expect(
      checkRefundEligibility({ ...eligibleInput, completedLessonCount: 5 })
    ).toEqual({ eligible: false, reason: "too_much_completed" });
  });

  it("allows a course with no lessons", () => {
    const result = checkRefundEligibility({
      ...eligibleInput,
      lessonCount: 0,
      completedLessonCount: 0,
    });
    expect(result).toMatchObject({ eligible: true });
  });

  it("refuses once the watch limit is reached", () => {
    expect(
      checkRefundEligibility({
        ...eligibleInput,
        secondsWatched: REFUND_WATCH_LIMIT_SECONDS,
      })
    ).toEqual({ eligible: false, reason: "too_much_watched" });
  });
});

describe("buildRefundRequestEmail", () => {
  it("talks about a Refund Request for the Refund Amount", () => {
    const email = buildRefundRequestEmail({
      buyerName: "Priya",
      buyerEmail: "priya@example.com",
      courseTitle: "Intro to Testing",
      refundAmount: 5000,
    });

    expect(email.to).toBe("priya@example.com");
    expect(email.subject).toBe("Refund requested — Intro to Testing");
    expect(email.body).toContain("$50.00");
    expect(email.body).not.toMatch(/reversal|chargeback/i);
  });
});
