"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api, tok } from "@/lib/api";
import { checkEmail, checkName, checkPassword } from "@/lib/validate";
import Avatar from "./Avatar";

const MAX_BYTES = 2 * 1024 * 1024;

export default function Profile({ me, onClose, onSaved, onDeleted }: any) {
  const [f, setF] = useState({ name: me.name, email: me.email ?? "", password: "", new_password: "" });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const input = "w-full rounded-xl border border-line px-3.5 py-2.5 text-base outline-none focus:border-neutral-400";
  const preview = useMemo(() => (avatar ? URL.createObjectURL(avatar) : null), [avatar]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pick(e: any) {
    const x: File | undefined = e.target.files?.[0];
    e.target.value = "";
    if (!x) return;
    if (!["image/png", "image/jpeg"].includes(x.type)) return setMsg({ ok: false, text: "Photo must be a PNG or JPG." });
    if (x.size > MAX_BYTES) return setMsg({ ok: false, text: "Photo must be 2 MB or smaller." });
    setMsg(null);
    setAvatar(x);
  }

  async function save() {
    const b = new FormData();
    b.append("_method", "PATCH");
    let changed = false;
    if (f.name !== me.name) { b.append("name", f.name); changed = true; }
    if (f.email && f.email !== me.email) { b.append("email", f.email); changed = true; }
    if (f.new_password) { b.append("new_password", f.new_password); b.append("password", f.password); changed = true; }
    if (avatar) { b.append("avatar", avatar); changed = true; }
    if (!changed) return setMsg({ ok: false, text: "Nothing to save." });
    const bad =
      (f.name !== me.name && checkName(f.name, false)) ||
      (f.email && f.email !== me.email && checkEmail(f.email)) ||
      (f.new_password && (checkPassword(f.new_password) || (!f.password && "Enter your current password to set a new one.")));
    if (bad) return setMsg({ ok: false, text: bad });
    setBusy(true);
    try {
      const r = await api(`/user/${me.friend_id}`, { method: "POST", body: b });
      await onSaved(r?.data ?? r, avatar);
      setAvatar(null);
      setMsg({ ok: true, text: "Saved." });
      setF((x) => ({ ...x, password: "", new_password: "" }));
    } catch (x: any) {
      setMsg({ ok: false, text: x.status === 422 && x.message === "Request failed" ? "Wrong current password." : x.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete your account permanently?")) return;
    try { await api(`/user/${me.friend_id}`, { method: "DELETE" }); tok.clear(); onDeleted(); } catch (x: any) { setMsg({ ok: false, text: x.message }); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
        <h2 className="text-lg font-medium">Profile</h2>
        <div className="flex items-center gap-4">
          {preview ? <img src={preview} className="h-16 w-16 rounded-full object-cover" alt="" /> : <Avatar user={me} size={64} />}
          <input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={pick} />
          <div className="flex flex-col items-start gap-1">
            <button onClick={() => file.current?.click()} className="rounded-full border border-line px-4 py-1.5 text-sm hover:bg-surface">Change photo</button>
            {avatar && <button onClick={() => setAvatar(null)} className="text-xs text-mute hover:underline">Discard new photo</button>}
          </div>
        </div>
        <input className={input} placeholder="Name (letters only, no spaces)" value={f.name} onChange={set("name")} />
        <input className={input} type="email" placeholder="Email" value={f.email} onChange={set("email")} />
        <input className={input} type="password" placeholder="New password (7+ chars, upper & lower case, number)" value={f.new_password} onChange={set("new_password")} />
        {f.new_password && <input className={input} type="password" placeholder="Current password" value={f.password} onChange={set("password")} />}
        {msg && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
        <div className="flex items-center justify-between pt-1">
          <button onClick={remove} className="text-sm text-red-600 hover:underline">Delete account</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-full px-4 py-2 text-sm hover:bg-surface">Close</button>
            <button onClick={save} disabled={busy} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
