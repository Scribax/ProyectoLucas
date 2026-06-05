'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Home, Plus, Edit, Trash2, Egg, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Gallinero {
  id: string;
  name: string;
  description: string;
  chicken_count: number;
  status: string;
  produccion_hoy: number;
}

export default function GallinerosPage() {
  const [gallineros, setGallineros] = useState<Gallinero[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Gallinero | null>(null);
  const [form, setForm] = useState({ name: '', description: '', chicken_count: 0 });

  useEffect(() => {
    fetchGallineros();
  }, []);

  const fetchGallineros = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/gallineros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGallineros(res.data.gallineros);
    } catch (error) {
      toast.error('Error cargando gallineros');
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
        await axios.put(`${API_URL}/gallineros/${editing.id}`, form, { headers });
        toast.success('Gallinero actualizado');
      } else {
        await axios.post(`${API_URL}/gallineros`, form, { headers });
        toast.success('Gallinero creado');
      }

      setModalOpen(false);
      setEditing(null);
      setForm({ name: '', description: '', chicken_count: 0 });
      fetchGallineros();
    } catch (error) {
      toast.error('Error guardando');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este gallinero?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/gallineros/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Gallinero eliminado');
      fetchGallineros();
    } catch (error) {
      toast.error('Error eliminando');
    }
  };

  return (
    <DashboardLayout title="Gallineros">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Gestión de Gallineros</h2>
        <button
          onClick={() => { setEditing(null); setForm({ name: '', description: '', chicken_count: 0 }); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600"
        >
          <Plus className="w-5 h-5" />
          Nuevo
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : (
        <div className="grid gap-4">
          {gallineros.map((g) => (
            <div key={g.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
                    <Home className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{g.name}</h3>
                    <p className="text-sm text-gray-500">{g.description}</p>
                    <div className="flex gap-4 mt-3 text-sm">
                      <span className="flex items-center gap-1 text-gray-600">
                        <Home className="w-4 h-4" />
                        {g.chicken_count} gallinas
                      </span>
                      <span className="flex items-center gap-1 text-yellow-600">
                        <Egg className="w-4 h-4" />
                        {g.produccion_hoy} huevos hoy
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditing(g); setForm({ name: g.name, description: g.description, chicken_count: g.chicken_count }); setModalOpen(true); }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                  >
                    <Edit className="w-5 h-5 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editing ? 'Editar' : 'Nuevo'} Gallinero</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cantidad de Gallinas</label>
                <input
                  type="number"
                  value={form.chicken_count}
                  onChange={(e) => setForm({ ...form, chicken_count: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600"
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
