'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getTransactionById, getTransactionItems } from '@/lib/actions/transactions';
import { getReturnEvents, processReturn, uploadDamagePhoto } from '@/lib/actions/returns';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import Modal from '@/components/ui/modal';
import Loading from '@/components/ui/loading';
import { showToast } from '@/components/ui/toast';
import { 
  ArrowLeft, Save, AlertTriangle, CheckCircle, 
  Package, Upload, Camera, Clock, History 
} from 'lucide-react';
import Link from 'next/link';
import type { 
  TransactionWithRelations, TransactionItem, ReturnEventWithRelations,
  ReturnItemForm, ReturnStatus 
} from '@/types';

export default function PengembalianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const supabase = createClient();

  const [transaction, setTransaction] = useState<TransactionWithRelations | null>(null);
  const [transactionItems, setTransactionItems] = useState<TransactionItem[]>([]);
  const [returnEvents, setReturnEvents] = useState<ReturnEventWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingSave, setPendingSave] = useState(false);

  // Return form state
  const [returnItems, setReturnItems] = useState<ReturnItemForm[]>([]);
  const [returnNotes, setReturnNotes] = useState('');

  // Damage modal
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [damageItem, setDamageItem] = useState<ReturnItemForm | null>(null);
  const [damageNotes, setDamageNotes] = useState('');
  const [damageFile, setDamageFile] = useState<File | null>(null);

  useEffect(() => {
    loadTransaction();
  }, []);

  async function loadTransaction() {
    setLoading(true);
    const resolvedParams = await params;
    try {
      const [txData, itemsData, eventsData] = await Promise.all([
        getTransactionById(resolvedParams.id),
        getTransactionItems(resolvedParams.id),
        getReturnEvents(resolvedParams.id),
      ]);

      setTransaction(txData as TransactionWithRelations);
      setTransactionItems(itemsData as TransactionItem[]);
      setReturnEvents(eventsData as ReturnEventWithRelations[]);

      // Initialize return form with existing values or defaults
      const formItems: ReturnItemForm[] = itemsData.map((item: TransactionItem) => {
        // If already partially returned, use existing values
        const returned = item.returned_qty || 0;
        const used = item.used_qty || 0;
        const damaged = item.damaged_qty || 0;
        const lost = item.lost_qty || 0;
        const outstanding = item.borrow_qty - returned - used - damaged - lost;

        return {
          id: item.id,
          item_name: item.item_name_snapshot,
          unit: item.unit_snapshot,
          item_type: item.item_type_snapshot,
          is_default_item: item.is_default_item,
          is_manual_item: item.is_manual_item,
          stock_known: false, // Will be determined later
          item_id: item.item_id,
          borrow_qty: item.borrow_qty,
          returned_qty: returned,
          used_qty: used,
          damaged_qty: damaged,
          lost_qty: lost,
          return_status: item.return_status || (outstanding === 0 ? 'KEMBALI_BAIK' : 'BELUM_KEMBALI'),
          notes: item.notes || '',
          damage_notes: '',
          damage_attachment: null,
        };
      });

      setReturnItems(formItems);
    } catch (error) {
      console.error('Error loading transaction:', error);
    }
    setLoading(false);
  }

  const updateReturnItem = (itemId: string, field: keyof ReturnItemForm, value: number | string | ReturnStatus) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const updated = { ...item, [field]: value };

        // Auto-calculate return status based on quantities
        if (['returned_qty', 'used_qty', 'damaged_qty', 'lost_qty'].includes(field)) {
          const totalDisposition = updated.returned_qty + updated.used_qty + updated.damaged_qty + updated.lost_qty;
          const outstanding = updated.borrow_qty - totalDisposition;

          if (totalDisposition === 0) {
            updated.return_status = 'BELUM_KEMBALI';
          } else if (outstanding === 0 && updated.returned_qty === updated.borrow_qty && updated.damaged_qty === 0 && updated.lost_qty === 0) {
            updated.return_status = 'KEMBALI_BAIK';
          } else if (outstanding === 0 && updated.used_qty > 0 && updated.returned_qty === 0) {
            updated.return_status = 'HABIS_DIPAKAI';
          } else if (outstanding === 0 && updated.damaged_qty > 0) {
            updated.return_status = 'RUSAK';
          } else if (outstanding === 0 && updated.lost_qty > 0) {
            updated.return_status = 'HILANG';
          } else if (outstanding > 0 && totalDisposition > 0) {
            updated.return_status = 'SEBAGIAN_KEMBALI';
          } else {
            updated.return_status = 'BELUM_KEMBALI';
          }
        }

        return updated;
      })
    );
  };

  const markAllToolsReturned = () => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.item_type === 'TOOL' && !item.is_manual_item) {
          return {
            ...item,
            returned_qty: item.borrow_qty,
            used_qty: 0,
            damaged_qty: 0,
            lost_qty: 0,
            return_status: 'KEMBALI_BAIK' as ReturnStatus,
          };
        }
        return item;
      })
    );
    showToast('success', 'Semua alat ditandai sudah kembali.');
  };

  const openDamageModal = (item: ReturnItemForm) => {
    setDamageItem(item);
    setDamageNotes('');
    setDamageFile(null);
    setShowDamageModal(true);
  };

  const handleDamageUpload = async () => {
    if (!damageItem || !damageFile) return;

    const result = await uploadDamagePhoto(damageItem.id, damageFile);
    if (result.success) {
      showToast('success', 'Foto kerusakan berhasil diupload.');
    } else {
      showToast('error', result.error || 'Gagal mengupload foto.');
    }
    setShowDamageModal(false);
  };

  const validateReturn = (): string | null => {
    for (const item of returnItems) {
      const totalDisposition = item.returned_qty + item.used_qty + item.damaged_qty + item.lost_qty;
      if (totalDisposition > item.borrow_qty) {
        return `Jumlah ${item.item_name} melebihi yang dipinjam. Dibawa: ${item.borrow_qty}, Total: ${totalDisposition}.`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateReturn();
    if (validationError) {
      showToast('error', validationError);
      return;
    }

    // Check for outstanding items
    const hasOutstanding = returnItems.some((item) => {
      const totalDisposition = item.returned_qty + item.used_qty + item.damaged_qty + item.lost_qty;
      return totalDisposition < item.borrow_qty;
    });

    if (hasOutstanding) {
      setConfirmMessage('Masih ada barang yang belum kembali. Simpan sebagai Pengembalian Belum Lengkap?');
      setPendingSave(true);
      setShowConfirmModal(true);
      return;
    }

    await executeReturn();
  };

  const executeReturn = async () => {
    setSaving(true);
    setShowConfirmModal(false);

    const resolvedParams = await params;
    const result = await processReturn({
      transaction_id: resolvedParams.id,
      items: returnItems,
      notes: returnNotes || undefined,
    });

    if (result.success) {
      showToast('success', 'Pengembalian berhasil disimpan.');
      router.push(`/pengembalian/sukses?id=${resolvedParams.id}&status=${result.transaction_status}`);
    } else {
      showToast('error', result.error || 'Gagal menyimpan pengembalian.');
    }
    setSaving(false);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'SEDANG_DIPINJAM': return 'info';
      case 'PENGEMBALIAN_BELUM_LENGKAP': return 'warning';
      case 'SELESAI': return 'success';
      case 'BERMASALAH': return 'danger';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SEDANG_DIPINJAM': return 'SEDANG DIPINJAM';
      case 'PENGEMBALIAN_BELUM_LENGKAP': return 'PENGEMBALIAN BELUM LENGKAP';
      case 'SELESAI': return 'SELESAI';
      case 'BERMASALAH': return 'BERMASALAH';
      default: return status;
    }
  };

  const getReturnStatusLabel = (status: ReturnStatus) => {
    switch (status) {
      case 'KEMBALI_BAIK': return 'Kembali / Baik';
      case 'BELUM_KEMBALI': return 'Belum Kembali';
      case 'RUSAK': return 'Rusak';
      case 'HILANG': return 'Hilang';
      case 'HABIS_DIPAKAI': return 'Habis Dipakai';
      case 'SEBAGIAN_KEMBALI': return 'Sebagian Kembali';
      default: return status;
    }
  };

  const getReturnStatusVariant = (status: ReturnStatus) => {
    switch (status) {
      case 'KEMBALI_BAIK': return 'success';
      case 'BELUM_KEMBALI': return 'warning';
      case 'RUSAK': return 'danger';
      case 'HILANG': return 'danger';
      case 'HABIS_DIPAKAI': return 'info';
      case 'SEBAGIAN_KEMBALI': return 'warning';
      default: return 'default';
    }
  };

  // Calculate summary
  const totalItems = returnItems.length;
  const resolvedItems = returnItems.filter((item) => {
    const totalDisposition = item.returned_qty + item.used_qty + item.damaged_qty + item.lost_qty;
    return totalDisposition === item.borrow_qty;
  }).length;
  const outstandingItems = totalItems - resolvedItems;

  if (loading) {
    return <Loading />;
  }

  if (!transaction) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">Transaksi tidak ditemukan.</p>
          <Link href="/pengembalian">
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
        <Link href="/pengembalian">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{transaction.transaction_number}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {transaction.technicians?.name} • {new Date(transaction.transaction_date).toLocaleDateString('id-ID')}
          </p>
        </div>
        <Badge variant={getStatusVariant(transaction.status)}>
          {getStatusLabel(transaction.status)}
        </Badge>
      </div>

      {/* Transaction Info */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Informasi Transaksi</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Teknisi</dt>
            <dd className="text-sm font-medium text-gray-900">
              {transaction.technicians?.name} ({transaction.technicians?.technician_code})
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Proyek</dt>
            <dd className="text-sm font-medium text-gray-900">
              {transaction.projects?.project_name || transaction.manual_project_name || '-'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Waktu Pengambilan</dt>
            <dd className="text-sm font-medium text-gray-900">
              {transaction.borrowed_at ? new Date(transaction.borrowed_at).toLocaleString('id-ID') : '-'}
            </dd>
          </div>
          {transaction.location && (
            <div>
              <dt className="text-sm text-gray-500">Lokasi</dt>
              <dd className="text-sm font-medium text-gray-900">{transaction.location}</dd>
            </div>
          )}
        </dl>
      </Card>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" size="sm" onClick={markAllToolsReturned}>
          <CheckCircle className="w-4 h-4 mr-2" />
          Tandai Semua Alat Kembali
        </Button>
      </div>

      {/* Return Items */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Daftar Barang yang Dibawa</h2>
          <div className="text-sm text-gray-500">
            {resolvedItems}/{totalItems} Selesai
          </div>
        </div>

        <div className="space-y-4">
          {returnItems.map((item) => {
            const totalDisposition = item.returned_qty + item.used_qty + item.damaged_qty + item.lost_qty;
            const outstanding = item.borrow_qty - totalDisposition;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-lg border ${
                  outstanding === 0 ? 'bg-green-50 border-green-200' : 
                  item.damaged_qty > 0 || item.lost_qty > 0 ? 'bg-red-50 border-red-200' : 
                  'bg-white border-gray-200'
                }`}
              >
                {/* Item Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{item.item_name}</p>
                      <Badge variant={item.is_default_item ? 'info' : item.is_manual_item ? 'warning' : 'default'}>
                        {item.is_default_item ? 'ALAT BAWAAN' : item.is_manual_item ? 'MANUAL' : 'TAMBAHAN'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      {item.item_type === 'TOOL' ? 'Tool' : 'Consumable'} • {item.unit || 'Pcs'}
                    </p>
                  </div>
                  <Badge variant={getReturnStatusVariant(item.return_status)}>
                    {getReturnStatusLabel(item.return_status)}
                  </Badge>
                </div>

                {/* Borrowed Qty */}
                <div className="mb-3">
                  <p className="text-sm text-gray-600">
                    Dibawa: <span className="font-medium">{item.borrow_qty}</span> {item.unit || 'Pcs'}
                  </p>
                </div>

                {/* Return Quantities */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Returned Qty */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Kembali</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="w-8 h-8 rounded border hover:bg-gray-100 flex items-center justify-center"
                        onClick={() => updateReturnItem(item.id, 'returned_qty', Math.max(0, item.returned_qty - 1))}
                        disabled={item.returned_qty <= 0}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={item.borrow_qty}
                        value={item.returned_qty}
                        onChange={(e) => updateReturnItem(item.id, 'returned_qty', Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-12 h-8 text-center border rounded text-sm"
                      />
                      <button
                        type="button"
                        className="w-8 h-8 rounded border hover:bg-gray-100 flex items-center justify-center"
                        onClick={() => updateReturnItem(item.id, 'returned_qty', Math.min(item.borrow_qty, item.returned_qty + 1))}
                        disabled={item.returned_qty >= item.borrow_qty}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Used Qty (for consumables) */}
                  {item.item_type === 'CONSUMABLE' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Dipakai</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="w-8 h-8 rounded border hover:bg-gray-100 flex items-center justify-center"
                          onClick={() => updateReturnItem(item.id, 'used_qty', Math.max(0, item.used_qty - 1))}
                          disabled={item.used_qty <= 0}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={item.borrow_qty}
                          value={item.used_qty}
                          onChange={(e) => updateReturnItem(item.id, 'used_qty', Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-12 h-8 text-center border rounded text-sm"
                        />
                        <button
                          type="button"
                          className="w-8 h-8 rounded border hover:bg-gray-100 flex items-center justify-center"
                          onClick={() => updateReturnItem(item.id, 'used_qty', Math.min(item.borrow_qty, item.used_qty + 1))}
                          disabled={item.used_qty >= item.borrow_qty}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Damaged Qty */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Rusak</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="w-8 h-8 rounded border hover:bg-gray-100 flex items-center justify-center"
                        onClick={() => updateReturnItem(item.id, 'damaged_qty', Math.max(0, item.damaged_qty - 1))}
                        disabled={item.damaged_qty <= 0}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={item.borrow_qty}
                        value={item.damaged_qty}
                        onChange={(e) => updateReturnItem(item.id, 'damaged_qty', Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-12 h-8 text-center border rounded text-sm"
                      />
                      <button
                        type="button"
                        className="w-8 h-8 rounded border hover:bg-gray-100 flex items-center justify-center"
                        onClick={() => updateReturnItem(item.id, 'damaged_qty', Math.min(item.borrow_qty, item.damaged_qty + 1))}
                        disabled={item.damaged_qty >= item.borrow_qty}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Lost Qty */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Hilang</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="w-8 h-8 rounded border hover:bg-gray-100 flex items-center justify-center"
                        onClick={() => updateReturnItem(item.id, 'lost_qty', Math.max(0, item.lost_qty - 1))}
                        disabled={item.lost_qty <= 0}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={item.borrow_qty}
                        value={item.lost_qty}
                        onChange={(e) => updateReturnItem(item.id, 'lost_qty', Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-12 h-8 text-center border rounded text-sm"
                      />
                      <button
                        type="button"
                        className="w-8 h-8 rounded border hover:bg-gray-100 flex items-center justify-center"
                        onClick={() => updateReturnItem(item.id, 'lost_qty', Math.min(item.borrow_qty, item.lost_qty + 1))}
                        disabled={item.lost_qty >= item.borrow_qty}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Outstanding Warning */}
                {outstanding > 0 && (
                  <div className="mt-2 text-xs text-orange-600">
                    Belum Ditentukan: {outstanding} {item.unit || 'Pcs'}
                  </div>
                )}

                {/* Notes */}
                <div className="mt-3">
                  <input
                    type="text"
                    placeholder="Catatan..."
                    value={item.notes}
                    onChange={(e) => updateReturnItem(item.id, 'notes', e.target.value)}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  />
                </div>

                {/* Damage Button */}
                {item.item_type === 'TOOL' && (
                  <div className="mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDamageModal(item)}
                    >
                      <Camera className="w-4 h-4 mr-1" />
                      Foto Kerusakan
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Return Events History */}
      {returnEvents.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <History className="w-5 h-5" />
            Riwayat Pengembalian
          </h2>
          <div className="space-y-4">
            {returnEvents.map((event) => (
              <div key={event.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(event.processed_at).toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-gray-500">
                    Oleh: {event.profiles?.full_name || 'Admin'}
                  </p>
                </div>
                {event.notes && (
                  <p className="text-sm text-gray-600 mb-2">{event.notes}</p>
                )}
                <div className="text-xs text-gray-500">
                  {event.return_event_items?.length || 0} item diproses
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Catatan Pengembalian</h2>
        <textarea
          value={returnNotes}
          onChange={(e) => setReturnNotes(e.target.value)}
          placeholder="Catatan tambahan untuk pengembalian ini..."
          className="w-full px-3 py-2 border rounded-lg text-sm"
          rows={3}
        />
      </Card>

      {/* Sticky Save Area */}
      <div className="sticky bottom-4 lg:bottom-6 bg-white p-4 rounded-lg shadow-lg border">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm">
            <span className="font-medium">{totalItems}</span> Item
            {outstandingItems > 0 && (
              <span className="text-orange-600 ml-2">
                {outstandingItems} Belum Selesai
              </span>
            )}
          </div>
          {outstandingItems === 0 && (
            <div className="flex items-center text-green-600 text-sm">
              <CheckCircle className="w-4 h-4 mr-1" />
              Semua Selesai
            </div>
          )}
        </div>
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={saving}
          loading={saving}
        >
          {saving ? 'Menyimpan...' : 'SIMPAN PENGEMBALIAN'}
        </Button>
      </div>

      {/* Confirm Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Konfirmasi Pengembalian"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{confirmMessage}</p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowConfirmModal(false);
                setPendingSave(false);
              }}
            >
              BATAL
            </Button>
            <Button
              className="flex-1"
              onClick={executeReturn}
            >
              SIMPAN
            </Button>
          </div>
        </div>
      </Modal>

      {/* Damage Modal */}
      <Modal
        isOpen={showDamageModal}
        onClose={() => setShowDamageModal(false)}
        title="Foto Kerusakan"
      >
        <div className="space-y-4">
          {damageItem && (
            <p className="text-sm text-gray-600">
              {damageItem.item_name} - {damageItem.damaged_qty} unit
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catatan Kerusakan *
            </label>
            <textarea
              value={damageNotes}
              onChange={(e) => setDamageNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={3}
              placeholder="Jelaskan kerusakan..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Foto Kerusakan
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setDamageFile(e.target.files?.[0] || null)}
              className="w-full"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowDamageModal(false)}
            >
              BATAL
            </Button>
            <Button
              className="flex-1"
              onClick={handleDamageUpload}
              disabled={!damageFile || !damageNotes.trim()}
            >
              <Upload className="w-4 h-4 mr-2" />
              UPLOAD
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
