"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Error state - visually indicates invalid input */
  error?: boolean;
  /** Controls the resize behavior of the textarea */
  resize?: 'none' | 'both' | 'horizontal' | 'vertical';
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, resize = 'vertical', "aria-describedby": ariaDescribedby, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "textarea textarea-bordered w-full",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50",
          "min-h-[80px] py-2 px-3",
          "placeholder:text-base-content/50",
          "text-base-content",
          "transition-colors",
          {
            "textarea-error border-error focus:ring-error": error,
            "resize-none": resize === 'none',
            "resize-y": resize === 'vertical',
            "resize-x": resize === 'horizontal',
            "resize": resize === 'both'
          },
          className
        )}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={ariaDescribedby}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea"; 