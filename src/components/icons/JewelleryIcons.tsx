"use client";

import { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function RingIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Diamond on top */}
      <path d="M24 8 L30 14 L24 20 L18 14 Z" />
      <path d="M18 14 L24 16 L30 14" />
      <path d="M24 16 L24 20" />
      {/* Ring band */}
      <ellipse cx="24" cy="32" rx="12" ry="8" />
      <path d="M12 32 C12 28 18 24 24 24 C30 24 36 28 36 32" />
    </svg>
  );
}

export function NecklaceIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Chain */}
      <path d="M8 12 C8 24 16 32 24 36 C32 32 40 24 40 12" />
      {/* Heart pendant */}
      <path d="M24 36 L24 38" />
      <path d="M20 40 C18 38 18 36 20 35 C22 34 24 36 24 38 C24 36 26 34 28 35 C30 36 30 38 28 40 L24 44 L20 40Z" />
    </svg>
  );
}

export function BraceletIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Chain links */}
      <ellipse cx="10" cy="24" rx="4" ry="6" />
      <ellipse cx="19" cy="24" rx="4" ry="6" />
      <ellipse cx="28" cy="24" rx="4" ry="6" />
      <ellipse cx="37" cy="24" rx="4" ry="6" />
    </svg>
  );
}

export function WatchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Watch face */}
      <circle cx="24" cy="24" r="12" />
      <circle cx="24" cy="24" r="10" />
      {/* Watch hands */}
      <path d="M24 18 L24 24 L28 26" />
      {/* Strap connectors */}
      <path d="M20 12 L20 8" />
      <path d="M28 12 L28 8" />
      <path d="M20 36 L20 40" />
      <path d="M28 36 L28 40" />
    </svg>
  );
}

export function EarringsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Left earring */}
      <circle cx="14" cy="12" r="3" />
      <path d="M14 15 L14 20" />
      <path d="M10 24 L14 32 L18 24 Z" />
      {/* Right earring */}
      <circle cx="34" cy="12" r="3" />
      <path d="M34 15 L34 20" />
      <path d="M30 24 L34 32 L38 24 Z" />
    </svg>
  );
}

export function PendantIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Bail/loop at top */}
      <path d="M20 12 C20 8 28 8 28 12" />
      <path d="M20 12 L20 16" />
      <path d="M28 12 L28 16" />
      {/* Teardrop pendant */}
      <path d="M24 16 C18 20 16 28 20 34 C22 38 26 38 28 34 C32 28 30 20 24 16 Z" />
      {/* Inner detail */}
      <path d="M24 22 C22 24 21 28 23 31 C24 32 25 32 26 31 C28 28 27 24 24 22 Z" />
    </svg>
  );
}

export function OtherJewelleryIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Three sparkle stars */}
      <path d="M14 16 L14 12 M12 14 L16 14" />
      <path d="M14 14 L12 12 M14 14 L16 12 M14 14 L12 16 M14 14 L16 16" />
      
      <path d="M34 20 L34 14 M31 17 L37 17" />
      <path d="M34 17 L31 14 M34 17 L37 14 M34 17 L31 20 M34 17 L37 20" />
      
      <path d="M22 34 L22 28 M19 31 L25 31" />
      <path d="M22 31 L19 28 M22 31 L25 28 M22 31 L19 34 M22 31 L25 34" />
    </svg>
  );
}

export function GemstoneIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Diamond shape */}
      <path d="M24 8 L36 18 L24 40 L12 18 Z" />
      <path d="M12 18 L24 22 L36 18" />
      <path d="M24 22 L24 40" />
      <path d="M18 8 L15 18" />
      <path d="M30 8 L33 18" />
      <path d="M18 8 L24 8 L30 8" />
    </svg>
  );
}

export function BroochIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Oval brooch */}
      <ellipse cx="24" cy="24" rx="14" ry="10" />
      <ellipse cx="24" cy="24" rx="10" ry="6" />
      {/* Center gem */}
      <circle cx="24" cy="24" r="4" />
      {/* Pin */}
      <path d="M10 34 L6 40" />
    </svg>
  );
}

export function CufflinksIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Left cufflink */}
      <rect x="8" y="16" width="12" height="12" rx="2" />
      <rect x="10" y="18" width="8" height="8" rx="1" />
      {/* Right cufflink */}
      <rect x="28" y="20" width="12" height="12" rx="2" />
      <rect x="30" y="22" width="8" height="8" rx="1" />
    </svg>
  );
}
