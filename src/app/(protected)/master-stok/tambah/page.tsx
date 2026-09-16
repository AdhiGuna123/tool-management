'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Card from '@/components/ui/card';
import { showToast } from '@/components/ui/toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TambahBarangPage() {
  const [formData, setFormData] = useState({
    item_code: '',
    item_name: '',
    category: '',
    item_type: 'TOOL',
    unit: '',
    stock_known: true,
    current_stock: '',
    storage_location: '',
    notes: '',
    active: true,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const supabase = createClient();

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.item_name.trim()) {
      newErrors.item_name = 'Nama barang wajib diisi';
    }
    if (!formData.item_type) {
      newErrors.item_type = 'Jenis barang wajib dipilih';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    // Check for duplicate code if provided
    if (formData.item_code.trim()) {
      const { data: existing } = await supabase
        .from('items')
        .select('id')
        .eq('item_code', formData.item_code.trim().toUpperCase())
        .single();

      if (existing) {
        setErrors({ item_code: 'Kode barang sudah digunakan' });
        setLoading(false);
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('items').insert({
      item_code: formData.item_code.trim() ? formData.item_code.trim().toUpperCase() : null,
      item_name: formData.item_name.trim(),
      category: formData.category.trim() || null,
      item_type: formData.item_type,
      unit: formData.unit.trim() || null,
      stock_known: formData.stock_known,
      current_stock: formData.stock_known && formData.current_stock
        ? parseInt(formData.current_stock)
        : null,
      storage_location: formData.storage_location.trim() || null,
      notes: formData.notes.trim() || null,
      active: formData.active,
      created_by: user?.id || null,
    });

    if (error) {
      showToast('error', 'Gagal menyimpan barang.');
      setLoading(false);
      return;
    }

    showToast('success', 'Barang berhasil ditambahkan.');
    router.push('/master-stok');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/master-stok">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tambah Barang</h1>
          <p className="text-sm text-gray-500 mt-1">Barang baru ke database</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Kode Barang"
            value={formData.item_code}
            onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
            placeholder="Contoh: ALT-011 (opsional)"
            error={errors.item_code}
            helperText="Kosongkan jika belum ada kode"
          />

          <Input
            label="Nama Barang"
            value={formData.item_name}
            onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
            placeholder="Nama barang"
            error={errors.item_name}
            required
          />

          <Input
            label="Kategori"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="Contoh: Hand Tool, Chemical, Electrical"
          />

          <Select
            label="Jenis Barang"
            value={formData.item_type}
            onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
            options={[
              { value: 'TOOL', label: 'Tool / Asset' },
              { value: 'CONSUMABLE', label: 'Consumable / Habis Pakai' },
            ]}
            error={errors.item_type}
          />

          <Input
            label="Satuan"
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            placeholder="Contoh: Pcs, Unit, Liter, Roll"
          />

          <Select
            label="Status Stok"
            value={formData.stock_known ? 'true' : 'false'}
            onChange={(e) => setFormData({ ...formData, stock_known: e.target.value === 'true' })}
            options={[
              { value: 'true', label: 'Stok Diketahui' },
              { value: 'false', label: 'Stok Belum Diketahui' },
            ]}
          />

          {formData.stock_known && (
            <Input
              label="Stok Saat Ini"
              type="number"
              min="0"
              value={formData.current_stock}
              onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
              placeholder="0"
            />
          )}

          <Input
            label="Lokasi Penyimpanan"
            value={formData.storage_location}
            onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
            placeholder="Contoh: Rak A-01, Gudang Utama"
          />

          <Input
            label="Catatan"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Catatan tambahan (opsional)"
          />

          <div className="flex items-center gap-3 pt-4">
            <Link href="/master-stok" className="flex-1">
              <Button type="button" variant="secondary" className="w-full">
                BATAL
              </Button>
            </Link>
            <Button type="submit" loading={loading} className="flex-1">
              SIMPAN
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
