'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

let toastListeners: ((toast: Toast) => void)[] = [];

export function showToast(type: Toast['type'], message: string) {
  const toast: Toast = {
    id: Math.random().toString(36).substring(7),
    type,
    message,
  };
  toastListeners.forEach((listener) => listener(toast));
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4000);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />,
    error: <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />,
  };

  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-orange-50 border-orange-200',
    info: 'bg-blue-50 border-blue-200',
  };

  return (
    <>
      {children}
      <div className="fixed bottom-20 lg:bottom-4 right-4 left-4 lg:left-auto z-[90] space-y-2 pointer-events-none">
        <div className="flex flex-col-reverse items-end gap-2 max-w-sm ml-auto">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-3 p-3 rounded-lg border shadow-lg ${bgColors[toast.type]} pointer-events-auto animate-in slide-in-from-right w-full`}
            >
              {icons[toast.type]}
              <p className="flex-1 text-sm text-gray-800 min-w-0">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 hover:bg-white/50 rounded flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
