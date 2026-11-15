// ─── PROTOTYPE: throwaway Notification feed variants ───
// Answers "What does the Notification feed look like in Cadence?" (wayfinder ticket #9).
// Lives on the prototype/notification-feed branch only. Never merge.
//
// Four variants of where the feed lives, switchable with ?variant=A|B|C|D and the
// floating bar at the bottom centre (or ← / →). All use Knock's real components.
//   A  Sidebar bell     → popover to the right of the sidebar
//   B  Top bar bell     → dropdown under the bell
//   C  Sidebar nav item → full /notifications page
//   D  Top bar bell     → slide-over drawer from the right
//
// Knock only mounts after hydration; before that every slot renders a quiet placeholder.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  NavLink,
  useFetcher,
  useNavigate,
  useSearchParams,
} from "react-router";
import {
  KnockFeedProvider,
  KnockProvider,
  NotificationFeed,
  NotificationFeedPopover,
  NotificationIconButton,
  useKnockFeed,
  type NotificationFeedProps,
} from "@knocklabs/react";
import "@knocklabs/react/dist/index.css";
import { Bell, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { KnockFeedConfig } from "~/lib/knock-prototype.server";
import { cn } from "~/lib/utils";

const VARIANTS = [
  { key: "A", name: "Sidebar bell → popover" },
  { key: "B", name: "Top bar bell → dropdown" },
  { key: "C", name: "Sidebar item → full page" },
  { key: "D", name: "Top bar bell → drawer" },
] as const;
type VariantKey = (typeof VARIANTS)[number]["key"];

const ReadyContext = createContext(false);

// The variant rides in the URL, but sidebar NavLinks drop the query string, so
// the last choice is remembered in localStorage too.
export function useVariant(): VariantKey {
  const [searchParams] = useSearchParams();
  const fromUrl = searchParams.get("variant") as VariantKey | null;
  const [stored, setStored] = useState<VariantKey>("A");
  useEffect(() => {
    if (fromUrl) localStorage.setItem("proto-notification-variant", fromUrl);
    setStored(
      (fromUrl ??
        (localStorage.getItem(
          "proto-notification-variant"
        ) as VariantKey | null) ??
        "A") as VariantKey
    );
  }, [fromUrl]);
  return fromUrl ?? stored;
}

export function NotificationRoot({
  config,
  children,
}: {
  config: KnockFeedConfig | null;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  useEffect(() => {
    setMounted(true);
    setColorMode(
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
  }, []);

  if (!mounted || !config) {
    return (
      <ReadyContext.Provider value={false}>{children}</ReadyContext.Provider>
    );
  }
  return (
    <KnockProvider
      apiKey={config.publicApiKey}
      user={{ id: config.userId }}
      userToken={config.userToken}
    >
      <KnockFeedProvider feedId={config.feedChannelId} colorMode={colorMode}>
        <ReadyContext.Provider value={true}>{children}</ReadyContext.Provider>
      </KnockFeedProvider>
    </KnockProvider>
  );
}

function useFeedClickHandler(
  onDone?: () => void
): NotificationFeedProps["onNotificationClick"] {
  const navigate = useNavigate();
  const { feedClient } = useKnockFeed();
  return (item) => {
    feedClient.markAsRead(item);
    onDone?.();
    const url = item.data?.url as string | undefined;
    if (url) navigate(url);
  };
}

function useCounts() {
  const { useFeedStore } = useKnockFeed();
  return useFeedStore((s) => s.metadata);
}

// ─── A: bell in the sidebar header, popover opens to the right ───

export function SidebarHeaderSlot() {
  const ready = useContext(ReadyContext);
  const variant = useVariant();
  if (variant !== "A") return null;
  if (!ready) return <BellPlaceholder />;
  return <BellWithPopover placement="right-start" />;
}

// ─── C: "Notifications" nav item with an unread count, going to a full page ───

export function SidebarNavSlot() {
  const ready = useContext(ReadyContext);
  const variant = useVariant();
  if (variant !== "C") return null;
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <Bell className="size-4" />
      Notifications
      {ready && <NavCount />}
    </NavLink>
  );
}

function NavCount() {
  const { feedClient } = useKnockFeed();
  const { unread_count } = useCounts();
  useEffect(() => {
    feedClient.fetch();
  }, [feedClient]);
  if (!unread_count) return null;
  return (
    <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
      {unread_count > 99 ? "99+" : unread_count}
    </span>
  );
}

export function NotificationsPage() {
  const ready = useContext(ReadyContext);
  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col p-6">
      <h1 className="mb-4 text-2xl font-bold">Notifications</h1>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
        {ready ? (
          <FullFeed />
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        )}
      </div>
    </div>
  );
}

function FullFeed() {
  const onClick = useFeedClickHandler();
  return <NotificationFeed onNotificationClick={onClick} />;
}

// ─── B and D: a top bar across the main column ───

export function TopBarSlot() {
  const ready = useContext(ReadyContext);
  const variant = useVariant();
  if (variant !== "B" && variant !== "D") return null;
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-end gap-2 border-b bg-background/95 px-6 backdrop-blur">
      {!ready ? (
        <BellPlaceholder />
      ) : variant === "B" ? (
        <BellWithPopover placement="bottom-end" />
      ) : (
        <BellWithDrawer />
      )}
    </div>
  );
}

