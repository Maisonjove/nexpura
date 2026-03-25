export default function Skeleton({ h = 'h-8', w = 'w-full' }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} bg-stone-100 rounded-lg animate-pulse`} />;
}
