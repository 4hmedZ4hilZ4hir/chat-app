"use client";
import { useEffect, useState } from "react";
import { avatarBlob, avatarId, avatarPath, avatarUrl, badImages } from "@/lib/api";

export default function Avatar({ user, name, size = 36 }: { user?: any; name?: string; size?: number }) {
  const n = name ?? user?.name ?? "?";
  const id = avatarId(user);
  const path = avatarPath(user);
  const [blob, setBlob] = useState<string | null>(null);
  const [blobDone, setBlobDone] = useState(false);
  const [, bump] = useState(0);
  useEffect(() => {
    setBlob(null); setBlobDone(false);
    if (id == null || user?.avatar_local) { setBlobDone(true); return; }
    let dead = false;
    avatarBlob(user).then((b) => { if (!dead) { setBlob(b); setBlobDone(true); } });
    return () => { dead = true; };
  }, [id, path]);
  const src = [user?.avatar_local, blob, blobDone ? avatarUrl(user) : null].find((c) => c && !badImages.has(c)) as string | undefined;
  return src ? (
    <img src={src} alt={n} style={{ width: size, height: size }} className="rounded-full object-cover shrink-0"
      onError={() => { badImages.add(src); bump((x) => x + 1); }} />
  ) : (
    <div style={{ width: size, height: size }} className="rounded-full bg-surface text-mute grid place-items-center text-xs font-medium shrink-0">
      {n.slice(0, 2).toUpperCase()}
    </div>
  );
}
