// ─── PROTOTYPE: throwaway Knock feed ───
// Answers "Does Knock's feed work inside Cadence?" (wayfinder ticket #11).
// Lives on the prototype/knock-feed branch only. Never merge.
//
// The feed is mounted client-side only: nothing Knock renders during SSR.
// Add ?knockRemount=1 to the URL to give the provider key={userId}, to compare
// "provider follows the new user by itself" against "remount on every switch".

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  KnockFeedProvider,
  KnockProvider,
  NotificationFeedPopover,
  NotificationIconButton,
  useKnockFeed,
} from "@knocklabs/react";
import "@knocklabs/react/dist/index.css";
import type { KnockFeedConfig } from "~/lib/knock-prototype.server";

export function KnockFeedPrototype({
  config,
  users,
}: {
  config: KnockFeedConfig | null;
  users: { id: number; name: string }[];
}) {
  const [mounted, setMounted] = useState(false);
  const [searchParams] = useSearchParams();
  const remount = searchParams.get("knockRemount") === "1";

  useEffect(() => setMounted(true), []);

  if (!config) {
    return <Shell>No user selected, so no feed.</Shell>;
  }
  if (!mounted) {
    return <Shell>SSR / pre-hydration placeholder (no Knock yet)</Shell>;
  }

  return (
    <KnockProvider
      key={remount ? config.userId : undefined}
      apiKey={config.publicApiKey}
      user={{ id: config.userId }}
      userToken={config.userToken}
      logLevel="debug"
    >
      <KnockFeedProvider feedId={config.feedChannelId}>
        <Feed config={config} users={users} remount={remount} />
      </KnockFeedProvider>
    </KnockProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed top-3 right-3 z-50 rounded-md border border-dashed border-orange-400 bg-orange-50 px-3 py-2 text-xs text-orange-900 shadow">
      <strong>PROTOTYPE · Knock feed</strong> · {children}
    </div>
  );
}

function Feed({
  config,
  users,
  remount,
}: {
  config: KnockFeedConfig;
  users: { id: number; name: string }[];
  remount: boolean;
}) {
  const { feedClient, useFeedStore } = useKnockFeed();
  const items = useFeedStore((state) => state.items);
  const metadata = useFeedStore((state) => state.metadata);
  const loading = useFeedStore((state) => state.loading);
  const [isVisible, setIsVisible] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [crossCheck, setCrossCheck] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(true);

  useEffect(() => {
    feedClient.fetch();
  }, [feedClient]);

  // The server stamps data.recipient_id on every item. Any item for someone
  // else is a leftover from the previous DevUI user.
  const foreignItems = items.filter(
    (item) => item.data?.recipient_id !== config.userId
  );

  const claims = decodeJwt(config.userToken);
  const other = users.find((u) => String(u.id) !== config.userId);

  async function tryOtherUsersFeed() {
    if (!other) return;
    setCrossCheck("checking…");
    const response = await fetch(
      `https://api.knock.app/v1/users/${other.id}/feeds/${config.feedChannelId}`,
      {
        headers: {
          Authorization: `Bearer ${config.publicApiKey}`,
          "X-Knock-User-Token": config.userToken,
        },
      }
    );
    setCrossCheck(
      `GET user ${other.id} (${other.name})'s feed with user ${config.userId}'s token → HTTP ${response.status} ${response.ok ? "⚠️ ALLOWED" : "✅ refused"}`
    );
  }

  return (
    <div className="fixed top-3 right-3 z-50 flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 rounded-md border border-dashed border-orange-400 bg-orange-50 px-2 py-1 shadow">
        <span className="text-xs font-semibold text-orange-900">
          PROTOTYPE · Knock
        </span>
        <NotificationIconButton
          ref={buttonRef}
          onClick={() => setIsVisible(!isVisible)}
        />
        <NotificationFeedPopover
          buttonRef={buttonRef}
          isVisible={isVisible}
          onClose={() => setIsVisible(false)}
        />
        <button
          className="text-xs text-orange-900 underline"
          onClick={() => setShowDebug(!showDebug)}
        >
          {showDebug ? "hide state" : "state"}
        </button>
      </div>

      {showDebug && (
        <pre className="max-w-md overflow-x-auto rounded-md border bg-white p-3 text-[11px] leading-snug shadow">
          {JSON.stringify(
            {
              cadenceUser: config.userId,
              tokenSub: claims?.sub,
              tokenExpires: claims?.exp
                ? new Date(claims.exp * 1000).toISOString()
                : null,
              tokenSignedAt: config.tokenSignedAt,
              remountOnSwitch: remount,
              feedLoading: loading,
              itemCount: items.length,
              unseen: metadata.unseen_count,
              unread: metadata.unread_count,
              foreignItems: foreignItems.length,
              items: items.slice(0, 5).map((item) => ({
                recipient: item.data?.recipient_id,
                actor: item.actors?.[0] && "name" in item.actors[0] ? item.actors[0].name : null,
                data: item.data,
                seen: item.seen_at !== null,
                inserted: item.inserted_at,
              })),
            },
            null,
            2
          )}
          {"\n"}
          <button
            className="mt-2 rounded border px-2 py-1 text-xs hover:bg-gray-50"
            onClick={tryOtherUsersFeed}
          >
            Try reading {other?.name ?? "another user"}'s feed with my token
          </button>
          {crossCheck && <div className="mt-1 text-xs">{crossCheck}</div>}
        </pre>
      )}
    </div>
  );
}

function decodeJwt(token: string): { sub?: string; exp?: number } | null {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}
