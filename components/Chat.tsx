"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, BASE, convoTitle, lastSeenText, tok } from "@/lib/api";
import { listenAll } from "@/lib/echo";
import Avatar from "./Avatar";
import Members from "./Members";
import Lightbox from "./Lightbox";
import Confirm from "./Confirm";
import { ArrowUp, Check, Copy, Pencil, Pin, Plus, Reply, SidebarIcon, ThumbDown, ThumbUp, Trash, Users } from "./Icons";

function Attachment({ a, image, onReady, onOpen }: { a: any; image: boolean; onReady?: (url: string) => void; onOpen?: () => void }) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (a.id == null) { setFailed(true); return; }
    let u: string;
    fetch(`${BASE}/api/attachments/${a.id}/download`, { headers: { Authorization: `Bearer ${tok.get()}`, "ngrok-skip-browser-warning": "1" } })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then((b) => { u = URL.createObjectURL(b); setUrl(u); onReady?.(u); })
      .catch(() => setFailed(true));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [a.id]);
  if (failed) return <span className="text-sm text-mute">{a.file_name ?? "Attachment"} <span className="text-xs text-faint">(can't load)</span></span>;
  if (image) return url
    ? <img src={url} alt={a.file_name} onClick={onOpen} className="max-h-64 max-w-full cursor-zoom-in rounded-xl" />
    : <div className="h-32 w-48 max-w-full animate-pulse rounded-xl bg-black/5" />;
  return <a href={url} download={a.file_name} className="text-sm underline underline-offset-2">{a.file_name}</a>;
}
const Act = ({ label, onClick, active, danger, count, children }: any) => (
  <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label} title={label}
    className={`flex h-7 min-w-7 items-center justify-center gap-1 rounded-lg px-1.5 text-xs hover:bg-surface ${active ? "text-ink" : ""} ${danger ? "hover:text-red-600!" : "hover:text-ink"}`}>{children}{count > 0 && <span>{count}</span>}</button>
);
const Ticks = ({ level }: { level: number }) => (
  <span title={level === 2 ? "Read" : level === 1 ? "Delivered" : "Sent"} className={`text-[11px] leading-none tracking-tighter ${level === 2 ? "text-ink" : "text-faint"}`}>{level ? "✓✓" : "✓"}</span>
);
const replyText = (r: any) =>
  !r || typeof r !== "object" ? "" : typeof r.body === "string" ? r.body : r.type === "image" ? "Photo" : r.type === "file" || Array.isArray(r.body) ? "Attachment" : "";
const snippet = (m: any) => replyText(m) || "Attachment";
const sameId = (a: any, b: any) => a != null && b != null && String(a) === String(b);
const snap = (t: any) => ({ id: t.id, type: t.type, body: typeof t.body === "string" ? t.body : null, sender: t.sender ? { name: t.sender.name, friend_id: t.sender.friend_id } : undefined });
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const atts = (m: any): any[] => (Array.isArray(m.body) ? m.body : m.body ? [m.body] : []);
const akey = (m: any, a: any, i: number) => `${m.id}:${a.id ?? a.path ?? i}`;
const mergeMsg = (old: any, upd: any) => ({
  ...old, ...upd,
  sender: upd.sender ?? old.sender,
  reply_to: upd.reply_to && typeof upd.reply_to === "object" ? upd.reply_to : old.reply_to ?? upd.reply_to,
});