function BellPlaceholder() {
  return (
    <span className="inline-flex size-8 items-center justify-center text-muted-foreground">
      <Bell className="size-4" />
    </span>
  );
}

function BellWithPopover({
  placement,
}: {
  placement: "right-start" | "bottom-end";
}) {
  const [isVisible, setIsVisible] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const onClick = useFeedClickHandler(() => setIsVisible(false));
  return (
    <>
      <NotificationIconButton
        ref={buttonRef}
        onClick={() => setIsVisible(!isVisible)}
      />
      <NotificationFeedPopover
        buttonRef={buttonRef}
        isVisible={isVisible}
        onClose={() => setIsVisible(false)}
        placement={placement}
        onNotificationClick={onClick}
      />
    </>
  );
}

function BellWithDrawer() {
  const [open, setOpen] = useState(false);
  const onClick = useFeedClickHandler(() => setOpen(false));
  return (
    <>
      <NotificationIconButton onClick={() => setOpen(!open)} />
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <aside
            className="absolute right-0 top-0 flex h-full w-[420px] flex-col border-l bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="font-semibold">Notifications</span>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <NotificationFeed onNotificationClick={onClick} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// ─── The floating switcher (not part of the design) ───

export function PrototypeSwitcher({ who }: { who: string }) {
  const ready = useContext(ReadyContext);
  const variant = useVariant();
  const [, setSearchParams] = useSearchParams();
  const index = VARIANTS.findIndex((v) => v.key === variant);

  function go(delta: number) {
    const next =
      VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length].key;
    localStorage.setItem("proto-notification-variant", next);
    setSearchParams(
      (params) => {
        params.set("variant", next);
        return params;
      },
      { replace: true, preventScrollReset: true }
    );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-900 px-3 py-2 text-xs text-white shadow-2xl ring-2 ring-orange-400">
      <button
        onClick={() => go(-1)}
        className="rounded-full p-1 hover:bg-white/10"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="font-semibold">
        {variant} ({VARIANTS[index]?.name})
      </span>
      <button
        onClick={() => go(1)}
        className="rounded-full p-1 hover:bg-white/10"
      >
        <ChevronRight className="size-4" />
      </button>
      <span className="text-white/50">|</span>
      <span className="text-white/70">{who}</span>
      {ready && <FeedControls />}
    </div>
  );
}

function FeedControls() {
  const fetcher = useFetcher<{ sent: number; error?: string }>();
  const { feedClient, useFeedStore } = useKnockFeed();
  const items = useFeedStore((s) => s.items);
  const { unseen_count, unread_count } = useCounts();
  return (
    <>
      <span className="text-white/70">
        items {items.length} · unseen {unseen_count} · unread {unread_count}
      </span>
      <fetcher.Form method="post" action="/prototype/notifications/seed">
        <button className="rounded-full bg-orange-500 px-2 py-0.5 font-semibold hover:bg-orange-400">
          {fetcher.state !== "idle" ? "sending…" : "Send launch set"}
        </button>
      </fetcher.Form>
      <button
        onClick={() => feedClient.markAllAsArchived()}
        className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20"
      >
        Empty feed
      </button>
      {fetcher.data?.error && (
        <span className="text-red-300">{fetcher.data.error}</span>
      )}
    </>
  );
}
