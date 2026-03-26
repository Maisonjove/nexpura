'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, type ReactNode, type CSSProperties } from 'react';

export interface VirtualListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Function to render each item */
  renderItem: (item: T, index: number) => ReactNode;
  /** Estimated height of each item in pixels (default: 50) */
  estimateSize?: number;
  /** Height of the container (default: '100%') */
  height?: string | number;
  /** Additional className for the container */
  className?: string;
  /** Additional styles for the container */
  style?: CSSProperties;
  /** Overscan count - how many items to render outside viewport (default: 5) */
  overscan?: number;
  /** Key extractor for items (default: uses index) */
  getItemKey?: (item: T, index: number) => string | number;
}

/**
 * A performant virtualized list component that only renders visible items.
 * Use for lists with many items (>50) to improve performance.
 * 
 * @example
 * <VirtualList
 *   items={customers}
 *   renderItem={(customer, index) => (
 *     <CustomerRow customer={customer} />
 *   )}
 *   estimateSize={64}
 * />
 */
export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 50,
  height = '100%',
  className = '',
  style,
  overscan = 5,
  getItemKey,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey 
      ? (index) => getItemKey(items[index], index)
      : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      ref={parentRef}
      className={className}
      style={{
        height,
        overflow: 'auto',
        ...style,
      }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default VirtualList;
