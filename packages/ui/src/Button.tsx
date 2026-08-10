import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-blue text-white hover:bg-brand-navy",
  secondary: "border border-brand-blue text-brand-blue hover:bg-brand-mist",
  ghost: "border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50",
  danger: "border border-slate-200 text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/** Shared class string for the button look — use with `next/link` or `<a>` where a real element is
 * needed (Link cannot render through the `Button` component). */
export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return `${BASE} ${VARIANT[variant]} ${extra}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

/** Standard button. Forwards native attributes (`type`, `name`, `value`, `disabled`, `onClick`, …)
 * so it works inside server-action `<form>`s exactly like the raw buttons it replaces. */
export function Button({ variant = "primary", fullWidth = false, className = "", type, ...rest }: ButtonProps) {
  return (
    <button
      // Explicit default: bare <button> defaults to type="submit"; keep that for form usage.
      type={type ?? "submit"}
      className={buttonClass(variant, `${fullWidth ? "w-full" : ""} cursor-pointer ${className}`.trim())}
      {...rest}
    />
  );
}
