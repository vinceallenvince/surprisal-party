import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { HeadingProps } from './types';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface HeadingComponentProps extends HeadingProps {
  level: HeadingLevel;
}

// Generic heading component
const Heading = forwardRef<HTMLHeadingElement, HeadingComponentProps>(
  ({ level, className, children, id, as, ...props }, ref) => {
    // Use the provided tag or default to h1-h6 based on level
    const Component = as || (`h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6');
    
    // Define styles for each heading level
    // Added font-sans class to ensure consistent font usage
    const styles: Record<HeadingLevel, string> = {
      1: 'scroll-m-20 text-4xl font-bold tracking-tight font-sans lg:text-5xl',
      2: 'scroll-m-20 text-3xl font-semibold tracking-tight font-sans lg:text-4xl',
      3: 'scroll-m-20 text-2xl font-semibold tracking-tight font-sans lg:text-3xl',
      4: 'scroll-m-20 text-xl font-semibold tracking-tight font-sans lg:text-2xl',
      5: 'scroll-m-20 text-lg font-semibold tracking-tight font-sans lg:text-xl',
      6: 'scroll-m-20 text-base font-semibold tracking-tight font-sans',
    };
    
    return (
      <Component
        id={id}
        ref={ref}
        className={cn(styles[level], className)}
        style={{
          fontFamily: 'var(--font-sans, var(--font-sans-fallback))'
        }}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Heading.displayName = 'Heading';

// Export specific heading components
export const H1 = forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level'>>(
  (props, ref) => <Heading level={1} {...props} ref={ref} />
);
H1.displayName = 'H1';

export const H2 = forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level'>>(
  (props, ref) => <Heading level={2} {...props} ref={ref} />
);
H2.displayName = 'H2';

export const H3 = forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level'>>(
  (props, ref) => <Heading level={3} {...props} ref={ref} />
);
H3.displayName = 'H3';

export const H4 = forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level'>>(
  (props, ref) => <Heading level={4} {...props} ref={ref} />
);
H4.displayName = 'H4';

export const H5 = forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level'>>(
  (props, ref) => <Heading level={5} {...props} ref={ref} />
);
H5.displayName = 'H5';

export const H6 = forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level'>>(
  (props, ref) => <Heading level={6} {...props} ref={ref} />
);
H6.displayName = 'H6';

// Also export the generic Heading component for flexibility
export { Heading }; 