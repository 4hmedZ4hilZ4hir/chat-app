import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { BASE } from "./api";
export function makeEcho(token: string) {
  if (!process.env.NEXT_PUBLIC_REVERB_KEY) { console.warn("NEXT_PUBLIC_REVERB_KEY is not set: realtime is off."); return null; }
  (window as any).Pusher = Pusher;
  return new Echo({
    broadcaster: "reverb",
    key: process.env.NEXT_PUBLIC_REVERB_KEY,
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST,
    wsPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080),
    wssPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 443),
    forceTLS: process.env.NEXT_PUBLIC_REVERB_TLS === "true",
    enabledTransports: ["ws", "wss"],
    authEndpoint: `${BASE}/api/broadcasting/auth`,
    auth: { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "ngrok-skip-browser-warning": "1" } },
  });
}

export function listenAll(channel: any, handlers: Record<string, (e: any) => void>) {
  const cb = (name: string, data: any) => {
    if (name.startsWith("pusher")) return;
    console.debug("[realtime]", name, data);
    const key = Object.keys(handlers).find((k) => name === k || name.endsWith("\\" + k) || name.endsWith("." + k));
    if (key) handlers[key](data);
  };
  channel.subscription.bind_global(cb);
  return () => channel.subscription.unbind_global(cb);
}
