import React, { ElementType } from 'react';
import { cn } from '@/lib/utils';

export type ContainerProps<T extends ElementType = 'div'> = {
  children: React.ReactNode;
  className?: string;
  as?: T;
  fluid?: boolean;
} & React.ComponentPropsWithoutRef<T>;

/**
 * Container component with responsive padding
 * 
 * @param children - The content to display inside the container
 * @param className - Additional class names to apply
 * @param as - The HTML element to render as (default: div)
 * @param fluid - Whether the container should be fluid (full width) or not
 */
export function Container<T extends ElementType = 'div'>({
  children,
  className,
  as,
  fluid = false,
  ...props
}: ContainerProps<T>) {
  const Component = as || 'div';
  
  return (
    <Component
      className={cn(
        'w-full px-6 ',
        // Apply either centered or left-justified alignment based on fluid prop
        fluid ? 'mx-auto' : 'max-w-7xl mr-auto ml-0',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
} 