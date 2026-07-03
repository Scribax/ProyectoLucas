'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Copy, DollarSign, MessageCircle, Phone, RefreshCw, Search, Send, UserRound } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface CobroPendiente {
  venta_id: string;
  cliente_id: string;
  cliente_nombre: string;
  telefono: string;
  telefono_whatsapp: string;
  fecha: string;
  total: number;
  pagado: number;
  saldo: number;
  estado: string;
  dias_vencida: number;
  mensaje: string;
  whatsapp_url: string;
  ultima_notificacion_at?: string | null;
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

export default function CobrosPage() {
  const [cobros, setCobros] = useState<CobroPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dias, setDias] = useState('5');
  const [registrando, setRegistrando] = useState<string | null>(null);

  useEffect(() => {
    fetchCobros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCobros = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/notificaciones/cobros-pendientes`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { dias },
      });
      setCobros(res.data.cobros || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error cargando cobros pendientes');
    } finally {
      setLoading(false);
    }
  };

  const filteredCobros = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return cobros;
    return cobros.filter((c) =>
      c.cliente_nombre.toLowerCase().includes(term) ||
      c.telefono.includes(term) ||
      c.venta_id.toLowerCase().includes(term)
    );
  }, [cobros, search]);

  const totalPendiente = useMemo(
    () => filteredCobros.reduce((sum, cobro) => sum + Number(cobro.saldo || 0), 0),
    [filteredCobros]
  );

  const copyMessage = async (mensaje: string) => {
    try {
      await navigator.clipboard.writeText(mensaje);
      toast.success('Mensaje copiado');
    } catch {
      toast.error('No se pudo copiar el mensaje');
    }
  };

  const registrarYEnviar = async (cobro: CobroPendiente) => {
    const win = window.open(cobro.whatsapp_url, '_blank', 'noopener,noreferrer');
    if (!win) {
      toast.error('Permití ventanas emergentes para abrir WhatsApp');
      return;
    }

    try {
      setRegistrando(cobro.venta_id);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/notificaciones/cobros-pendientes/${cobro.venta_id}/registrar`,
        { mensaje: cobro.mensaje, telefono: cobro.telefono },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Recordatorio registrado');
      fetchCobros();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'WhatsApp abrió, pero no se pudo registrar el recordatorio');
    } finally {
      setRegistrando(null);
    }
  };

  return (
    <DashboardLayout title="Cobros pendientes">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm text-gray-500">Facturas vencidas</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{filteredCobros.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm text-gray-500">Total por cobrar</p>
          <p className="text-3xl font-bold text-red-500">{formatMoney(totalPendiente)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm text-gray-500">Regla activa</p>
          <p className="text-3xl font-bold text-yellow-600">+{dias} días</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, teléfono o factura..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className="w-24 px-4 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
              title="Días mínimos vencidos"
            />
            <button
              type="button"
              onClick={fetchCobros}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-medium"
            >
              <RefreshCw className="w-5 h-5" />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : filteredCobros.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
          <MessageCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="font-semibold text-gray-900 dark:text-white">No hay cobros vencidos para notificar</p>
          <p className="text-sm text-gray-500 mt-1">Probá cambiar los días o verificá que los clientes tengan teléfono.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredCobros.map((cobro) => (
            <div key={cobro.venta_id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{cobro.cliente_nombre}</h3>
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        {cobro.dias_vencida} días vencida
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-2">
                      <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{cobro.telefono}</span>
                      <span className="flex items-center gap-1"><UserRound className="w-4 h-4" />Factura #{cobro.venta_id.slice(0, 8)}</span>
                      <span>{format(parseISO(cobro.fecha), 'dd/MM/yyyy')}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2 max-w-3xl">{cobro.mensaje}</p>
                    {cobro.ultima_notificacion_at && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                        Último recordatorio registrado: {format(parseISO(cobro.ultima_notificacion_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="xl:text-right flex-shrink-0">
                  <p className="text-sm text-gray-500">Saldo</p>
                  <p className="text-2xl font-bold text-red-500">{formatMoney(cobro.saldo)}</p>
                  <div className="flex xl:justify-end gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => copyMessage(cobro.mensaje)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar
                    </button>
                    <button
                      type="button"
                      onClick={() => registrarYEnviar(cobro)}
                      disabled={registrando === cobro.venta_id}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium"
                    >
                      <Send className="w-4 h-4" />
                      {registrando === cobro.venta_id ? 'Registrando...' : 'WhatsApp'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
