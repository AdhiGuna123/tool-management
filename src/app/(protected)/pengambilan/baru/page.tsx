'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createTransaction } from '@/lib/actions/transactions';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import Modal from '@/components/ui/modal';
import Loading from '@/components/ui/loading';
import { showToast } from '@/components/ui/toast';
import { 
  ArrowLeft, Plus, Search, Trash2, Minus, Package, 
  AlertTriangle, CheckCircle, FileText 
} from 'lucide-react';
import Link from 'next/link';
import type { 
  Technician, Project, Item, TechnicianDefaultItemWithItem, 
  TransactionItemForm 
} from '@/types';

let itemIdCounter = 0;
function generateItemId() {
  return `temp-${Date.now()}-${++itemIdCounter}`;
}

export default function PengambilanBaruPage() {
  const router = useRouter();
  const supabase = createClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [defaultTools, setDefaultTools] = useState<TechnicianDefaultItemWithItem[]>([]);
  const [items, setItems] = useState<TransactionItemForm[]>([]);
  
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [manualProjectName, setManualProjectName] = useState('');
  const [location, setLocation] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // Search state
  const [itemSearch, setItemSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Modal state
  const [showManualItemModal, setShowManualItemModal] = useState(false);
  const [manualItemForm, setManualItemForm] = useState({
    item_name: '',
    borrow_qty: '1',
    unit: '',
    item_type: 'CONSUMABLE',
    notes: '',
    save_to_master: false,
  });
  
  // Loading state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedTechnician) {
      loadDefaultTools(selectedTechnician.id);
    }
  }, [selectedTechnician]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (itemSearch.trim()) {
        searchItems(itemSearch);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [itemSearch]);

  async function loadInitialData() {
    const [techResult, projectResult] = await Promise.all([
      supabase.from('technicians').select('*').eq('active', true).order('name'),
      supabase.from('projects').select('*').eq('status', 'AKTIF').order('project_name'),
    ]);

    setTechnicians(techResult.data || []);
    setProjects(projectResult.data || []);
    setLoading(false);
  }

  async function loadDefaultTools(technicianId: string) {
    const { data } = await supabase
      .from('technician_default_items')
      .select('*, items(*)')
      .eq('technician_id', technicianId);

    if (data) {
      setDefaultTools(data as TechnicianDefaultItemWithItem[]);
      // Add default tools to items list
      const defaultItems: TransactionItemForm[] = data.map((dt) => ({
        id: generateItemId(),
        item_id: dt.items.id,
        item_name: dt.items.item_name,
        unit: dt.items.unit,
        item_type: dt.items.item_type,
        is_default_item: true,
        is_manual_item: false,
        borrow_qty: dt.default_qty,
        notes: '',
        stock_known: dt.items.stock_known,
        current_stock: dt.items.current_stock,
        save_to_master: false,
        category: dt.items.category,
      }));
      setItems(defaultItems);
    }
  }

  async function searchItems(query: string) {
    setSearching(true);
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('active', true)
      .ilike('item_name', `%${query}%`)
      .limit(10);

    setSearchResults(data || []);
    setSearching(false);
  }

  const addItem = useCallback((item: Item) => {
    // Check for duplicates
    const existing = items.find((i) => i.item_id === item.id);
    if (existing) {
      showToast('warning', 'Barang sudah ada di transaksi. Gunakan Edit Qty.');
      return;
    }

    const newItem: TransactionItemForm = {
      id: generateItemId(),
      item_id: item.id,
      item_name: item.item_name,
      unit: item.unit,
      item_type: item.item_type,
      is_default_item: false,
      is_manual_item: false,
      borrow_qty: 1,
      notes: '',
      stock_known: item.stock_known,
      current_stock: item.current_stock,
      save_to_master: false,
      category: item.category,
    };
    setItems((prev) => [...prev, newItem]);
    setItemSearch('');
    setSearchResults([]);
  }, [items]);

  const updateItemQty = useCallback((itemId: string, qty: number) => {
    if (qty < 1) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, borrow_qty: qty } : item
      )
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const addManualItem = () => {
    if (!manualItemForm.item_name.trim()) {
      showToast('error', 'Nama barang wajib diisi.');
      return;
    }

    const qty = parseInt(manualItemForm.borrow_qty);
    if (isNaN(qty) || qty < 1) {
      showToast('error', 'Jumlah harus lebih dari 0.');
      return;
    }

    // Check for duplicate names
    const existing = items.find(
      (i) => i.item_name.toLowerCase() === manualItemForm.item_name.trim().toLowerCase()
    );
    if (existing) {
      showToast('warning', 'Barang dengan nama sama sudah ada di transaksi.');
      return;
    }

    const newItem: TransactionItemForm = {
      id: generateItemId(),
      item_id: null,
      item_name: manualItemForm.item_name.trim(),
      unit: manualItemForm.unit || null,
      item_type: manualItemForm.item_type as 'TOOL' | 'CONSUMABLE',
      is_default_item: false,
      is_manual_item: true,
      borrow_qty: qty,
      notes: manualItemForm.notes,
      stock_known: false,
      current_stock: null,
      save_to_master: manualItemForm.save_to_master,
      category: null,
    };

    setItems((prev) => [...prev, newItem]);
    setShowManualItemModal(false);
    setManualItemForm({
      item_name: '',
      borrow_qty: '1',
      unit: '',
      item_type: 'CONSUMABLE',
      notes: '',
      save_to_master: false,
    });
  };

  const handleSubmit = async () => {
    if (!selectedTechnician) {
      showToast('error', 'Pilih teknisi terlebih dahulu.');
      return;
    }

    if (items.length === 0) {
      showToast('error', 'Minimal harus ada 1 item.');
      return;
    }

    // Check for stock issues
    for (const item of items) {
      if (item.item_id && item.stock_known && item.current_stock !== null) {
        if (item.borrow_qty > item.current_stock) {
          showToast('error', `Stok ${item.item_name} tidak mencukupi. Stok tersedia: ${item.current_stock}.`);
          return;
        }
      }
    }

    setSaving(true);
    const result = await createTransaction({
      technician_id: selectedTechnician.id,
      project_id: selectedProjectId && selectedProjectId !== '__manual__' ? selectedProjectId : null,
      manual_project_name: selectedProjectId === '__manual__' ? manualProjectName : null,
      location: location || null,
      transaction_date: transactionDate,
      notes: notes || null,
      items,
    });

    if (result.success) {
      showToast('success', 'Pengambilan alat berhasil disimpan.');
      router.push(`/pengambilan/${result.transaction_id}`);
    } else {
      showToast('error', result.error || 'Gagal menyimpan transaksi.');
      setSaving(false);
    }
  };

  const defaultItems = items.filter((i) => i.is_default_item);
  const additionalItems = items.filter((i) => !i.is_default_item && !i.is_manual_item);
  const manualItems = items.filter((i) => i.is_manual_item);
  const totalItems = items.length;

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pengambilan">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pengambilan Baru</h1>
          <p className="text-sm text-gray-500 mt-1">Buat pengambilan alat pagi</p>
        </div>
      </div>

      {/* Technician Selection */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Teknisi</h2>
        <Select
          label="Pilih Teknisi"
          value={selectedTechnician?.id || ''}
          onChange={(e) => {
            const tech = technicians.find((t) => t.id === e.target.value);
            setSelectedTechnician(tech || null);
          }}
          options={technicians.map((t) => ({
            value: t.id,
            label: `${t.name} (${t.technician_code})`,
          }))}
          placeholder="Pilih teknisi..."
        />
      </Card>

      {/* Project Selection */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Proyek / Pekerjaan</h2>
        <div className="space-y-4">
          <Select
            label="Proyek"
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              if (e.target.value) {
                setManualProjectName('');
              }
            }}
            options={[
              { value: '', label: 'Pilih proyek...' },
              ...projects.map((p) => ({
                value: p.id,
                label: `${p.project_name} (${p.project_code})`,
              })),
              { value: '__manual__', label: 'LAINNYA / INPUT MANUAL' },
            ]}
          />

          {selectedProjectId === '__manual__' && (
            <>
              <Input
                label="Nama Pekerjaan"
                value={manualProjectName}
                onChange={(e) => setManualProjectName(e.target.value)}
                placeholder="Contoh: Service AC Rumah Bapak Andi"
              />
              <Input
                label="Lokasi"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Contoh: Sanur"
              />
            </>
          )}

          {selectedProjectId && selectedProjectId !== '__manual__' && (
            <Input
              label="Lokasi (Opsional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Lokasi pekerjaan"
            />
          )}
        </div>
      </Card>

      {/* Transaction Date & Notes */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Detail Transaksi</h2>
        <div className="space-y-4">
          <Input
            label="Tanggal"
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
          />
          <Input
            label="Catatan (Opsional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan tambahan"
          />
        </div>
      </Card>

      {/* Default Tools */}
      {selectedTechnician && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Alat Bawaan Wajib</h2>
            <Badge variant="info">{defaultItems.length} Item</Badge>
          </div>
          
          {defaultItems.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Tidak ada alat bawaan wajib untuk teknisi ini.
            </p>
          ) : (
            <div className="space-y-3">
              {defaultItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.item_name}</p>
                    <p className="text-xs text-gray-500">
                      {item.unit || 'Pcs'} • {item.item_type === 'TOOL' ? 'Tool' : 'Consumable'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateItemQty(item.id, item.borrow_qty - 1)}
                      disabled={item.borrow_qty <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.borrow_qty}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateItemQty(item.id, item.borrow_qty + 1)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
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

      {/* Additional Items Search */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Alat / Barang Tambahan</h2>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            ref={searchInputRef}
            placeholder="Cari barang..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {searching && (
          <div className="text-center py-4">
            <Loading />
          </div>
        )}

        {!searching && searchResults.length > 0 && (
          <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
            {searchResults.map((item) => (
              <div
                key={item.id}
                className="p-3 hover:bg-gray-50 flex items-center justify-between"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.item_name}</p>
                  <p className="text-xs text-gray-500">
                    {item.item_code && `${item.item_code} • `}
                    {item.item_type === 'TOOL' ? 'Tool' : 'Consumable'}
                    {item.unit && ` • ${item.unit}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.stock_known ? (
                      <span>Stok: {item.current_stock}</span>
                    ) : (
                      <span className="text-orange-600">Stok: Belum Diketahui</span>
                    )}
                    {item.storage_location && ` • ${item.storage_location}`}
                  </p>
                </div>
                <Button size="sm" onClick={() => addItem(item)}>
                  Tambahkan
                </Button>
              </div>
            ))}
          </div>
        )}

        {!searching && itemSearch && searchResults.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            Tidak ada barang yang cocok.
          </p>
        )}

        {/* Additional Items List */}
        {additionalItems.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Barang Ditambahkan:</p>
            {additionalItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.item_name}</p>
                  <p className="text-xs text-gray-500">
                    {item.unit || 'Pcs'} • Stok: {item.stock_known ? item.current_stock : 'Belum Diketahui'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateItemQty(item.id, item.borrow_qty - 1)}
                    disabled={item.borrow_qty <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-8 text-center font-medium">{item.borrow_qty}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateItemQty(item.id, item.borrow_qty + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Manual Item Button */}
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => setShowManualItemModal(true)}
      >
        <Plus className="w-4 h-4 mr-2" />
        INPUT BARANG MANUAL
      </Button>

      {/* Manual Items List */}
      {manualItems.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4">Barang Manual</h2>
          <div className="space-y-3">
            {manualItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-orange-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{item.item_name}</p>
                    <Badge variant="warning">BELUM TERDAFTAR</Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    {item.unit || '-'} • {item.item_type === 'TOOL' ? 'Tool' : 'Consumable'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateItemQty(item.id, item.borrow_qty - 1)}
                    disabled={item.borrow_qty <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-8 text-center font-medium">{item.borrow_qty}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateItemQty(item.id, item.borrow_qty + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Review Section */}
      {totalItems > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4">Review</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Teknisi</dt>
              <dd className="text-sm font-medium text-gray-900">
                {selectedTechnician?.name || '-'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Proyek</dt>
              <dd className="text-sm font-medium text-gray-900">
                {selectedProjectId === '__manual__'
                  ? manualProjectName || '-'
                  : projects.find((p) => p.id === selectedProjectId)?.project_name || '-'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Tanggal</dt>
              <dd className="text-sm font-medium text-gray-900">
                {new Date(transactionDate).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </dd>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Alat Bawaan</span>
                <span>{defaultItems.length} item</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Alat Tambahan</span>
                <span>{additionalItems.length} item</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Barang Manual</span>
                <span>{manualItems.length} item</span>
              </div>
              <div className="flex justify-between text-sm font-medium mt-2 pt-2 border-t">
                <span>Total Jenis Barang</span>
                <span>{totalItems}</span>
              </div>
            </div>
          </dl>
        </Card>
      )}

      {/* Submit Button */}
      <div className="sticky bottom-4 lg:bottom-6">
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={saving || totalItems === 0 || !selectedTechnician}
          loading={saving}
        >
          {saving ? 'Menyimpan...' : 'SIMPAN PENGAMBILAN'}
        </Button>
      </div>

      {/* Manual Item Modal */}
      <Modal
        isOpen={showManualItemModal}
        onClose={() => setShowManualItemModal(false)}
        title="Input Barang Manual"
      >
        <div className="space-y-4">
          <Input
            label="Nama Barang"
            value={manualItemForm.item_name}
            onChange={(e) =>
              setManualItemForm({ ...manualItemForm, item_name: e.target.value })
            }
            placeholder="Contoh: Connector Brass 1/2"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Jumlah"
              type="number"
              min="1"
              value={manualItemForm.borrow_qty}
              onChange={(e) =>
                setManualItemForm({ ...manualItemForm, borrow_qty: e.target.value })
              }
            />
            <Input
              label="Satuan"
              value={manualItemForm.unit}
              onChange={(e) =>
                setManualItemForm({ ...manualItemForm, unit: e.target.value })
              }
              placeholder="pcs"
            />
          </div>

          <Select
            label="Jenis Barang"
            value={manualItemForm.item_type}
            onChange={(e) =>
              setManualItemForm({ ...manualItemForm, item_type: e.target.value })
            }
            options={[
              { value: 'TOOL', label: 'Tool / Alat' },
              { value: 'CONSUMABLE', label: 'Consumable / Habis Pakai' },
            ]}
          />

          <Input
            label="Catatan"
            value={manualItemForm.notes}
            onChange={(e) =>
              setManualItemForm({ ...manualItemForm, notes: e.target.value })
            }
            placeholder="Catatan opsional"
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={manualItemForm.save_to_master}
              onChange={(e) =>
                setManualItemForm({
                  ...manualItemForm,
                  save_to_master: e.target.checked,
                })
              }
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700">Simpan juga ke Master Stok</span>
          </label>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowManualItemModal(false)}
            >
              BATAL
            </Button>
            <Button className="flex-1" onClick={addManualItem}>
              TAMBAHKAN
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
