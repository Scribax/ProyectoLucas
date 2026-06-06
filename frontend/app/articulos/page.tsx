'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Package, Plus, Search, DollarSign, Edit3, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Articulo {
  id: string;
  nombre: string;
  precio_unitario: number;
  is_active: boolean;
}

export default function ArticulosPage() {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Articulo | null>(null);
  const [form, setForm] = useState({ nombre: '', precio_unitario: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchArticulos();
  }, []);

  const fetchArticulos = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/articulos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setArticulos(res.data.articulos);
    } catch (error) {
      toast.error('Error cargando artículos');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (articulo: Articulo) => {
    setEditing(articulo);
    setForm({
      nombre: articulo.nombre,
      precio_unitario: String(articulo.precio_unitario)
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este artículo?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/articulos/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Artículo eliminado');
      fetchArticulos();
    } catch (error) {
      toast.error('Error al eliminar artículo');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre) {
      toast.error('El nombre es requerido');
      return;
    }
    const precio = parseFloat(form.precio_unitario) || 0;
    if (precio < 0) {
      toast.error('El precio no puede ser negativo');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (editing) {
        await axios.put(`${API_URL}/articulos/${editing.id}`, {
          nombre: form.nombre,
          precio_unitario: precio
        }, { headers });
        toast.success('Artículo actualizado');
      } else {
        await axios.post(`${API_URL}/articulos`, {
          nombre: form.nombre,
          precio_unitario: precio
        }, { headers });
        toast.success('Artículo creado');
      }

      setModalOpen(false);
      setEditing(null);
      setForm({ nombre: '', precio_unitario: '' });
      fetchArticulos();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Error al guardar artículo';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const filteredArticulos = articulos.filter(a =>
    a.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout title="Catálogo de Artículos">
      {/* Barra superior con buscar y agregar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar artículo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-yellow-500 outline-none"
          />
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setForm({ nombre: '', precio_unitario: '' });
            setModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nuevo Artículo</span>
        </button>
      </div>

      {/* Grid de artículos */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : filteredArticulos.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No hay artículos cargados</p>
          <p className="text-gray-400 text-sm mt-1">Agregá tu primer artículo para poder facturarlo</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredArticulos.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow flex justify-between items-center"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center text-yellow-600">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200">{a.nombre}</h3>
                  <p className="text-lg font-bold text-yellow-600 mt-1">
                    ${a.precio_unitario.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(a)}
                  className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                  title="Editar"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Agregar/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editing ? 'Editar Artículo' : 'Nuevo Artículo'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre del Artículo *
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Maple vacío de plástico"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-yellow-500 outline-none text-gray-950 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Precio Sugerido *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={form.precio_unitario}
                    onChange={(e) => setForm({ ...form, precio_unitario: e.target.value })}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-yellow-500 outline-none text-lg font-semibold text-gray-950 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
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
