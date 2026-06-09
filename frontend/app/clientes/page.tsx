'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Users, Plus, Search, Phone, MapPin, DollarSign, Eye, Trash2, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const buildWhatsAppUrl = (telefono: string, nombre: string, saldo: number) => {
  // Limpiar el número: quitar espacios, guiones, paréntesis, +
  let num = telefono.replace(/[\s\-\(\)\+]/g, '');
  // Si empieza con 0, sacar el 0
  if (num.startsWith('0')) num = num.slice(1);
  // Si no empieza con 549 ni 54, agregar 549
  if (!num.startsWith('549') && !num.startsWith('54')) num = '549' + num;
  else if (num.startsWith('54') && !num.startsWith('549')) num = '549' + num.slice(2);

  const mensaje = saldo > 0
    ? `Hola ${nombre}, te informamos que tenés un saldo pendiente de $${Number(saldo).toLocaleString()} con Granja Avícola. Cualquier consulta estamos a disposición. 🐣`
    : `Hola ${nombre}, te informamos que tu cuenta con Granja Avícola está al día. ¡Gracias por tu pago! 🐣`;

  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
};

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

  const deleteCliente = async (cliente: Cliente) => {
    if (cliente.saldo > 0) {
      toast.error('No se puede eliminar un cliente con saldo pendiente');
      return;
    }

    const ok = confirm(`¿Eliminar el cliente "${cliente.nombre}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/clientes/${cliente.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClientes((prev) => prev.filter((c) => c.id !== cliente.id));
      toast.success('Cliente eliminado');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error eliminando cliente');
    }
  };

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
                  <div className="mt-3 flex justify-end gap-2">
                    {c.telefono ? (
                      <a
                        href={buildWhatsAppUrl(c.telefono, c.nombre, c.saldo)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-xl border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600"
                        title="Enviar WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="p-2 rounded-xl border border-gray-200 dark:border-gray-600 opacity-30 cursor-not-allowed"
                        title="Sin teléfono cargado"
                      >
                        <MessageCircle className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteCliente(c); }}
                      disabled={c.saldo > 0}
                      className="p-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={c.saldo > 0 ? 'No se puede eliminar con saldo pendiente' : 'Eliminar cliente'}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
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
                  placeholder="Ej: 2604123456 o 5492604123456"
                  className="w-full px-4 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
                />
                <p className="text-xs text-gray-400 mt-1">Sin el 0 ni el 15. Se usará para WhatsApp.</p>
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
