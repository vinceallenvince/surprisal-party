"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Label text to display next to the radio button */
  label?: React.ReactNode;
  /** Error state - visually indicates an invalid selection */
  error?: boolean;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, id, error, ...props }, ref) => {
    const radioId = id || `radio-${Math.random().toString(36).substring(2, 9)}`;
    
    return (
      <div className="form-control">
        <label 
          htmlFor={radioId}
          className={cn(
            "label cursor-pointer justify-start gap-2",
            className
          )}
        >
          <input
            type="radio"
            id={radioId}
            ref={ref}
            className={cn(
              "radio",
              error && "radio-error",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50"
            )}
            {...props}
          />
          {label && (
            <span className={cn(
              "label-text",
              error && "text-error"
            )}>
              {label}
            </span>
          )}
        </label>
      </div>
    );
  }
);

Radio.displayName = "Radio"; 