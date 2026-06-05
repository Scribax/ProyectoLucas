'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Receipt,
  Plus,
  Trash2,
  Calendar,
  TrendingDown,
  Package,
  Truck,
  Pill,
  Wrench,
  Zap,
  HelpCircle,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const CATEGORIAS = [
  { value: 'alimento', label: 'Alimento', icon: Package, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'cartones', label: 'Cartones', icon: Package, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'transporte', label: 'Transporte', icon: Truck, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'medicamentos', label: 'Medicamentos', icon: Pill, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'mantenimiento', label: 'Mantenimiento', icon: Wrench, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'servicios', label: 'Servicios', icon: Zap, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'otros', label: 'Otros', icon: HelpCircle, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
];

interface Gasto {
  id: string;
  categoria: string;
  descripcion: string;
  monto: number;
  fecha: string;
}

interface GastosData {
  gastos: Gasto[];
  totalesPorCategoria: Record<string, number>;
  totalMes: number;
}

export default function GastosPage() {
  const currentMonth = new Date().toISOString().substring(0, 7);
  const [mes, setMes] = useState(currentMonth);
  const [data, setData] = useState<GastosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formCategoria, setFormCategoria] = useState('alimento');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formMonto, setFormMonto] = useState('');
  const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGastos();
  }, [mes]);

  const fetchGastos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/gastos?mes=${mes}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (error) {
      toast.error('Error cargando gastos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMonto || parseFloat(formMonto) <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/gastos`,
        {
          categoria: formCategoria,
          descripcion: formDescripcion,
          monto: parseFloat(formMonto),
          fecha: formFecha,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Gasto registrado');
      setModalOpen(false);
      setFormDescripcion('');
      setFormMonto('');
      setFormCategoria('alimento');
      setFormFecha(new Date().toISOString().split('T')[0]);
      fetchGastos();
    } catch (error) {
      toast.error('Error registrando gasto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      setDeleting(id);
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/gastos/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Gasto eliminado');
      fetchGastos();
    } catch (error) {
      toast.error('Error eliminando gasto');
    } finally {
      setDeleting(null);
    }
  };

  const getCategoriaInfo = (cat: string) =>
    CATEGORIAS.find((c) => c.value === cat) || CATEGORIAS[CATEGORIAS.length - 1];

  const mesLabel = () => {
    const [y, m] = mes.split('-');
    return format(new Date(parseInt(y), parseInt(m) - 1, 1), 'MMMM yyyy', { locale: es });
  };

  return (
    <DashboardLayout title="Gastos">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-orange-500 rounded-xl flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold capitalize text-gray-900 dark:text-white">{mesLabel()}</h2>
            <p className="text-sm text-gray-500">
              Total: <span className="font-semibold text-red-500">${(data?.totalMes || 0).toLocaleString()}</span>
            </p>
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
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Nuevo Gasto</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Resumen por categoría */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">Por categoría</h3>
              <div className="space-y-3">
                {CATEGORIAS.map((cat) => {
                  const total = data?.totalesPorCategoria?.[cat.value] || 0;
                  if (total === 0) return null;
                  const pct = data?.totalMes ? Math.round((total / data.totalMes) * 100) : 0;
                  return (
                    <div key={cat.value}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>
                          {cat.label}
                        </span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          ${total.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-red-400 to-orange-400 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {(data?.totalMes || 0) === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Sin gastos este mes</p>
                )}
              </div>
            </div>
          </div>

          {/* Lista de gastos */}
          <div className="lg:col-span-2">
            {(data?.gastos || []).length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700">
                <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No hay gastos registrados</p>
                <p className="text-gray-400 text-sm mt-1">Este mes no tiene gastos cargados</p>
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600"
                >
                  Agregar primero
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {data?.gastos.map((gasto) => {
                  const cat = getCategoriaInfo(gasto.categoria);
                  const Icon = cat.icon;
                  return (
                    <div
                      key={gasto.id}
                      className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 hover:shadow-md transition-shadow"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>
                            {cat.label}
                          </span>
                          <span className="text-xs text-gray-400">
                            {format(new Date(gasto.fecha + 'T12:00:00'), 'dd/MM/yyyy')}
                          </span>
                        </div>
                        <p className="font-medium text-gray-800 dark:text-gray-200 truncate mt-0.5">
                          {gasto.descripcion || cat.label}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <p className="text-lg font-bold text-red-500">
                          ${parseFloat(String(gasto.monto)).toLocaleString()}
                        </p>
                        <button
                          onClick={() => handleDelete(gasto.id)}
                          disabled={deleting === gasto.id}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-50"
                        >
                          {deleting === gasto.id ? (
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal crear gasto */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nuevo Gasto</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Categoría
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIAS.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormCategoria(cat.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        formCategoria === cat.value
                          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <cat.icon className="w-4 h-4" />
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  placeholder="Ej: Compra de maíz 50kg"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-yellow-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Monto *
                  </label>
                  <input
                    type="number"
                    value={formMonto}
                    onChange={(e) => setFormMonto(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-yellow-500 outline-none text-lg font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-yellow-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Guardar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