export default function Chat({ me, convo, echo, names, onPartner, onMessage, presence, onMembers, onGone, profiles, onMenu }: any) {
  const ov = (u: any) => (u ? { ...u, ...profiles?.[u.friend_id] } : u);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<any>(null);
  const [edit, setEdit] = useState<{ id: number; value: string } | null>(null);
  const [pinIdx, setPinIdx] = useState(0);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [ask, setAsk] = useState<{ text: string; label: string; run: () => void } | null>(null);
  const [caret, setCaret] = useState(0);
  const [sel, setSel] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [mentions, setMentions] = useState<any[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [owner, setOwner] = useState<any>(undefined);
  const [removed, setRemoved] = useState<any[]>([]);
  const [viewer, setViewer] = useState<string | null>(null);
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState(true);
  const [reactView, setReactView] = useState<number | null>(null);
  const reactBusy = useRef(new Set<number>());
  const [copied, setCopied] = useState<number | null>(null);
  const [tapped, setTapped] = useState<number | null>(null);
  const readUpTo = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgEls = useRef(new Map<number, HTMLElement>());
  const flashT = useRef<any>(null);
  const replyCache = useRef<Record<string, any>>({});
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const lastPing = useRef(0);
  const typingSent = useRef(false);
  const idle = useRef<any>(null);
  const prevNewest = useRef<any>(null);
  const typingTimer = useRef<any>(null);
  const id = convo.id;
  const role = convo.members?.find((m: any) => m.friend_id === me.friend_id)?.role;
  const isOwner = !!owner && (owner.friend_id === me.friend_id || owner.id === me.id);
  const isAdmin: boolean = role ? role === "owner" || role === "admin" : owner === undefined ? false : owner === null ? true : isOwner;

  const likers = (m: any): any[] => m.liked_users ?? [];
  const dislikers = (m: any): any[] => m.disliked_users ?? [];
  const likeCount = (m: any): number => m.likes_count ?? likers(m).length;
  const dislikeCount = (m: any): number => m.dislikes_count ?? dislikers(m).length;
  const mine_ = (m: any): "like" | "dislike" | null =>
    likers(m).some((u: any) => sameId(u.id, me.id)) ? "like" : dislikers(m).some((u: any) => sameId(u.id, me.id)) ? "dislike" : null;
  const applyReactions = (full: any) => setMsgs((cur) => cur.map((x) => x.id === full.id
    ? { ...x, liked_users: full.liked_users ?? [], disliked_users: full.disliked_users ?? [], likes_count: undefined, dislikes_count: undefined } : x));
  const userStub = (uid: any) => people.find((p: any) => sameId(p.id, uid)) ?? (sameId(uid, me.id) ? me : { id: uid });
  const onReactEvent = (e: any, liked: boolean | null) => {
    if (e?.message_id == null) return;
    setMsgs((cur) => cur.map((x) => {
      if (!sameId(x.id, e.message_id)) return x;
      const not = (u: any) => !sameId(u.id, e.user_id);
      const l = likers(x).filter(not), d = dislikers(x).filter(not);
      if (liked === true) l.push(userStub(e.user_id)); else if (liked === false) d.push(userStub(e.user_id));
      return { ...x, liked_users: l, disliked_users: d, likes_count: e.likes_count, dislikes_count: e.dislikes_count };
    }));
  };
  async function react(m: any, kind: "like" | "dislike") {
    if (reactBusy.current.has(m.id)) return;
    reactBusy.current.add(m.id);
    try {
      const full = mine_(m) === kind
        ? await api(`/message/${m.id}/remove_reaction`, { method: "DELETE" })
        : await api(`/message/${m.id}/${kind}`, { method: "POST" });
      applyReactions(full); setErr("");
    } catch (x: any) { fail(x); }
    finally { reactBusy.current.delete(m.id); }
  }
  async function removeReaction(m: any, uid: any) {
    try { applyReactions(await api(`/message/${m.id}/remove_reaction`, { method: "DELETE", body: { user_id: uid } })); }
    catch (x: any) { fail(x); }
  }
  async function copyMsg(m: any) {
    const t = typeof m.body === "string" ? m.body : "";
    try { await navigator.clipboard.writeText(t); }
    catch { const a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } catch {} a.remove(); }
    setCopied(m.id); setTimeout(() => setCopied((c) => (c === m.id ? null : c)), 1500);
  }

  const people = useMemo(() => {
    const map = new Map<string, any>();
    [...(convo.members ?? []), ...msgs.map((m) => m.sender)].forEach((u) => u && u.friend_id !== me.friend_id && map.set(u.friend_id, ov(u)));
    return [...map.values()];
  }, [convo.members, msgs, me.friend_id, profiles]);
  const knownMembers = convo.members?.length ? convo.members : [me, ...people];
  const saveReply = (mid: number, t: any) => {
    const c = replyCache.current; c[mid] = snap(t);
    Object.keys(c).map(Number).sort((a, b) => b - a).slice(300).forEach((k) => delete c[k]);
    try { localStorage.setItem(`replies:${me.friend_id}:${id}`, JSON.stringify(c)); } catch {}
  };
  const hydrate = (m: any, all: any[]) => {
    const r = m.reply_to;
    let t = r && typeof r === "object" ? r : r != null && r !== "" ? all.find((x) => sameId(x.id, r)) : undefined;
    if (t) { saveReply(m.id, t); return t === r ? m : { ...m, reply_to: t }; }
    const c = replyCache.current[m.id];
    return c ? { ...m, reply_to: c } : m;
  };
  const replyOf = (m: any) => (m.reply_to && typeof m.reply_to === "object" ? m.reply_to : m.reply_to != null && m.reply_to !== "" ? msgs.find((x) => sameId(x.id, m.reply_to)) : undefined);
  const pinned = useMemo(() => msgs.filter((m) => m.is_pinned).sort((a, b) => b.id - a.id), [msgs]);
  const curPin = pinned.length ? Math.min(pinIdx, pinned.length - 1) : 0;
  const mentionRe = useMemo(() => {
    const ns = [...people.map((p) => p.name), me.name].filter(Boolean).sort((a: string, b: string) => b.length - a.length).map(esc);
    return ns.length ? new RegExp(`@(${ns.join("|")})`, "g") : null;
  }, [people, me.name]);
  const renderText = (t: string, mine: boolean) => !mentionRe ? t : t.split(mentionRe).map((part, i) =>
    i % 2 ? <span key={i} className="rounded bg-black/5 px-1 font-medium">@{part}</span> : part);
  function jumpTo(mid: number) {
    const el = msgEls.current.get(mid);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(mid); clearTimeout(flashT.current); flashT.current = setTimeout(() => setFlashId(null), 1800);
  }
  function cyclePin() {
    const p = pinned[curPin]; if (!p) return;
    jumpTo(p.id); setPinIdx((curPin + 1) % pinned.length);
  }
  const askPin = (m: any) => setAsk({ text: m.is_pinned ? "Would you like to unpin this message?" : "Would you like to pin this message?", label: m.is_pinned ? "Unpin" : "Pin", run: () => togglePin(m) });
  const gallery = useMemo(() => msgs.flatMap((m) => (m.type === "image" ? atts(m).map((a, i) => ({ key: akey(m, a, i), m, a })) : []))
    .filter((g) => imgUrls[g.key])
    .map((g) => ({ key: g.key, url: imgUrls[g.key], name: g.a.file_name, mime: g.a.mime_type, sender: ov(g.m.sender), when: g.m.created_at })), [msgs, imgUrls, profiles]);
  const viewIndex = viewer ? gallery.findIndex((g) => g.key === viewer) : -1;
  const at = convo.type !== "direct_convo" ? text.slice(0, caret).match(/(?:^|\s)@(\w*(?: \w*){0,3})$/) : null;
  const q = (at?.[1] ?? "").toLowerCase();
  const suggestions = at && !dismissed ? people.filter((p) => { const n = p.name.toLowerCase(); return n.startsWith(q) || n.split(" ").some((w: string) => w.startsWith(q)); }).slice(0, 8) : [];

  useEffect(() => {
    setMsgs([]); setReply(null); setEdit(null); setPinIdx(0); setMentions([]); setErr(""); setTyping(null); setRemoved([]);
    try { replyCache.current = JSON.parse(localStorage.getItem(`replies:${me.friend_id}:${id}`) || "{}"); } catch { replyCache.current = {}; }
    const load = () => api(`/conversation/${id}/messages?created_by`).then((c) => {
      const list = [...(c.messages ?? [])].reverse();
      setMsgs(list.map((m: any) => hydrate(m, list)));
      setOwner(c.created_by ?? null);
    }).catch((x) => setErr(x.message));
    const loadMembers = () => api(`/conversation/${id}/members_in`).then((r) => {
      const c = Array.isArray(r) ? r[0] : r;
      if (!c) return;
      const active = c.members ?? c.all_members?.filter((u: any) => !u.left_at);
      if (active?.length) onMembers?.(id, active);
      if (c.all_members) setRemoved(c.all_members.filter((u: any) => u.left_at));
    }).catch(() => {});
    load(); loadMembers();
    if (!echo) return;
    const off = listenAll(echo.private(`conversation.${id}`), {
      MessageSent: (e: any) => {
        if (!e?.message) return load();
        setMsgs((m) => (m.find((x) => x.id === e.message.id) ? m : [...m, hydrate(e.message, m)]));
        onMessage?.(id, e.message);
        if (!e.message.sender) load();
      },
      MessageUpdated: (e: any) => {
        const m = e?.message;
        if (!m?.id) return load();
        setMsgs((cur) => cur.map((x) => (x.id === m.id ? mergeMsg(x, m) : x)));
      },
      UserReacted: (e: any) => onReactEvent(e, !!e.liked),
      UserUnreacted: (e: any) => onReactEvent(e, null),
      UserAdded: loadMembers, UserDeleted: loadMembers,
      MessageDeleted: (e: any) => removeMsg(e?.message?.id) || load(),
      MessageDeletedForever: (e: any) => removeMsg(e?.message?.id) || load(),
      MessageRestored: (e: any) => {
        const m = e?.message;
        if (!m?.id) return load();
        setMsgs((cur) => (cur.find((x) => x.id === m.id) ? cur : [...cur, m].sort((a, b) => a.id - b.id)));
        if (!m.sender) load();
      },
      "user.stopped.typing": (e: any) => {
        if (String(e.userId) === String(me.id)) return;
        clearTimeout(typingTimer.current);
        setTyping(null);
      },
      "user.typing": (e: any) => {
        if (String(e.userId) === String(me.id)) return;
        setTyping(convo.type === "direct_convo" ? "" : e.name);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(null), 5000);
      },
    });
    return () => { off(); clearTimeout(typingTimer.current); stopTyping(); };
  }, [id, echo]);
  useEffect(() => {
    if (convo.type !== "direct_convo") return;
    const o = msgs.find((m) => m.sender && m.sender.friend_id !== me.friend_id);
    if (o) onPartner(id, ov(o.sender).name, ov(o.sender));
  }, [msgs, profiles]);
  useEffect(() => {
    const n = msgs[msgs.length - 1], p = prevNewest.current;
    const body = (m: any) => (typeof m?.body === "string" ? m.body : "");
    if (n && p && (n.id < p.id || (n.id === p.id && body(n) !== p.body))) onMessage?.(id, n, false);
    prevNewest.current = n ? { id: n.id, body: body(n) } : null;
  }, [msgs]);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  useEffect(() => { try { readUpTo.current = Number(localStorage.getItem(`readUpTo:${me.friend_id}:${id}`) || 0); } catch {} }, [id]);
  useEffect(() => {
    if (!visible) return;
    const todo = msgs.filter((m) => m.sender && m.sender.friend_id !== me.friend_id && m.id > readUpTo.current).slice(-30);
    if (!todo.length) return;
    readUpTo.current = todo[todo.length - 1].id;
    try { localStorage.setItem(`readUpTo:${me.friend_id}:${id}`, String(readUpTo.current)); } catch {}
    (async () => {
      for (const m of todo) {
        const r = await api(`/message/${m.id}?reply_to`).catch(() => null);
        const t = r?.reply_to;
        if (t && typeof t === "object") { saveReply(m.id, t); setMsgs((cur) => cur.map((x) => (x.id === m.id ? { ...x, reply_to: t } : x))); }
      }
    })();
  }, [msgs, visible]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, typing]);

  const fail = (x: any) => setErr(
    x.status === 429 ? `You're reacting too fast. Try again${x.retryAfter ? ` in ${x.retryAfter}s` : " in a minute"}.`
    : x.status === 403 ? "You don't have permission to do that." : x.message);

  const removeMsg = (mid?: number) => {
    if (!mid) return false;
    setMsgs((cur) => cur.filter((x) => x.id !== mid));
    return true;
  };
  function stopTyping() {
    clearTimeout(idle.current);
    if (!typingSent.current) return;
    typingSent.current = false; lastPing.current = 0;
    api(`/conversation/${id}/stopped-typing`, { method: "POST" }).catch(() => {});
  }
  function onType(v: string) {
    setText(v); setDismissed(false); setSel(0);
    if (!v) return stopTyping();
    typingSent.current = true;
    clearTimeout(idle.current); idle.current = setTimeout(stopTyping, 3000);
    if (Date.now() - lastPing.current > 3000) { lastPing.current = Date.now(); api(`/conversation/${id}/typing`, { method: "POST" }).catch(() => {}); }
  }
  function pick(u: any) {
    const start = text.slice(0, caret).lastIndexOf("@");
    const next = text.slice(0, start) + `@${u.name} ` + text.slice(caret);
    const pos = start + u.name.length + 2;
    setText(next); setMentions((m) => (m.some((x) => x.id === u.id) ? m : [...m, u])); setSel(0); setCaret(pos); setDismissed(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(pos, pos); }, 0);
  }

  async function send(attachment?: File) {
    const body = new FormData();
    body.append("conversation_id", id);
    if (attachment) { body.append("type", attachment.type.startsWith("image/") ? "image" : "file"); body.append("attachment", attachment); }
    else { if (!text.trim()) return; body.append("type", "text"); body.append("body", text.trim()); }
    if (reply) body.append("reply_to", reply.id);
    try {
      const m = await api("/message", { body });
      const mine = { ...m, sender: m.sender ?? me, ...(reply ? { reply_to: reply } : {}) };
      if (reply) saveReply(m.id, reply);
      setMsgs((x) => (x.some((y) => sameId(y.id, m.id)) ? x.map((y) => (sameId(y.id, m.id) ? { ...y, ...mine } : y)) : [...x, mine])); onMessage?.(id, m);
      mentions.filter((u) => text.includes(`@${u.name}`)).forEach((u) => api(`/notify/${u.friend_id}/in/${id}`, { method: "POST" }).catch(() => {}));
      stopTyping(); setText(""); setReply(null); setMentions([]); setErr("");
    } catch (x: any) { fail(x); }
  }
  async function saveEdit() {
    if (!edit || !edit.value.trim()) return;
    try {
      const m = await api(`/message/${edit.id}`, { method: "PATCH", body: { conversation_id: id, body: edit.value.trim() } });
      setMsgs((x) => x.map((y) => (y.id === edit.id ? mergeMsg(y, m) : y))); setEdit(null);
    } catch (x: any) { fail(x); }
  }
  async function del(m: any) {
    if (!confirm("Delete this message?")) return;
    try { await api(`/message/${m.id}`, { method: "DELETE" }); setMsgs((x) => x.filter((y) => y.id !== m.id)); }
    catch (x: any) { fail(x); }
  }
  async function togglePin(m: any) {
    try {
      await api(`/pin/${id}/${m.is_pinned ? "remove" : "add"}`, { method: "PUT", body: m.is_pinned ? { remove_pin_message: m.id } : { pin_message: m.id } });
      setMsgs((x) => x.map((y) => (y.id === m.id ? { ...y, is_pinned: !m.is_pinned } : y)));
    } catch (x: any) { fail(x); }
  }
  const typingText = typing === null ? "" : typing ? `${typing} is typing…` : convoTitle(convo, me, names) === "Direct chat" ? "Typing…" : `${convoTitle(convo, me, names)} is typing…`;
  const statusText = convo.type === "direct_convo"
    ? convo.online ? "Online" : convo.lastSeen ? `Last seen ${lastSeenText(convo.lastSeen)}` : ""
    : convo.members?.length ? `${convo.members.length} members` : "";
  const field = "text-base";

  return (
    <div className="flex h-dvh min-w-0 flex-1 flex-col bg-white">
      <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b border-surface px-2 pt-[env(safe-area-inset-top)] sm:px-4">
        <button onClick={onMenu} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-mute hover:bg-surface md:hidden" aria-label="Open chats"><SidebarIcon size={20} /></button>
        <Avatar name={convoTitle(convo, me, names)} user={convo.partner} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium leading-5">{convoTitle(convo, me, names)}</p>
          <p className={`h-4 truncate text-xs leading-4 ${typingText ? "text-ink" : convo.online ? "text-green-600" : "text-faint"}`}>{typingText || statusText}</p>
        </div>
        <button onClick={() => setShowMembers(true)} className="flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm hover:bg-surface" aria-label="Members"><Users size={18} /><span className="hidden sm:inline">Members</span></button>
      </header>
      <AnimatePresence initial={false}>
        {pinned.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="shrink-0 overflow-hidden border-b border-surface bg-white">
            <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
              <button onClick={cyclePin} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-0.5 text-left hover:bg-surface/60" title="Go to pinned message">
                <span className="flex h-9 w-0.5 flex-col gap-0.5">
                  {pinned.slice(0, 6).map((_, i) => <span key={i} className={`flex-1 rounded-full ${i === curPin ? "bg-ink" : "bg-neutral-300"}`} />)}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-mute">{pinned.length > 1 ? `Pinned message #${curPin + 1}` : "Pinned message"}</span>
                  <span className="block truncate text-sm">{replyText(pinned[curPin]) || "Message"}</span>
                </span>
              </button>
              {isAdmin && <button onClick={() => askPin(pinned[curPin])} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-mute hover:bg-surface" aria-label="Unpin message" title="Unpin"><Plus size={16} className="rotate-45" /></button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-5 px-3 py-5 sm:px-4">
          <AnimatePresence initial={false}>
            {msgs.map((m) => {
              const mine = m.sender?.friend_id === me.friend_id;
              const editing = edit?.id === m.id;
              const r = mine_(m);
              return (
                <motion.div key={m.id} ref={(el: any) => { if (el) msgEls.current.set(m.id, el); else msgEls.current.delete(m.id); }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: "easeOut" }}
                  className={`group flex gap-2.5 ${mine ? "justify-end" : ""}`}>
                  {!mine && <div className="mt-0.5 shrink-0"><Avatar user={ov(m.sender)} size={28} /></div>}
                  <div className={`flex min-w-0 flex-col ${mine ? "max-w-[85%] items-end sm:max-w-[75%]" : "max-w-[calc(100%-2.25rem)] items-start sm:max-w-[85%]"}`}>
                    {!mine && convo.type !== "direct_convo" && <p className="mb-0.5 text-[13px] font-medium leading-4 text-mute">{ov(m.sender)?.name}</p>}
                    <div onClick={() => setTapped((t) => (t === m.id ? null : m.id))}
                      className={`max-w-full rounded-3xl text-base transition-shadow duration-500 wrap-anywhere ${mine ? "bg-surface px-4 py-2.5" : "py-0.5"} ${flashId === m.id ? "shadow-[0_0_0_4px_rgba(13,13,13,0.14)]" : ""}`}>
                      {(() => {
                        if (m.reply_to == null || m.reply_to === "") return null;
                        const t = replyOf(m); const txt = replyText(t);
                        return (
                          <button onClick={(e) => { e.stopPropagation(); t && jumpTo(t.id); }} className="mb-1.5 block w-full max-w-full rounded-lg border-l-2 border-neutral-400 bg-black/5 py-1 pl-2.5 pr-2 text-left">
                            <span className="block truncate text-[13px] font-medium leading-4">{t?.sender ? ov(t.sender)?.name : "Reply"}</span>
                            <span className="block truncate text-[13px] leading-4 text-mute">{txt || "Original message"}</span>
                          </button>
                        );
                      })()}
                      {editing ? (
                        <input autoFocus value={edit!.value} onChange={(e) => setEdit({ id: m.id, value: e.target.value })} onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => (e.key === "Enter" ? saveEdit() : e.key === "Escape" && setEdit(null))}
                          className="w-full min-w-48 rounded-lg bg-white px-2.5 py-1 text-base outline-none" />
                      ) : m.type === "text" ? (typeof m.body === "string" ? renderText(m.body, mine) : m.body) : atts(m).map((a: any, i: number) => { const k = akey(m, a, i); return <Attachment key={k} a={a} image={m.type === "image"} onReady={(u) => setImgUrls((p) => ({ ...p, [k]: u }))} onOpen={() => setViewer(k)} />; })}
                      {(m.is_pinned || m.edited_at || mine) && (
                        <div className={`mt-1 flex items-center gap-1.5 text-[11px] leading-none text-faint ${mine ? "justify-end" : "justify-start"}`}>
                          {m.is_pinned && <Pin size={11} />}
                          {m.edited_at && <span>edited</span>}
                          {mine && <Ticks level={convo.receipts?.[m.id] ?? 0} />}
                        </div>
                      )}
                    </div>
                    <div className={`mt-1 items-center gap-0.5 text-mute md:flex md:opacity-0 md:transition-opacity md:focus-within:opacity-100 md:group-hover:opacity-100 ${tapped === m.id ? "flex" : "hidden"} ${r || likeCount(m) > 0 || dislikeCount(m) > 0 ? "md:opacity-100" : ""}`}>
                      {m.type === "text" && typeof m.body === "string" && <Act label={copied === m.id ? "Copied" : "Copy"} onClick={() => copyMsg(m)}>{copied === m.id ? <Check size={16} /> : <Copy size={16} />}</Act>}
                      <Act label={r === "like" ? "Remove like" : "Like"} active={r === "like"} count={likeCount(m)} onClick={() => react(m, "like")}><ThumbUp size={16} filled={r === "like"} /></Act>
                      <Act label={r === "dislike" ? "Remove dislike" : "Dislike"} active={r === "dislike"} count={dislikeCount(m)} onClick={() => react(m, "dislike")}><ThumbDown size={16} filled={r === "dislike"} /></Act>
                      {(likeCount(m) > 0 || dislikeCount(m) > 0) && <button onClick={(e) => { e.stopPropagation(); setReactView(m.id); }} className="ml-1 rounded-lg px-1.5 py-1 text-xs hover:bg-surface hover:text-ink">Who reacted</button>}
                      <Act label="Reply" onClick={() => setReply(m)}><Reply size={16} /></Act>
                      {isAdmin && <Act label={m.is_pinned ? "Unpin" : "Pin"} onClick={() => askPin(m)}><Pin size={16} /></Act>}
                      {mine && m.type === "text" && <Act label="Edit" onClick={() => setEdit({ id: m.id, value: m.body })}><Pencil size={16} /></Act>}
                      {(mine || isAdmin) && <Act label="Delete" danger onClick={() => del(m)}><Trash size={16} /></Act>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={end} />
        </div>
      </div>

      <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
        <div className="relative mx-auto w-full max-w-3xl">
          {err && <p className="px-2 pb-2 text-sm text-red-600">{err}</p>}
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute bottom-full left-0 z-10 mb-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-line bg-white p-1 shadow-lg sm:w-72">
                {suggestions.map((u, i) => (
                  <button key={u.friend_id} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setSel(i)} onClick={() => pick(u)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${i === Math.min(sel, suggestions.length - 1) ? "bg-surface" : "hover:bg-surface/70"}`}>
                    <Avatar user={u} size={26} /><span className="truncate">{u.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
            {reply && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="mb-2 flex items-center justify-between gap-3 overflow-hidden rounded-2xl bg-surface px-4 py-2 text-xs text-mute">
                <span className="min-w-0"><span className="block truncate font-medium text-ink">Reply to {ov(reply.sender)?.name ?? "message"}</span><span className="block truncate">{snippet(reply)}</span></span>
                <button onClick={() => setReply(null)} aria-label="Cancel reply" className="shrink-0"><Plus size={16} className="rotate-45" /></button>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-1 rounded-full border border-line bg-white p-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-colors focus-within:border-neutral-300">
            <input ref={file} type="file" hidden onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
            <button onClick={() => file.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-surface" aria-label="Attach"><Plus size={20} /></button>
            <input ref={inputRef} value={text} onChange={(e) => { onType(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); }} onBlur={stopTyping}
              onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
              onKeyDown={(e) => {
                if (suggestions.length) {
                  if (e.key === "ArrowDown") { e.preventDefault(); return setSel((x) => (x + 1) % suggestions.length); }
                  if (e.key === "ArrowUp") { e.preventDefault(); return setSel((x) => (x - 1 + suggestions.length) % suggestions.length); }
                  if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); return pick(suggestions[Math.min(sel, suggestions.length - 1)]); }
                  if (e.key === "Escape") return setDismissed(true);
                }
                if (e.key === "Enter") send();
              }}
              placeholder={convo.type === "direct_convo" ? "Type a message" : "Type a message — @ to tag someone"} className={`${field} min-w-0 flex-1 bg-transparent px-1.5 outline-none`} />
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => send()} disabled={!text.trim()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-white transition-colors disabled:bg-[#d7d7d7]" aria-label="Send"><ArrowUp size={18} /></motion.button>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {showMembers && (
          <Members me={me} convo={convo} known={knownMembers} complete={!!convo.members?.length} owner={owner} presence={presence} canManage={isAdmin}
            isOwner={isOwner} removed={removed}
            onRemoved={(u: any) => setRemoved((r) => (r.some((x) => x.id === u.id) ? r : [...r, u]))}
            onPurged={(u: any) => setRemoved((r) => r.filter((x) => x.id !== u.id))}
            onRestored={(u: any, list: any[]) => { setRemoved((r) => r.filter((x) => x.id !== u.id)); onMembers?.(id, [...knownMembers, ...list.filter((n) => !knownMembers.some((k: any) => k.id === n.id))]); }}
            onClose={() => setShowMembers(false)} onGone={() => onGone?.(id)}
            onChanged={(c: any, fallback: any[]) => onMembers?.(id, c.members?.length ? c.members : fallback, c.type ? { type: c.type, ...(c.name ? { name: c.name } : {}) } : undefined)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {reactView != null && (() => {
          const m = msgs.find((x) => x.id === reactView);
          if (!m) return null;
          const rows = [...likers(m).map((u: any) => ({ u, k: "like" })), ...dislikers(m).map((u: any) => ({ u, k: "dislike" }))];
          return (
            <motion.div key="reacts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReactView(null)} className="fixed inset-0 z-70 grid place-items-center bg-black/40 p-4">
              <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="max-h-[80dvh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
                <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-medium">Reactions</h2><button onClick={() => setReactView(null)} aria-label="Close" className="text-mute hover:text-ink"><Plus size={20} className="rotate-45" /></button></div>
                {rows.length === 0 && <p className="text-sm text-mute">No reactions yet.</p>}
                {rows.map(({ u, k }) => {
                  const full = ov(u.name ? u : userStub(u.id));
                  return (
                    <div key={`${k}${u.id}`} className="flex items-center gap-3 py-1.5">
                      <Avatar user={full} size={30} /><span className="min-w-0 flex-1 truncate text-sm">{full?.name ?? "Member"}{sameId(u.id, me.id) && " (you)"}</span>
                      {k === "like" ? <ThumbUp size={16} filled /> : <ThumbDown size={16} filled />}
                      {isAdmin && !sameId(u.id, me.id) && <button onClick={() => removeReaction(m, u.id)} className="rounded-full px-2.5 py-1 text-xs text-red-600 hover:bg-surface">Remove</button>}
                    </div>
                  );
                })}
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
      <AnimatePresence>
        {ask && <Confirm text={ask.text} label={ask.label} onYes={ask.run} onClose={() => setAsk(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {viewIndex >= 0 && <Lightbox items={gallery} index={viewIndex} onIndex={(n: number) => setViewer(gallery[n].key)} onClose={() => setViewer(null)} />}
      </AnimatePresence>
    </div>
  );
}
