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
import { showToast } from '@/components/ui/toast';
import { FolderOpen, Plus, Search, Edit, Archive } from 'lucide-react';
import type { Project } from '@/types';

export default function ProyekPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const supabase = createClient();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('project_code', { ascending: true });

    setProjects(data || []);
    setLoading(false);
  }

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.project_name.toLowerCase().includes(search.toLowerCase()) ||
      project.project_code.toLowerCase().includes(search.toLowerCase()) ||
      (project.location && project.location.toLowerCase().includes(search.toLowerCase()));
    
    const matchesStatus = !filterStatus || project.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleArchive = async (id: string) => {
    if (!confirm('Arsipkan proyek ini?')) return;

    const { error } = await supabase
      .from('projects')
      .update({ status: 'ARSIP' })
      .eq('id', id);

    if (!error) {
      showToast('success', 'Proyek berhasil diarsipkan.');
      loadProjects();
    }
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proyek</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kelola data proyek
          </p>
        </div>
        <Link href="/proyek/tambah">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Proyek
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Cari proyek..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          options={[
            { value: '', label: 'Semua Status' },
            { value: 'AKTIF', label: 'Aktif' },
            { value: 'SELESAI', label: 'Selesai' },
            { value: 'ARSIP', label: 'Arsip' },
          ]}
        />
      </div>

      {filteredProjects.length === 0 ? (
        <Card>
          <EmptyState
            title="BELUM ADA PROYEK"
            description="Tambahkan proyek untuk mulai melacak pekerjaan."
            icon={<FolderOpen className="w-12 h-12" />}
            action={
              <Link href="/proyek/tambah">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Proyek
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
                      Nama Proyek
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
                  {filteredProjects.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">
                        {project.project_code}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {project.project_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {project.location || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getStatusVariant(project.status)}>
                          {project.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/proyek/${project.id}`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          {project.status !== 'ARSIP' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchive(project.id)}
                            >
                              <Archive className="w-4 h-4 text-orange-500" />
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
            {filteredProjects.map((project) => (
              <Card key={project.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{project.project_name}</p>
                    <p className="text-sm font-mono text-gray-500">{project.project_code}</p>
                    {project.location && (
                      <p className="text-sm text-gray-600 mt-1">{project.location}</p>
                    )}
                  </div>
                  <Badge variant={getStatusVariant(project.status)}>
                    {project.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Link href={`/proyek/${project.id}`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </Link>
                  {project.status !== 'ARSIP' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchive(project.id)}
                    >
                      <Archive className="w-4 h-4 text-orange-500" />
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
