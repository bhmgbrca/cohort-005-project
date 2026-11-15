import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { RefundStatus, UserRole } from "~/db/schema";
import { claimSeat, SEAT_ON_HOLD, SEAT_REFUNDED } from "./seats.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let teamAdmin: typeof schema.users.$inferSelect;

function createStudent(name: string) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name.toLowerCase().replace(" ", ".")}@example.com`,
      role: UserRole.Student,
    })
    .returning()
    .get();
}

function buySeats(
  buyerId: number,
  seats: number,
  country: string | null = null
) {
  const team = db.insert(schema.teams).values({}).returning().get();
  const purchase = db
    .insert(schema.purchases)
    .values({
      userId: buyerId,
      courseId: base.course.id,
      amountPaid: 7900 * seats,
      country,
    })
    .returning()
    .get();
  const seatRows = Array.from({ length: seats }, (_, i) =>
    db
      .insert(schema.coupons)
      .values({
        teamId: team.id,
        courseId: base.course.id,
        code: `SEAT-${purchase.id}-${i}`,
        purchaseId: purchase.id,
      })
      .returning()
      .get()
  );
  return { purchase, seats: seatRows };
}

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  teamAdmin = createStudent("Tess Admin");
});

describe("claimSeat", () => {
  it("claims an Unclaimed Seat and enrolls the Student", () => {
    const { seats } = buySeats(teamAdmin.id, 2);

    const result = claimSeat(db, seats[0].code, base.user.id, "");

    expect(result).toMatchObject({
      ok: true,
      enrollment: { userId: base.user.id, courseId: base.course.id },
    });
    const seat = db
      .select()
      .from(schema.coupons)
      .where(eq(schema.coupons.id, seats[0].id))
      .get();
    expect(seat?.redeemedByUserId).toBe(base.user.id);
    expect(seat?.redeemedAt).not.toBeNull();
  });

  it("refuses an unknown code", () => {
    expect(claimSeat(db, "NOPE", base.user.id, "")).toEqual({
      ok: false,
      error: "Seat not found",
    });
  });

  it("refuses a Claimed Seat", () => {
    const { seats } = buySeats(teamAdmin.id, 1);
    claimSeat(db, seats[0].code, base.user.id, "");
    const other = createStudent("Other Student");

    expect(claimSeat(db, seats[0].code, other.id, "")).toEqual({
      ok: false,
      error: "This Seat has already been claimed",
    });
  });

  it("refuses a Seat while its Team Licence has an Open Refund Request", () => {
    const { purchase, seats } = buySeats(teamAdmin.id, 1);
    db.insert(schema.refunds)
      .values({
        purchaseId: purchase.id,
        status: RefundStatus.Open,
        reason: "Changed plans",
      })
      .run();

    expect(claimSeat(db, seats[0].code, base.user.id, "")).toEqual({
      ok: false,
      error: SEAT_ON_HOLD,
    });
  });

  it("refuses a Seat whose Team Licence was refunded", () => {
    const { seats } = buySeats(teamAdmin.id, 1);
    db.update(schema.coupons)
      .set({ refundedAt: new Date().toISOString() })
      .where(eq(schema.coupons.id, seats[0].id))
      .run();

    expect(claimSeat(db, seats[0].code, base.user.id, "")).toEqual({
      ok: false,
      error: SEAT_REFUNDED,
    });
  });

  it("refuses a Student already enrolled in the course", () => {
    const { seats } = buySeats(teamAdmin.id, 1);
    db.insert(schema.enrollments)
      .values({ userId: base.user.id, courseId: base.course.id })
      .run();

    expect(claimSeat(db, seats[0].code, base.user.id, "")).toEqual({
      ok: false,
      error: "You are already enrolled in this course",
    });
  });

  it("refuses a Student in a different country from the Team Admin's Purchase", () => {
    const { seats } = buySeats(teamAdmin.id, 1, "BR");

    expect(claimSeat(db, seats[0].code, base.user.id, "US")).toEqual({
      ok: false,
      error:
        "This Seat can only be claimed from the country the Team Licence was bought in",
    });
    expect(claimSeat(db, seats[0].code, base.user.id, "BR")).toMatchObject({
      ok: true,
    });
  });
});

describe("claimSeat: Seat claimed Notification", () => {
  it("tells the Team Admin who bought the Team Licence, with the counts at that moment", () => {
    const { seats } = buySeats(teamAdmin.id, 3);
    const first = createStudent("First Student");
    claimSeat(db, seats[0].code, first.id, "");

    const result = claimSeat(db, seats[1].code, base.user.id, "");

    expect(result.ok && result.notification).toEqual({
      kind: "seat-claimed",
      recipients: [{ id: teamAdmin.id, name: "Tess Admin" }],
      actor: { id: base.user.id, name: "Test User" },
      url: "/team",
      seatId: seats[1].id,
      courseTitle: "Test Course",
      claimed: 2,
      total: 3,
    });
  });

  it("counts only the Seats on this Team Licence", () => {
    buySeats(teamAdmin.id, 4);
    const { seats } = buySeats(teamAdmin.id, 2);

    const result = claimSeat(db, seats[0].code, base.user.id, "");

    expect(result.ok && result.notification).toMatchObject({
      claimed: 1,
      total: 2,
    });
  });

  it("returns no Notification when the Team Admin claims their own Seat", () => {
    const { seats } = buySeats(teamAdmin.id, 2);

    const result = claimSeat(db, seats[0].code, teamAdmin.id, "");

    expect(result).toMatchObject({ ok: true, notification: null });
  });
});
