export const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://album-reliably-sureness.ngrok-free.dev";
export const TOKEN_TTL = 24 * 60 * 60 * 1000;
export const tok = {
  get: () => {
    if (typeof window === "undefined") return null;
    const t = localStorage.getItem("token");
    if (!t) return null;
    const at = Number(localStorage.getItem("token_at"));
    if (!at) { localStorage.setItem("token_at", String(Date.now())); return t; }
    if (Date.now() - at >= TOKEN_TTL) { tok.clear(); return null; }
    return t;
  },
  expiresIn: () => { const at = Number(localStorage.getItem("token_at")); return at ? Math.max(0, at + TOKEN_TTL - Date.now()) : TOKEN_TTL; },
  set: (t: string) => { localStorage.setItem("token", t); localStorage.setItem("token_at", String(Date.now())); },
  clear: () => { localStorage.removeItem("token"); localStorage.removeItem("token_at"); },
};
export async function api<T = any>(path: string, o: { method?: string; body?: any } = {}): Promise<T> {
  const t = tok.get();
  const form = typeof FormData !== "undefined" && o.body instanceof FormData;
  const res = await fetch(`${BASE}/api${path}`, {
    method: o.method ?? (o.body ? "POST" : "GET"),
    headers: {
      Accept: "application/json",
      "ngrok-skip-browser-warning": "1",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(o.body && !form ? { "Content-Type": "application/json" } : {}),
    },
    body: o.body ? (form ? o.body : JSON.stringify(o.body)) : undefined,
  });
  if (res.status === 204) return null as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const first = data?.errors ? Object.values(data.errors).flat()[0] : null;
    throw Object.assign(new Error((first as string) ?? data?.message ?? data?.error ?? "Request failed"), {
      status: res.status, errors: data?.errors, retryAfter: Number(res.headers.get("retry-after")) || undefined,
    });
  }
  return data;
}
const pathOf = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return pathOf(v[v.length - 1]);
  if (typeof v === "object") return pathOf(v.path ?? v.url ?? v.file_path ?? v.src ?? v.name);
  return null;
};
export const avatarPath = (u: any): string | null => {
  if (!u || typeof u !== "object") return null;
  const known = pathOf(u.avatar) ?? pathOf(u.avatar_url) ?? pathOf(u.avatar_path);
  if (known) return known;
  for (const k of Object.keys(u)) {
    if (/^avatar_(v|local)$/.test(k)) continue;
    if (/avatar|photo|picture|image|pfp|profile_pic/i.test(k)) { const p = pathOf(u[k]); if (p) return p; }
  }
  return null;
};
export const avatarUrl = (u: any) => {
  const p = avatarPath(u);
  if (!p) return null;
  const v = u?.avatar_v ? `v=${u.avatar_v}` : "";
  if (/^(https?:|blob:|data:)/.test(p)) return v && !p.startsWith("data:") && !p.startsWith("blob:") ? `${p}${p.includes("?") ? "&" : "?"}${v}` : p;
  return `${BASE}/storage/${p.replace(/^\/?(public\/)?(storage\/)?/, "").split("/").map(encodeURIComponent).join("/")}${v ? `?${v}` : ""}`;
};
export const clean = (o: any) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v != null));
export async function fetchFullUser(fid: string, name?: string, self = false) {
  let u: any = null;
  try { const r = await api(self ? "/me" : `/user/${fid}`); u = r?.data ?? r; } catch {}
  if (self && !avatarPath(u)) { try { const r = await api(`/user/${fid}`); u = { ...(u ?? {}), ...clean(r?.data ?? r) }; } catch {} }
  if (!avatarPath(u)) {
    const n = String(u?.name ?? name ?? "").replace(/[^a-zA-Z ]/g, "").trim();
    if (n) {
      try {
        const list = await api(`/user?search=${encodeURIComponent(n)}`);
        const hit = list?.data?.find((x: any) => x.friend_id === fid);
        if (hit) u = { ...(u ?? {}), ...clean(hit) };
      } catch {}
    }
  }
  return u;
}
export const convoTitle = (c: any, me: any, names: Record<number, string> = {}) => {
  if (c.nick) return c.nick;
  if (c.type !== "direct_convo") return c.name;
  if (c.partner?.name) return c.partner.name;
  const other = c.members?.find((m: any) => m.friend_id !== me?.friend_id);
  const s = c.last_message?.sender;
  return other?.name ?? (s && s.friend_id !== me?.friend_id ? s.name : undefined) ?? names[c.id] ?? "Direct chat";
};
export const previewOf = (m: any) => (!m ? "No messages yet" : m.type === "text" ? m.body : m.type === "image" ? "📷 Photo" : "📎 File");

export function lastSeenText(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  const mins = Math.floor((Date.now() - +d) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (new Date().toDateString() === d.toDateString()) return `today at ${t}`;
  if (new Date(Date.now() - 864e5).toDateString() === d.toDateString()) return `yesterday at ${t}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${t}`;
}

export const avatarId = (u: any): string | number | null => {
  const a = u?.avatar;
  return a && typeof a === "object" && !Array.isArray(a) && a.id != null ? a.id : null;
};
const blobCache = new Map<string, Promise<string | null>>();
export const badImages = new Set<string>();
export function avatarBlob(u: any): Promise<string | null> {
  const id = avatarId(u);
  if (id == null) return Promise.resolve(null);
  const key = `${id}:${avatarPath(u)}`;
  if (!blobCache.has(key)) {
    blobCache.set(key, fetch(`${BASE}/api/attachments/${id}/download`, { headers: { Authorization: `Bearer ${tok.get()}`, "ngrok-skip-browser-warning": "1" } })
      .then((r) => {
        if (r.ok) return r.blob().then((b) => URL.createObjectURL(b));
        if (r.status >= 500) blobCache.delete(key);
        return null;
      })
      .catch(() => { blobCache.delete(key); return null; }));
  }
  return blobCache.get(key)!;
}
