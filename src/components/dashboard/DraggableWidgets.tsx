"use client";

import { useState, useEffect, ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Widget {
  id: string;
  visible: boolean;
}

interface SortableWidgetProps {
  id: string;
  children: ReactNode;
  isDragEnabled?: boolean;
}

interface DraggableWidgetsProps {
  children: ReactNode[];
  widgetIds: string[];
  storageKey?: string;
  onLayoutChange?: (layout: Widget[]) => void;
}

// ─── Sortable Widget Wrapper ─────────────────────────────────────────────────

function SortableWidget({ id, children, isDragEnabled = true }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isDragEnabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {isDragEnabled && (
        <button
          className="absolute -left-2 top-3 z-10 p-1.5 rounded-lg bg-white border border-stone-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-stone-400" />
        </button>
      )}
      {children}
    </div>
  );
}

// ─── Main Draggable Widgets Component ────────────────────────────────────────

export default function DraggableWidgets({
  children,
  widgetIds,
  storageKey = "dashboard-widget-layout",
  onLayoutChange,
}: DraggableWidgetsProps) {
  const [layout, setLayout] = useState<Widget[]>(() => {
    // Initialize with default order
    return widgetIds.map((id) => ({ id, visible: true }));
  });
  const [isClient, setIsClient] = useState(false);

  // Load saved layout from localStorage on mount
  useEffect(() => {
    setIsClient(true);
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Widget[];
        // Merge with current widgetIds to handle new/removed widgets
        const merged = widgetIds.map((id) => {
          const existing = parsed.find((w) => w.id === id);
          return existing || { id, visible: true };
        });
        // Sort by saved order
        merged.sort((a, b) => {
          const aIndex = parsed.findIndex((w) => w.id === a.id);
          const bIndex = parsed.findIndex((w) => w.id === b.id);
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
        setLayout(merged);
      }
    } catch (e) {
      Sentry.captureException(e, { tags: { component: 'DraggableWidgets', action: 'load-layout' } });
    }
  }, [storageKey, widgetIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLayout((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newLayout = arrayMove(items, oldIndex, newIndex);

        // Save to localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify(newLayout));
        } catch (e) {
          Sentry.captureException(e, { tags: { component: 'DraggableWidgets', action: 'save-layout-drag' } });
        }

        // Notify parent
        onLayoutChange?.(newLayout);

        return newLayout;
      });
    }
  }

  function toggleWidgetVisibility(id: string) {
    setLayout((items) => {
      const newLayout = items.map((item) =>
        item.id === id ? { ...item, visible: !item.visible } : item
      );

      // Save to localStorage
      try {
        localStorage.setItem(storageKey, JSON.stringify(newLayout));
      } catch (e) {
        Sentry.captureException(e, { tags: { component: 'DraggableWidgets', action: 'save-layout-toggle' } });
      }

      onLayoutChange?.(newLayout);
      return newLayout;
    });
  }

  // Create a map of widget ID to child component
  const childrenArray = Array.isArray(children) ? children : [children];
  const childMap = new Map<string, ReactNode>();
  widgetIds.forEach((id, index) => {
    childMap.set(id, childrenArray[index]);
  });

  // Get ordered visible widgets
  const orderedWidgetIds = layout.filter((w) => w.visible).map((w) => w.id);

  if (!isClient) {
    // Server-side: render in default order without drag functionality
    return (
      <div className="space-y-6">
        {widgetIds.map((id) => (
          <div key={id}>{childMap.get(id)}</div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={orderedWidgetIds} strategy={rectSortingStrategy}>
        <div className="space-y-6">
          {orderedWidgetIds.map((id) => (
            <SortableWidget key={id} id={id}>
              {childMap.get(id)}
            </SortableWidget>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─── Widget Settings Panel (for toggling visibility) ────────────────────────

interface WidgetSettingsProps {
  widgets: { id: string; label: string }[];
  layout: Widget[];
  onToggle: (id: string) => void;
  onResetLayout: () => void;
}

export function WidgetSettings({
  widgets,
  layout,
  onToggle,
  onResetLayout,
}: WidgetSettingsProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-stone-900">Dashboard Widgets</h3>
        <button
          onClick={onResetLayout}
          className="text-xs text-stone-500 hover:text-stone-700"
        >
          Reset to default
        </button>
      </div>
      <p className="text-xs text-stone-500 mb-4">
        Drag widgets to reorder. Toggle visibility below.
      </p>
      <div className="space-y-2">
        {widgets.map((widget) => {
          const isVisible = layout.find((w) => w.id === widget.id)?.visible ?? true;
          return (
            <label
              key={widget.id}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isVisible}
                onChange={() => onToggle(widget.id)}
                className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-stone-700">{widget.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
