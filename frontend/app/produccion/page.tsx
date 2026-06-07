'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Egg, Plus, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Gallinero {
  id: string;
  name: string;
}

interface ProduccionForm {
  gallinero_id: string;
  fecha: string;
  S: number;
  M: number;
  L: number;
  XL: number;
}

export default function ProduccionPage() {
  const [gallineros, setGallineros] = useState<Gallinero[]>([]);
  const [fecha, setFecha] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [produccion, setProduccion] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedGallinero, setSelectedGallinero] = useState<Gallinero | null>(null);
  const [form, setForm] = useState({ S: 0, M: 0, L: 0, XL: 0 });
  // Strings para los inputs (permite borrar el 0 y escribir libremente)
  const [formStr, setFormStr] = useState({ S: '0', M: '0', L: '0', XL: '0' });


  useEffect(() => {
    fetchGallineros();
  }, []);

  useEffect(() => {
    fetchProduccionDia();
  }, [fecha]);

  const fetchGallineros = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/gallineros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGallineros(res.data.gallineros);
    } catch (error) {
      toast.error('Error cargando gallineros');
    }
  };

  const fetchProduccionDia = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/produccion?fecha=${fecha}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Convertir array a map por gallinero_id
      const prodMap: Record<string, any> = {};
      (res.data.produccion || []).forEach((p: any) => {
        prodMap[p.gallinero_id] = {
          S: parseInt(p.S || p.s) || 0,
          M: parseInt(p.M || p.m) || 0,
          L: parseInt(p.L || p.l) || 0,
          XL: parseInt(p.XL || p.xl) || 0,
        };
      });
      setProduccion(prodMap);
    } catch (error) {
      // No hacer toast aquí para no molestar si simplemente no hay producción
      console.error('Error cargando producción:', error);
      setProduccion({});
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (gallinero: Gallinero) => {
    setSelectedGallinero(gallinero);
    const existente = produccion[gallinero.id] || {};
    const s = existente.S || 0;
    const m = existente.M || 0;
    const l = existente.L || 0;
    const xl = existente.XL || 0;
    setForm({ S: s, M: m, L: l, XL: xl });
    setFormStr({ S: String(s), M: String(m), L: String(l), XL: String(xl) });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGallinero) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/gallineros/${selectedGallinero.id}/produccion`,
        {
          fecha,
          produccion: {
            S: Number(form.S) || 0,
            M: Number(form.M) || 0,
            L: Number(form.L) || 0,
            XL: Number(form.XL) || 0,
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('¡Producción guardada!');
      setModalOpen(false);
      fetchProduccionDia();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Error guardando producción';
      toast.error(msg);
      console.error('Error guardando producción:', error.response?.data);
    }
  };


  const calcularTotal = (p: any) => (p?.S || 0) + (p?.M || 0) + (p?.L || 0) + (p?.XL || 0);

  return (
    <DashboardLayout title="Producción Diaria">
      {/* Selector de fecha */}
      <div className="flex items-center justify-between mb-6 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm">
        <button
          onClick={() => setFecha(format(subDays(parseISO(fecha), 1), 'yyyy-MM-dd'))}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-yellow-500" />
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="font-semibold text-lg bg-transparent border-none focus:outline-none text-gray-900 dark:text-white"
          />
        </div>
        <button
          onClick={() => setFecha(format(addDays(parseISO(fecha), 1), 'yyyy-MM-dd'))}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {['S', 'M', 'L', 'XL'].map((size) => {
          const total = Object.values(produccion).reduce((sum: number, p: any) => sum + (p?.[size] || 0), 0);
          const colors: Record<string, string> = {
            S: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30',
            M: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30',
            L: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30',
            XL: 'bg-red-100 text-red-800 dark:bg-red-900/30',
          };
          const labels: Record<string, string> = {
            S: 'Chico',
            M: 'Mediano',
            L: 'Grande',
            XL: 'Extra',
          };
          return (
            <div key={size} className={`${colors[size]} rounded-2xl p-4 text-center`}>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs font-medium">Huevo {labels[size]}</p>
            </div>
          );
        })}
      </div>

      {/* Lista de gallineros */}
      <div className="grid gap-4">
        {gallineros.map((g) => {
          const p = produccion[g.id];
          const total = calcularTotal(p);
          return (
            <div
              key={g.id}
              onClick={() => handleOpenModal(g)}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
                    <Egg className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{g.name}</h3>
                    <div className="flex gap-3 text-sm text-gray-500 mt-1">
                      {p ? (
                        <>
                          <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">Chico: {p.S || 0}</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">Mediano: {p.M || 0}</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-800">Grande: {p.L || 0}</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">Extra: {p.XL || 0}</span>
                        </>
                      ) : (
                        <span className="text-gray-400">Sin producción registrada</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-yellow-600">{total}</p>
                  <p className="text-xs text-gray-500">huevos</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modalOpen && selectedGallinero && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-1">{selectedGallinero.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{format(parseISO(fecha), 'EEEE d MMMM', { locale: es })}</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {['S', 'M', 'L', 'XL'].map((size) => {
                  const labels: Record<string, string> = {
                    S: 'Chico',
                    M: 'Mediano',
                    L: 'Grande',
                    XL: 'Extra',
                  };
                  return (
                    <div key={size}>
                      <label className="block text-sm font-medium mb-1">Huevo {labels[size]}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formStr[size as keyof typeof formStr]}
                        onFocus={(e) => {
                          if (formStr[size as keyof typeof formStr] === '0') {
                            setFormStr({ ...formStr, [size]: '' });
                          }
                          e.target.select();
                        }}
                        onBlur={() => {
                          const val = formStr[size as keyof typeof formStr];
                          if (!val || val === '') {
                            setFormStr({ ...formStr, [size]: '0' });
                            setForm({ ...form, [size]: 0 });
                          }
                        }}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setFormStr({ ...formStr, [size]: raw });
                          setForm({ ...form, [size]: parseInt(raw) || 0 });
                        }}
                        className="w-full px-4 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700 text-lg text-center"
                        autoFocus={size === 'S'}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500">Total estimado</p>
                <p className="text-3xl font-bold text-yellow-600">{form.S + form.M + form.L + form.XL}</p>
              </div>
              <div className="flex gap-3">
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
