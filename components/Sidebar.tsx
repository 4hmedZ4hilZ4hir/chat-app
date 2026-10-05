"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api, convoTitle, previewOf } from "@/lib/api";
import Avatar from "./Avatar";
import { Bell } from "./Notifications";
import { Check, Compose, Dots, Logout, Pin, Search, SidebarIcon, Close } from "./Icons";

const MIN_W = 240;
const MAX_W = 520;
const clampW = (w: number) => Math.min(MAX_W, Math.max(MIN_W, w));
const row = "flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm hover:bg-surface";

function useDesktop() {
  const [d, setD] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    const f = () => setD(m.matches);
    f(); m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return d;
}

export default function Sidebar({ me, convos, activeId, onSelect, onCreated, onLogout, onProfile, notes, noteTotal, onOpenNote, onClearNotes, names, onPin, onRename, onDelete, drawer, onDrawer }: any) {
  const desktop = useDesktop();
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(300);
  const [dragging, setDragging] = useState(false);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const expanded = desktop ? open : true;
  useEffect(() => {
    const w = Number(localStorage.getItem("sidebarWidth"));
    if (w) setWidth(clampW(w));
  }, []);

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    let current = startW;
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) => { current = clampW(startW + ev.clientX - startX); setWidth(current); };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setDragging(false);
      try { localStorage.setItem("sidebarWidth", String(current)); } catch {}
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const list = convos.filter((c: any) => convoTitle(c, me, names)?.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <AnimatePresence>
        {!desktop && drawer && (
          <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => onDrawer(false)} className="fixed inset-0 z-40 bg-black/30" />
        )}
      </AnimatePresence>
      <motion.aside key={desktop ? "desktop" : "mobile"} initial={false}
        animate={desktop ? { width: open ? width : 68 } : { x: drawer ? 0 : "-105%" }}
        transition={dragging ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 34 }}
        className={`flex flex-col overflow-hidden border-r border-surface bg-white ${desktop ? "relative h-dvh shrink-0" : "fixed inset-y-0 left-0 z-50 h-dvh w-[86vw] max-w-80 shadow-xl"}`}>
        {desktop && open && (
          <div onPointerDown={startResize} role="separator" aria-orientation="vertical" aria-label="Resize sidebar"
            className={`absolute right-0 top-0 z-40 h-full w-1.5 cursor-col-resize touch-none transition-colors hover:bg-black/10 ${dragging ? "bg-black/10" : ""}`} />
        )}
        <div className="flex h-14 shrink-0 items-center justify-between px-3 pt-[env(safe-area-inset-top)]">
          {expanded && <span className="px-2 text-base font-medium">Chat</span>}
          <button onClick={() => (desktop ? setOpen(!open) : onDrawer(false))} className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-surface" aria-label={desktop ? "Toggle sidebar" : "Close menu"}>
            {desktop ? <SidebarIcon size={20} /> : <Close size={20} />}
          </button>
        </div>
        <div className="space-y-0.5 px-3">
          <button onClick={() => setModal(true)} className={row}><Compose size={18} />{expanded && "New conversation"}</button>
          {expanded ? (
            <label className={`${row} focus-within:bg-surface`}>
              <Search size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
          ) : (
            <button onClick={() => setOpen(true)} className={row} aria-label="Search chats"><Search size={18} /></button>
          )}
        </div>
        {expanded && <p className="px-5 pb-1 pt-4 text-xs text-faint">Chats</p>}
        <div className="mt-1 flex-1 overflow-y-auto px-2">
          {list.map((c: any) => (
            <motion.div layout key={c.id} role="button" tabIndex={0} onClick={() => renaming !== c.id && onSelect(c.id)} whileTap={{ scale: 0.99 }}
              className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left ${menu === c.id ? "z-20 " : ""}${c.id === activeId ? "bg-surface" : "hover:bg-surface/70"}`}>
              <div className="relative shrink-0">
                <Avatar name={convoTitle(c, me, names)} user={c.partner} size={30} />
                {c.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" title="Online" />}
              </div>
              {expanded && (
                <div className="min-w-0 flex-1">
                  {renaming === c.id ? (
                    <input autoFocus value={draft} maxLength={c.type === "direct_convo" ? 24 : 10} onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setDraft(e.target.value)} onBlur={() => setRenaming(null)}
                      onKeyDown={(e) => { if (e.key === "Enter") { onRename(c, draft.trim()); setRenaming(null); } else if (e.key === "Escape") setRenaming(null); }}
                      className="w-full rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-sm outline-none" />
                  ) : (
                    <p className="flex items-center gap-1 truncate text-sm">{c.pinned && <Pin size={12} className="shrink-0 text-faint" />}<span className="truncate">{convoTitle(c, me, names)}</span></p>
                  )}
                  <p className="truncate text-xs text-faint">{previewOf(c.last_message)}</p>
                </div>
              )}
              {expanded && renaming !== c.id && (
                <button onClick={(e) => { e.stopPropagation(); setMenu(menu === c.id ? null : c.id); }} aria-label="Conversation options"
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-mute hover:bg-black/5 ${menu === c.id ? "opacity-100" : "md:opacity-0 md:group-hover:opacity-100"}`}><Dots size={16} /></button>
              )}
              <AnimatePresence>
                {menu === c.id && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={(e) => e.stopPropagation()}
                    className="absolute right-2 top-full z-30 mt-1 w-48 rounded-xl border border-line bg-white p-1 shadow-lg">
                    <Item onClick={() => { onPin(c); setMenu(null); }}>{c.pinned ? "Unpin" : "Pin"} conversation</Item>
                    <Item onClick={() => { setDraft(c.nick ?? (c.type === "direct_convo" ? convoTitle(c, me, names) : c.name)); setRenaming(c.id); setMenu(null); }}>Rename</Item>
                    <Item danger onClick={() => { setMenu(null); onDelete(c); }}>Delete</Item>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
        {menu !== null && <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />}
        <div className="flex shrink-0 items-center gap-2 border-t border-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={onProfile} aria-label="Profile" className="shrink-0"><Avatar user={me} size={32} /></button>
          {expanded && (<>
            <button onClick={onProfile} className="min-w-0 flex-1 truncate text-left text-sm font-medium">{me.name}</button>
            <Bell items={notes} total={noteTotal} onOpen={onOpenNote} onClear={onClearNotes} />
            <button onClick={onLogout} className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-surface" aria-label="Log out" title="Log out"><Logout size={18} /></button>
          </>)}
        </div>
      </motion.aside>
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>{modal && <NewChat me={me} onClose={() => setModal(false)} onCreated={(c: any, u: any) => { setModal(false); onCreated(c, u); }} />}</AnimatePresence>,
        document.body
      )}
    </>
  );
}

