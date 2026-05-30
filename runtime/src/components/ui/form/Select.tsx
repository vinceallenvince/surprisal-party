"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Options for the select dropdown */
  options?: SelectOption[];
  /** Optional placeholder text when no option is selected */
  placeholder?: string;
  /** Error state - visually indicates invalid selection */
  error?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ 
    className, 
    options = [], 
    placeholder, 
    error, 
    size = 'md',
    children,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    ...props 
  }, ref) => {
    // Determine size classes
    const sizeClasses = {
      sm: "min-h-8 py-1 text-sm",
      md: "min-h-10 py-2",
      lg: "min-h-12 py-3 text-lg"
    };

    return (
      <select
        ref={ref}
        className={cn(
          "select select-bordered w-full appearance-none",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50",
          "px-3",
          "text-base-content",
          "transition-colors",
          sizeClasses[size],
          {
            "select-error border-error focus:ring-error": error
          },
          className
        )}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-invalid={error ? "true" : "false"}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        
        {options.length > 0 ? (
          options.map((option) => (
            <option 
              key={option.value} 
              value={option.value} 
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))
        ) : (
          children
        )}
      </select>
    );
  }
);

Select.displayName = "Select"; 