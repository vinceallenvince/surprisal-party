import React, { ElementType } from 'react';
import { cn } from '@/lib/utils';

type Cols = 1 | 2 | 3 | 4 | 5 | 6 | 'none';

type ResponsiveColsConfig = {
  default: Cols;
  sm?: Cols;
  md?: Cols;
  lg?: Cols;
  xl?: Cols;
  '2xl'?: Cols;
};

type GapSize = 'none' | 'sm' | 'md' | 'lg';

type ResponsiveGapConfig = {
  default: GapSize;
  sm?: GapSize;
  md?: GapSize;
  lg?: GapSize;
  xl?: GapSize;
  '2xl'?: GapSize;
};

type GridProps<T extends ElementType = 'div'> = {
  children: React.ReactNode;
  className?: string;
  as?: T;
  cols?: Cols | ResponsiveColsConfig;
  gap?: GapSize | ResponsiveGapConfig;
} & React.ComponentPropsWithoutRef<T>;

/**
 * Grid component for responsive layouts
 * 
 * @param children - The content to display inside the grid
 * @param className - Additional class names to apply
 * @param as - The HTML element to render as (default: div)
 * @param cols - Number of columns (1-6 or 'none' for auto), can be responsive
 * @param gap - Size of gap between grid items, can be responsive
 */
export function Grid<T extends ElementType = 'div'>({
  children,
  className,
  as,
  cols = 1,
  gap = 'md',
  ...props
}: GridProps<T>) {
  const Component = as || 'div';
  
  const getColsClass = () => {
    // Handle responsive configuration object
    if (typeof cols === 'object') {
      const { default: defaultCols, ...breakpoints } = cols;
      
      // Format the default columns
      const baseClass = defaultCols === 'none' ? '' : `grid-cols-${defaultCols}`;
      
      // Create responsive classes using Tailwind's responsive prefixes
      const responsiveClasses = Object.entries(breakpoints).reduce(
        (classes, [breakpoint, value]) => {
          if (value !== undefined) {
            classes[`${breakpoint}:grid-cols-${value === 'none' ? '' : value}`] = true;
          }
          return classes;
        },
        {} as Record<string, boolean>
      );
      
      return cn(baseClass, responsiveClasses);
    }
    
    // Handle simple value with predefined responsive patterns
    switch(cols) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-1 sm:grid-cols-2';
      case 3: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      case 4: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
      case 5: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5';
      case 6: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6';
      case 'none': return '';
      default: return 'grid-cols-1';
    }
  };
  
  const getGapClass = () => {
    // Map gap sizes to Tailwind classes
    const gapSizeMap: Record<GapSize, string> = {
      'none': 'gap-0',
      'sm': 'gap-2',
      'md': 'gap-4',
      'lg': 'gap-8'
    };
    
    // Handle responsive configuration object
    if (typeof gap === 'object') {
      const { default: defaultGap, ...breakpoints } = gap;
      
      // Format the default gap
      const baseClass = gapSizeMap[defaultGap];
      
      // Create responsive classes using Tailwind's responsive prefixes
      const responsiveClasses = Object.entries(breakpoints).reduce(
        (classes, [breakpoint, value]) => {
          if (value !== undefined) {
            classes[`${breakpoint}:${gapSizeMap[value]}`] = true;
          }
          return classes;
        },
        {} as Record<string, boolean>
      );
      
      return cn(baseClass, responsiveClasses);
    }
    
    // Handle simple value
    return gapSizeMap[gap] || 'gap-4';
  };

  return (
    <Component
      className={cn(
        'grid',
        getColsClass(),
        getGapClass(),
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

type Span = 1 | 2 | 3 | 4 | 5 | 6 | 'full';

type ResponsiveSpanConfig = {
  default: Span;
  sm?: Span;
  md?: Span;
  lg?: Span;
  xl?: Span;
  '2xl'?: Span;
};

type GridItemProps<T extends ElementType = 'div'> = {
  children: React.ReactNode;
  className?: string;
  as?: T;
  span?: Span | ResponsiveSpanConfig;
} & React.ComponentPropsWithoutRef<T>;

/**
 * GridItem component for use within Grid
 * 
 * @param children - The content to display inside the grid item
 * @param className - Additional class names to apply
 * @param as - The HTML element to render as (default: div)
 * @param span - Number of columns to span (1-6 or 'full' for all columns), can be responsive
 */
export function GridItem<T extends ElementType = 'div'>({
  children,
  className,
  as,
  span,
  ...props
}: GridItemProps<T>) {
  const Component = as || 'div';
  
  const getSpanClass = () => {
    if (!span) return '';
    
    // Map span values to Tailwind classes
    const spanClassMap = (value: Span): string => {
      if (value === 'full') return 'col-span-full';
      return `col-span-${value}`;
    };
    
    // Handle responsive configuration object
    if (typeof span === 'object') {
      const { default: defaultSpan, ...breakpoints } = span;
      
      // Format the default span
      const baseClass = spanClassMap(defaultSpan);
      
      // Create responsive classes using Tailwind's responsive prefixes
      const responsiveClasses = Object.entries(breakpoints).reduce(
        (classes, [breakpoint, value]) => {
          if (value !== undefined) {
            classes[`${breakpoint}:${spanClassMap(value)}`] = true;
          }
          return classes;
        },
        {} as Record<string, boolean>
      );
      
      return cn(baseClass, responsiveClasses);
    }
    
    // Handle simple value
    return spanClassMap(span);
  };

  return (
    <Component
      className={cn(
        getSpanClass(),
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
} 