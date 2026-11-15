// ─── Purchases ───
// The two kinds of Purchase, what each is called and where its buyer manages
// it. See GLOSSARY.md, "Purchase". No database here, so pages can use it.

// There is no column saying which kind a Purchase is: a Team Licence is the
// Purchase that granted Seats, and every Team Licence grants at least one.
export const PURCHASE_KINDS = {
  individual_purchase: {
    label: "Individual Purchase",
    /** Where the buyer manages it and its Refund Requests. */
    pagePath: "/settings",
    /** What an Approved Refund Request ends, told to the buyer. */
    refundEnds: "Your Enrollment has ended.",
  },
  team_licence: {
    label: "Team Licence",
    pagePath: "/team",
    refundEnds: "Your Unclaimed Seats can no longer be claimed.",
  },
} as const;

export type PurchaseKind = keyof typeof PURCHASE_KINDS;

/** Where the buyer manages a Purchase and its Refund Requests. */
export function purchasePagePath(kind: PurchaseKind) {
  return PURCHASE_KINDS[kind].pagePath;
}

/** Where a Platform Admin decides Refund Requests. */
export const ADMIN_REFUNDS_PATH = "/admin/refunds";
