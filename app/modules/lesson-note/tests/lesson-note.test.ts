import { describe, it, expect } from "vitest";
import { describeNoteDraft } from "../index";

describe("describeNoteDraft", () => {
  it("is empty and unsaveable when nothing is written and nothing is saved", () => {
    expect(describeNoteDraft("", null, 2000)).toEqual({
      status: { kind: "empty" },
      canSave: false,
      counter: "0 / 2,000",
    });
  });

  it("treats whitespace alone as empty", () => {
    expect(describeNoteDraft("  \n ", null, 2000).status).toEqual({
      kind: "empty",
    });
  });

  it("is unsaved and saveable once the Student writes something new", () => {
    expect(describeNoteDraft("Generics", null, 2000)).toEqual({
      status: { kind: "unsaved" },
      canSave: true,
      counter: "8 / 2,000",
    });
  });

  it("is saved when the box matches the stored Note", () => {
    expect(describeNoteDraft("Generics", "Generics", 2000)).toEqual({
      status: { kind: "saved" },
      canSave: false,
      counter: "8 / 2,000",
    });
  });

  it("ignores surrounding whitespace the server would trim", () => {
    expect(describeNoteDraft("Generics\n", "Generics", 2000).status).toEqual({
      kind: "saved",
    });
  });

  it("is unsaved after an edit to the stored Note", () => {
    expect(describeNoteDraft("Generics!", "Generics", 2000).canSave).toBe(true);
  });

  it("is unsaved when the Student clears a stored Note, but cannot save an empty one", () => {
    expect(describeNoteDraft("", "Generics", 2000)).toEqual({
      status: { kind: "empty" },
      canSave: false,
      counter: "0 / 2,000",
    });
  });

  it("allows exactly the maximum length", () => {
    expect(describeNoteDraft("abcde", null, 5).canSave).toBe(true);
  });

  it("reports how far over the limit the draft is", () => {
    expect(describeNoteDraft("abcdefg", null, 5)).toEqual({
      status: { kind: "too-long", over: 2 },
      canSave: false,
      counter: "7 / 5",
    });
  });

  it("is too long even when a saved Note exists", () => {
    expect(describeNoteDraft("abcdef", "abc", 5).status.kind).toBe("too-long");
  });
});
