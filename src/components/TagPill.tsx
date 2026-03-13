interface TagPillProps {
  tag: string;
  className?: string;
}

const TAG_STYLES: Record<string, string> = {
  vip: "bg-amber-50 text-amber-700 border border-amber-200",
  bridal: "bg-stone-50 text-stone-600 border border-stone-200",
  wholesale: "bg-stone-100 text-stone-700 border border-stone-200",
  retail: "bg-stone-100 text-stone-500 border border-stone-200",
  trade: "bg-stone-100 text-stone-700 border border-stone-200",
  regular: "bg-stone-100 text-stone-500 border border-stone-200",
};

export default function TagPill({ tag, className = "" }: TagPillProps) {
  const style = TAG_STYLES[tag.toLowerCase()] || "bg-stone-100 text-stone-500 border border-stone-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${style} ${className}`}>
      {tag}
    </span>
  );
}
