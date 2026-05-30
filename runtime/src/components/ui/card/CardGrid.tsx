"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface CardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /**
   * Number of columns at different breakpoints
   * Default: { sm: 1, md: 2, lg: 3, xl: 4 }
   */
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  /**
   * Gap between cards using Tailwind's gap utility classes
   * Default: 'gap-4' (equivalent to 1rem)
   * Example values: 'gap-2', 'gap-6', 'gap-x-4 gap-y-2'
   */
  gap?: string;
}

export function CardGrid({
  children,
  className,
  columns = { sm: 1, md: 2, lg: 3, xl: 4 },
  gap = "gap-4",
  ...props
}: CardGridProps) {
  // Convert columns to Tailwind grid classes
  const getGridClass = () => {
    const { sm = 1, md = 2, lg = 3, xl = 4 } = columns;
    
    // Ensure column values are within a valid range (1-12)
    const validateColumns = (val: number) => val > 0 && val <= 12;
    
    // Function to generate grid column mappings
    const createGridColumnsMap = (prefix = '') => {
      const map: Record<number, string> = {};
      for (let i = 1; i <= 12; i++) {
        map[i] = `${prefix}grid-cols-${i}`;
      }
      return map;
    };
    
    // Create mappings for each breakpoint
    const smGridColumnsMap = createGridColumnsMap('sm:');
    const mdGridColumnsMap = createGridColumnsMap('md:');
    const lgGridColumnsMap = createGridColumnsMap('lg:');
    const xlGridColumnsMap = createGridColumnsMap('xl:');
    
    return [
      validateColumns(sm) && smGridColumnsMap[sm],
      validateColumns(md) && mdGridColumnsMap[md],
      validateColumns(lg) && lgGridColumnsMap[lg],
      validateColumns(xl) && xlGridColumnsMap[xl],
      "grid-cols-1", // Fallback if no other grid classes apply
    ].filter(Boolean).join(" ");
  };

  return (
    <div
      className={cn(
        "grid w-full",
        getGridClass(),
        gap,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
} 