"use client";
import { useEffect } from "react";
import { motion } from "framer-motion";
import Avatar from "./Avatar";

export default function Lightbox({ items, index, onIndex, onClose }: any) {
  const it = items[index];
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      else if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [index, items.length, onClose, onIndex]);
  if (!it) return null;

  const ext = String(it.mime || "jpg").replace(/^image\//, "");
  const file = /\.(png|jpe?g|gif|webp)$/i.test(it.name ?? "") ? it.name : `photo.${ext}`;
  const when = it.when ? new Date(it.when).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const stop = (e: any) => e.stopPropagation();
  const nav = "absolute top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20 sm:h-11 sm:w-11";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/90">
      <div onClick={stop} className="absolute inset-x-0 top-0 flex items-center gap-3 bg-linear-to-b from-black/70 to-transparent px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        {it.sender && <Avatar user={it.sender} size={34} />}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">{it.sender?.name}</p>
          <p className="text-xs text-white/70">{when}{when && items.length > 1 ? " · " : ""}{items.length > 1 ? `${index + 1} of ${items.length}` : ""}</p>
        </div>
        <a href={it.url} download={file} onClick={stop} className="rounded-full px-3 py-1.5 text-sm hover:bg-white/15" title="Download">⬇ Save</a>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-white/15" aria-label="Close">✕</button>
      </div>

      {index > 0 && <button onClick={(e) => { stop(e); onIndex(index - 1); }} className={`${nav} left-2 sm:left-4`} aria-label="Previous photo">‹</button>}
      {index < items.length - 1 && <button onClick={(e) => { stop(e); onIndex(index + 1); }} className={`${nav} right-2 sm:right-4`} aria-label="Next photo">›</button>}

      <motion.img key={it.key} src={it.url} alt={it.name} onClick={stop} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }} className="max-h-[84dvh] max-w-[96vw] rounded-lg object-contain shadow-2xl" />
    </motion.div>
  );
}
