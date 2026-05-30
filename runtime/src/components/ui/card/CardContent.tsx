"use client";

import React from "react";
import { cn } from "@/lib/utils";

// Omit children from base props as it's already in React.HTMLAttributes
export interface BaseCardComponentProps {
  className?: string;
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement>, BaseCardComponentProps {
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn("card-header p-6", className)} {...props}>
      {children}
    </div>
  );
}

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement>, BaseCardComponentProps {
}

export function CardBody({ className, children, ...props }: CardBodyProps) {
  return (
    <div className={cn("card-body p-6 pt-2 text-left", className)} {...props}>
      {children}
    </div>
  );
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement>, BaseCardComponentProps {
}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div 
      className={cn("card-footer p-6 border-t border-base-200", className)} 
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement>, BaseCardComponentProps {
  as?: React.ElementType;
}

export function CardTitle({ 
  className, 
  children, 
  as: Component = "h3", 
  ...props 
}: CardTitleProps) {
  return (
    <Component 
      className={cn("card-title text-xl font-semibold text-left", className)}
      aria-level={Component === "div" ? 2 : undefined}
      role={Component === "div" ? "heading" : undefined}
      {...props}
    >
      {children}
    </Component>
  );
}

export interface CardDividerProps extends React.HTMLAttributes<HTMLDivElement>, BaseCardComponentProps {
}

export function CardDivider({ className, children, ...props }: CardDividerProps) {
  return (
    <div 
      className={cn("divider my-2", className)} 
      {...props}
    >
      {children}
    </div>
  );
} 