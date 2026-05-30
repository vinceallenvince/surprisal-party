"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button visual variant */
  variant?: "primary" | "secondary" | "accent" | "ghost" | "link" | "outline";
  /** Button color scheme */
  color?: "default" | "success" | "warning" | "error" | "info";
  /** Button size */
  size?: "xs" | "sm" | "md" | "lg";
  /** Loading state with spinner */
  isLoading?: boolean;
  /** Leading (left) icon component */
  leadingIcon?: React.ReactNode;
  /** Trailing (right) icon component */
  trailingIcon?: React.ReactNode;
  /** Full width button */
  fullWidth?: boolean;
  /** Button text or content */
  children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      color = "default",
      size = "md",
      isLoading = false,
      leadingIcon,
      trailingIcon,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // Base classes all buttons will have
    const baseClasses = "btn font-medium inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary";

    // Variant classes
    const variantClasses = {
      primary: "btn-primary",
      secondary: "btn-secondary",
      accent: "btn-accent",
      ghost: "btn-ghost",
      link: "btn-link",
      outline: "btn-outline",
    };

    // Color classes (only apply to some variants)
    const colorClasses = {
      default: "",
      success: "btn-success",
      warning: "btn-warning",
      error: "btn-error",
      info: "btn-info",
    };

    // Size classes
    const sizeClasses = {
      xs: "btn-xs",
      sm: "btn-sm",
      md: "",
      lg: "btn-lg",
    };

    // Get color class (empty string for default)
    const colorClass = colorClasses[color];

    // Combine all classes
    const buttonClasses = cn(
      baseClasses,
      variantClasses[variant],
      colorClass,
      sizeClasses[size],
      isLoading && "btn-disabled",
      fullWidth && "w-full",
      className
    );

    // Content with icons and loading state
    const content = (
      <>
        {isLoading && (
          <span className="loading loading-spinner loading-xs mr-2" aria-hidden="true"></span>
        )}
        {!isLoading && leadingIcon && (
          <span className="mr-2">{leadingIcon}</span>
        )}
        {children}
        {!isLoading && trailingIcon && (
          <span className="ml-2">{trailingIcon}</span>
        )}
      </>
    );

    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={isLoading || disabled}
        aria-disabled={isLoading || disabled}
        aria-busy={isLoading}
        role={isLoading || disabled ? "button" : undefined}
        {...props}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = "Button"; 