import { WifiOff, RefreshCw } from 'lucide-react';

export const metadata = {
  title: 'Offline — Nexpura',
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
          <WifiOff className="w-8 h-8 text-amber-700" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">You're Offline</h1>
        <p className="text-stone-500 mb-6">
          It looks like you've lost your internet connection. Don't worry — any POS transactions 
          you make will be saved and synced automatically when you're back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg font-medium hover:bg-amber-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}
