"use client";

import React, { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ButtonLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Link href */
  href: string;
  /** Button visual variant */
  variant?: "primary" | "secondary" | "accent" | "ghost" | "link" | "outline";
  /** Button color scheme */
  color?: "default" | "success" | "warning" | "error" | "info";
  /** Button size */
  size?: "xs" | "sm" | "md" | "lg";
  /** Leading (left) icon component */
  leadingIcon?: React.ReactNode;
  /** Trailing (right) icon component */
  trailingIcon?: React.ReactNode;
  /** Full width button */
  fullWidth?: boolean;
  /** Button text or content */
  children: React.ReactNode;
  /** External link (opens in new tab) */
  external?: boolean;
  /** Disabled state (visually disabled, but still navigable for accessibility) */
  disabled?: boolean;
  /** Loading state with spinner */
  isLoading?: boolean;
}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (
    {
      className,
      href,
      variant = "primary",
      color = "default",
      size = "md",
      leadingIcon,
      trailingIcon,
      fullWidth = false,
      external = false,
      disabled = false,
      isLoading = false,
      children,
      ...props
    },
    ref
  ) => {
    // Base classes
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

    // External link props
    const externalProps = external
      ? { target: "_blank", rel: "noopener noreferrer" }
      : {};

    // Combine all classes
    const linkClasses = cn(
      baseClasses,
      variantClasses[variant],
      colorClass,
      sizeClasses[size],
      (disabled || isLoading) && "btn-disabled pointer-events-none",
      fullWidth && "w-full",
      className
    );

    // Common props for both link types
    const commonProps = {
      className: linkClasses,
      ref,
      "aria-disabled": disabled || isLoading,
      "aria-busy": isLoading,
      ...props
    };

    // Content with icons and loading state
    const content = (
      <>
        {isLoading && (
          <span className="loading loading-spinner loading-xs mr-2" aria-hidden="true"></span>
        )}
        {!isLoading && leadingIcon && <span className="mr-2">{leadingIcon}</span>}
        {children}
        {!isLoading && trailingIcon && <span className="ml-2">{trailingIcon}</span>}
      </>
    );

    // Use Next Link for internal links or standard <a> for external
    if (external) {
      return (
        <a
          href={href}
          {...externalProps}
          {...commonProps}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        href={href}
        {...commonProps}
      >
        {content}
      </Link>
    );
  }
);

ButtonLink.displayName = "ButtonLink"; 