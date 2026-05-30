"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Additional class names for styling */
  className?: string;
  /** Error state - visually indicates invalid input */
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, "aria-describedby": ariaDescribedby, ...props }, ref) => {
    // We need to handle aria-describedby separately to merge it properly when there's an error
    return (
      <input
        ref={ref}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={ariaDescribedby}
        className={cn(
          "input input-bordered w-full",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50",
          "min-h-10 py-2 px-3",
          "placeholder:text-base-content/50",
          "text-base-content",
          "transition-colors",
          {
            "input-error border-error focus:ring-error": error
          },
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input"; 