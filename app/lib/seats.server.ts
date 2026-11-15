import { and, eq } from "drizzle-orm";
import type { Db } from "~/db";
import { coupons, enrollments, purchases } from "~/db/schema";
import { getCourseTitle } from "~/lib/courses.server";
import type { Notification } from "~/lib/notifier.server";
import { getPerson } from "~/lib/people.server";
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
  "This seat can't be claimed right now. Ask the person who shared it with you.";
export const SEAT_REFUNDED =
  "This seat is no longer available. Ask the person who shared it with you.";

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
    url: "/team",
    seatId: seat.id,
    courseTitle,
    ...countSeats(db, seat.purchaseId),
  };
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
  const seat = db.select().from(coupons).where(eq(coupons.code, code)).get();
  if (!seat) {
    return { ok: false, error: "Seat not found" };
  }

  if (seat.redeemedByUserId !== null) {
    return { ok: false, error: "This Seat has already been claimed" };
  }

  const availability = getSeatAvailability(db, seat);
  if (availability === "on_hold") {
    return { ok: false, error: SEAT_ON_HOLD };
  }
  if (availability === "refunded") {
    return { ok: false, error: SEAT_REFUNDED };
  }

  const existingEnrollment = db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, seat.courseId)
      )
    )
    .get();

  if (existingEnrollment) {
    return { ok: false, error: "You are already enrolled in this course" };
  }

  const purchase = db
    .select()
    .from(purchases)
    .where(eq(purchases.id, seat.purchaseId))
    .get();

  if (purchase?.country && purchase.country !== userCountry) {
    return {
      ok: false,
      error:
        "This Seat can only be claimed from the country the Team Licence was bought in",
    };
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

  const notification = purchase
    ? seatClaimedNotification(db, seat, purchase.userId, userId)
    : null;

  return { ok: true, enrollment, notification };
}
