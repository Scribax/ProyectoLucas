'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Users, Plus, Search, Phone, MapPin, DollarSign, Eye } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  direccion: string;
  observaciones: string;
  saldo: number;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState({ nombre: '', telefono: '', direccion: '', observaciones: '' });

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/clientes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClientes(res.data.clientes);
    } catch (error) {
      toast.error('Error cargando clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (editing) {
        await axios.put(`${API_URL}/clientes/${editing.id}`, form, { headers });
        toast.success('Cliente actualizado');
      } else {
        await axios.post(`${API_URL}/clientes`, form, { headers });
        toast.success('Cliente creado');
      }

      setModalOpen(false);
      setEditing(null);
      setForm({ nombre: '', telefono: '', direccion: '', observaciones: '' });
      fetchClientes();
    } catch (error) {
      toast.error('Error guardando cliente');
    }
  };

  const filteredClientes = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.telefono.includes(search)
  );

  return (
    <DashboardLayout title="Clientes">
      {/* Search y Nuevo */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
          />
        </div>
        <button
          onClick={() => { setEditing(null); setForm({ nombre: '', telefono: '', direccion: '', observaciones: '' }); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-3 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Nuevo</span>
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredClientes.map((c) => (
            <Link
              key={c.id}
              href={`/clientes/${c.id}`}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{c.nombre}</h3>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-2">
                      {c.telefono && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {c.telefono}
                        </span>
                      )}
                      {c.direccion && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {c.direccion}
                        </span>
                      )}
                    </div>
                    {c.observaciones && (
                      <p className="text-sm text-gray-400 mt-2">{c.observaciones}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${c.saldo > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {c.saldo > 0 ? `$${c.saldo.toLocaleString()}` : 'Al día'}
                  </div>
                  {c.saldo > 0 && <p className="text-xs text-red-400">Saldo pendiente</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editing ? 'Editar' : 'Nuevo'} Cliente</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Dirección</label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Observaciones</label>
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
