'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  MoreHorizontal,
} from 'lucide-react';

const navigation = [
  { name: 'Beranda', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Ambil', href: '/pengambilan', icon: ArrowDownToLine },
  { name: 'Kembali', href: '/pengembalian', icon: ArrowUpFromLine },
  { name: 'Stok', href: '/master-stok', icon: Package },
  { name: 'Lainnya', href: '/pengaturan', icon: MoreHorizontal },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 min-w-0 touch-manipulation ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <div className={`relative p-1.5 rounded-xl transition-colors ${
                isActive ? 'bg-blue-50' : ''
              }`}>
                <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
              </div>
              <span className={`text-[10px] leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
