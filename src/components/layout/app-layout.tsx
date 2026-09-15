'use client';

import { useState } from 'react';
import Sidebar from './sidebar';
import MobileNav from './mobile-nav';
import Header from './header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-gray-900 z-50 overflow-y-auto">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="lg:pl-64 min-h-screen flex flex-col">
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 w-full min-w-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileNav />
    </div>
  );
}
