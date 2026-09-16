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

export default function TambahProyekPage() {
  const [formData, setFormData] = useState({
    project_code: '',
    project_name: '',
    location: '',
    status: 'AKTIF',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const supabase = createClient();

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.project_code.trim()) {
      newErrors.project_code = 'Kode proyek wajib diisi';
    }
    if (!formData.project_name.trim()) {
      newErrors.project_name = 'Nama proyek wajib diisi';
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
      .from('projects')
      .select('id')
      .eq('project_code', formData.project_code.trim().toUpperCase())
      .single();

    if (existing) {
      setErrors({ project_code: 'Kode proyek sudah digunakan' });
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('projects').insert({
      project_code: formData.project_code.trim().toUpperCase(),
      project_name: formData.project_name.trim(),
      location: formData.location.trim() || null,
      status: formData.status,
      notes: formData.notes.trim() || null,
      created_by: user?.id || null,
    });

    if (error) {
      showToast('error', 'Gagal menyimpan proyek.');
      setLoading(false);
      return;
    }

    showToast('success', 'Proyek berhasil ditambahkan.');
    router.push('/proyek');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/proyek">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tambah Proyek</h1>
          <p className="text-sm text-gray-500 mt-1">Proyek baru</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Kode Proyek"
            value={formData.project_code}
            onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
            placeholder="Contoh: PRJ-005"
            error={errors.project_code}
            required
          />

          <Input
            label="Nama Proyek"
            value={formData.project_name}
            onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
            placeholder="Nama proyek"
            error={errors.project_name}
            required
          />

          <Input
            label="Lokasi"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Contoh: Jakarta Selatan"
          />

          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'AKTIF', label: 'Aktif' },
              { value: 'SELESAI', label: 'Selesai' },
              { value: 'ARSIP', label: 'Arsip' },
            ]}
          />

          <Input
            label="Catatan"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Catatan tambahan (opsional)"
          />

          <div className="flex items-center gap-3 pt-4">
            <Link href="/proyek" className="flex-1">
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
