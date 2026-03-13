interface TagPillProps {
  tag: string;
  className?: string;
}

const TAG_STYLES: Record<string, string> = {
  vip: "bg-[#FBF5E6] text-[#B8860B] border border-[#E8D5A0]",
  bridal: "bg-rose-50 text-rose-600 border border-rose-200",
  wholesale: "bg-stone-100 text-stone-700 border border-blue-200",
  retail: "bg-gray-100 text-gray-500 border border-gray-200",
  trade: "bg-stone-100 text-stone-700 border border-purple-200",
  regular: "bg-gray-100 text-gray-500 border border-gray-200",
};

export default function TagPill({ tag, className = "" }: TagPillProps) {
  const style = TAG_STYLES[tag.toLowerCase()] || "bg-gray-100 text-gray-500 border border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${style} ${className}`}>
      {tag}
    </span>
  );
}
