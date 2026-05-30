import React, { ElementType } from 'react';
import { cn } from '@/lib/utils';
import { Container } from './container';

type SectionProps<T extends ElementType = 'section'> = {
  children: React.ReactNode;
  className?: string;
  as?: T;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  container?: boolean;
} & React.ComponentPropsWithoutRef<T>;

/**
 * Section component for page structure with consistent vertical spacing
 * 
 * @param children - The content to display inside the section
 * @param className - Additional class names to apply
 * @param as - The HTML element to render as (default: section)
 * @param size - Size of vertical padding
 * @param container - Whether to wrap content in a container
 */
export function Section<T extends ElementType = 'section'>({
  children,
  className,
  as,
  size = 'md',
  container = false,
  ...props
}: SectionProps<T>) {
  const Component = as || 'section';
  
  const sizeClasses = {
    sm: 'py-4',
    md: 'py-8',
    lg: 'py-12 md:py-16',
    xl: 'py-16 md:py-24',
  };
  
  const getSizeClass = () => sizeClasses[size] || 'py-8';

  const content = container ? <Container>{children}</Container> : children;

  return (
    <Component
      className={cn(
        getSizeClass(),
        className
      )}
      {...props}
    >
      {content}
    </Component>
  );
}

type DividerProps<T extends ElementType = 'hr'> = {
  className?: string;
  as?: T;
  orientation?: 'horizontal' | 'vertical';
} & React.ComponentPropsWithoutRef<T>;

/**
 * Divider component for visual separation between content
 * 
 * @param className - Additional class names to apply
 * @param as - The HTML element to render as (default: hr)
 * @param orientation - Orientation of the divider (horizontal or vertical)
 */
export function Divider<T extends ElementType = 'hr'>({
  className,
  as,
  orientation = 'horizontal',
  ...props
}: DividerProps<T>) {
  const Component = as || 'hr';
  
  const orientationClasses = {
    vertical: 'h-full border-l border-t-0',
    horizontal: 'w-full border-t border-l-0'
  };

  return (
    <Component
      className={cn(
        'border-gray-200 dark:border-gray-700',
        orientationClasses[orientation],
        className
      )}
      {...props}
    />
  );
} 