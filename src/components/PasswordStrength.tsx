"use client";

export interface PasswordScore {
  score: number; // 0–4
  level: "weak" | "fair" | "strong";
  allowed: boolean; // only "strong" is allowed to submit
  feedback: string[];
}

export function scorePassword(password: string): PasswordScore {
  const feedback: string[] = [];

  // Server policy raised the floor to 12 chars + HIBP screening
  // (Supabase auth config: password_min_length=12). Mirror the floor here.
  const hasMin12 = password.length >= 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const hasMin16 = password.length >= 16;

  if (!hasMin12) feedback.push("At least 12 characters");
  if (!hasUppercase) feedback.push("At least 1 uppercase letter");
  if (!hasLowercase) feedback.push("At least 1 lowercase letter");
  if (!hasNumber) feedback.push("At least 1 number");
  if (!hasSpecial) feedback.push("At least 1 special character (e.g. !@#$%)");

  const score = [hasMin12, hasUppercase, hasLowercase, hasNumber, hasSpecial || hasMin16].filter(Boolean).length;

  let level: PasswordScore["level"];
  if (score <= 2) level = "weak";
  else if (score <= 3) level = "fair";
  else level = "strong";

  return { score, level, allowed: level === "strong", feedback };
}

interface Props {
  password: string;
  className?: string;
}

export default function PasswordStrength({ password, className = "" }: Props) {
  if (!password) return null;

  const { score, level, feedback } = scorePassword(password);

  const bars = [1, 2, 3, 4, 5];
  const barColor =
    level === "weak"
      ? "bg-red-500"
      : level === "fair"
      ? "bg-amber-400"
      : "bg-emerald-500";

  const labelColor =
    level === "weak"
      ? "text-red-600"
      : level === "fair"
      ? "text-amber-600"
      : "text-emerald-600";

  const label =
    level === "weak" ? "Weak" : level === "fair" ? "Fair" : "Strong";

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {bars.map((b) => (
            <div
              key={b}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                b <= score ? barColor : "bg-stone-200"
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-semibold w-12 text-right ${labelColor}`}>
          {label}
        </span>
      </div>

      {/* Missing criteria */}
      {feedback.length > 0 && (
        <ul className="space-y-0.5">
          {feedback.map((tip) => (
            <li key={tip} className="flex items-center gap-1.5 text-xs text-stone-400">
              <svg className="w-3 h-3 text-stone-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {tip}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
