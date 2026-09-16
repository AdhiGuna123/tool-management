'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center text-sm font-medium transition-colors ${
        isOnline
          ? 'bg-green-600 text-white'
          : 'bg-red-600 text-white'
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            <span>Koneksi kembali tersedia.</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Koneksi internet terputus. Data belum disimpan.</span>
          </>
        )}
      </div>
    </div>
  );
}
