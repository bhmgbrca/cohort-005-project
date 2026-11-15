// ─── PROTOTYPE: throwaway Knock wiring ───
// Answers "Does Knock's feed work inside Cadence?" (wayfinder ticket #11).
// Lives on the prototype/knock-feed branch only. Never merge. No seam, no
// tests, no error handling beyond keeping the app running.

import Knock, { signUserToken } from "@knocklabs/node";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { users } from "~/db/schema";

// Nothing in Cadence loads .env, so the prototype does it itself.
try {
  process.loadEnvFile(".env");
} catch {
  console.warn("[knock-prototype] no .env found");
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`[knock-prototype] ${name} is not set in .env`);
  return value;
}

const knock = new Knock({ apiKey: env("KNOCK_SECRET_API_KEY") });

export type KnockFeedConfig = {
  publicApiKey: string;
  feedChannelId: string;
  userId: string;
  userToken: string;
  tokenSignedAt: string;
};

/** Called from the app layout loader on every navigation, for whoever the DevUI says is logged in. */
export async function getKnockFeedConfig(
  cadenceUserId: number
): Promise<KnockFeedConfig> {
  const userId = String(cadenceUserId);
  const userToken = await signUserToken(userId, {
    signingKey: env("KNOCK_SIGNING_KEY"),
    expiresInSeconds: 60 * 60,
  });
  return {
    publicApiKey: env("KNOCK_PUBLIC_API_KEY"),
    feedChannelId: env("KNOCK_FEED_CHANNEL_ID"),
    userId,
    userToken,
    tokenSignedAt: new Date().toISOString(),
  };
}

type Person = { id: number; name: string; email: string };

/** New Question → the course's Instructor. Recipients and actor are identified inline. */
export async function sendNewQuestion(args: {
  asker: Person;
  instructor: Person;
  courseTitle: string;
  lessonTitle: string;
  url: string;
}) {
  const startedAt = Date.now();
  try {
    const result = await knock.workflows.trigger("new-question", {
      recipients: [
        {
          id: String(args.instructor.id),
          name: args.instructor.name,
          email: args.instructor.email,
        },
      ],
      actor: {
        id: String(args.asker.id),
        name: args.asker.name,
        email: args.asker.email,
      },
      data: {
        course_title: args.courseTitle,
        lesson_title: args.lessonTitle,
        url: args.url,
        // Lets the prototype spot items left over from a previous DevUI user.
        recipient_id: String(args.instructor.id),
      },
    });
    console.log(
      `[knock-prototype] new-question → user ${args.instructor.id} in ${Date.now() - startedAt}ms`,
      result
    );
  } catch (error) {
    console.error(
      `[knock-prototype] new-question FAILED after ${Date.now() - startedAt}ms`,
      error
    );
  }
}

// ─── PROTOTYPE: launch-set seeding for "What does the Notification feed look like?" (#9) ───
// Every launch Notification goes through ONE generic workflow so the feed's
// look can be judged before the final templates exist. The workflow's in-app
// step renders `{{ data.body }}` as markdown with action URL `{{ data.url }}`.

export const PROTOTYPE_WORKFLOW = "prototype-launch-notification";

type Seed = { kind: string; actor: string; body: string; url: string };

const alex = "alex.rivera@ralph.dev";
const sarah = "sarah.chen@ralph.dev";
const emma = "emma.wilson@student.dev";
const james = "james.park@student.dev";
const olivia = "olivia.martinez@student.dev";
const liam = "liam@example.com";
const sophia = "sophia.davis@student.dev";
const bossy = "bossy.mcbossface@student.dev";

const lesson = "/courses/introduction-to-typescript/lessons/1";

/** The launch Notifications (#7) a person in this role would plausibly see, oldest first. */
export function launchSetFor(role: string, isTeamAdmin: boolean): Seed[] {
  if (isTeamAdmin) {
    return [
      {
        kind: "D",
        actor: liam,
        body: "Liam Thompson **claimed a Seat** on *Introduction to TypeScript* (2 of 5 claimed)",
        url: "/team",
      },
      {
        kind: "D",
        actor: sophia,
        body: "Sophia Davis **claimed a Seat** on *Introduction to TypeScript* (3 of 5 claimed)",
        url: "/team",
      },
      {
        kind: "B",
        actor: alex,
        body: '**Refund declined** for *React Fundamentals*: "Three Seats have already been claimed." You still have everything you bought.',
        url: "/team",
      },
      {
        kind: "A",
        actor: alex,
        body: "**Refund approved** for *Advanced CSS*: $450.00 is on its way back. Your Unclaimed Seats can no longer be claimed.",
        url: "/team",
      },
    ];
  }
  if (role === "admin") {
    return [
      {
        kind: "C",
        actor: emma,
        body: "**New Refund Request** from Emma Wilson for *Introduction to TypeScript* ($49.00, Individual Purchase)",
        url: "/admin/refunds",
      },
      {
        kind: "C",
        actor: bossy,
        body: "**New Refund Request** from Bossy McBossface for *Advanced CSS* ($450.00, Team Licence)",
        url: "/admin/refunds",
      },
    ];
  }
  if (role === "instructor") {
    return [
      {
        kind: "F",
        actor: emma,
        body: "Emma Wilson **asked a Question** on *Generics Basics* in *Introduction to TypeScript*",
        url: `${lesson}#comment-1`,
      },
      {
        kind: "F",
        actor: olivia,
        body: "Olivia Martinez **asked a Question** on *Mapped Types* in *Introduction to TypeScript*",
        url: `${lesson}#comment-2`,
      },
      {
        kind: "E",
        actor: alex,
        body: "Alex Rivera **answered** your Question on *Conditional Types*",
        url: `${lesson}#comment-3`,
      },
    ];
  }
  return [
    {
      kind: "E",
      actor: james,
      body: "James Park **replied** to your Question on *Generics Basics*",
      url: `${lesson}#comment-4`,
    },
    {
      kind: "E",
      actor: sarah,
      body: "Sarah Chen **answered** your Question on *Generics Basics*",
      url: `${lesson}#comment-5`,
    },
    {
      kind: "B",
      actor: alex,
      body: '**Refund declined** for *React Fundamentals*: "You\'ve completed most of the course." You still have everything you bought.',
      url: "/settings",
    },
    {
      kind: "A",
      actor: alex,
      body: "**Refund approved** for *Advanced CSS*: $49.00 is on its way back. Your Enrollment has ended.",
      url: "/settings",
    },
  ];
}

export async function seedLaunchSet(
  recipient: Person,
  role: string,
  isTeamAdmin: boolean
) {
  const seeds = launchSetFor(role, isTeamAdmin).filter(
    (s) => s.actor !== recipient.email
  );
  for (const seed of seeds) {
    const actor = db
      .select()
      .from(users)
      .where(eq(users.email, seed.actor))
      .get();
    if (!actor) continue;
    await knock.workflows.trigger(PROTOTYPE_WORKFLOW, {
      recipients: [
        {
          id: String(recipient.id),
          name: recipient.name,
          email: recipient.email,
        },
      ],
      actor: {
        id: String(actor.id),
        name: actor.name,
        email: actor.email,
        avatar: actor.avatarUrl ?? undefined,
      },
      data: {
        kind: seed.kind,
        body: seed.body,
        url: seed.url,
        recipient_id: String(recipient.id),
      },
    });
  }
  return seeds.length;
}
