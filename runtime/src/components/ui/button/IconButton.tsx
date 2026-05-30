"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button visual variant */
  variant?: "primary" | "secondary" | "accent" | "ghost" | "link" | "outline";
  /** Button color scheme */
  color?: "default" | "success" | "warning" | "error" | "info";
  /** Button size */
  size?: "xs" | "sm" | "md" | "lg";
  /** Loading state with spinner */
  isLoading?: boolean;
  /** Icon component */
  icon: React.ReactNode;
  /** Visually hidden text for screen readers */
  ariaLabel: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = "ghost", // Intentionally different from Button default for better icon-only appearance
      color = "default",
      size = "md",
      isLoading = false,
      icon,
      ariaLabel,
      disabled,
      ...props
    },
    ref
  ) => {
    // Base classes all buttons will have
    const baseClasses = "btn btn-circle flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary";

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
      className
    );

    // Content with icon or loading spinner
    const content = isLoading ? (
      <span className="loading loading-spinner loading-xs" aria-hidden="true"></span>
    ) : (
      icon
    );

    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={isLoading || disabled}
        aria-disabled={isLoading || disabled}
        aria-busy={isLoading}
        role={isLoading || disabled ? "button" : undefined}
        aria-label={ariaLabel}
        {...props}
      >
        {content}
      </button>
    );
  }
);

IconButton.displayName = "IconButton"; 