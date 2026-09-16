'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Badge from '@/components/ui/badge';
import Loading from '@/components/ui/loading';
import {
  FileText,
  Download,
  Calendar,
  Search,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import {
  generateSOP,
  getSOPSearchResults,
  getTransactionForSOP,
} from '@/lib/actions/sop-generation';
import {
  generateDailyReport,
  getDailyReportPreview,
} from '@/lib/actions/daily-report-generation';

type TabType = 'daily' | 'sop';

interface Technician {
  id: string;
  name: string;
  technician_code: string;
}

interface Project {
  id: string;
  project_name: string;
}

interface DailyPreview {
  totalTransactions: number;
  totalTechnicians: number;
  totalItems: number;
  technicians: string[];
}

interface SopTransaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  status: string;
  sop_generated_at: string | null;
  technicians: { name: string; technician_code: string } | null;
  projects: { project_name: string } | null;
}

const statusColors: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'info',
  SEDANG_DIPINJAM: 'warning',
  PENGEMBALIAN_BELUM_LENGKAP: 'danger',
  SELESAI: 'success',
  BERMASALAH: 'danger',
  DIBATALKAN: 'danger',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draf',
  SEDANG_DIPINJAM: 'Sedang Dipinjam',
  PENGEMBALIAN_BELUM_LENGKAP: 'Belum Lengkap',
  SELESAI: 'Selesai',
  BERMASALAH: 'Bermasalah',
  DIBATALKAN: 'Dibatalkan',
};

