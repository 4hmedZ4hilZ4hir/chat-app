"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { api, avatarPath, clean, convoTitle, fetchFullUser, previewOf, tok } from "@/lib/api";
import { listenAll, makeEcho } from "@/lib/echo";
import Auth from "@/components/Auth";
import { SidebarIcon } from "@/components/Icons";
import Sidebar from "@/components/Sidebar";
import Chat from "@/components/Chat";
import Profile from "@/components/Profile";
import { Toast, groupNotes, parseNote } from "@/components/Notifications";

export default function Page() {
  const [me, setMe] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [convos, setConvos] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [echo, setEcho] = useState<any>(null);
  const [profile, setProfile] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [toasts, setToasts] = useState<any[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  const meRef = useRef<any>(null);
  meRef.current = me;
  useEffect(() => {
    if (!me?.friend_id) return;
    try { setNames(JSON.parse(localStorage.getItem(`names:${me.friend_id}`) || "{}")); } catch {}
  }, [me?.friend_id]);
  const setName = useCallback((id: number, n: string) => setNames((p) => {
    if (p[id] === n) return p;
    const x = { ...p, [id]: n };
    try { localStorage.setItem(`names:${meRef.current?.friend_id}`, JSON.stringify(x)); } catch {}
    return x;
  }), []);
  const [membersMap, setMembersMap] = useState<Record<number, any[]>>({});
  const [presence, setPresence] = useState<Record<number, { online: boolean; lastSeen?: string }>>({});
  const [receipts, setReceipts] = useState<Record<number, Record<number, number>>>({});
  const [partners, setPartners] = useState<Record<number, any>>({});
  const setPartner = useCallback((cid: number, u: any) => setPartners((p) => (p[cid]?.id === u?.id ? p : { ...p, [cid]: u })), []);
  const setMembers = useCallback((cid: number, list: any[], patch?: any) => {
    setMembersMap((p) => ({ ...p, [cid]: list }));
    if (patch) setConvos((cs) => cs.map((x) => (x.id === cid ? { ...x, ...patch } : x)));
  }, []);
  const dropConvo = useCallback((cid: number) => {
    setConvos((cs) => cs.filter((x) => x.id !== cid));
    setActiveId((a) => (a === cid ? null : a));
  }, []);
  const markReceipts = useCallback((cid: number, ids: number[], level: number) => setReceipts((p) => {
    const cur = { ...(p[cid] ?? {}) };
    let changed = false;
    ids.forEach((i) => { if ((cur[i] ?? 0) < level) { cur[i] = level; changed = true; } });
    if (!changed) return p;
    const keep: Record<number, number> = {};
    Object.keys(cur).map(Number).sort((a, b) => b - a).slice(0, 300).forEach((k) => (keep[k] = cur[k]));
    const x = { ...p, [cid]: keep };
    try { localStorage.setItem(`receipts:${meRef.current?.friend_id}`, JSON.stringify(x)); } catch {}
    return x;
  }), []);

  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const applyProfile = useCallback((u: any, bust = false) => {
    if (!u?.friend_id) return;
    const { conversations, created_conversations, ...rest } = u;
    setProfiles((p) => ({ ...p, [u.friend_id]: { ...p[u.friend_id], ...rest, ...(bust ? { avatar_v: Date.now() } : {}) } }));
  }, []);
  const lastRefresh = useRef<Record<string, number>>({});
  const refreshProfile = useCallback(async (fid?: string, name?: string) => {
    if (!fid || fid === meRef.current?.friend_id) return;
    if (Date.now() - (lastRefresh.current[fid] ?? 0) < 1000) return;
    lastRefresh.current[fid] = Date.now();
    try {
      const r = await api(`/user/${fid}`);
      let u = r?.data ?? r;
      console.debug("[avatar] /user/" + fid, u);
      const n = String(u?.name ?? name ?? "").replace(/[^a-zA-Z ]/g, "").trim();
      if (!u?.avatar && n) {
        const list = await api(`/user?search=${encodeURIComponent(n)}`);
        const hit = list?.data?.find((x: any) => x.friend_id === fid);
        console.debug("[avatar] search hit for", fid, hit);
        if (hit) u = { ...u, ...hit };
      }
      applyProfile(u, true);
    } catch {}
  }, [applyProfile]);

  const notesRef = useRef<any[]>([]);
  notesRef.current = notes;
  const activeRef = useRef<number | null>(null);
  activeRef.current = activeId;
  const dismissedRef = useRef<Set<string>>(new Set());
  const dismiss = useCallback((pred: (n: any) => boolean) => {
    const gone = notesRef.current.filter(pred);
    if (!gone.length) return;
    gone.forEach((n) => { if (n.id != null) dismissedRef.current.add(String(n.id)); });
    try { localStorage.setItem(`dismissed:${meRef.current?.friend_id}`, JSON.stringify(Array.from(dismissedRef.current).slice(-300))); } catch {}
    setNotes((x) => x.filter((n) => !pred(n)));
  }, []);
  const openNote = useCallback((it: any) => {
    dismiss((n) => it.notes.includes(n) || (it.convoId != null && parseNote(n).convoId === it.convoId));
    if (it.convoId != null) setActiveId(it.convoId);
  }, [dismiss]);
  useEffect(() => {
    if (activeId == null) return;
    const clear = () => { if (!document.hidden) dismiss((n) => parseNote(n).convoId === activeRef.current); };
    clear();
    document.addEventListener("visibilitychange", clear);
    return () => document.removeEventListener("visibilitychange", clear);
  }, [activeId, notes, dismiss]);

  const load = useCallback(() => api("/conversation").then((r) => setConvos(r.data)).catch(() => {}), []);

  const bump = useCallback((id: number, m: any, reorder = true) => setConvos((cs) => {
    const c = cs.find((x) => x.id === id);
    if (!c) return cs;
    const u = { ...c, last_message: m };
    return reorder ? [u, ...cs.filter((x) => x.id !== id)] : cs.map((x) => (x.id === id ? u : x));
  }), []);

  useEffect(() => {
    if (!tok.get()) return setReady(true);
    api("/me").then((r) => setMe(r.data)).catch(() => tok.clear()).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!me) return;
    load();
    try { dismissedRef.current = new Set(JSON.parse(localStorage.getItem(`dismissed:${me.friend_id}`) || "[]")); } catch { dismissedRef.current = new Set(); }
    api("/notifications").then((r) => {
      const list: any[] = Array.isArray(r) ? r : r?.data ?? [];
      setNotes(list.filter((n) => n.id == null || !dismissedRef.current.has(String(n.id))));
    }).catch(() => {});
    const e = makeEcho(tok.get()!);
    if (!e) return;
    e.private(`App.Models.User.${me.id}`).notification((n: any) => addNote(n));
    listenAll(e.private(`user.${me.id}`), {
      GroupCreated: load, UserAdded: load, UserDeleted: load,
      ConversationUpdated: (ev: any) => {
        const cv = ev?.conversation;
        if (!cv?.id) return load();
        setConvos((cs) => cs.map((x) => (x.id === cv.id ? { ...x, ...(cv.name !== undefined ? { name: cv.name } : {}) } : x)));
      },
      ConversationDeleted: (ev: any) => (ev?.conversation?.id ? dropConvo(ev.conversation.id) : load()),
    });
    setEcho(e);
    return () => { subbed.current = new Set(); e.disconnect(); };
  }, [me?.id, load]);

  useEffect(() => {
    if (!me) return;
    const t = setTimeout(() => { tok.clear(); logout(); }, tok.expiresIn());
    return () => clearTimeout(t);
  }, [me?.id]);

  useEffect(() => {
    if (!me?.friend_id || avatarPath(me)) return;
    let dead = false;
    fetchFullUser(me.friend_id, me.name, true).then((u) => {
      if (dead || !u) return;
      console.debug("[profile] full user", u);
      setMe((m: any) => (m && m.friend_id === me.friend_id ? { ...m, ...clean(u) } : m));
      applyProfile(u);
    });
    return () => { dead = true; };
  }, [me?.friend_id]);

  useEffect(() => {
    if (!me) return;
    const pull = () => api("/active-users").then((r) => {
      const ids: number[] = (r?.users ?? []).map((u: any) => u.id).filter(Boolean);
      setPresence((p) => { const x = { ...p }; ids.forEach((i) => { if (!x[i]) x[i] = { online: true }; }); return x; });
    }).catch(() => {});
    pull();
    const t = setInterval(pull, 60000);
    return () => clearInterval(t);
  }, [me]);

  const subbed = useRef<Set<number>>(new Set());
  const convosRef = useRef<any[]>([]);
  convosRef.current = convos;

  const membersRef = useRef<Record<number, any[]>>({});
  membersRef.current = membersMap;
  const addNote = useCallback((raw: any) => {
    console.debug("[notification]", raw);
    if (raw?.id != null && (dismissedRef.current.has(String(raw.id)) || notesRef.current.some((y) => y.id === raw.id))) return;
    const cid = parseNote(raw).convoId;
    if (cid != null && cid === activeRef.current && !document.hidden) return;
    if (cid != null && !convosRef.current.some((c) => c.id === cid)) load();
    const base = { ...raw, _at: new Date().toISOString() };
    const push = (n: any) => { setNotes((x) => [n, ...x]); setToasts((x) => [...x, n]); };
    const p = parseNote(base);
    if (p.reactorId != null && !p.sender) {
      const pool = [...(membersRef.current[cid as number] ?? []), ...(convosRef.current.find((c) => c.id === cid)?.members ?? []), ...Object.values(membersRef.current).flat()];
      const who: any = pool.find((u: any) => String(u.id) === String(p.reactorId));
      return push(who?.name ? { ...base, _ctx: { sender: who.name } } : base);
    }
    if (p.sender && p.preview) return push(base);
    setTimeout(() => {
      const m = convosRef.current.find((c) => c.id === cid)?.last_message;
      const s = m?.sender;
      push(s && s.friend_id !== meRef.current?.friend_id ? { ...base, _ctx: { sender: s.name, preview: previewOf(m) } } : base);
    }, 700);
  }, [load]);

  const resolved = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!me?.friend_id) return;
    const todo = convos.filter((c) => c.type === "direct_convo" && !resolved.current.has(c.id) && !membersMap[c.id]
      && !c.members?.some((m: any) => m.friend_id !== me.friend_id));
    if (!todo.length) return;
    todo.forEach((c) => resolved.current.add(c.id));
    (async () => {
      for (const c of todo) {
        try {
          const r = await api(`/conversation/${c.id}/members_in`);
          const cc = Array.isArray(r) ? r[0] : r;
          const active = cc?.members ?? cc?.all_members?.filter((u: any) => !u.left_at);
          if (!active?.length) continue;
          setMembers(c.id, active);
          const other = active.find((u: any) => u.friend_id !== meRef.current?.friend_id);
          if (other?.name) setName(c.id, other.name);
        } catch {}
      }
    })();
  }, [convos, membersMap, me?.friend_id]);

  const hydrated = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!me?.friend_id) return;
    const people = new Map<string, any>();
    convos.forEach((c) => [...(membersMap[c.id] ?? c.members ?? []), c.last_message?.sender].forEach((u: any) => u?.friend_id && people.set(u.friend_id, u)));
    const todo = Array.from(people.values()).filter((u) => u.friend_id !== me.friend_id && !hydrated.current.has(u.friend_id) && !avatarPath(u));
    if (!todo.length) return;
    todo.forEach((u) => hydrated.current.add(u.friend_id));
    (async () => { for (const u of todo) await refreshProfile(u.friend_id, u.name); })();
  }, [convos, membersMap, me?.friend_id]);
  useEffect(() => {
    if (!echo) return;
    convos.forEach((c) => {
      if (subbed.current.has(c.id)) return;
      subbed.current.add(c.id);
      listenAll(echo.private(`conversation.${c.id}`), {
        MessageSent: (ev: any) => ev?.message && bump(c.id, ev.message),
        MessageUpdated: (ev: any) => {
          const m = ev?.message;
          if (m?.id && convosRef.current.find((x) => x.id === c.id)?.last_message?.id === m.id) bump(c.id, m, false);
        },
        MessageDeleted: load, MessageDeletedForever: load, MessageRestored: load,
        MessageDelivered: (ev: any) => { if (ev?.user?.id !== meRef.current?.id) markReceipts(c.id, ev?.messageIds ?? [], 1); },
        MessageRead: (ev: any) => { if (ev?.messageId && ev?.user?.id !== meRef.current?.id) markReceipts(c.id, [ev.messageId], 2); },
        UserAdded: (ev: any) => {
          const cv = ev?.conversation;
          if (cv?.members) setMembers(c.id, cv.members, cv.type ? { type: cv.type, ...(cv.name ? { name: cv.name } : {}) } : undefined);
          else setMembersMap((p) => { const { [c.id]: _gone, ...rest } = p; return rest; });
        },
        UserDeleted: (ev: any) => {
          const ids: number[] = ev?.userIds ?? [];
          if (ids.includes(meRef.current?.id)) return dropConvo(c.id);
          setMembersMap((p) => (p[c.id] ? { ...p, [c.id]: p[c.id].filter((u) => !ids.includes(u.id)) } : p));
        },
        UserUpdatedInfo: (ev: any) => { if (!ev?.user?.friend_id) return load(); applyProfile(ev.user); refreshProfile(ev.user.friend_id, ev.user.name); },
        UserDeletedForever: (ev: any) => {
          const uid = ev?.user?.id;
          if (uid) setMembersMap((p) => (p[c.id] ? { ...p, [c.id]: p[c.id].filter((u) => u.id !== uid) } : p));
          load();
        },
        "user.online": (ev: any) => { if (ev?.user_id) setPresence((p) => ({ ...p, [ev.user_id]: { online: true } })); },
        "user.offline": (ev: any) => { if (ev?.user_id) setPresence((p) => ({ ...p, [ev.user_id]: { online: false, lastSeen: ev.last_seen_at } })); },
      });
    });
  }, [echo, convos, bump, load, markReceipts, setMembers, dropConvo, refreshProfile, applyProfile]);

  const [pins, setPins] = useState<number[]>([]);
  const [nicks, setNicks] = useState<Record<number, string>>({});
  const [flash, setFlash] = useState("");
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    if (!me?.friend_id) return;
    try {
      setPins(JSON.parse(localStorage.getItem(`pins:${me.friend_id}`) || "[]"));
      setNicks(JSON.parse(localStorage.getItem(`nicks:${me.friend_id}`) || "{}"));
      setReceipts(JSON.parse(localStorage.getItem(`receipts:${me.friend_id}`) || "{}"));
    } catch {}
  }, [me?.friend_id]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 4000);
    return () => clearTimeout(t);
  }, [flash]);
  const save = (k: string, v: any) => localStorage.setItem(`${k}:${me.friend_id}`, JSON.stringify(v));
  const togglePin = (c: any) => setPins((p) => { const x = p.includes(c.id) ? p.filter((i) => i !== c.id) : [c.id, ...p]; save("pins", x); return x; });
  async function renameConvo(c: any, name: string) {
    if (c.type === "direct_convo") {
      setNicks((p) => { const x = { ...p }; if (name) x[c.id] = name; else delete x[c.id]; save("nicks", x); return x; });
      return;
    }
    if (!name) return setFlash("A group name can't be empty.");
    try { await api(`/conversation/${c.id}`, { method: "PATCH", body: { name } }); setConvos((cs) => cs.map((x) => (x.id === c.id ? { ...x, name } : x))); }
    catch (x: any) { setFlash(x.status === 403 ? "Only the owner or an admin can rename this group." : x.message); }
  }
  async function deleteConvo(c: any) {
    if (!confirm("Delete this conversation for everyone? This can't be undone.")) return;
    try {
      await api(`/conversation/${c.id}`, { method: "DELETE" });
      setConvos((cs) => cs.filter((x) => x.id !== c.id)); setPins((p) => { const x = p.filter((i) => i !== c.id); save("pins", x); return x; });
      if (activeId === c.id) setActiveId(null);
    } catch (x: any) { setFlash(x.status === 403 ? "Only the owner can delete this conversation." : x.message); }
  }

  async function logout() { await api("/logout").catch(() => {}); tok.clear(); setMe(null); setConvos([]); setActiveId(null); setNotes([]); setToasts([]); setNames({}); localStorage.removeItem("names"); resolved.current = new Set(); hydrated.current = new Set(); setMembersMap({}); setPresence({}); setReceipts({}); setPartners({}); setProfiles({}); }

  if (!ready) return null;
  if (!me) return <Auth onAuth={setMe} />;
  const view = convos.map((c) => {
    const ov = (u: any) => (u ? { ...u, ...profiles[u.friend_id] } : u);
    const members = (membersMap[c.id] ?? c.members)?.map(ov);
    const ls = c.last_message?.sender;
    const partner = ov(c.type === "direct_convo"
      ? members?.find((m: any) => m.friend_id !== me.friend_id) ?? (ls && ls.friend_id !== me.friend_id ? ls : partners[c.id])
      : undefined);
    const pr = partner ? presence[partner.id] : undefined;
    return { ...c, members, nick: nicks[c.id], pinned: pins.includes(c.id), partner, online: !!pr?.online, lastSeen: pr?.lastSeen ?? partner?.last_seen_at, receipts: receipts[c.id] };
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const active = view.find((c) => c.id === activeId);
  async function onProfileSaved(u: any, file?: File | null) {
    console.debug("[profile] save response", u);
    const local = file ? { avatar_local: URL.createObjectURL(file), avatar_v: Date.now() } : {};
    setMe((m: any) => ({ ...m, ...clean(u), ...local }));
    const fresh = await fetchFullUser(me.friend_id, u?.name ?? me.name, true);
    console.debug("[profile] refreshed user", fresh);
    if (fresh) {
      setMe((m: any) => ({ ...m, ...clean(fresh), ...local, ...(file ? {} : { avatar_v: Date.now() }) }));
      applyProfile({ ...fresh, friend_id: me.friend_id }, true);
    }
  }
  const titleOf = (cid: number | null) => { const c = view.find((x) => x.id === cid); return c ? convoTitle(c, me, names) : undefined; };
  const noteItems = groupNotes(notes, titleOf);
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar me={me} convos={view} activeId={activeId} onSelect={(id: number) => { setActiveId(id); setDrawer(false); }} drawer={drawer} onDrawer={setDrawer} onLogout={logout} names={names} onPin={togglePin} onRename={renameConvo} onDelete={deleteConvo}
        onProfile={() => setProfile(true)} notes={noteItems} noteTotal={notes.length} onOpenNote={(it: any) => { openNote(it); setDrawer(false); }} onClearNotes={() => dismiss(() => true)}
        onCreated={(c: any, u: any) => { if (u && c.type === "direct_convo") setName(c.id, u.name); load(); setActiveId(c.id); setDrawer(false); }} />
      {active ? <Chat key={active.id} me={me} convo={active} echo={echo} names={names} onMessage={bump} onMenu={() => setDrawer(true)} presence={presence} profiles={profiles} onMembers={setMembers} onGone={dropConvo}
        onPartner={(cid: number, n: string, u?: any) => { setName(cid, n); if (u) setPartner(cid, u); }} /> : (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center px-2 pt-[env(safe-area-inset-top)] md:hidden">
            <button onClick={() => setDrawer(true)} className="grid h-10 w-10 place-items-center rounded-lg text-mute hover:bg-surface" aria-label="Open chats"><SidebarIcon size={20} /></button>
          </div>
          <div className="grid flex-1 place-items-center px-6 text-center"><p className="text-2xl leading-8 sm:text-[28px] sm:leading-9">Select a conversation or start a new one</p></div>
        </div>
      )}
      <div className="fixed right-3 top-3 z-[80] flex max-w-[calc(100vw-1.5rem)] flex-col gap-2 pt-[env(safe-area-inset-top)]">
        {flash && <div className="rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm text-red-600 shadow-lg">{flash}</div>}
        <AnimatePresence>
          {toasts.map((n, i) => <Toast key={n.id ?? i} item={groupNotes([n], titleOf)[0]} onOpen={openNote} onDone={() => setToasts((x) => x.filter((y) => y !== n))} />)}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {profile && <Profile me={me} onClose={() => setProfile(false)} onSaved={onProfileSaved} onDeleted={() => { setProfile(false); setMe(null); }} />}
      </AnimatePresence>
    </div>
  );
}
