'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import Loading from '@/components/ui/loading';
import { Settings, LogOut, User } from 'lucide-react';
import type { Profile } from '@/types';

export default function PengaturanPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadProfile();
  }, []);

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
    setLoading(false);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pengaturan akun dan profil
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {profile?.full_name || 'Pengguna'}
            </h2>
            <p className="text-sm text-gray-500">{profile?.email}</p>
          </div>
        </div>

        <dl className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <dt className="text-sm text-gray-500">Peran</dt>
            <dd>
              <Badge variant="info">
                {profile?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <dt className="text-sm text-gray-500">Status</dt>
            <dd>
              <Badge variant={profile?.active ? 'success' : 'danger'}>
                {profile?.active ? 'Aktif' : 'Nonaktif'}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Aksi</h3>
        <Button variant="danger" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Keluar dari Akun
        </Button>
      </Card>
    </div>
  );
}
