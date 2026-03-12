export default function AppLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <div className="text-center">
        <div className="w-10 h-10 mx-auto mb-4 rounded-xl bg-forest flex items-center justify-center">
          <span className="font-fraunces text-sm font-bold text-white">N</span>
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <span className="w-2 h-2 rounded-full bg-sage animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-sage animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-sage animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
