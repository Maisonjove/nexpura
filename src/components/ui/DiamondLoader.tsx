'use client';

interface DiamondLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function DiamondLoader({ size = 'md', text }: DiamondLoaderProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Diamond SVG with animations */}
      <div className={`relative ${sizeClasses[size]}`}>
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full animate-pulse"
          style={{ filter: 'drop-shadow(0 0 8px rgba(180, 83, 9, 0.3))' }}
        >
          {/* Diamond outline */}
          <polygon
            points="50,5 95,35 50,95 5,35"
            fill="none"
            stroke="url(#diamondGradient)"
            strokeWidth="2"
            className="animate-[diamondDraw_2s_ease-in-out_infinite]"
            style={{
              strokeDasharray: 300,
              strokeDashoffset: 0,
            }}
          />
          
          {/* Inner facets - top */}
          <polygon
            points="50,5 75,35 50,45 25,35"
            fill="url(#facetGradient1)"
            className="animate-[facetShimmer_2s_ease-in-out_infinite]"
            style={{ opacity: 0.6 }}
          />
          
          {/* Inner facets - left */}
          <polygon
            points="5,35 25,35 50,45 50,95"
            fill="url(#facetGradient2)"
            className="animate-[facetShimmer_2s_ease-in-out_infinite_0.3s]"
            style={{ opacity: 0.4 }}
          />
          
          {/* Inner facets - right */}
          <polygon
            points="95,35 75,35 50,45 50,95"
            fill="url(#facetGradient3)"
            className="animate-[facetShimmer_2s_ease-in-out_infinite_0.6s]"
            style={{ opacity: 0.5 }}
          />

          {/* Sparkle effects */}
          <circle
            cx="50"
            cy="20"
            r="2"
            fill="white"
            className="animate-[sparkle_1.5s_ease-in-out_infinite]"
          />
          <circle
            cx="30"
            cy="35"
            r="1.5"
            fill="white"
            className="animate-[sparkle_1.5s_ease-in-out_infinite_0.5s]"
          />
          <circle
            cx="70"
            cy="35"
            r="1.5"
            fill="white"
            className="animate-[sparkle_1.5s_ease-in-out_infinite_0.8s]"
          />

          {/* Gradients */}
          <defs>
            <linearGradient id="diamondGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#b45309" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="facetGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef3c7" />
              <stop offset="100%" stopColor="#fcd34d" />
            </linearGradient>
            <linearGradient id="facetGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="facetGradient3" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
          </defs>
        </svg>

        {/* Rotating glow ring */}
        <div 
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            background: 'conic-gradient(from 0deg, transparent, rgba(180, 83, 9, 0.2), transparent)',
            animationDuration: '3s',
          }}
        />
      </div>

      {/* Loading text */}
      {text && (
        <p className={`text-stone-500 font-medium tracking-wide ${textSizeClasses[size]}`}>
          {text}
        </p>
      )}

      {/* Inline keyframes */}
      <style jsx>{`
        @keyframes diamondDraw {
          0%, 100% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          50% {
            stroke-dashoffset: 50;
            opacity: 0.7;
          }
        }
        
        @keyframes facetShimmer {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.8;
          }
        }
        
        @keyframes sparkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            opacity: 1;
            transform: scale(1.5);
          }
        }
      `}</style>
    </div>
  );
}
