export default function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-stone-900 flex items-center justify-center">
          <span className="font-bold text-lg text-white">N</span>
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <span className="w-2 h-2 rounded-full bg-amber-700 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-amber-700 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-amber-700 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
