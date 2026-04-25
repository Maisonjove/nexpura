import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * Marketing-site button per Kaitlyn's brief (section 2 — Buttons).
 *
 * Three variants: primary (Start Free Trial), secondary (See the
 * Platform), tertiary (Book a Demo). Pill shape, charcoal/champagne
 * palette, lift-on-hover micro-interaction. Same component renders as
 * <button> by default OR as <Link> when `href` is set.
 */

type Variant = "primary" | "secondary" | "tertiary";
type Size = "default" | "lg";

interface BaseProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
}

type ButtonAsButton = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    href?: undefined;
  };
interface ButtonAsLink extends BaseProps {
  href: string;
  children: ReactNode;
  type?: never;
  disabled?: never;
  onClick?: never;
}

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function classes(variant: Variant, size: Size, fullWidth: boolean, extra?: string) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-sans font-semibold " +
    "transition-all duration-200 [transition-timing-function:var(--m-ease)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-champagne focus-visible:ring-offset-2 " +
    "disabled:opacity-60 disabled:pointer-events-none";
  const sizeCls =
    size === "lg"
      ? "text-base px-8 py-4"
      : "text-[15px] px-7 py-[14px]";
  const variantCls =
    variant === "primary"
      ? "bg-m-charcoal text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] " +
        "hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,0,0,0.18)] hover:bg-m-charcoal-soft"
      : variant === "secondary"
      ? "bg-transparent border border-m-charcoal text-m-charcoal " +
        "hover:bg-m-champagne-soft"
      : // tertiary
        "bg-transparent text-m-text-secondary px-3 py-2 " +
        "hover:text-m-charcoal hover:underline underline-offset-4 decoration-m-charcoal";
  const widthCls = fullWidth ? "w-full" : "";
  return [base, sizeCls, variantCls, widthCls, extra ?? ""].filter(Boolean).join(" ");
}

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button(
  props,
  ref,
) {
  const { variant = "primary", size = "default", fullWidth = false, className, children } = props;
  const cls = classes(variant, size, fullWidth, className);
  if ("href" in props && props.href) {
    return (
      <Link
        href={props.href}
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={cls}
      >
        {children}
      </Link>
    );
  }
  const { href: _ignored, ...rest } = props as ButtonAsButton;
  void _ignored;
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={(rest as ButtonHTMLAttributes<HTMLButtonElement>).type ?? "button"}
      {...rest}
      className={cls}
    >
      {children}
    </button>
  );
});

export default Button;
