import { useState } from "react";
import { useFetcher } from "react-router";
import { CheckCircle2, Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { describeNoteDraft, type NoteDraftStatus } from "~/modules/lesson-note";

export type LessonNoteData = { body: string; updatedAt: string } | null;

/** The Student's private Note on a Lesson, styled to sit with the Discussion card. */
export function LessonNote({ note }: { note: LessonNoteData }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [draft, setDraft] = useState(note?.body ?? "");
  const isSaving = fetcher.state !== "idle";
  const error = isSaving ? undefined : fetcher.data?.error;
  const { status, canSave, counter } = describeNoteDraft(
    draft,
    note?.body ?? null,
    MAX_NOTE_LENGTH
  );

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <NoteHeader />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={5}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes"
            className="min-h-32 resize-y"
          />

          <NoteFooter
            isSaving={isSaving}
            canSave={canSave}
            error={error}
            status={status}
            counter={counter}
            updatedAt={note?.updatedAt}
          />
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function NoteHeader() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <NotebookPen className="size-5 text-primary" />
      <h2 className="text-xl font-semibold">Your notes</h2>
      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" />
        Only you can see these
      </span>
    </div>
  );
}

function NoteFooter({
  isSaving,
  canSave,
  error,
  status,
  counter,
  updatedAt,
}: {
  isSaving: boolean;
  canSave: boolean;
  error: string | undefined;
  status: NoteDraftStatus;
  counter: string;
  updatedAt: string | undefined;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" size="sm" disabled={isSaving || !canSave}>
        {isSaving ? "Saving..." : "Save note"}
      </Button>

      {error ? (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      ) : (
        <NoteStatus status={status} updatedAt={updatedAt} />
      )}

      <span
        className={cn(
          "ml-auto text-xs",
          status.kind === "too-long"
            ? "text-destructive"
            : "text-muted-foreground"
        )}
      >
        {counter}
      </span>
    </div>
  );
}

function NoteStatus({
  status,
  updatedAt,
}: {
  status: NoteDraftStatus;
  updatedAt: string | undefined;
}) {
  if (status.kind === "saved" && updatedAt) {
    return (
      <span
        suppressHydrationWarning
        className="flex items-center gap-1 text-xs text-muted-foreground"
      >
        <CheckCircle2 className="size-3.5 text-green-600" />
        Saved {formatRelativeTime(updatedAt)}
      </span>
    );
  }
  if (status.kind === "unsaved") {
    return (
      <span className="text-xs text-muted-foreground">Unsaved changes</span>
    );
  }
  if (status.kind === "too-long") {
    return (
      <span className="text-xs text-destructive">
        {status.over.toLocaleString("en")} characters over the limit
      </span>
    );
  }
  return null;
}
