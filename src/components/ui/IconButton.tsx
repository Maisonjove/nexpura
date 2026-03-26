'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';
import { Slot } from '@radix-ui/react-slot';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Required accessible label for screen readers
   */
  label: string;
  /**
   * Visual icon element (e.g., from lucide-react)
   */
  icon: React.ReactNode;
  /**
   * Button variant from the button component
   */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  /**
   * Button size
   */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /**
   * Use Slot for composition
   */
  asChild?: boolean;
  /**
   * Optional tooltip (shown on hover)
   */
  tooltip?: string;
}

/**
 * Accessible icon-only button with sr-only label.
 * Always includes a screen reader label for accessibility.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ 
    label, 
    icon, 
    variant = 'ghost', 
    size = 'icon', 
    asChild = false,
    tooltip,
    className, 
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : 'button';
    
    return (
      <Comp
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          'focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
          className
        )}
        title={tooltip || label}
        aria-label={label}
        {...props}
      >
        <span aria-hidden="true">{icon}</span>
        <span className="sr-only">{label}</span>
      </Comp>
    );
  }
);

IconButton.displayName = 'IconButton';

/**
 * Accessible icon link with sr-only label.
 */
interface IconLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  label: string;
  icon: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const IconLink = React.forwardRef<HTMLAnchorElement, IconLinkProps>(
  ({ label, icon, variant = 'ghost', size = 'icon', className, ...props }, ref) => {
    return (
      <a
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          'focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
          className
        )}
        aria-label={label}
        {...props}
      >
        <span aria-hidden="true">{icon}</span>
        <span className="sr-only">{label}</span>
      </a>
    );
  }
);

IconLink.displayName = 'IconLink';
