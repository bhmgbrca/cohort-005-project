// ─── Notification feed ───
// The bell in the sidebar header and Knock's feed popover. See GLOSSARY.md,
// "Notification", and ADR 0013. The browser reads the person's feed straight
// from Knock with the public key and a user token signed by the server
// (`getFeedConfig` in notifier.server.ts).

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Bell } from "lucide-react";
import {
  KnockFeedProvider,
  KnockProvider,
  NotificationFeedPopover,
  NotificationIconButton,
} from "@knocklabs/react";
import "@knocklabs/react/dist/index.css";
import type { FeedConfig } from "~/lib/notifier.server";
import {
  parseRefreshedToken,
  TOKEN_REFRESH_URL,
} from "~/lib/notification-feed";

interface NotificationFeedProps {
  /** `null` when there's no user or no Knock configuration: no bell at all. */
  config: FeedConfig | null;
  colorMode: "light" | "dark";
}

export function NotificationFeed({ config, colorMode }: NotificationFeedProps) {
  // Knock only runs in the browser: the server and the first client render
  // show a plain bell, and the feed mounts after hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!config) return null;
  if (!mounted) return <PlainBell />;

  // A different user (DevUI switch) gets a fresh Knock client and feed.
  return (
    <KnockFeed key={config.userId} config={config} colorMode={colorMode} />
  );
}

function PlainBell() {
  return (
    <span
      aria-hidden
      className="flex size-8 items-center justify-center text-sidebar-foreground/70"
    >
      <Bell className="size-4" />
    </span>
  );
}

function KnockFeed({
  config,
  colorMode,
}: {
  config: FeedConfig;
  colorMode: "light" | "dark";
}) {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // The layout loader signs a new token on every navigation. Keep the first
  // one: passing each new token would make Knock re-authenticate on every
  // navigation. Expiry is handled by `refreshToken` instead.
  const [userToken] = useState(config.userToken);
  const userId = config.userId;

  // Stable, so Knock doesn't rebuild its client on every render.
  const refreshToken = useCallback(async () => {
    const response = await fetch(TOKEN_REFRESH_URL, {
      headers: { Accept: "application/json" },
    });
    const refreshed = response.ok
      ? parseRefreshedToken(await response.json().catch(() => null))
      : null;
    if (!refreshed) {
      // Signed out, Knock unconfigured, a server error or an unexpected body:
      // reload rather than let the feed die silently once the old token
      // expires.
      window.location.reload();
      return;
    }

    if (refreshed.userId !== userId) {
      // This tab is showing someone else's feed; reload as the current user.
      window.location.reload();
      return;
    }
    return refreshed.token;
  }, [userId]);

  return (
    <KnockProvider
      apiKey={config.publicApiKey}
      user={{ id: userId }}
      userToken={userToken}
      onUserTokenExpiring={refreshToken}
    >
      <KnockFeedProvider feedId={config.feedChannelId} colorMode={colorMode}>
        <NotificationIconButton
          ref={buttonRef}
          onClick={() => setIsVisible((visible) => !visible)}
        />
        <NotificationFeedPopover
          buttonRef={buttonRef}
          isVisible={isVisible}
          onClose={() => setIsVisible(false)}
          placement="right-start"
          // Knock marks the item read before calling this. Without it, Knock
          // would do a full page load to the item's link.
          onNotificationClick={(item) => {
            setIsVisible(false);
            const url = item.data?.url;
            if (typeof url === "string") navigate(url);
          }}
        />
      </KnockFeedProvider>
    </KnockProvider>
  );
}
