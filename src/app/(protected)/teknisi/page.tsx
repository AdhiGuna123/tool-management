'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import Loading from '@/components/ui/loading';
import { Users, Plus, Search, Eye, Edit, UserX } from 'lucide-react';
import type { TechnicianWithItemCount } from '@/types';

export default function TeknisiListPage() {
  const [technicians, setTechnicians] = useState<TechnicianWithItemCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const supabase = createClient();

  useEffect(() => {
    loadTechnicians();
  }, []);

  async function loadTechnicians() {
    setLoading(true);
    const { data, error } = await supabase
      .from('technicians')
      .select(`
        *,
        technician_default_items(count)
      `)
      .order('technician_code', { ascending: true });

    if (data) {
      const formatted = data.map((t) => ({
        ...t,
        item_count: t.technician_default_items?.[0]?.count || 0,
      }));
      setTechnicians(formatted);
    }
    setLoading(false);
  }

  const filteredTechnicians = technicians.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.technician_code.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeactivate = async (id: string) => {
    if (!confirm('Nonaktifkan teknisi ini?')) return;

    const { error } = await supabase
      .from('technicians')
      .update({ active: false })
      .eq('id', id);

    if (!error) {
      loadTechnicians();
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teknisi</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kelola data teknisi dan alat bawaan wajib
          </p>
        </div>
        <Link href="/teknisi/tambah">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Teknisi
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Cari teknisi..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredTechnicians.length === 0 ? (
        <Card>
          <EmptyState
            title="BELUM ADA TEKNISI"
            description="Tambahkan teknisi pertama untuk mulai menyiapkan daftar alat bawaan."
            icon={<Users className="w-12 h-12" />}
            action={
              <Link href="/teknisi/tambah">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Teknisi
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card padding={false} className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Kode
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Nama Teknisi
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Jumlah Alat
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTechnicians.map((technician) => (
                    <tr key={technician.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">
                        {technician.technician_code}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {technician.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {technician.item_count} Barang
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={technician.active ? 'success' : 'danger'}>
                          {technician.active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/teknisi/${technician.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/teknisi/${technician.id}?edit=true`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          {technician.active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeactivate(technician.id)}
                            >
                              <UserX className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredTechnicians.map((technician) => (
              <Card key={technician.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{technician.name}</p>
                    <p className="text-sm font-mono text-gray-500">{technician.technician_code}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {technician.item_count} Alat Bawaan
                    </p>
                  </div>
                  <Badge variant={technician.active ? 'success' : 'danger'}>
                    {technician.active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Link href={`/teknisi/${technician.id}`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      <Eye className="w-4 h-4 mr-2" />
                      Lihat
                    </Button>
                  </Link>
                  {technician.active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeactivate(technician.id)}
                    >
                      <UserX className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
