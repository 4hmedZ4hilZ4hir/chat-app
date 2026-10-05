"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, lastSeenText } from "@/lib/api";
import Avatar from "./Avatar";

export default function Members({ me, convo, known, complete, owner, presence, canManage, isOwner, removed, onRemoved, onPurged, onRestored, onClose, onChanged, onGone }: any) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<any[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const direct = convo.type === "direct_convo";
  const inChat = new Set(known.map((u: any) => u.id));

  useEffect(() => {
    if (!canManage) return;
    const s = q.replace(/[^a-zA-Z ]/g, "").trim();
    const t = setTimeout(() => api(s ? `/user?search=${encodeURIComponent(s)}` : "/user").then((r) => setFound(r.data)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q, canManage]);

  const status = (u: any) => {
    const p = presence?.[u.id];
    if (p?.online) return { text: "Online", on: true };
    const ls = lastSeenText(p?.lastSeen ?? u.last_seen_at);
    return { text: ls ? `Last seen ${ls}` : "", on: false };
  };

  async function add(u: any) {
    setBusy(u.id); setErr("");
    try {
      const c = await api(`/conversation/${convo.id}/users`, { method: "POST", body: { add_users: [u.id] } });
      onChanged(c, [...known, u]);
    } catch (x: any) { setErr(x.status === 403 ? "Only the owner or an admin can add people." : x.message); }
    finally { setBusy(null); }
  }
  async function remove(u: any) {
    if (!confirm(`Remove ${u.name} from this group?`)) return;
    setBusy(u.id); setErr("");
    try {
      const c = await api(`/conversation/${convo.id}/users`, { method: "DELETE", body: { delete_users: [u.id] } });
      if (!c) { onGone(); onClose(); return; }
      onChanged(c, known.filter((k: any) => k.id !== u.id));
      onRemoved?.(u);
    } catch (x: any) { setErr(x.status === 403 ? "Only the owner or an admin can remove people." : x.message); }
    finally { setBusy(null); }
  }

  async function restore(u: any) {
    setBusy(u.id); setErr("");
    try {
      const r = await api(`/conversation/${convo.id}/restore`, { method: "POST", body: { users: [u.id] } });
      onRestored(u, r?.users?.length ? r.users : [u]);
    } catch (x: any) { setErr(x.status === 403 ? "Only the owner can restore people." : x.message); }
    finally { setBusy(null); }
  }
  async function purge(u: any) {
    if (!confirm(`Permanently remove ${u.name}? They can't be restored afterwards.`)) return;
    setBusy(u.id); setErr("");
    try { await api(`/conversation/${convo.id}/force_delete`, { method: "DELETE", body: { users: [u.id] } }); onPurged(u); }
    catch (x: any) { setErr(x.status === 403 ? "Only the owner can do that." : x.message); }
    finally { setBusy(null); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{direct ? "People in this chat" : "Group members"}</h2>
          <button onClick={onClose} className="rounded-lg px-2 text-mute hover:bg-surface" aria-label="Close">×</button>
        </div>
        {!complete && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Showing people who have sent a message here. The server doesn't list every member yet.</p>}

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {known.map((u: any) => {
            const s = status(u); const you = u.friend_id === me.friend_id;
            const uOwner = owner?.friend_id === u.friend_id || u.role === "owner";
            return (
              <div key={u.friend_id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface/60">
                <div className="relative"><Avatar user={u} size={34} />{s.on && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.name}{you && " (you)"}{uOwner && <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-[10px] text-ink">owner</span>}{!uOwner && u.role === "admin" && <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-[10px] text-mute">admin</span>}</p>
                  <p className={`truncate text-xs ${s.on ? "text-green-600" : "text-mute"}`}>{you ? "" : s.text}</p>
                </div>
                {canManage && !you && !direct && !uOwner && (
                  <button disabled={busy === u.id} onClick={() => remove(u)} className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40">Remove</button>
                )}
              </div>
            );
          })}
        </div>

        {canManage && (
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-sm font-medium">Add people</p>
            {direct && <p className="text-xs text-mute">Adding someone turns this chat into a group.</p>}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="w-full rounded-xl border border-line px-3.5 py-2.5 text-base outline-none focus:border-neutral-400" />
            <div className="max-h-40 overflow-y-auto">
              {found.filter((u) => !inChat.has(u.id)).map((u) => (
                <button key={u.friend_id} disabled={busy === u.id} onClick={() => add(u)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface disabled:opacity-40">
                  <Avatar user={u} size={28} /><span className="flex-1 text-sm">{u.name}</span><span className="text-xs text-ink font-medium">Add</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {isOwner && removed?.length > 0 && (
          <div className="space-y-1 border-t border-line pt-3">
            <p className="text-sm font-medium">Removed members</p>
            <div className="max-h-32 overflow-y-auto">
              {removed.map((u: any) => (
                <div key={u.friend_id ?? u.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                  <Avatar user={u} size={28} /><span className="flex-1 truncate text-sm text-mute">{u.name}</span>
                  <button disabled={busy === u.id} onClick={() => restore(u)} className="rounded-lg px-2 py-1 text-xs text-ink hover:bg-surface disabled:opacity-40">Restore</button>
                  <button disabled={busy === u.id} onClick={() => purge(u)} className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40">Remove for good</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </motion.div>
    </motion.div>
  );
}
