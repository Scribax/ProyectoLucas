'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  DollarSign,
  Egg,
  Users,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const CATEGORIA_LABELS: Record<string, string> = {
  alimento: 'Alimento',
  cartones: 'Cartones',
  transporte: 'Transporte',
  medicamentos: 'Medicamentos',
  mantenimiento: 'Mantenimiento',
  servicios: 'Servicios',
  otros: 'Otros',
};

const CATEGORIA_COLORS: Record<string, string> = {
  alimento: '#f59e0b',
  cartones: '#f97316',
  transporte: '#3b82f6',
  medicamentos: '#ef4444',
  mantenimiento: '#8b5cf6',
  servicios: '#10b981',
  otros: '#6b7280',
};

interface MonthlyData {
  mes: string;
  produccion: { s: number; m: number; l: number; xl: number; total: number };
  ingresos: number;
  cobrado: number;
  pendiente: number;
  gastos: { categoria: string; total: number }[];
  totalGastos: number;
  utilidadNeta: number;
  topClientes: { nombre: string; telefono: string; total_comprado: number; cant_ventas: number }[];
  produccionDiaria: { fecha: string; total: number }[];
}

export default function ReportesPage() {
  const currentMonth = new Date().toISOString().substring(0, 7);
  const [mes, setMes] = useState(currentMonth);
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMonthly = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/dashboard/monthly?mes=${mes}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (error) {
      toast.error('Error cargando reporte mensual');
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    fetchMonthly();
  }, [fetchMonthly]);

  const mesLabel = () => {
    const [y, m] = mes.split('-');
    return format(new Date(parseInt(y), parseInt(m) - 1, 1), 'MMMM yyyy', { locale: es });
  };

  const exportCSV = () => {
    if (!data) return;
    const rows: string[][] = [
      ['REPORTE MENSUAL', mesLabel().toUpperCase()],
      [],
      ['=== PRODUCCIÓN ==='],
      ['Tamaño', 'Cantidad'],
      ['S (Pequeño)', String(data.produccion?.s || 0)],
      ['M (Mediano)', String(data.produccion?.m || 0)],
      ['L (Grande)', String(data.produccion?.l || 0)],
      ['XL (Extra Grande)', String(data.produccion?.xl || 0)],
      ['TOTAL', String(data.produccion?.total || 0)],
      [],
      ['=== FINANZAS ==='],
      ['Concepto', 'Monto'],
      ['Ingresos Totales', String(data.ingresos)],
      ['Cobrado', String(data.cobrado)],
      ['Pendiente de cobro', String(data.pendiente)],
      ['Total Gastos', String(data.totalGastos)],
      ['Utilidad Neta', String(data.utilidadNeta)],
      [],
      ['=== GASTOS POR CATEGORÍA ==='],
      ['Categoría', 'Total'],
      ...(data.gastos || []).map((g) => [CATEGORIA_LABELS[g.categoria] || g.categoria, String(g.total)]),
      [],
      ['=== TOP CLIENTES ==='],
      ['Cliente', 'Teléfono', 'Total Compras', 'Nro Ventas'],
      ...(data.topClientes || []).map((c) => [
        c.nombre,
        c.telefono,
        String(c.total_comprado),
        String(c.cant_ventas),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Reporte exportado correctamente');
  };

  const produccionData = [
    { name: 'S', cantidad: data?.produccion?.s || 0, fill: '#fbbf24' },
    { name: 'M', cantidad: data?.produccion?.m || 0, fill: '#f97316' },
    { name: 'L', cantidad: data?.produccion?.l || 0, fill: '#22c55e' },
    { name: 'XL', cantidad: data?.produccion?.xl || 0, fill: '#3b82f6' },
  ];

  const gastosChartData = (data?.gastos || []).map((g) => ({
    name: CATEGORIA_LABELS[g.categoria] || g.categoria,
    total: parseFloat(String(g.total)),
    fill: CATEGORIA_COLORS[g.categoria] || '#6b7280',
  }));

  return (
    <DashboardLayout title="Reportes Mensuales">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold capitalize text-gray-900 dark:text-white">{mesLabel()}</h2>
            <p className="text-sm text-gray-500">Reporte completo del mes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-yellow-500 outline-none"
            />
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
                  <Egg className="w-5 h-5 text-yellow-600" />
                </div>
                <p className="text-sm text-gray-500">Producción</p>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {(data?.produccion?.total || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">huevos totales</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-sm text-gray-500">Ingresos</p>
              </div>
              <p className="text-3xl font-bold text-green-600">
                ${(data?.ingresos || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                cobrado: ${(data?.cobrado || 0).toLocaleString()}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-sm text-gray-500">Gastos</p>
              </div>
              <p className="text-3xl font-bold text-red-500">
                ${(data?.totalGastos || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {(data?.gastos || []).length} categorías
              </p>
            </div>

            <div className={`rounded-2xl p-5 shadow-sm border ${
              (data?.utilidadNeta || 0) >= 0
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  (data?.utilidadNeta || 0) >= 0
                    ? 'bg-green-100 dark:bg-green-900/40'
                    : 'bg-red-100 dark:bg-red-900/40'
                }`}>
                  {(data?.utilidadNeta || 0) >= 0
                    ? <TrendingUp className="w-5 h-5 text-green-600" />
                    : <AlertCircle className="w-5 h-5 text-red-500" />
                  }
                </div>
                <p className="text-sm text-gray-500">Utilidad Neta</p>
              </div>
              <p className={`text-3xl font-bold ${
                (data?.utilidadNeta || 0) >= 0 ? 'text-green-600' : 'text-red-500'
              }`}>
                ${(data?.utilidadNeta || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">ingresos − gastos</p>
            </div>
          </div>

          {/* Producción por tamaño */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <Egg className="w-4 h-4 text-yellow-500" />
                Producción por Tamaño
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={produccionData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [value + ' huevos', 'Cantidad']}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="cantidad" radius={[6, 6, 0, 0]}>
                    {produccionData.map((entry, index) => (
                      <rect key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-4 gap-2 mt-4">
                {[
                  { size: 'S', val: data?.produccion?.s || 0, color: 'bg-yellow-400' },
                  { size: 'M', val: data?.produccion?.m || 0, color: 'bg-orange-400' },
                  { size: 'L', val: data?.produccion?.l || 0, color: 'bg-green-400' },
                  { size: 'XL', val: data?.produccion?.xl || 0, color: 'bg-blue-400' },
                ].map((item) => (
                  <div key={item.size} className="text-center">
                    <div className={`h-1.5 rounded-full ${item.color} mb-1`} />
                    <p className="text-xs text-gray-500">{item.size}</p>
                    <p className="text-sm font-bold">{item.val.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Gastos por categoría */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                Gastos por Categoría
              </h3>
              {gastosChartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <TrendingDown className="w-12 h-12 mb-2 opacity-30" />
                  <p className="text-sm">Sin gastos registrados</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={gastosChartData} layout="vertical" barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip
                      formatter={(value) => ['$' + Number(value).toLocaleString(), 'Monto']}
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]} fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Producción diaria */}
          {(data?.produccionDiaria || []).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Producción Diaria del Mes
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={(data?.produccionDiaria || []).map((d) => ({
                  dia: d.fecha.substring(8),
                  total: parseInt(String(d.total)),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [value + ' huevos', 'Producción']}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ fill: '#f59e0b', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Finanzas detalle + Top Clientes */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Resumen financiero */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-500" />
                Resumen Financiero
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Ingresos Totales', value: data?.ingresos || 0, color: 'text-green-600', bar: 'bg-green-400' },
                  { label: 'Cobrado', value: data?.cobrado || 0, color: 'text-blue-600', bar: 'bg-blue-400' },
                  { label: 'Pendiente de Cobro', value: data?.pendiente || 0, color: 'text-orange-500', bar: 'bg-orange-400' },
                  { label: 'Total Gastos', value: data?.totalGastos || 0, color: 'text-red-500', bar: 'bg-red-400' },
                ].map((item) => {
                  const maxVal = Math.max(data?.ingresos || 1, data?.totalGastos || 1);
                  const pct = Math.round((item.value / maxVal) * 100);
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                        <span className={`font-bold ${item.color}`}>${item.value.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                        <div className={`${item.bar} h-2 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}

                <div className={`mt-4 p-4 rounded-xl border-2 ${
                  (data?.utilidadNeta || 0) >= 0
                    ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                    : 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
                }`}>
                  <p className="text-sm text-gray-500">Utilidad Neta del Mes</p>
                  <p className={`text-2xl font-bold ${
                    (data?.utilidadNeta || 0) >= 0 ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {(data?.utilidadNeta || 0) >= 0 ? '+' : ''}${(data?.utilidadNeta || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Top clientes */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Top 5 Clientes del Mes
              </h3>
              {(data?.topClientes || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <Users className="w-12 h-12 mb-2 opacity-30" />
                  <p className="text-sm">Sin ventas este mes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(data?.topClientes || []).map((cliente, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                        i === 0 ? 'bg-yellow-500' :
                        i === 1 ? 'bg-gray-400' :
                        i === 2 ? 'bg-orange-400' :
                        'bg-gray-300 dark:bg-gray-600'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{cliente.nombre}</p>
                        <p className="text-xs text-gray-500">{cliente.cant_ventas} ventas · {cliente.telefono}</p>
                      </div>
                      <p className="font-bold text-green-600 flex-shrink-0">
                        ${parseFloat(String(cliente.total_comprado)).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
