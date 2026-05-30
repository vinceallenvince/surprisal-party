"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Radio } from "./Radio";

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, 'onChange'> {
  /** Label text for the radio group */
  label: React.ReactNode;
  /** Optional description text */
  description?: React.ReactNode;
  /** Error message to display */
  error?: string;
  /** Whether the radio group is required */
  required?: boolean;
  /** Children components (typically Radio components) */
  children?: React.ReactNode;
  /** Array of radio options */
  options?: RadioOption[];
  /** Current selected value */
  value?: string;
  /** Callback when value changes */
  onValueChange?: (value: string) => void;
  /** Layout direction of radio buttons */
  direction?: 'horizontal' | 'vertical';
}

export const RadioGroup = forwardRef<HTMLFieldSetElement, RadioGroupProps>(
  ({ 
    className, 
    label, 
    description, 
    error, 
    required, 
    children, 
    options, 
    value, 
    onValueChange,
    direction = 'vertical',
    ...props 
  }, ref) => {
    const hasError = !!error;
    const id = props.id || `radio-group-${Math.random().toString(36).substring(2, 9)}`;
    const errorId = `${id}-error`;
    const descriptionId = `${id}-description`;
    
    const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange?.(e.target.value);
    };
    
    return (
      <fieldset
        ref={ref}
        className={cn("space-y-2", className)}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={cn(
          description ? descriptionId : undefined,
          error ? errorId : undefined
        )}
        role="radiogroup"
        aria-required={required ? "true" : undefined}
        {...props}
      >
        <legend className={cn(
          "text-base font-medium", 
          hasError && "text-error"
        )}>
          {label}
          {required && <span className="text-error ml-1" aria-hidden="true">*</span>}
        </legend>
        
        {description && (
          <p id={descriptionId} className="text-sm text-gray-500">
            {description}
          </p>
        )}
        
        <div className={cn(
          "space-y-2",
          direction === 'horizontal' && "flex flex-row flex-wrap gap-4 space-y-0"
        )}>
          {options ? (
            options.map((option) => (
              <Radio
                key={option.value}
                name={props.name}
                value={option.value}
                label={option.label}
                checked={value === option.value}
                onChange={handleRadioChange}
                disabled={option.disabled}
                aria-describedby={cn(
                  description ? descriptionId : undefined,
                  error ? errorId : undefined
                )}
              />
            ))
          ) : (
            children
          )}
        </div>
        
        {error && (
          <p id={errorId} className="text-sm text-error mt-1" aria-live="polite">
            {error}
          </p>
        )}
      </fieldset>
    );
  }
);

RadioGroup.displayName = "RadioGroup"; 