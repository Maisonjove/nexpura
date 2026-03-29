export default function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="font-serif text-2xl tracking-[0.12em] text-stone-900 mb-6">
          NEXPURA
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-900 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-stone-900 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-stone-900 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
