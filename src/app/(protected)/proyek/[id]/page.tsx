'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import Loading from '@/components/ui/loading';
import { showToast } from '@/components/ui/toast';
import { ArrowLeft, Edit } from 'lucide-react';
import Link from 'next/link';
import type { Project } from '@/types';

export default function ProyekDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    project_code: '',
    project_name: '',
    location: '',
    status: 'AKTIF',
    notes: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    loadProject();
  }, []);

  useEffect(() => {
    if (searchParams.get('edit') === 'true') {
      setEditing(true);
    }
  }, [searchParams]);

  async function loadProject() {
    setLoading(true);
    const resolvedParams = await params;
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('id', resolvedParams.id)
      .single();

    if (data) {
      setProject(data);
      setEditForm({
        project_code: data.project_code,
        project_name: data.project_name,
        location: data.location || '',
        status: data.status,
        notes: data.notes || '',
      });
    }
    setLoading(false);
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);

    const resolvedParams = await params;

    // Check for duplicate code
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('project_code', editForm.project_code.trim().toUpperCase())
      .neq('id', resolvedParams.id)
      .single();

    if (existing) {
      setEditLoading(false);
      showToast('error', 'Kode proyek sudah digunakan.');
      return;
    }

    const { error } = await supabase
      .from('projects')
      .update({
        project_code: editForm.project_code.trim().toUpperCase(),
        project_name: editForm.project_name.trim(),
        location: editForm.location.trim() || null,
        status: editForm.status,
        notes: editForm.notes.trim() || null,
      })
      .eq('id', resolvedParams.id);

    if (error) {
      showToast('error', 'Gagal mengubah data proyek.');
    } else {
      showToast('success', 'Data proyek berhasil diubah.');
      setEditing(false);
      loadProject();
    }
    setEditLoading(false);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'AKTIF':
        return 'success';
      case 'SELESAI':
        return 'info';
      case 'ARSIP':
        return 'default';
      default:
        return 'default';
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!project) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">Proyek tidak ditemukan.</p>
          <Link href="/proyek">
            <Button variant="secondary" className="mt-4">
              Kembali ke Daftar
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/proyek">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{project.project_name}</h1>
          <p className="text-sm font-mono text-gray-500">{project.project_code}</p>
        </div>
        <Badge variant={getStatusVariant(project.status)}>
          {project.status}
        </Badge>
      </div>

      {/* Edit Form */}
      {editing ? (
        <Card>
          <h2 className="text-lg font-semibold mb-4">Edit Data Proyek</h2>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <Input
              label="Kode Proyek"
              value={editForm.project_code}
              onChange={(e) => setEditForm({ ...editForm, project_code: e.target.value })}
              required
            />
            <Input
              label="Nama Proyek"
              value={editForm.project_name}
              onChange={(e) => setEditForm({ ...editForm, project_name: e.target.value })}
              required
            />
            <Input
              label="Lokasi"
              value={editForm.location}
              onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
            />
            <Select
              label="Status"
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              options={[
                { value: 'AKTIF', label: 'Aktif' },
                { value: 'SELESAI', label: 'Selesai' },
                { value: 'ARSIP', label: 'Arsip' },
              ]}
            />
            <Input
              label="Catatan"
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(false)}
              >
                BATAL
              </Button>
              <Button type="submit" loading={editLoading}>
                SIMPAN
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Data Proyek</h2>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Kode Proyek</dt>
              <dd className="text-sm font-medium text-gray-900 font-mono">{project.project_code}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Nama Proyek</dt>
              <dd className="text-sm font-medium text-gray-900">{project.project_name}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Lokasi</dt>
              <dd className="text-sm text-gray-900">{project.location || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Status</dt>
              <dd>
                <Badge variant={getStatusVariant(project.status)}>
                  {project.status}
                </Badge>
              </dd>
            </div>
            {project.notes && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-gray-500">Catatan</dt>
                <dd className="text-sm text-gray-900">{project.notes}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {/* Future Transactions Placeholder */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Transaksi Terkait</h2>
        <div className="text-center py-8">
          <p className="text-sm text-gray-500">
            Riwayat transaksi akan tersedia pada tahap berikutnya.
          </p>
        </div>
      </Card>
    </div>
  );
}
