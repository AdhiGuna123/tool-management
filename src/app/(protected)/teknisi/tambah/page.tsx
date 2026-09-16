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

export default function TambahTeknisiPage() {
  const [formData, setFormData] = useState({
    technician_code: '',
    name: '',
    active: true,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const supabase = createClient();

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.technician_code.trim()) {
      newErrors.technician_code = 'Kode teknisi wajib diisi';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Nama teknisi wajib diisi';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    // Check for duplicate code
    const { data: existing } = await supabase
      .from('technicians')
      .select('id')
      .eq('technician_code', formData.technician_code.trim().toUpperCase())
      .single();

    if (existing) {
      setErrors({ technician_code: 'Kode teknisi sudah digunakan' });
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('technicians').insert({
      technician_code: formData.technician_code.trim().toUpperCase(),
      name: formData.name.trim().toUpperCase(),
      active: formData.active,
      notes: formData.notes.trim() || null,
      created_by: user?.id || null,
    });

    if (error) {
      showToast('error', 'Gagal menyimpan teknisi.');
      setLoading(false);
      return;
    }

    showToast('success', 'Teknisi berhasil ditambahkan.');
    router.push('/teknisi');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/teknisi">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tambah Teknisi</h1>
          <p className="text-sm text-gray-500 mt-1">Data teknisi baru</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Kode Teknisi"
            value={formData.technician_code}
            onChange={(e) => setFormData({ ...formData, technician_code: e.target.value })}
            placeholder="Contoh: TEC-006"
            error={errors.technician_code}
            required
          />

          <Input
            label="Nama Teknisi"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Nama lengkap teknisi"
            error={errors.name}
            required
          />

          <Select
            label="Status"
            value={formData.active ? 'true' : 'false'}
            onChange={(e) => setFormData({ ...formData, active: e.target.value === 'true' })}
            options={[
              { value: 'true', label: 'Aktif' },
              { value: 'false', label: 'Nonaktif' },
            ]}
          />

          <Input
            label="Catatan"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Catatan tambahan (opsional)"
          />

          <div className="flex items-center gap-3 pt-4">
            <Link href="/teknisi" className="flex-1">
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