function NewChat({ me, onClose, onCreated }: any) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [picked, setPicked] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const s = q.replace(/[^a-zA-Z ]/g, "").trim();
    const t = setTimeout(
      () => api(s ? `/user?search=${encodeURIComponent(s)}` : "/user").then((r) => setUsers(r.data)).catch(() => {}),
      250
    );
    return () => clearTimeout(t);
  }, [q]);

  async function create() {
    const groupName = name.trim();
    if (picked.length > 1 && !groupName) return setErr("Enter a group name (1–10 characters).");
    try {
      const c = await api("/conversation", {
        body: { users: picked.map((u) => u.id), ...(picked.length > 1 ? { name: groupName } : {}) },
      });
      onCreated(c, picked[0]);
    } catch (x: any) { setErr(x.message); }
  }
  const toggle = (u: any) => setPicked(picked.find((p) => p.id === u.id) ? picked.filter((p) => p.id !== u.id) : [...picked, u]);
  const field = "w-full rounded-xl border border-line px-3.5 py-2.5 text-base outline-none focus:border-neutral-400";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      className="fixed inset-0 z-70 grid place-items-center bg-black/40 p-4">
      <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-medium">New conversation</h2>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className={field} />
        <div className="max-h-56 overflow-y-auto">
          {users.map((u) => (
            <button key={u.friend_id} onClick={() => toggle(u)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface">
              <Avatar user={u} size={32} /><span className="flex-1 truncate text-left text-sm">{u.name}</span>
              {picked.find((p) => p.id === u.id) && <Check size={18} />}
            </button>
          ))}
        </div>
        {picked.length > 1 && (
          <input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} maxLength={10} placeholder="Group name (max 10 chars)" className={field} />
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm hover:bg-surface">Cancel</button>
          <button disabled={!picked.length} onClick={create} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white disabled:opacity-30">Start chat</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const Item = ({ onClick, danger, children }: any) => (
  <button onClick={onClick} className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface ${danger ? "text-red-600" : ""}`}>{children}</button>
);
