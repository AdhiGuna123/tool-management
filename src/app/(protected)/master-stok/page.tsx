'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import Loading from '@/components/ui/loading';
import { Package, Plus, Search, Eye, Edit, Archive } from 'lucide-react';
import type { Item } from '@/types';

export default function MasterStokPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStock, setFilterStock] = useState('');
  const supabase = createClient();

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    const { data } = await supabase
      .from('items')
      .select('*')
      .order('item_code', { ascending: true });

    setItems(data || []);
    setLoading(false);
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.item_name.toLowerCase().includes(search.toLowerCase()) ||
      (item.item_code && item.item_code.toLowerCase().includes(search.toLowerCase()));
    
    const matchesType = !filterType || item.item_type === filterType;
    const matchesStock = 
      filterStock === '' ||
      (filterStock === 'known' && item.stock_known) ||
      (filterStock === 'unknown' && !item.stock_known);

    return matchesSearch && matchesType && matchesStock;
  });

  const handleDeactivate = async (id: string) => {
    if (!confirm('Nonaktifkan barang ini?')) return;

    const { error } = await supabase
      .from('items')
      .update({ active: false })
      .eq('id', id);

    if (!error) {
      loadItems();
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Stok</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kelola database barang dan inventaris
          </p>
        </div>
        <Link href="/master-stok/tambah">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Barang
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Cari barang..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          options={[
            { value: '', label: 'Semua Jenis' },
            { value: 'TOOL', label: 'Tool / Asset' },
            { value: 'CONSUMABLE', label: 'Consumable' },
          ]}
        />
        <Select
          value={filterStock}
          onChange={(e) => setFilterStock(e.target.value)}
          options={[
            { value: '', label: 'Semua Stok' },
            { value: 'known', label: 'Stok Diketahui' },
            { value: 'unknown', label: 'Stok Belum Diketahui' },
          ]}
        />
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <EmptyState
            title="BELUM ADA BARANG"
            description="Tambahkan barang untuk mulai membuat database alat."
            icon={<Package className="w-12 h-12" />}
            action={
              <Link href="/master-stok/tambah">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Barang
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
                      Nama Barang
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Kategori
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Jenis
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Satuan
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Stok
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Lokasi
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
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">
                        {item.item_code || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {item.item_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {item.category || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={item.item_type === 'TOOL' ? 'info' : 'warning'}>
                          {item.item_type === 'TOOL' ? 'Tool' : 'Consumable'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {item.unit || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.stock_known ? (
                          <span className="font-medium text-gray-900">
                            {item.current_stock}
                          </span>
                        ) : (
                          <span className="text-orange-600 text-xs">
                            Belum Diketahui
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {item.storage_location || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={item.active ? 'success' : 'danger'}>
                          {item.active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/master-stok/${item.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/master-stok/${item.id}?edit=true`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          {item.active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeactivate(item.id)}
                            >
                              <Archive className="w-4 h-4 text-red-500" />
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
            {filteredItems.map((item) => (
              <Card key={item.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{item.item_name}</p>
                    <p className="text-sm font-mono text-gray-500">{item.item_code || '-'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={item.item_type === 'TOOL' ? 'info' : 'warning'}>
                        {item.item_type === 'TOOL' ? 'Tool' : 'Consumable'}
                      </Badge>
                      {item.stock_known ? (
                        <span className="text-sm text-gray-600">Stok: {item.current_stock}</span>
                      ) : (
                        <span className="text-sm text-orange-600">Stok: Belum Diketahui</span>
                      )}
                    </div>
                    {item.storage_location && (
                      <p className="text-xs text-gray-500 mt-1">{item.storage_location}</p>
                    )}
                  </div>
                  <Badge variant={item.active ? 'success' : 'danger'}>
                    {item.active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Link href={`/master-stok/${item.id}`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      <Eye className="w-4 h-4 mr-2" />
                      Lihat
                    </Button>
                  </Link>
                  {item.active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeactivate(item.id)}
                    >
                      <Archive className="w-4 h-4 text-red-500" />
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
