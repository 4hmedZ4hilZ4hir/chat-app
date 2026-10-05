"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api, clean, tok } from "@/lib/api";
import { authError, checkEmail, checkName, checkPassword, passwordRules } from "@/lib/validate";
import Avatar from "./Avatar";

const MAX_BYTES = 2 * 1024 * 1024;

export default function Auth({ onAuth }: { onAuth: (u: any) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  const [avatar, setAvatar] = useState<File | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (avatar ? URL.createObjectURL(avatar) : null), [avatar]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const set = (k: string) => (e: any) => { setF({ ...f, [k]: e.target.value }); if (fe[k]) setFe({ ...fe, [k]: "" }); };

  function pick(e: any) {
    const x: File | undefined = e.target.files?.[0];
    e.target.value = "";
    if (!x) return;
    if (!["image/png", "image/jpeg"].includes(x.type)) return setErr("Photo must be a PNG or JPG.");
    if (x.size > MAX_BYTES) return setErr("Photo must be 2 MB or smaller.");
    setErr(""); setAvatar(x);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (wait > 0) return;
    const bad: Record<string, string> = {};
    if (mode === "register") { const n = checkName(f.name, true); if (n) bad.name = n; }
    const em = checkEmail(f.email); if (em) bad.email = em;
    if (mode === "register") { const pw = checkPassword(f.password); if (pw) bad.password = pw; }
    else if (!f.password) bad.password = "Password is required.";
    setFe(bad);
    if (Object.keys(bad).length) return;
    setBusy(true);
    try {
      const r = await api(`/${mode}`, { body: mode === "login" ? { email: f.email, password: f.password } : f });
      tok.set(r.access_token);
      let user = r.user;
      if (mode === "register" && avatar && user?.friend_id) {
        try {
          const b = new FormData();
          b.append("_method", "PATCH");
          b.append("avatar", avatar);
          const u = await api(`/user/${user.friend_id}`, { method: "POST", body: b });
          user = { ...user, ...clean(u?.data ?? u), avatar_local: URL.createObjectURL(avatar), avatar_v: Date.now() };
        } catch (x) { console.warn("[register] photo upload failed", x); }
      }
      onAuth(user);
    } catch (x: any) {
      const a = authError(x);
      setErr(a.text);
      if (a.wait) setWait(a.wait);
    } finally { setBusy(false); }
  }
  const input = "h-12 w-full rounded-full border border-line bg-white px-5 text-base outline-none placeholder:text-faint focus:border-neutral-400";
  return (
    <div className="grid min-h-dvh place-items-center bg-white px-4 py-8">
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-3">
        <h1 className="pb-1 text-center text-[28px] leading-9">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="pb-3 text-center text-base text-mute">{mode === "login" ? "Log in to continue chatting." : "Start chatting in seconds."}</p>
        {mode === "register" && (
          <div className="flex flex-col items-center gap-2 pb-2">
            {preview ? <img src={preview} alt="" className="h-20 w-20 rounded-full object-cover" /> : <Avatar name={f.name || "?"} size={80} />}
            <input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={pick} />
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => file.current?.click()} className="rounded-full border border-line px-4 py-1.5 text-sm hover:bg-surface">{avatar ? "Change photo" : "Add profile photo"}</button>
              {avatar && <button type="button" onClick={() => setAvatar(null)} className="text-sm text-mute hover:text-ink">Remove</button>}
            </div>
            {!avatar && <span className="text-xs text-faint">Optional · PNG or JPG, max 2 MB</span>}
          </div>
        )}
        {mode === "register" && <><input className={input} placeholder="Name (letters and spaces)" value={f.name} onChange={set("name")} autoComplete="name" />{fe.name && <p className="px-3 text-sm text-red-600">{fe.name}</p>}</>}
        <input className={input} type="email" placeholder="Email" value={f.email} onChange={set("email")} autoComplete="email" />
        {fe.email && <p className="px-3 text-sm text-red-600">{fe.email}</p>}
        <input className={input} type="password" placeholder="Password" value={f.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        {mode === "register" && (
          <ul className="space-y-0.5 px-3 text-sm">
            {passwordRules(f.password).map((r) => <li key={r.label} className={r.ok ? "text-ink" : "text-faint"}>{r.ok ? "✓" : "○"} {r.label}</li>)}
          </ul>
        )}
        {fe.password && <p className="px-3 text-sm text-red-600">{fe.password}</p>}
        {err && <p className="px-3 text-sm text-red-600">{err}{wait > 0 && ` Try again in ${wait}s.`}</p>}
        <button disabled={busy || wait > 0} className="h-12 w-full rounded-full bg-ink text-base font-medium text-white hover:bg-black/85 disabled:opacity-60">
          {busy ? "Please wait…" : wait > 0 ? `Try again in ${wait}s` : mode === "login" ? "Log in" : "Sign up"}
        </button>
        <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); setFe({}); setAvatar(null); }}
          className="w-full pt-1 text-center text-sm text-mute hover:text-ink">
          {mode === "login" ? "No account? Sign up" : "Have an account? Log in"}
        </button>
      </motion.form>
    </div>
  );
}
