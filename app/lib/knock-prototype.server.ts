// ─── PROTOTYPE: throwaway Knock wiring ───
// Answers "Does Knock's feed work inside Cadence?" (wayfinder ticket #11).
// Lives on the prototype/knock-feed branch only. Never merge. No seam, no
// tests, no error handling beyond keeping the app running.

import Knock, { signUserToken } from "@knocklabs/node";

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
