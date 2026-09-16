'use client';

import { useEffect, useState } from 'react';
import { Menu, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

interface HeaderProps {
  onMenuToggle?: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const supabase = createClient();

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

  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 hidden sm:block">Sistem Manajemen Alat</h1>
          <h1 className="text-lg font-semibold text-gray-900 sm:hidden">ToolManager</h1>
        </div>

        {profile && (
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{profile.full_name}</p>
              <p className="text-xs text-gray-500">
                {profile.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
              </p>
            </div>
            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
