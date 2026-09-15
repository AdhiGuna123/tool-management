'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Users,
  FolderOpen,
  Settings,
  LogOut,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  ClipboardList,
  AlertTriangle,
  BookOpen,
  User,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/types';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Pengambilan', href: '/pengambilan', icon: ArrowDownToLine },
  { name: 'Pengembalian', href: '/pengembalian', icon: ArrowUpFromLine },
  { name: 'Transaksi', href: '/transaksi', icon: ClipboardList },
  { name: 'Master Stok', href: '/master-stok', icon: Package },
  { name: 'Teknisi', href: '/teknisi', icon: Users },
  { name: 'Proyek', href: '/proyek', icon: FolderOpen },
  { name: 'Laporan', href: '/laporan', icon: FileText },
  { name: 'Barang Belum Terdaftar', href: '/belum-terdaftar', icon: AlertTriangle },
  { name: 'Log Aktivitas', href: '/audit-log', icon: BookOpen },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(data);
      }
    }
    loadProfile();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 bg-gray-900 min-h-screen lg:z-30">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-800">
        <Package className="w-8 h-8 text-blue-400" />
        <div>
          <span className="text-white font-bold text-lg">ToolManager</span>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Sistem Manajemen Alat</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="px-3 py-3 border-t border-gray-800">
        {profile && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile.full_name}</p>
              <p className="text-xs text-gray-400 truncate">
                {profile.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
              </p>
            </div>
          </div>
        )}
        <Link
          href="/pengaturan"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            pathname === '/pengaturan'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <Settings className="w-5 h-5" />
          Pengaturan
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Keluar
        </button>
      </div>
    </aside>
  );
}