export default function LaporanPage() {
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const supabase = createClient();

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [reportDate, setReportDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [technicianId, setTechnicianId] = useState('');
  const [projectId, setProjectId] = useState('');

  const [preview, setPreview] = useState<DailyPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dailyGenerating, setDailyGenerating] = useState(false);

  const [sopSearch, setSopSearch] = useState('');
  const [sopResults, setSopResults] = useState<SopTransaction[]>([]);
  const [sopSearching, setSopSearching] = useState(false);
  const [generatingSopId, setGeneratingSopId] = useState<string | null>(null);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const loadFilterData = async () => {
      const [techResult, projResult] = await Promise.all([
        supabase.from('technicians').select('id, name, technician_code').eq('active', true).order('name'),
        supabase.from('projects').select('id, project_name').order('project_name'),
      ]);
      setTechnicians((techResult.data || []) as Technician[]);
      setProjects((projResult.data || []) as Project[]);
    };
    loadFilterData();
  }, [supabase]);

  const handlePreview = useCallback(async () => {
    if (!reportDate) return;
    setPreviewLoading(true);
    setMessage(null);
    setPreview(null);

    try {
      const result = await getDailyReportPreview({
        reportDate,
        technician_id: technicianId || undefined,
        project_id: projectId || undefined,
      });

      if (!result.success) {
        setMessage({ type: 'error', text: result.error || 'Gagal memuat preview.' });
      } else {
        setPreview({
          totalTransactions: result.totalTransactions || 0,
          totalTechnicians: result.totalTechnicians || 0,
          totalItems: result.totalItems || 0,
          technicians: result.technicians || [],
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat memuat preview.' });
    } finally {
      setPreviewLoading(false);
    }
  }, [reportDate, technicianId, projectId]);

  const handleDownloadDailyReport = useCallback(async () => {
    if (!reportDate) return;
    setDailyGenerating(true);
    setMessage(null);

    try {
      const result = await generateDailyReport({
        reportDate,
        technician_id: technicianId || undefined,
        project_id: projectId || undefined,
      });

      if (!result.success || !result.buffer || !result.fileName) {
        setMessage({ type: 'error', text: result.error || 'Gagal membuat laporan.' });
        return;
      }

      const blob = new Blob([new Uint8Array(result.buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'Laporan berhasil didownload.' });
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat membuat laporan.' });
    } finally {
      setDailyGenerating(false);
    }
  }, [reportDate, technicianId, projectId]);

  const handleSopSearch = useCallback(async () => {
    setSopSearching(true);
    setMessage(null);

    try {
      const results = await getSOPSearchResults(sopSearch);
      setSopResults(results as unknown as SopTransaction[]);
    } catch {
      setMessage({ type: 'error', text: 'Gagal mencari transaksi.' });
      setSopResults([]);
    } finally {
      setSopSearching(false);
    }
  }, [sopSearch]);

  useEffect(() => {
    if (activeTab === 'sop') {
      handleSopSearch();
    }
  }, [activeTab, handleSopSearch]);

  const handleGenerateSop = useCallback(async (transactionId: string) => {
    setGeneratingSopId(transactionId);
    setMessage(null);

    try {
      const result = await generateSOP(transactionId);

      if (!result.success || !result.buffer || !result.fileName) {
        setMessage({ type: 'error', text: result.error || 'Gagal membuat SOP.' });
        return;
      }

      const blob = new Blob([new Uint8Array(result.buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSopResults((prev) =>
        prev.map((tx) =>
          tx.id === transactionId
            ? { ...tx, sop_generated_at: new Date().toISOString() }
            : tx
        )
      );
      setMessage({ type: 'success', text: 'SOP berhasil dibuat dan didownload.' });
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat membuat SOP.' });
    } finally {
      setGeneratingSopId(null);
    }
  }, []);

  const handleDownloadSop = useCallback(async (transactionId: string) => {
    setGeneratingSopId(transactionId);
    setMessage(null);

    try {
      const result = await generateSOP(transactionId);

      if (!result.success || !result.buffer || !result.fileName) {
        setMessage({ type: 'error', text: result.error || 'Gagal download SOP.' });
        return;
      }

      const blob = new Blob([new Uint8Array(result.buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'SOP berhasil didownload.' });
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat download SOP.' });
    } finally {
      setGeneratingSopId(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Laporan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate laporan resmi dari data transaksi
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('daily')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'daily'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 inline mr-2" />
            Laporan Harian Alat
          </button>
          <button
            onClick={() => setActiveTab('sop')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'sop'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            SOP Transaksi
          </button>
        </nav>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Tab: Laporan Harian Alat */}
      {activeTab === 'daily' && (
        <Card>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                label="Tanggal"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                required
              />
              <Select
                label="Teknisi (Opsional)"
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                options={[
                  { value: '', label: 'Semua Teknisi' },
                  ...technicians.map((t) => ({
                    value: t.id,
                    label: `${t.name} (${t.technician_code})`,
                  })),
                ]}
              />
              <Select
                label="Proyek (Opsional)"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                options={[
                  { value: '', label: 'Semua Proyek' },
                  ...projects.map((p) => ({
                    value: p.id,
                    label: p.project_name,
                  })),
                ]}
              />
            </div>

            {/* Preview Section */}
            {preview && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Preview Data</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Jumlah Transaksi</p>
                    <p className="text-lg font-semibold text-gray-900">{preview.totalTransactions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Jumlah Teknisi</p>
                    <p className="text-lg font-semibold text-gray-900">{preview.totalTechnicians}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Jumlah Item</p>
                    <p className="text-lg font-semibold text-gray-900">{preview.totalItems}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Nama Teknisi</p>
                    <p className="text-sm text-gray-900">
                      {preview.technicians.length > 0
                        ? preview.technicians.join(', ')
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={handlePreview}
                disabled={!reportDate || previewLoading}
                loading={previewLoading}
              >
                <Search className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button
                onClick={handleDownloadDailyReport}
                disabled={!reportDate || dailyGenerating}
                loading={dailyGenerating}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Excel
              </Button>
            </div>

            {/* Loading State */}
            {(previewLoading || dailyGenerating) && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Membuat laporan...
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tab: SOP Transaksi */}
      {activeTab === 'sop' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <Card>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nomor transaksi..."
                value={sopSearch}
                onChange={(e) => setSopSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSopSearch();
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </Card>

          {/* Search Results */}
          {sopSearching ? (
            <Loading />
          ) : sopResults.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mb-4" />
                <p className="text-gray-500">
                  {sopSearch
                    ? 'Tidak ada transaksi ditemukan.'
                    : 'Masukkan kata kunci untuk mencari transaksi.'}
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {sopResults.map((tx) => {
                const hasSop = !!tx.sop_generated_at;
                const isGenerating = generatingSopId === tx.id;

                return (
                  <Card key={tx.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">
                            {tx.transaction_number}
                          </p>
                          <Badge
                            variant={statusColors[tx.status] || 'info'}
                            className="text-xs"
                          >
                            {statusLabels[tx.status] || tx.status}
                          </Badge>
                          {hasSop && (
                            <Badge variant="success" className="text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              SOP Dibuat
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {tx.technicians?.name || '-'}
                          {tx.projects?.project_name && (
                            <> - {tx.projects.project_name}</>
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {tx.transaction_date}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {hasSop ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDownloadSop(tx.id)}
                            disabled={isGenerating}
                            loading={isGenerating}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download SOP
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleGenerateSop(tx.id)}
                            disabled={isGenerating}
                            loading={isGenerating}
                          >
                            {isGenerating ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4 mr-1" />
                            )}
                            Buat SOP
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
