"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outlined" | "elevated";
  color?: "default" | "primary" | "secondary" | "accent" | "info" | "success" | "warning" | "error";
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Card({
  variant = "default",
  color = "default",
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  const baseClasses = "card overflow-hidden";
  
  const variantClasses = {
    default: "bg-base-100",
    outlined: "bg-base-100 border border-base-300",
    elevated: "bg-base-100 shadow-lg"
  };
  
  const colorClasses = {
    default: "",
    primary: "bg-primary text-primary-content",
    secondary: "bg-secondary text-secondary-content",
    accent: "bg-accent text-accent-content",
    info: "bg-info text-info-content",
    success: "bg-success text-success-content",
    warning: "bg-warning text-warning-content",
    error: "bg-error text-error-content"
  };
  
  const interactiveClasses = interactive 
    ? "cursor-pointer transition-all duration-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary" 
    : "";

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        color !== "default" ? colorClasses[color] : "",
        interactiveClasses,
        className
      )}
      {...props}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? "button" : undefined}
      aria-pressed={interactive && props.onClick ? false : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const element = e.currentTarget as HTMLElement;
          element.click();
        }
      } : undefined}
    >
      {children}
    </div>
  );
} 