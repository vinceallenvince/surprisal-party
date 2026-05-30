"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Label text to display next to the switch */
  label?: React.ReactNode;
  /** Error state - visually indicates invalid selection */
  error?: boolean;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const switchId = id || Math.random().toString(36).substring(2, 9);
    
    return (
      <div className="form-control">
        <label 
          htmlFor={switchId}
          className={cn(
            "label cursor-pointer justify-start gap-2",
            error && "text-error",
            className
          )}
        >
          <input
            type="checkbox"
            role="switch"
            id={switchId}
            ref={ref}
            className={cn(
              "toggle",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50",
              {
                "toggle-error": error
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

Switch.displayName = "Switch"; 