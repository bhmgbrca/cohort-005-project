import { and, eq } from "drizzle-orm";
import type { Db, Queryable } from "~/db";
import { coupons, enrollments, purchases } from "~/db/schema";
import { getCourseTitle } from "~/lib/courses.server";
import type { Notification } from "~/lib/notifier.server";
import { getPerson } from "~/lib/people.server";
import { purchasePagePath } from "~/lib/purchases";
import {
  getSeatAvailability,
  getSeats,
  isClaimed,
} from "~/lib/refunds.server";

// ─── Seats ───
// A Student claiming a Seat on a Team Licence. See GLOSSARY.md, "Seat".
//
// Every function takes the database first, so tests can hand in an in-memory
// one. Uses positional parameters (project convention).

type Enrollment = typeof enrollments.$inferSelect;
type Seat = typeof coupons.$inferSelect;

export const SEAT_ON_HOLD =
  "This Seat can't be claimed right now. Ask the person who shared it with you.";
export const SEAT_REFUNDED =
  "This Seat is no longer available. Ask the person who shared it with you.";

export type ClaimSeatResult =
  | { ok: true; enrollment: Enrollment; notification: Notification | null }
  | { ok: false; error: string };

function countSeats(db: Db, purchaseId: number) {
  const seats = getSeats(db, purchaseId);
  return { claimed: seats.filter(isClaimed).length, total: seats.length };
}

/**
 * Seat claimed (D), for the Team Admin who bought the Team Licence, with the
 * counts just after this claim. `null` when they claimed their own Seat.
 */
function seatClaimedNotification(
  db: Db,
  seat: Seat,
  buyerId: number,
  studentId: number
): Notification | null {
  if (buyerId === studentId) return null;

  const teamAdmin = getPerson(db, buyerId);
  const student = getPerson(db, studentId);
  const courseTitle = getCourseTitle(db, seat.courseId);
  if (!teamAdmin || !student || !courseTitle) return null;

  return {
    kind: "seat-claimed",
    recipients: [teamAdmin],
    actor: student,
    url: purchasePagePath("team_licence"),
    seatId: seat.id,
    courseTitle,
    ...countSeats(db, seat.purchaseId),
  };
}

export function getSeatByCode(db: Queryable, code: string): Seat | undefined {
  return db.select().from(coupons).where(eq(coupons.code, code)).get();
}

function isEnrolled(db: Queryable, userId: number, courseId: number) {
  const enrollment = db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId))
    )
    .get();
  return enrollment !== undefined;
}

function getPurchase(db: Queryable, purchaseId: number) {
  return db.select().from(purchases).where(eq(purchases.id, purchaseId)).get();
}

/** Why a Student can't claim a Seat. */
export type ClaimBlock =
  | "claimed"
  | "enrolled"
  | "on_hold"
  | "refunded"
  | "wrong_country";

export const CLAIM_BLOCK_ERRORS: Record<ClaimBlock, string> = {
  claimed: "This Seat has already been claimed",
  enrolled: "You are already enrolled in this course",
  on_hold: SEAT_ON_HOLD,
  refunded: SEAT_REFUNDED,
  wrong_country:
    "This Seat can only be claimed from the country the Team Licence was bought in",
};

/**
 * The first reason this Student can't claim this Seat from `userCountry`, or
 * `null` when they can. A Student already enrolled is told so before anything
 * about the Seat itself, since they have nothing to claim.
 */
export function findClaimBlock(
  db: Queryable,
  seat: Seat,
  userId: number,
  userCountry: string
): ClaimBlock | null {
  const availability = getSeatAvailability(db, seat);
  if (availability === "claimed") return "claimed";
  if (isEnrolled(db, userId, seat.courseId)) return "enrolled";
  if (availability === "on_hold") return "on_hold";
  if (availability === "refunded") return "refunded";

  const purchase = getPurchase(db, seat.purchaseId);
  if (purchase?.country && purchase.country !== userCountry) {
    return "wrong_country";
  }
  return null;
}

/**
 * Claims the Seat with this code for a Student and enrolls them. Returns a
 * user-facing error when the Seat can't be claimed.
 *
 * Returns the Notification it causes, if any, for the route to `notify` after
 * the write.
 */
export function claimSeat(
  db: Db,
  code: string,
  userId: number,
  userCountry: string
): ClaimSeatResult {
  const seat = getSeatByCode(db, code);
  if (!seat) {
    return { ok: false, error: "Seat not found" };
  }

  const block = findClaimBlock(db, seat, userId, userCountry);
  if (block) {
    return { ok: false, error: CLAIM_BLOCK_ERRORS[block] };
  }

  db.update(coupons)
    .set({
      redeemedByUserId: userId,
      redeemedAt: new Date().toISOString(),
    })
    .where(eq(coupons.id, seat.id))
    .run();

  const enrollment = db
    .insert(enrollments)
    .values({ userId, courseId: seat.courseId })
    .returning()
    .get();

  const purchase = getPurchase(db, seat.purchaseId);
  const notification = purchase
    ? seatClaimedNotification(db, seat, purchase.userId, userId)
    : null;

  return { ok: true, enrollment, notification };
}
