"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell as BellIcon } from "./Icons";
import { lastSeenText } from "@/lib/api";

const str = (v: any) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function parseNote(n: any) {
  const d = n?.data ?? n ?? {};
  const type = String(n?.type);
  const kind: "tag" | "reply" | "like" | "dislike" = type.includes("PingUser") ? "tag"
    : type.includes("UserReactedToYourMessage") ? (d.liked === false ? "dislike" : "like") : "reply";
  const raw = d.conversation_id ?? d.conversationId ?? (typeof d.conversation === "object" ? d.conversation?.id : d.conversation);
  const convoId = raw != null && raw !== "" && !isNaN(Number(raw)) ? Number(raw) : null;
  const s = d.sender ?? d.from ?? d.replier ?? d.tagged_by ?? d.message?.sender;
  const sender = str(typeof s === "string" ? s : s?.name) ?? str(d.sender_name) ?? str(d.from_name) ?? str(d.user_name) ?? n?._ctx?.sender;
  const preview = str(d.body) ?? str(d.message_body) ?? str(typeof d.message === "string" ? d.message : d.message?.body) ?? n?._ctx?.preview;
  return { kind, convoId, sender, preview, reactorId: d.reactor_id as number | undefined };
}

export function describeNote(n: any, title?: string) {
  const p = parseNote(n);
  const who = p.sender ?? "Someone";
  return { ...p, title: title ?? "Conversation", line: p.kind === "tag" ? `${who} tagged you` : p.kind === "like" ? `${who} liked your message` : p.kind === "dislike" ? `${who} disliked your message` : `${who} replied to your message`, when: n?.created_at ?? n?._at };
}

export function groupNotes(notes: any[], titleOf: (cid: number | null) => string | undefined) {
  const map = new Map<string, any>();
  const out: any[] = [];
  notes.forEach((n, i) => {
    const d = describeNote(n, titleOf(parseNote(n).convoId));
    const key = d.convoId != null ? `c${d.convoId}` : `n${n.id ?? i}`;
    const g = map.get(key);
    if (g) { g.count++; g.notes.push(n); }
    else { const item = { ...d, key, count: 1, notes: [n] }; map.set(key, item); out.push(item); }
  });
  return out;
}

export function Bell({ items, total, onOpen, onClear }: any) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 8, bottom: 8 });
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 296)), bottom: window.innerHeight - r.top + 8 });
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const down = (e: Event) => {
      const t = e.target as Node;
      if (pop.current?.contains(t) || btn.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className="relative">
      <button ref={btn} onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-surface" aria-label="Notifications" aria-expanded={open}>
        <BellIcon size={18} />{total > 0 && <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] leading-none text-white">{total > 9 ? "9+" : total}</span>}
      </button>
      {typeof document !== "undefined" && createPortal(<AnimatePresence>
        {open && (
          <motion.div ref={pop} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ left: pos.left, bottom: pos.bottom }}
            className="fixed z-75 max-h-[70dvh] w-72 overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-lg">
            <div className="flex items-center justify-between px-2 pb-1 text-xs text-faint">
              <span>Notifications</span>{total > 0 && <button onClick={() => { onClear(); setOpen(false); }} className="hover:text-ink">Clear all</button>}
            </div>
            {items.length === 0 && <p className="px-2 py-3 text-sm text-mute">You're all caught up.</p>}
            {items.map((g: any) => (
              <button key={g.key} onClick={() => { onOpen(g); setOpen(false); }} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-surface">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{g.title}</span>
                    {g.when && <span className="shrink-0 text-[10px] text-faint">{lastSeenText(g.when)}</span>}
                  </span>
                  <span className="block truncate text-xs text-mute">{g.line}</span>
                  {g.preview && <span className="block truncate text-xs text-faint">“{g.preview}”</span>}
                </span>
                {g.count > 1 && <span className="mt-0.5 grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-surface px-1 text-[10px] text-mute">{g.count}</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </div>
  );
}

export function Toast({ item, onOpen, onDone }: any) {
  return (
    <motion.button initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}
      onAnimationComplete={(d: any) => d.y === 0 && setTimeout(onDone, 4000)} onClick={() => { onOpen(item); onDone(); }}
      className="w-72 max-w-full rounded-2xl border border-line bg-white px-4 py-3 text-left text-sm shadow-lg">
      <span className="block truncate font-medium">{item.title}</span>
      <span className="block truncate text-xs text-mute">{item.line}</span>
      {item.preview && <span className="block truncate text-xs text-faint">“{item.preview}”</span>}
    </motion.button>
  );
}
