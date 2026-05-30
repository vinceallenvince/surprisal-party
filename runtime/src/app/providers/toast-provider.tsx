"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { Toast } from "@/components/ui/toast";
import { ToastType, ToastMessage } from "@/types/toast";

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType, duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { id, message, type, duration };
    
    setToasts((prev) => {
      // Limit the number of toasts to 5, removing oldest ones first
      const updatedToasts = [...prev, newToast];
      return updatedToasts.length > 5 ? updatedToasts.slice(-5) : updatedToasts;
    });
    
    // Auto-dismiss toast after duration
    if (duration !== Infinity) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="fixed bottom-0 right-0 p-4 sm:p-6 z-50 flex flex-col items-end"
        style={{ maxWidth: '100%', width: 'auto' }}
      >
        <div className="flex flex-col items-end gap-2 w-full max-w-[90vw] sm:max-w-md">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onDismiss={() => removeToast(toast.id)}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
} 