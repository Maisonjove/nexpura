'use client';

import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook for trapping focus within a container (for modals, dialogs, etc.)
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements
    const getFocusableElements = () => {
      return container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
    };

    // Focus the first focusable element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to the previously focused element
      previousActiveElement.current?.focus();
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook for handling Escape key to close modals/dropdowns
 */
export function useEscapeKey(onEscape: () => void, isActive: boolean = true) {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, isActive]);
}

/**
 * Hook for arrow key navigation in lists/menus
 */
export function useArrowNavigation<T>(
  items: T[],
  selectedIndex: number,
  onSelect: (index: number) => void,
  onActivate?: (item: T) => void,
  isActive: boolean = true
) {
  useEffect(() => {
    if (!isActive || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onSelect((selectedIndex + 1) % items.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          onSelect((selectedIndex - 1 + items.length) % items.length);
          break;
        case 'Home':
          e.preventDefault();
          onSelect(0);
          break;
        case 'End':
          e.preventDefault();
          onSelect(items.length - 1);
          break;
        case 'Enter':
        case ' ':
          if (onActivate && items[selectedIndex]) {
            e.preventDefault();
            onActivate(items[selectedIndex]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedIndex, onSelect, onActivate, isActive]);
}

/**
 * Hook for managing roving tabindex in a group of elements
 */
export function useRovingTabIndex(containerRef: React.RefObject<HTMLElement>) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = Array.from(
      container.querySelectorAll<HTMLElement>('[role="menuitem"], [role="option"], [role="tab"]')
    );
    
    const currentIndex = focusableElements.findIndex(el => el === document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = (currentIndex + 1) % focusableElements.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = focusableElements.length - 1;
        break;
    }

    if (nextIndex !== null) {
      focusableElements[nextIndex]?.focus();
    }
  }, [containerRef]);

  return { onKeyDown: handleKeyDown };
}

/**
 * Hook for announcing messages to screen readers
 */
export function useAnnounce() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement is made
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  return announce;
}

/**
 * Hook for managing focus when content changes dynamically
 */
export function useFocusOnMount(ref: React.RefObject<HTMLElement>, shouldFocus: boolean = true) {
  useEffect(() => {
    if (shouldFocus && ref.current) {
      // Small delay to ensure element is rendered
      const timeoutId = setTimeout(() => {
        ref.current?.focus();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [shouldFocus, ref]);
}

/**
 * Hook for skip link functionality
 */
export function useSkipLink(targetId: string) {
  const handleSkip = useCallback((e: React.KeyboardEvent | React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus();
      target.removeAttribute('tabindex');
    }
  }, [targetId]);

  return handleSkip;
}
