export const NAME_REGISTER = /^[A-Za-z ]+$/;
export const NAME_UPDATE = /^[A-Za-z]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const checkName = (v: string, allowSpaces: boolean): string => {
  const t = v.trim();
  if (!t) return "Name is required.";
  if (!(allowSpaces ? NAME_REGISTER : NAME_UPDATE).test(t)) return allowSpaces ? "Name can only contain letters and spaces." : "Name can only contain letters (no spaces).";
  return "";
};
export const checkEmail = (v: string): string => (!v.trim() ? "Email is required." : EMAIL.test(v.trim()) ? "" : "Enter a valid email address.");

export const passwordRules = (v: string) => [
  { ok: v.length >= 7, label: "At least 7 characters" },
  { ok: /[a-z]/.test(v) && /[A-Z]/.test(v), label: "Upper and lower case letters" },
  { ok: /\d/.test(v), label: "At least one number" },
];
export const checkPassword = (v: string): string => (!v ? "Password is required." : passwordRules(v).every((r) => r.ok) ? "" : "Password must be 7+ characters with upper and lower case letters and a number.");

export function authError(x: any): { text: string; wait: number } {
  const e = x?.errors ?? {};
  const first = (v: any) => (Array.isArray(v) ? v[0] : v);
  const tryAgain = Number(first(e.try_again)) || x?.retryAfter || 0;
  const code = String(first(e.error) ?? "");
  if (tryAgain || x?.status === 429) return { text: "Too many attempts.", wait: Math.ceil(tryAgain || 60) };
  if (code === "wrong_password") return { text: "Wrong email or password.", wait: 0 };
  return { text: x?.message ?? "Something went wrong.", wait: 0 };
}
