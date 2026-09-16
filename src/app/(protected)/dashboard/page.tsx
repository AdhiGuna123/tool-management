import { createClient } from '@/lib/supabase/server';
import {
  Users,
  Package,
  HelpCircle,
  FolderOpen,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  CheckCircle,
  Clock,
  ListTodo,
  Wrench,
  ClipboardList,
} from 'lucide-react';
import Link from 'next/link';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const [
    { count: totalTechnicians },
    { count: totalItems },
    { count: unknownStockItems },
    { count: activeProjects },
    { count: openTransactions },
    { count: incompleteReturns },
    { count: damagedItems },
    { count: unregisteredItems },
    todayTxResult,
  ] = await Promise.all([
    supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('active', true),
    supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('active', true),
    supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('stock_known', false)
      .eq('active', true),
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'AKTIF'),
    supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP']),
    supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENGEMBALIAN_BELUM_LENGKAP'),
    supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('has_damage', true)
      .in('status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP']),
    supabase
      .from('transaction_items')
      .select('*', { count: 'exact', head: true })
      .eq('is_manual_item', true)
      .is('item_id', null),
    supabase
      .from('transactions')
      .select('*, technicians(name, technician_code), projects(project_name)')
      .eq('transaction_date', today)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return {
    totalTechnicians: totalTechnicians || 0,
    totalItems: totalItems || 0,
    unknownStockItems: unknownStockItems || 0,
    activeProjects: activeProjects || 0,
    openTransactions: openTransactions || 0,
    incompleteReturns: incompleteReturns || 0,
    damagedItems: damagedItems || 0,
    unregisteredItems: unregisteredItems || 0,
    todayTransactions: todayTxResult.data || [],
  };
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

export default async function DashboardPage() {
  const stats = await getDashboardData();

  const mainStats = [
    {
      label: 'TEKNISI AKTIF',
      value: stats.totalTechnicians,
      icon: Users,
      color: 'bg-blue-600',
    },
    {
      label: 'MASTER BARANG',
      value: stats.totalItems,
      icon: Package,
      color: 'bg-green-600',
    },
    {
      label: 'STOK BELUM DIKETAHUI',
      value: stats.unknownStockItems,
      icon: HelpCircle,
      color: 'bg-orange-500',
    },
    {
      label: 'PROYEK AKTIF',
      value: stats.activeProjects,
      icon: FolderOpen,
      color: 'bg-purple-600',
    },
  ];

  const operationalStats = [
    {
      label: 'Peminjaman Aktif',
      value: stats.openTransactions,
      icon: Clock,
      color: 'text-amber-600',
      href: '/pengembalian',
    },
    {
      label: 'Pengembalian Belum Lengkap',
      value: stats.incompleteReturns,
      icon: ListTodo,
      color: 'text-red-600',
      href: '/pengembalian',
    },
    {
      label: 'Barang Bermasalah',
      value: stats.damagedItems,
      icon: AlertTriangle,
      color: 'text-red-600',
      href: '/pengembalian',
    },
    {
      label: 'Barang Belum Terdaftar',
      value: stats.unregisteredItems,
      icon: Wrench,
      color: 'text-orange-600',
      href: '/belum-terdaftar',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ringkasan data sistem manajemen alat
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainStats.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${stat.color}`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {stat.label}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Operational Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {operationalStats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Today's Transactions */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Transaksi Hari Ini</h2>
          </div>
          <Link href="/transaksi" className="text-sm text-blue-600 hover:underline">
            Lihat Semua
          </Link>
        </div>

        {stats.todayTransactions.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Belum ada transaksi hari ini.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.todayTransactions.map((tx: {
              id: string;
              transaction_number: string;
              status: string;
              technicians?: { name: string; technician_code: string };
              projects?: { project_name: string };
            }) => (
              <Link
                key={tx.id}
                href={`/pengambilan/${tx.id}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {tx.transaction_number}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {tx.technicians?.name} ({tx.technicians?.technician_code})
                    {tx.projects?.project_name && ` - ${tx.projects.project_name}`}
                  </p>
                </div>
                <Badge variant={statusColors[tx.status] || 'info'}>
                  {statusLabels[tx.status] || tx.status}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
