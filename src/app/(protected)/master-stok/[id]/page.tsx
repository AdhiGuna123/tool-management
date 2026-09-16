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
import Modal from '@/components/ui/modal';
import { showToast } from '@/components/ui/toast';
import {
  ArrowLeft,
  Edit,
  Users,
  Package,
  Plus,
  Minus,
  History,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wrench,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { Item, TechnicianDefaultItemWithItem, StockMovement, Transaction } from '@/types';

const movementTypeLabels: Record<string, string> = {
  BORROW: 'Peminjaman',
  RETURN: 'Pengembalian',
  DAMAGED: 'Kerusakan',
  LOST: 'Kehilangan',
  CONSUMABLE_USED: 'Habis Dipakai',
  TOOL_RETURNED: 'Alat Dikembalikan',
  TOOL_DAMAGED: 'Alat Rusak',
  TOOL_LOST: 'Alat Hilang',
  CONSUMABLE_RETURNED: 'Sisa Dikembalikan',
  STOCK_OPNAME_INCREASE: 'Stok Opname +',
  STOCK_OPNAME_DECREASE: 'Stok Opname -',
  MANUAL_ADJUSTMENT: 'Penyesuaian Manual',
};

const movementTypeColors: Record<string, string> = {
  BORROW: 'text-amber-600',
  RETURN: 'text-green-600',
  DAMAGED: 'text-red-600',
  LOST: 'text-red-600',
  CONSUMABLE_USED: 'text-orange-600',
  TOOL_RETURNED: 'text-green-600',
  TOOL_DAMAGED: 'text-red-600',
  TOOL_LOST: 'text-red-600',
  CONSUMABLE_RETURNED: 'text-green-600',
  STOCK_OPNAME_INCREASE: 'text-blue-600',
  STOCK_OPNAME_DECREASE: 'text-amber-600',
  MANUAL_ADJUSTMENT: 'text-purple-600',
};

export default function BarangDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [item, setItem] = useState<Item | null>(null);
  const [usedByTechnicians, setUsedByTechnicians] = useState<TechnicianDefaultItemWithItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [transactionItems, setTransactionItems] = useState<Transaction[]>([]);
  const [stockSummary, setStockSummary] = useState<{
    totalBorrowed: number;
    totalDamaged: number;
    totalLost: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
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
  const [editLoading, setEditLoading] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    adjustment_type: 'ADD',
    quantity: '',
    reason: '',
  });
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'technicians' | 'stock'>('info');

  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    loadItem();
  }, []);

  useEffect(() => {
    if (searchParams.get('edit') === 'true') {
      setEditing(true);
    }
  }, [searchParams]);

  async function loadItem() {
    setLoading(true);
    const resolvedParams = await params;
    const itemId = resolvedParams.id;

    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (data) {
      setItem(data);
      setEditForm({
        item_code: data.item_code || '',
        item_name: data.item_name,
        category: data.category || '',
        item_type: data.item_type,
        unit: data.unit || '',
        stock_known: data.stock_known,
        current_stock: data.current_stock !== null ? String(data.current_stock) : '',
        storage_location: data.storage_location || '',
        notes: data.notes || '',
        active: data.active,
      });
    }

    // Load parallel data
    const [usageData, movementsData, txItemsData] = await Promise.all([
      supabase
        .from('technician_default_items')
        .select('*, technicians(*), items(*)')
        .eq('item_id', itemId),
      supabase
        .from('stock_movements')
        .select('*, technicians(name), profiles(full_name)')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('transaction_items')
        .select('*, transactions(transaction_number, transaction_date, status), technicians(name)')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    setUsedByTechnicians(usageData.data || []);
    setStockMovements(movementsData.data || []);
    setTransactionItems(txItemsData.data || []);

    // Stock summary
    const borrowed = await supabase
      .from('transaction_items')
      .select('borrow_qty, transactions!inner(status)')
      .eq('item_id', itemId)
      .in('transactions.status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP']);

    const totalBorrowed = (borrowed.data || []).reduce(
      (sum: number, ti: { borrow_qty: number }) => sum + (ti.borrow_qty || 0), 0
    );

    const damaged = await supabase
      .from('transaction_items')
      .select('damaged_qty, transactions!inner(status)')
      .eq('item_id', itemId)
      .in('transactions.status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP', 'SELESAI']);

    const totalDamaged = (damaged.data || []).reduce(
      (sum: number, ti: { damaged_qty: number }) => sum + (ti.damaged_qty || 0), 0
    );

    const lost = await supabase
      .from('transaction_items')
      .select('lost_qty, transactions!inner(status)')
      .eq('item_id', itemId)
      .in('transactions.status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP', 'SELESAI']);

    const totalLost = (lost.data || []).reduce(
      (sum: number, ti: { lost_qty: number }) => sum + (ti.lost_qty || 0), 0
    );

    setStockSummary({ totalBorrowed, totalDamaged, totalLost });
    setLoading(false);
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);

    const resolvedParams = await params;
    const itemId = resolvedParams.id;

    if (editForm.item_code.trim()) {
      const { data: existing } = await supabase
        .from('items')
        .select('id')
        .eq('item_code', editForm.item_code.trim().toUpperCase())
        .neq('id', itemId)
        .single();

      if (existing) {
        setEditLoading(false);
        showToast('error', 'Kode barang sudah digunakan.');
        return;
      }
    }

    const { error } = await supabase
      .from('items')
      .update({
        item_code: editForm.item_code.trim() ? editForm.item_code.trim().toUpperCase() : null,
        item_name: editForm.item_name.trim(),
        category: editForm.category.trim() || null,
        item_type: editForm.item_type,
        unit: editForm.unit.trim() || null,
        stock_known: editForm.stock_known,
        current_stock: editForm.stock_known && editForm.current_stock
          ? parseInt(editForm.current_stock)
          : null,
        storage_location: editForm.storage_location.trim() || null,
        notes: editForm.notes.trim() || null,
        active: editForm.active,
      })
      .eq('id', itemId);

    if (error) {
      showToast('error', 'Gagal mengubah data barang.');
    } else {
      showToast('success', 'Data barang berhasil diubah.');
      setEditing(false);
      loadItem();
    }
    setEditLoading(false);
  };

  const handleAdjust = async () => {
    if (!item) return;
    setAdjustLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('error', 'Tidak terautentikasi.');
      setAdjustLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'SUPER_ADMIN') {
      showToast('error', 'Hanya Super Admin yang dapat melakukan penyesuaian stok.');
      setAdjustLoading(false);
      return;
    }

    if (!item.stock_known) {
      showToast('error', 'Stok barang ini belum diketahui. Set stok diketahui terlebih dahulu.');
      setAdjustLoading(false);
      return;
    }

    const currentStock = item.current_stock || 0;
    const qty = parseInt(adjustForm.quantity) || 0;
    let newStock: number;

    switch (adjustForm.adjustment_type) {
      case 'ADD':
        newStock = currentStock + qty;
        break;
      case 'SUBTRACT':
        newStock = Math.max(0, currentStock - qty);
        break;
      case 'SET':
        newStock = Math.max(0, qty);
        break;
      default:
        setAdjustLoading(false);
        return;
    }

    const { error: updateError } = await supabase
      .from('items')
      .update({ current_stock: newStock })
      .eq('id', item.id);

    if (updateError) {
      showToast('error', 'Gagal memperbarui stok.');
      setAdjustLoading(false);
      return;
    }

    const quantityDiff = newStock - currentStock;
    await supabase.from('stock_movements').insert({
      item_id: item.id,
      movement_type: adjustForm.adjustment_type === 'ADD' ? 'STOCK_OPNAME_INCREASE' :
                     adjustForm.adjustment_type === 'SUBTRACT' ? 'STOCK_OPNAME_DECREASE' : 'MANUAL_ADJUSTMENT',
      quantity: quantityDiff,
      stock_before: currentStock,
      stock_after: newStock,
      notes: adjustForm.reason || `Penyesuaian: ${adjustForm.adjustment_type}`,
      created_by: user.id,
    });

    showToast('success', `Stok berhasil diubah dari ${currentStock} ke ${newStock}.`);
    setShowAdjustModal(false);
    setAdjustForm({ adjustment_type: 'ADD', quantity: '', reason: '' });
    loadItem();
    setAdjustLoading(false);
  };

  if (loading) return <Loading />;

  if (!item) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">Barang tidak ditemukan.</p>
          <Link href="/master-stok">
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/master-stok">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{item.item_name}</h1>
          <p className="text-sm font-mono text-gray-500">{item.item_code || 'Tanpa Kode'}</p>
        </div>
        <Badge variant={item.active ? 'success' : 'danger'}>
          {item.active ? 'Aktif' : 'Nonaktif'}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {[
          { id: 'info', label: 'Informasi', icon: FileText },
          { id: 'stock', label: 'Stok', icon: Package },
          { id: 'history', label: 'Riwayat', icon: History },
          { id: 'technicians', label: 'Teknisi', icon: Users },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <>
          {editing ? (
            <Card>
              <h2 className="text-lg font-semibold mb-4">Edit Data Barang</h2>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <Input
                  label="Kode Barang"
                  value={editForm.item_code}
                  onChange={(e) => setEditForm({ ...editForm, item_code: e.target.value })}
                  placeholder="Kode barang (opsional)"
                />
                <Input
                  label="Nama Barang"
                  value={editForm.item_name}
                  onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
                  required
                />
                <Input
                  label="Kategori"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
                <Select
                  label="Jenis Barang"
                  value={editForm.item_type}
                  onChange={(e) => setEditForm({ ...editForm, item_type: e.target.value })}
                  options={[
                    { value: 'TOOL', label: 'Tool / Asset' },
                    { value: 'CONSUMABLE', label: 'Consumable / Habis Pakai' },
                  ]}
                />
                <Input
                  label="Satuan"
                  value={editForm.unit}
                  onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                />
                <Select
                  label="Status Stok"
                  value={editForm.stock_known ? 'true' : 'false'}
                  onChange={(e) => setEditForm({ ...editForm, stock_known: e.target.value === 'true' })}
                  options={[
                    { value: 'true', label: 'Stok Diketahui' },
                    { value: 'false', label: 'Stok Belum Diketahui' },
                  ]}
                />
                {editForm.stock_known && (
                  <Input
                    label="Stok Saat Ini"
                    type="number"
                    min="0"
                    value={editForm.current_stock}
                    onChange={(e) => setEditForm({ ...editForm, current_stock: e.target.value })}
                  />
                )}
                <Input
                  label="Lokasi Penyimpanan"
                  value={editForm.storage_location}
                  onChange={(e) => setEditForm({ ...editForm, storage_location: e.target.value })}
                />
                <Input
                  label="Catatan"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
                <Select
                  label="Status"
                  value={editForm.active ? 'true' : 'false'}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.value === 'true' })}
                  options={[
                    { value: 'true', label: 'Aktif' },
                    { value: 'false', label: 'Nonaktif' },
                  ]}
                />
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
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
                <h2 className="text-lg font-semibold">Data Barang</h2>
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Kode Barang</dt>
                  <dd className="text-sm font-medium text-gray-900 font-mono">
                    {item.item_code || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Nama Barang</dt>
                  <dd className="text-sm font-medium text-gray-900">{item.item_name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Kategori</dt>
                  <dd className="text-sm text-gray-900">{item.category || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Jenis</dt>
                  <dd>
                    <Badge variant={item.item_type === 'TOOL' ? 'info' : 'warning'}>
                      {item.item_type === 'TOOL' ? 'Tool / Asset' : 'Consumable'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Satuan</dt>
                  <dd className="text-sm text-gray-900">{item.unit || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Stok</dt>
                  <dd className="text-sm text-gray-900">
                    {item.stock_known ? (
                      <span className="font-medium">{item.current_stock}</span>
                    ) : (
                      <span className="text-orange-600">Belum Diketahui</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Lokasi</dt>
                  <dd className="text-sm text-gray-900">{item.storage_location || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Status</dt>
                  <dd>
                    <Badge variant={item.active ? 'success' : 'danger'}>
                      {item.active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </dd>
                </div>
                {item.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-gray-500">Catatan</dt>
                    <dd className="text-sm text-gray-900">{item.notes}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
        </>
      )}

      {/* Tab: Stock */}
      {activeTab === 'stock' && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Ringkasan Stok</h2>
              {item.stock_known && (
                <Button variant="secondary" size="sm" onClick={() => setShowAdjustModal(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Sesuaikan Stok
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase">Stok Saat Ini</p>
                <p className="text-xl font-bold text-gray-900">
                  {item.stock_known ? item.current_stock ?? 0 : '?'}
                </p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="text-xs text-amber-600 uppercase">Dipinjam</p>
                <p className="text-xl font-bold text-amber-700">
                  {stockSummary?.totalBorrowed || 0}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-red-600 uppercase">Rusak</p>
                <p className="text-xl font-bold text-red-700">
                  {stockSummary?.totalDamaged || 0}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-red-600 uppercase">Hilang</p>
                <p className="text-xl font-bold text-red-700">
                  {stockSummary?.totalLost || 0}
                </p>
              </div>
            </div>
          </Card>

          {/* Stock Movements */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold">Pergerakan Stok</h2>
            </div>
            {stockMovements.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">Belum ada pergerakan stok.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stockMovements.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`${
                      (m.quantity || 0) > 0 ? 'text-green-600' :
                      (m.quantity || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {(m.quantity || 0) > 0 ? (
                        <ArrowDownToLine className="w-4 h-4" />
                      ) : (m.quantity || 0) < 0 ? (
                        <ArrowUpFromLine className="w-4 h-4" />
                      ) : (
                        <Package className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {movementTypeLabels[m.movement_type] || m.movement_type}
                      </p>
                      <p className="text-xs text-gray-500">
                        {m.notes || '-'}
                        {(m as unknown as { technicians?: { name: string } }).technicians?.name &&
                          ` • ${(m as unknown as { technicians?: { name: string } }).technicians?.name}`
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        (m.quantity || 0) > 0 ? 'text-green-600' :
                        (m.quantity || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {(m.quantity || 0) > 0 ? '+' : ''}{m.quantity}
                      </p>
                      <p className="text-xs text-gray-500">
                        {m.stock_before} → {m.stock_after}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(m.created_at).toLocaleDateString('id-ID')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Tab: History */}
      {activeTab === 'history' && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Riwayat Penggunaan</h2>
          </div>
          {transactionItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">Barang ini belum pernah digunakan.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactionItems.map((tx: Transaction & {
                transaction_items?: { borrow_qty: number };
                technicians?: { name: string };
              }) => (
                <Link
                  key={tx.id}
                  href={`/pengambilan/${tx.id}`}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ArrowDownToLine className="w-4 h-4 text-amber-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {(tx as unknown as { transaction_items?: { borrow_qty: number } }).transaction_items?.borrow_qty} unit dipinjam
                    </p>
                    <p className="text-xs text-gray-500">
                      {tx.transaction_number} • {tx.technicians?.name}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {tx.transaction_date}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab: Technicians */}
      {activeTab === 'technicians' && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Alat Bawaan Teknisi</h2>
          </div>
          {usedByTechnicians.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">
                Barang ini belum digunakan sebagai alat bawaan wajib oleh teknisi manapun.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {usedByTechnicians.map((usage) => (
                <div
                  key={usage.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {(usage as unknown as { technicians: { name: string } }).technicians.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      Qty: {usage.default_qty} {item.unit || 'Pcs'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="Penyesuaian Stok"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              Stok saat ini: <span className="font-bold">{item.current_stock ?? 0}</span> {item.unit || 'Pcs'}
            </p>
          </div>
          <Select
            label="Tipe Penyesuaian"
            value={adjustForm.adjustment_type}
            onChange={(e) => setAdjustForm({ ...adjustForm, adjustment_type: e.target.value })}
            options={[
              { value: 'ADD', label: 'Tambah Stok' },
              { value: 'SUBTRACT', label: 'Kurangi Stok' },
              { value: 'SET', label: 'Atur Stok Ke...' },
            ]}
          />
          <Input
            label={
              adjustForm.adjustment_type === 'ADD' ? 'Jumlah Ditambahkan' :
              adjustForm.adjustment_type === 'SUBTRACT' ? 'Jumlah Dikurangi' :
              'Stok Baru'
            }
            type="number"
            min="0"
            value={adjustForm.quantity}
            onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
            required
          />
          <Input
            label="Alasan"
            value={adjustForm.reason}
            onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
            placeholder="Alasan penyesuaian (wajib)"
          />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAdjustModal(false)}>
              BATAL
            </Button>
            <Button onClick={handleAdjust} loading={adjustLoading} disabled={!adjustForm.reason.trim()}>
              SIMPAN
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
