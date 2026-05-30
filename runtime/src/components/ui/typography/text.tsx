import { createElement, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { TextProps } from './types';

// Define variant styles outside component to prevent recreation on each render
// Adding explicit fallback classes to ensure text is always visible
const variantStyles = {
  lead: 'text-xl text-foreground leading-7 font-sans',
  normal: 'text-base text-foreground leading-7 font-sans',
  small: 'text-sm text-foreground/80 leading-6 font-sans',
  tiny: 'text-xs text-foreground/70 leading-5 font-sans',
};

// Generic text component that can render different HTML elements
export const Text = forwardRef<HTMLElement, TextProps>(
  ({ className, as = 'p', variant = 'normal', children, id, ...props }, ref) => {
    return createElement(
      as,
      {
        id,
        ref,
        className: cn(variantStyles[variant], className),
        style: {
          fontFamily: 'var(--font-sans, var(--font-sans-fallback))'
        },
        ...props
      },
      children
    );
  }
);

Text.displayName = 'Text';

// Paragraph component
export const Paragraph = forwardRef<HTMLParagraphElement, Omit<TextProps, 'as' | 'variant'>>(
  (props, ref) => {
    // Cast ref to unknown then HTMLElement to avoid TypeScript errors
    const elementRef = ref as unknown as React.Ref<HTMLElement>;
    return <Text {...props} ref={elementRef} as="p" variant="normal" />;
  }
);
Paragraph.displayName = 'Paragraph';

// Lead paragraph component
export const Lead = forwardRef<HTMLParagraphElement, Omit<TextProps, 'as' | 'variant'>>(
  (props, ref) => {
    // Cast ref to unknown then HTMLElement to avoid TypeScript errors
    const elementRef = ref as unknown as React.Ref<HTMLElement>;
    return <Text {...props} ref={elementRef} as="p" variant="lead" />;
  }
);
Lead.displayName = 'Lead';

// Small text component
export const Small = forwardRef<HTMLSpanElement, Omit<TextProps, 'as' | 'variant'>>(
  (props, ref) => {
    // Cast ref to unknown then HTMLElement to avoid TypeScript errors
    const elementRef = ref as unknown as React.Ref<HTMLElement>;
    return <Text {...props} ref={elementRef} as="span" variant="small" />;
  }
);
Small.displayName = 'Small';

// Tiny text component for captions or footnotes
export const Tiny = forwardRef<HTMLSpanElement, Omit<TextProps, 'as' | 'variant'>>(
  (props, ref) => {
    // Cast ref to unknown then HTMLElement to avoid TypeScript errors
    const elementRef = ref as unknown as React.Ref<HTMLElement>;
    return <Text {...props} ref={elementRef} as="span" variant="tiny" />;
  }
);
Tiny.displayName = 'Tiny'; 