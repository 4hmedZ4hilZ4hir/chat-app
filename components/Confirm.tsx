"use client";
import { useEffect } from "react";
import { motion } from "framer-motion";

export default function Confirm({ text, label, onYes, onClose }: { text: string; label: string; onYes: () => void; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-70 grid place-items-center bg-black/40 p-4">
      <motion.div initial={{ scale: 0.95, y: 6 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl">
        <p className="text-base text-ink">{text}</p>
        <div className="mt-5 flex justify-end gap-1">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-ink hover:bg-surface">Cancel</button>
          <button autoFocus onClick={() => { onYes(); onClose(); }} className="rounded-full px-4 py-2 text-sm font-medium text-ink hover:bg-surface">{label}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
