import React from 'react';
import { cn } from '@/lib/utils';

// Define the size type for better type safety
type SpacingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

// Shared sizing constants
const SPACING_SIZE_MAP: Record<SpacingSize, number> = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
};

type SpacerProps = {
  size?: SpacingSize;
  axis?: 'horizontal' | 'vertical';
  className?: string;
};

/**
 * Spacer component for consistent spacing
 * 
 * @param size - Size of the spacer
 * @param axis - Orientation of the spacer (horizontal or vertical)
 * @param className - Additional class names to apply
 */
export function Spacer({
  size = 'md',
  axis = 'vertical',
  className,
}: SpacerProps) {
  const getSizeClass = () => {
    const sizeValue = SPACING_SIZE_MAP[size] || 8;
    return axis === 'vertical' ? `h-${sizeValue}` : `w-${sizeValue}`;
  };

  return (
    <div
      className={cn(
        getSizeClass(),
        axis === 'horizontal' ? 'inline-block' : 'block',
        className
      )}
      aria-hidden="true"
    />
  );
}

type Direction = 'row' | 'column';

type ResponsiveDirection = Direction | {
  default: Direction;
  sm?: Direction;
  md?: Direction;
  lg?: Direction;
  xl?: Direction;
  '2xl'?: Direction;
};

type StackProps = {
  children: React.ReactNode;
  className?: string;
  space?: SpacingSize;
  direction?: ResponsiveDirection;
};

/**
 * Stack component for consistent spacing between elements
 * 
 * @param children - The content to display inside the stack
 * @param className - Additional class names to apply
 * @param space - Size of the gap between elements
 * @param direction - Direction of the stack (row or column), can be responsive
 */
export function Stack({
  children,
  className,
  space = 'md',
  direction = 'column',
}: StackProps) {
  const getSpaceClass = () => `gap-${SPACING_SIZE_MAP[space] || 8}`;

  const getDirectionClass = () => {
    // Simple implementation for string values
    if (typeof direction === 'string') {
      return direction === 'row' ? 'flex-row' : 'flex-col';
    }
    
    // When direction is an object with responsive values
    // e.g. { default: 'column', md: 'row' }
    const { default: defaultDir, ...breakpoints } = direction;
    const baseClass = defaultDir === 'row' ? 'flex-row' : 'flex-col';
    
    // Create responsive classes using Tailwind's responsive prefixes
    const responsiveClasses = Object.entries(breakpoints).reduce(
      (classes, [breakpoint, dir]) => {
        classes[`${breakpoint}:${dir === 'row' ? 'flex-row' : 'flex-col'}`] = true;
        return classes;
      },
      {} as Record<string, boolean>
    );
    
    return cn(baseClass, responsiveClasses);
  };

  return (
    <div
      className={cn(
        'flex',
        getDirectionClass(),
        getSpaceClass(),
        className
      )}
    >
      {children}
    </div>
  );
} 