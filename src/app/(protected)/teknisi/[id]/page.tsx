'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import Modal from '@/components/ui/modal';
import EmptyState from '@/components/ui/empty-state';
import Loading from '@/components/ui/loading';
import { showToast } from '@/components/ui/toast';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Package,
  Clock,
  AlertTriangle,
  History,
  ChevronRight,
  Calendar,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import type { Technician, TechnicianDefaultItemWithItem, Item } from '@/types';

interface TransactionItem {
  transaction_id: string;
  item_name_snapshot: string;
  borrow_qty: number;
  returned_qty: number;
  used_qty: number;
  damaged_qty: number;
  lost_qty: number;
  is_manual_item: boolean;
  item_type_snapshot: string;
  unit_snapshot: string;
}

interface TechnicianTransaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  status: string;
  has_damage: boolean;
  has_loss: boolean;
  projects?: { project_name: string };
  transaction_items: TransactionItem[];
}

interface OutstandingItem {
  id: string;
  item_name_snapshot: string;
  borrow_qty: number;
  returned_qty: number;
  used_qty: number;
  damaged_qty: number;
  lost_qty: number;
  unit_snapshot: string;
  is_manual_item: boolean;
  transaction_number: string;
}

export default function TeknisiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [defaultItems, setDefaultItems] = useState<TechnicianDefaultItemWithItem[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<TechnicianTransaction[]>([]);
  const [outstandingItems, setOutstandingItems] = useState<OutstandingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', notes: '', active: true });
  const [editLoading, setEditLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'default' | 'transactions' | 'outstanding'>('info');

  // Default tool modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [defaultQty, setDefaultQty] = useState('1');
  const [itemSearch, setItemSearch] = useState('');
  const [addItemLoading, setAddItemLoading] = useState(false);

  // Edit qty modal
  const [showEditQtyModal, setShowEditQtyModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TechnicianDefaultItemWithItem | null>(null);
  const [editQty, setEditQty] = useState('1');

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (searchParams.get('edit') === 'true') {
      setEditing(true);
    }
  }, [searchParams]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    const resolvedParams = await params;
    const techId = resolvedParams.id;

    const [techResult, defaultItemsResult, transactionsResult, outstandingResult, itemsResult] = await Promise.all([
      supabase.from('technicians').select('*').eq('id', techId).single(),
      supabase
        .from('technician_default_items')
        .select('*, items(*)')
        .eq('technician_id', techId)
        .order('created_at', { ascending: true }),
      supabase
        .from('transactions')
        .select('*, projects(project_name), transaction_items(item_name_snapshot, borrow_qty, returned_qty, used_qty, damaged_qty, lost_qty, is_manual_item, item_type_snapshot, unit_snapshot)')
        .eq('technician_id', techId)
        .order('transaction_date', { ascending: false })
        .limit(20),
      supabase
        .from('transaction_items')
        .select('*, transactions!inner(transaction_number, technician_id, status)')
        .eq('transactions.technician_id', techId)
        .in('transactions.status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP']),
      supabase
        .from('items')
        .select('*')
        .eq('active', true)
        .order('item_name'),
    ]);

    if (techResult.data) {
      setTechnician(techResult.data);
      setEditForm({
        name: techResult.data.name,
        notes: techResult.data.notes || '',
        active: techResult.data.active,
      });
    }

    setDefaultItems(defaultItemsResult.data || []);
    setTransactions((transactionsResult.data || []) as unknown as TechnicianTransaction[]);
    setItems(itemsResult.data || []);

    // Filter outstanding items
    const outstanding = (outstandingResult.data || []).filter(
      (item: TransactionItem) => {
        const total = (item.returned_qty || 0) + (item.used_qty || 0) + (item.damaged_qty || 0) + (item.lost_qty || 0);
        return total < item.borrow_qty;
      }
    ).map((item: TransactionItem & { transactions: { transaction_number: string } }) => ({
      id: item.transaction_id + '-' + item.item_name_snapshot,
      item_name_snapshot: item.item_name_snapshot,
      borrow_qty: item.borrow_qty,
      returned_qty: item.returned_qty || 0,
      used_qty: item.used_qty || 0,
      damaged_qty: item.damaged_qty || 0,
      lost_qty: item.lost_qty || 0,
      unit_snapshot: item.unit_snapshot,
      is_manual_item: item.is_manual_item,
      transaction_number: item.transactions?.transaction_number,
    }));

    setOutstandingItems(outstanding);
    setLoading(false);
  }, [params, supabase]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);

    const resolvedParams = await params;
    const { error } = await supabase
      .from('technicians')
      .update({
        name: editForm.name.trim().toUpperCase(),
        notes: editForm.notes.trim() || null,
        active: editForm.active,
      })
      .eq('id', resolvedParams.id);

    if (error) {
      showToast('error', 'Gagal mengubah data teknisi.');
    } else {
      showToast('success', 'Data teknisi berhasil diubah.');
      setEditing(false);
      loadAllData();
    }
    setEditLoading(false);
  };

  const handleAddDefaultTool = async () => {
    if (!selectedItemId || !defaultQty) return;

    const qty = parseInt(defaultQty);
    if (qty <= 0) {
      showToast('error', 'Jumlah harus lebih dari 0.');
      return;
    }

    const exists = defaultItems.find((di) => di.item_id === selectedItemId);
    if (exists) {
      showToast('warning', 'Barang ini sudah ada dalam daftar alat bawaan. Gunakan Edit Qty.');
      return;
    }

    setAddItemLoading(true);
    const resolvedParams = await params;

    const { error } = await supabase.from('technician_default_items').insert({
      technician_id: resolvedParams.id,
      item_id: selectedItemId,
      default_qty: qty,
    });

    if (error) {
      showToast('error', 'Gagal menambahkan alat bawaan.');
    } else {
      showToast('success', 'Alat bawaan berhasil ditambahkan.');
      setShowAddModal(false);
      setSelectedItemId('');
      setDefaultQty('1');
      setItemSearch('');
      loadAllData();
    }
    setAddItemLoading(false);
  };

  const handleEditQty = async () => {
    if (!editingItem) return;

    const qty = parseInt(editQty);
    if (qty <= 0) {
      showToast('error', 'Jumlah harus lebih dari 0.');
      return;
    }

    const { error } = await supabase
      .from('technician_default_items')
      .update({ default_qty: qty })
      .eq('id', editingItem.id);

    if (error) {
      showToast('error', 'Gagal mengubah jumlah.');
    } else {
      showToast('success', 'Jumlah berhasil diubah.');
      setShowEditQtyModal(false);
      setEditingItem(null);
      loadAllData();
    }
  };

  const handleRemoveItem = async (id: string) => {
    if (!confirm('Hapus alat dari daftar bawaan?')) return;

    const { error } = await supabase
      .from('technician_default_items')
      .delete()
      .eq('id', id);

    if (error) {
      showToast('error', 'Gagal menghapus alat.');
    } else {
      showToast('success', 'Alat berhasil dihapus dari daftar bawaan.');
      loadAllData();
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.item_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (item.item_code && item.item_code.toLowerCase().includes(itemSearch.toLowerCase()))
  );

  // Stats
  const thisMonth = new Date();
  thisMonth.setDate(1);
  const transactionsThisMonth = transactions.filter(
    (tx) => new Date(tx.transaction_date) >= thisMonth
  ).length;

  if (loading) return <Loading />;

  if (!technician) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">Teknisi tidak ditemukan.</p>
          <Link href="/teknisi">
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
        <Link href="/teknisi">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{technician.name}</h1>
          <p className="text-sm font-mono text-gray-500">{technician.technician_code}</p>
        </div>
        <Badge variant={technician.active ? 'success' : 'danger'}>
          {technician.active ? 'Aktif' : 'Nonaktif'}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="py-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{transactionsThisMonth}</p>
            <p className="text-xs text-gray-500">Transaksi Bulan Ini</p>
          </div>
        </Card>
        <Card className="py-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{outstandingItems.length}</p>
            <p className="text-xs text-gray-500">Barang Belum Kembali</p>
          </div>
        </Card>
        <Card className="py-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{defaultItems.length}</p>
            <p className="text-xs text-gray-500">Alat Bawaan</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {[
          { id: 'info', label: 'Informasi', icon: Package },
          { id: 'outstanding', label: 'Belum Kembali', icon: AlertTriangle },
          { id: 'transactions', label: 'Riwayat', icon: History },
          { id: 'default', label: 'Alat Bawaan', icon: Wrench },
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
            {tab.id === 'outstanding' && outstandingItems.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                {outstandingItems.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <>
          {editing ? (
            <Card>
              <h2 className="text-lg font-semibold mb-4">Edit Data Teknisi</h2>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <Input
                  label="Nama Teknisi"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
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
                <Input
                  label="Catatan"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditing(false);
                      setEditForm({
                        name: technician.name,
                        notes: technician.notes || '',
                        active: technician.active,
                      });
                    }}
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
                <h2 className="text-lg font-semibold">Data Teknisi</h2>
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Kode Teknisi</dt>
                  <dd className="text-sm font-medium text-gray-900 font-mono">{technician.technician_code}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Nama</dt>
                  <dd className="text-sm font-medium text-gray-900">{technician.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Status</dt>
                  <dd>
                    <Badge variant={technician.active ? 'success' : 'danger'}>
                      {technician.active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </dd>
                </div>
                {technician.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-gray-500">Catatan</dt>
                    <dd className="text-sm text-gray-900">{technician.notes}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
        </>
      )}

      {/* Tab: Outstanding Items */}
      {activeTab === 'outstanding' && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold">Barang Belum Dikembalikan</h2>
          </div>
          {outstandingItems.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircleIcon className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Semua barang sudah dikembalikan dengan lengkap.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {outstandingItems.map((item) => {
                const outstanding = item.borrow_qty - item.returned_qty - item.used_qty - item.damaged_qty - item.lost_qty;
                return (
                  <div key={item.id} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{item.item_name_snapshot}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Pinjam: {item.borrow_qty} | Kembali: {item.returned_qty} | 
                          Dipakai: {item.used_qty} | Rusak: {item.damaged_qty} | Hilang: {item.lost_qty}
                        </p>
                      </div>
                      <Badge variant="danger" className="text-xs">
                        Sisa: {outstanding}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Tab: Transactions */}
      {activeTab === 'transactions' && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Riwayat Transaksi</h2>
          </div>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">Belum ada riwayat transaksi.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <Link
                  key={tx.id}
                  href={`/pengambilan/${tx.id}`}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{tx.transaction_number}</p>
                      <Badge variant={
                        tx.status === 'SELESAI' ? 'success' :
                        tx.status === 'PENGEMBALIAN_BELUM_LENGKAP' ? 'danger' : 'warning'
                      } className="text-xs">
                        {tx.status === 'SELESAI' ? 'Selesai' :
                         tx.status === 'PENGEMBALIAN_BELUM_LENGKAP' ? 'Belum Lengkap' :
                         tx.status === 'DIBATALKAN' ? 'Dibatalkan' : 'Dipinjam'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {tx.transaction_date}
                      {tx.projects?.project_name && ` • ${tx.projects.project_name}`}
                      {tx.has_damage && ' • Ada kerusakan'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab: Default Tools */}
      {activeTab === 'default' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Alat Bawaan Wajib</h2>
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Tambah
            </Button>
          </div>
          {defaultItems.length === 0 ? (
            <EmptyState
              title="BELUM ADA ALAT BAWAAN"
              description="Tambahkan alat wajib yang harus dibawa teknisi ini."
              icon={<Package className="w-10 h-10" />}
              action={
                <Button size="sm" onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Alat
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {defaultItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{item.items.item_name}</p>
                    <p className="text-sm text-gray-500">
                      Qty: {item.default_qty} {item.items.unit || 'Pcs'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingItem(item);
                        setEditQty(String(item.default_qty));
                        setShowEditQtyModal(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Add Default Tool Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah Alat Bawaan">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cari Barang
            </label>
            <Input
              placeholder="Ketik nama atau kode barang..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
            />
          </div>

          <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
            {filteredItems.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">
                Tidak ada barang yang cocok
              </p>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                    selectedItemId === item.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''
                  }`}
                  onClick={() => setSelectedItemId(item.id)}
                >
                  <p className="font-medium text-gray-900">{item.item_name}</p>
                  <p className="text-xs text-gray-500">
                    {item.item_code && `${item.item_code} • `}
                    {item.item_type === 'TOOL' ? 'Tool' : 'Consumable'}
                  </p>
                </button>
              ))
            )}
          </div>

          {selectedItemId && (
            <Input
              label="Jumlah Default"
              type="number"
              min="1"
              value={defaultQty}
              onChange={(e) => setDefaultQty(e.target.value)}
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowAddModal(false);
                setSelectedItemId('');
                setDefaultQty('1');
                setItemSearch('');
              }}
            >
              BATAL
            </Button>
            <Button
              className="flex-1"
              loading={addItemLoading}
              disabled={!selectedItemId}
              onClick={handleAddDefaultTool}
            >
              SIMPAN
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Qty Modal */}
      <Modal isOpen={showEditQtyModal} onClose={() => setShowEditQtyModal(false)} title="Edit Jumlah">
        <div className="space-y-4">
          {editingItem && (
            <p className="text-sm text-gray-600">
              {editingItem.items.item_name}
            </p>
          )}
          <Input
            label="Jumlah"
            type="number"
            min="1"
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowEditQtyModal(false);
                setEditingItem(null);
              }}
            >
              BATAL
            </Button>
            <Button className="flex-1" onClick={handleEditQty}>
              SIMPAN
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
