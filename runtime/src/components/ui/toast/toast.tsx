"use client";

import React from "react";
import { ToastType } from "@/types/toast";

interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
}

export function Toast({ message, type, onDismiss }: ToastProps) {
  // Map toast type to CSS classes
  const toastClasses = {
    success: "alert alert-success",
    error: "alert alert-error",
    info: "alert alert-info",
  };

  return (
    <div
      role="alert"
      className={`${toastClasses[type]} shadow-lg w-full animate-slideIn transition-all duration-200 rounded-lg`}
      data-testid={`toast-${type}`}
    >
      <div className="flex w-full items-start gap-2 p-3">
        {/* Map toast type to appropriate SVG path */}
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6 mt-0.5" fill="none" viewBox="0 0 24 24">
          {type === "success" && (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
          {type === "error" && (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
          {type === "info" && (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
        <div className="flex-1 text-sm sm:text-base break-words">{message}</div>
        <button
          onClick={onDismiss}
          className="btn btn-ghost btn-sm btn-circle min-h-8 h-8 w-8 ml-1 flex-shrink-0 flex items-center justify-center"
          aria-label="Dismiss notification"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
} 