"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The ID for the form field (for label association) */
  id?: string;
  /** The label text for the form field */
  label?: React.ReactNode;
  /** Help text to display below the field */
  helpText?: React.ReactNode;
  /** Error message to display when validation fails */
  error?: React.ReactNode;
  /** Whether the field is required */
  required?: boolean;
  /** Whether to display the label */
  hideLabel?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Child components (input, select, etc.) */
  children: React.ReactNode;
}

export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  (
    {
      id,
      label,
      helpText,
      error,
      required = false,
      hideLabel = false,
      disabled = false,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const fieldId = id || Math.random().toString(36).substring(2, 9);
    const helpTextId = `${fieldId}-help`;
    const errorId = `${fieldId}-error`;

    return (
      <div 
        ref={ref}
        className={cn("form-control w-full mb-4", className)}
        {...props}
      >
        {label && !hideLabel && (
          <label 
            htmlFor={fieldId}
            className={cn(
              "label label-text font-medium mb-1",
              disabled && "opacity-70",
              error && "text-error"
            )}
          >
            <span>
              {label}
              {required && (
                <span className="text-error ml-1" aria-hidden="true">
                  *
                </span>
              )}
            </span>
          </label>
        )}
        
        {/* If label is hidden but required, we should still announce it to screen readers */}
        {label && hideLabel && required && (
          <span className="sr-only">
            {typeof label === "string" ? label : "Field"} is required
          </span>
        )}
        
        {/* Instead of trying to manipulate children, render them directly */}
        {/* The parent must pass appropriate props to form elements directly */}
        <div 
          className="relative"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : helpText ? helpTextId : undefined}
        >
          {children}
        </div>
        
        {/* Error message */}
        {error && (
          <div 
            id={errorId}
            className="text-error text-sm mt-1"
            role="alert"
          >
            {error}
          </div>
        )}
        
        {/* Help text - only show if no error is present */}
        {!error && helpText && (
          <div 
            id={helpTextId}
            className="text-sm text-base-content/70 mt-1"
          >
            {helpText}
          </div>
        )}
      </div>
    );
  }
);

FormField.displayName = "FormField"; 