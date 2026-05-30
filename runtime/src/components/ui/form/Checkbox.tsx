"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Label text to display next to the checkbox */
  label?: React.ReactNode;
  /** Error state - visually indicates invalid selection */
  error?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const checkboxId = id || Math.random().toString(36).substring(2, 9);
    
    return (
      <div className="form-control">
        <label 
          htmlFor={checkboxId}
          className={cn(
            "label cursor-pointer justify-start gap-2",
            error && "text-error",
            className
          )}
        >
          <input
            type="checkbox"
            id={checkboxId}
            ref={ref}
            className={cn(
              "checkbox",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50",
              {
                "checkbox-error": error
              }
            )}
            aria-invalid={error ? "true" : undefined}
            {...props}
          />
          {label && (
            <span className="label-text">{label}</span>
          )}
        </label>
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox"; 