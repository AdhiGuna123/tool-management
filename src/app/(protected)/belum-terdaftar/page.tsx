'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Loading from '@/components/ui/loading';
import Modal from '@/components/ui/modal';
import { showToast } from '@/components/ui/toast';
import {
  AlertTriangle,
  Plus,
  Search,
  Users,
  Calendar,
  Package,
} from 'lucide-react';
import type { Item } from '@/types';

interface UnregisteredItem {
  name: string;
  unit: string | null;
  itemType: string;
  usageCount: number;
  transactions: { transactionNumber: string; date: string }[];
  technicians: string[];
  lastUsedDate: string | null;
}

interface RawTransactionItem {
  item_name_snapshot: string;
  unit_snapshot: string | null;
  item_type_snapshot: string;
  transaction_id: string;
  transactions?: { transaction_number: string; transaction_date: string } | null;
  technicians?: { name: string } | null;
}

export default function BelumTerdaftarPage() {
  const [items, setItems] = useState<UnregisteredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UnregisteredItem | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertForm, setConvertForm] = useState({
    item_code: '',
    category: '',
    item_type: 'TOOL',
    unit: '',
    stock_known: false,
    current_stock: '',
    storage_location: '',
    notes: '',
  });

  const supabase = createClient();

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    const { data } = await supabase
      .from('transaction_items')
      .select(`
        item_name_snapshot,
        unit_snapshot,
        item_type_snapshot,
        transaction_id,
        transactions!inner(transaction_number, transaction_date, technician_id, status),
        technicians!inner(name)
      `)
      .eq('is_manual_item', true)
      .is('item_id', null);

    if (data) {
      const grouped = (data as unknown as RawTransactionItem[]).reduce((acc, item) => {
        const name = item.item_name_snapshot;
        if (!acc[name]) {
          acc[name] = {
            name,
            unit: item.unit_snapshot,
            itemType: item.item_type_snapshot,
            usageCount: 0,
            transactions: [],
            technicians: [],
            lastUsedDate: null,
          };
        }
        acc[name].usageCount++;
        acc[name].transactions.push({
          transactionNumber: item.transactions?.transaction_number || '',
          date: item.transactions?.transaction_date || '',
        });
        const techName = item.technicians?.name;
        if (techName && !acc[name].technicians.includes(techName)) {
          acc[name].technicians.push(techName);
        }
        if (
          item.transactions?.transaction_date &&
          (!acc[name].lastUsedDate || new Date(item.transactions.transaction_date) > new Date(acc[name].lastUsedDate))
        ) {
          acc[name].lastUsedDate = item.transactions.transaction_date;
        }
        return acc;
      }, {} as Record<string, UnregisteredItem>);

      setItems(Object.values(grouped));
    }
    setLoading(false);
  }

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.technicians.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleConvert = async () => {
    if (!selectedItem) return;
    setConverting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('error', 'Tidak terautentikasi.');
      setConverting(false);
      return;
    }

    // Check if item_code already exists
    if (convertForm.item_code.trim()) {
      const { data: existing } = await supabase
        .from('items')
        .select('id')
        .eq('item_code', convertForm.item_code.trim().toUpperCase())
        .single();

      if (existing) {
        showToast('error', 'Kode barang sudah digunakan.');
        setConverting(false);
        return;
      }
    }

    // Create master item
    const { data: newItem, error } = await supabase
      .from('items')
      .insert({
        item_code: convertForm.item_code.trim() ? convertForm.item_code.trim().toUpperCase() : null,
        item_name: selectedItem.name,
        category: convertForm.category.trim() || null,
        item_type: convertForm.item_type,
        unit: convertForm.unit.trim() || selectedItem.unit || null,
        stock_known: convertForm.stock_known,
        current_stock: convertForm.stock_known && convertForm.current_stock
          ? parseInt(convertForm.current_stock)
          : null,
        storage_location: convertForm.storage_location.trim() || null,
        notes: convertForm.notes.trim() || 'Dikonversi dari barang manual',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      showToast('error', 'Gagal membuat barang master.');
      setConverting(false);
      return;
    }

    // Update all manual items with this name to point to the new master item
    const { error: updateError } = await supabase
      .from('transaction_items')
      .update({ item_id: newItem.id, is_manual_item: false })
      .eq('item_name_snapshot', selectedItem.name)
      .eq('is_manual_item', true)
      .is('item_id', null);

    if (updateError) {
      console.error('Update error:', updateError);
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      action: 'MANUAL_ITEM_TO_MASTER',
      entity_type: 'item',
      entity_id: newItem.id,
      new_data: {
        name: selectedItem.name,
        code: convertForm.item_code || null,
        type: convertForm.item_type,
        source: 'manual_conversion',
      },
    });

    showToast('success', `Berhasil mengkonversi "${selectedItem.name}" ke barang master.`);
    setShowConvertModal(false);
    setSelectedItem(null);
    setConvertForm({
      item_code: '',
      category: '',
      item_type: 'TOOL',
      unit: '',
      stock_known: false,
      current_stock: '',
      storage_location: '',
      notes: '',
    });
    loadItems();
    setConverting(false);
  };

  const openConvertModal = (item: UnregisteredItem) => {
    setSelectedItem(item);
    setConvertForm({
      ...convertForm,
      unit: item.unit || '',
      item_type: item.itemType || 'TOOL',
    });
    setShowConvertModal(true);
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Barang Belum Terdaftar</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} barang manual ditemukan
          </p>
        </div>
      </div>

      <Card className="bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Barang Manual
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Barang ini diinput saat pengambilan tanpa memiliki master data. 
              Gunakan tombol konversi untuk menambahkannya ke master barang.
            </p>
          </div>
        </div>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari nama barang atau teknisi..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <Package className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-500">
              {items.length === 0
                ? 'Tidak ada barang belum terdaftar.'
                : 'Tidak ada barang yang cocok dengan pencarian.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Card key={item.name}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    <Badge variant={item.itemType === 'TOOL' ? 'info' : 'warning'} className="text-xs">
                      {item.itemType === 'TOOL' ? 'Tool' : 'Consumable'}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" />
                      Digunakan oleh: {item.technicians.join(', ')}
                    </p>
                    <p className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      Terakhir digunakan: {item.lastUsedDate || '-'}
                    </p>
                    <p className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5" />
                      {item.usageCount}x digunakan
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openConvertModal(item)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Konversi
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Convert Modal */}
      <Modal
        isOpen={showConvertModal}
        onClose={() => {
          setShowConvertModal(false);
          setSelectedItem(null);
        }}
        title={`Konversi "${selectedItem?.name}" ke Master Barang`}
      >
        <div className="space-y-4">
          <Input
            label="Kode Barang"
            value={convertForm.item_code}
            onChange={(e) => setConvertForm({ ...convertForm, item_code: e.target.value })}
            placeholder="Kode barang (opsional)"
          />
          <Input
            label="Kategori"
            value={convertForm.category}
            onChange={(e) => setConvertForm({ ...convertForm, category: e.target.value })}
            placeholder="Kategori barang"
          />
          <Select
            label="Jenis Barang"
            value={convertForm.item_type}
            onChange={(e) => setConvertForm({ ...convertForm, item_type: e.target.value })}
            options={[
              { value: 'TOOL', label: 'Tool / Asset' },
              { value: 'CONSUMABLE', label: 'Consumable / Habis Pakai' },
            ]}
          />
          <Input
            label="Satuan"
            value={convertForm.unit}
            onChange={(e) => setConvertForm({ ...convertForm, unit: e.target.value })}
            placeholder="Satuan barang"
          />
          <Select
            label="Status Stok"
            value={convertForm.stock_known ? 'true' : 'false'}
            onChange={(e) => setConvertForm({ ...convertForm, stock_known: e.target.value === 'true' })}
            options={[
              { value: 'true', label: 'Stok Diketahui' },
              { value: 'false', label: 'Stok Belum Diketahui' },
            ]}
          />
          {convertForm.stock_known && (
            <Input
              label="Stok Saat Ini"
              type="number"
              min="0"
              value={convertForm.current_stock}
              onChange={(e) => setConvertForm({ ...convertForm, current_stock: e.target.value })}
            />
          )}
          <Input
            label="Lokasi Penyimpanan"
            value={convertForm.storage_location}
            onChange={(e) => setConvertForm({ ...convertForm, storage_location: e.target.value })}
          />
          <Input
            label="Catatan"
            value={convertForm.notes}
            onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })}
          />
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowConvertModal(false);
                setSelectedItem(null);
              }}
            >
              BATAL
            </Button>
            <Button onClick={handleConvert} loading={converting}>
              KONVERSI
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
