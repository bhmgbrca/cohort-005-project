import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "~/test/setup";
import { createComment, deleteComment } from "~/lib/comments.server";
import { fakeNotifications } from "~/lib/notifications.fake.server";
import { lessonPage } from "../index.server";
import { decisionsFor, seedCourse } from "./fixtures";

let testDb: TestDb;
vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

const NOW = new Date(2026, 9, 6, 12, 0, 0);
let seeded: ReturnType<typeof seedCourse>;

beforeEach(() => {
  testDb = createTestDb();
  seeded = seedCourse(testDb);
});

async function post(authorId: number, body: string, parentId: number | null) {
  const created = await createComment(
    testDb,
    authorId,
    seeded.lessonIds[0],
    parentId,
    body,
    NOW,
    fakeNotifications()
  );
  if (!created.ok) throw new Error(created.error);
  return created.comment.id;
}

async function remove(commentId: number, userId: number) {
  await deleteComment(
    testDb,
    commentId,
    userId,
    false,
    NOW,
    fakeNotifications()
  );
}

async function thread() {
  const page = await lessonPage.load(
    decisionsFor(seeded, true),
    seeded.lessonIds[0]
  );
  if (page?.view !== "full") throw new Error("expected the full view");
  return page.comments;
}

describe("the lesson's discussion thread", () => {
  it("nests replies under their question and marks the instructor", async () => {
    const question = await post(seeded.user.id, "How do generics work?", null);
    await post(seeded.instructor.id, "Like parameters, for types.", question);

    const [top, ...rest] = await thread();
    expect(rest).toEqual([]);
    expect(top).toMatchObject({ id: question, deleted: false });
    expect(top.author.isInstructor).toBe(false);
    expect(top.replies).toHaveLength(1);
    expect(top.replies[0].author.isInstructor).toBe(true);
    expect(top.replies[0].bodyHtml).toContain("Like parameters, for types.");
  });

  it("drops a deleted question that has no replies", async () => {
    const question = await post(seeded.user.id, "Never mind, found it.", null);
    await remove(question, seeded.user.id);
    expect(await thread()).toEqual([]);
  });

  it("keeps a deleted question with replies, blanking its body", async () => {
    const question = await post(seeded.user.id, "How do generics work?", null);
    await post(seeded.instructor.id, "Like parameters, for types.", question);
    await remove(question, seeded.user.id);

    const [top] = await thread();
    expect(top).toMatchObject({ deleted: true, bodyHtml: "", editedAt: null });
    expect(top.replies).toHaveLength(1);
  });

  it("hides a deleted reply", async () => {
    const question = await post(seeded.user.id, "How do generics work?", null);
    const reply = await post(seeded.user.id, "Oh wait, I see now.", question);
    await remove(reply, seeded.user.id);

    const [top] = await thread();
    expect(top.replies).toEqual([]);
  });

  it("finds a comment by id", async () => {
    const question = await post(seeded.user.id, "How do generics work?", null);
    expect(lessonPage.getComment(question)?.lessonId).toBe(seeded.lessonIds[0]);
  });
});
