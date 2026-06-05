'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { ArrowLeft, Phone, MapPin, DollarSign, CreditCard, CheckCircle, User, Calendar, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
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

interface Venta {
  id: string;
  fecha: string;
  total: number;
  pagado: number;
  saldo: number;
  estado: string;
  items: any[];
}

export default function ClienteDetallePage() {
  const params = useParams();
  const router = useRouter();
  const clienteId = params.id as string;

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagoModal, setPagoModal] = useState(false);
  const [pagoMonto, setPagoMonto] = useState(0);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);

  useEffect(() => {
    fetchData();
  }, [clienteId]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [clienteRes, ventasRes] = await Promise.all([
        axios.get(`${API_URL}/clientes/${clienteId}`, { headers }),
        axios.get(`${API_URL}/ventas`, { headers }),
      ]);

      setCliente(clienteRes.data.cliente);
      // Filtrar ventas de este cliente
      const clienteVentas = ventasRes.data.ventas.filter((v: any) => v.cliente_id === clienteId);
      setVentas(clienteVentas);
    } catch (error) {
      toast.error('Error cargando datos del cliente');
    } finally {
      setLoading(false);
    }
  };

  const handlePago = async () => {
    if (!cliente || pagoMonto <= 0) return;

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.post(`${API_URL}/clientes/${clienteId}/pagos`, {
        monto: pagoMonto,
        venta_id: selectedVenta?.id || null,
      }, { headers });

      toast.success('Pago registrado');
      setPagoModal(false);
      setPagoMonto(0);
      setSelectedVenta(null);
      fetchData();
    } catch (error) {
      toast.error('Error registrando pago');
    }
  };

  const openPagoModal = (venta?: Venta) => {
    setSelectedVenta(venta || null);
    setPagoMonto(venta ? venta.saldo : 0);
    setPagoModal(true);
  };

  const ventasPendientes = ventas.filter(v => v.saldo > 0);
  const ventasPagadas = ventas.filter(v => v.saldo <= 0);

  if (loading) {
    return (
      <DashboardLayout title="Cliente">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (!cliente) {
    return (
      <DashboardLayout title="Cliente">
        <div className="text-center py-12">
          <p className="text-gray-500">Cliente no encontrado</p>
          <button
            onClick={() => router.push('/clientes')}
            className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded-xl"
          >
            Volver
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={cliente.nombre}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/clientes')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold">{cliente.nombre}</h2>
      </div>

      {/* Info del Cliente */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <User className="w-7 h-7 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold">{cliente.nombre}</h3>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                  {cliente.telefono && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {cliente.telefono}
                    </span>
                  )}
                  {cliente.direccion && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {cliente.direccion}
                    </span>
                  )}
                </div>
                {cliente.observaciones && (
                  <p className="text-sm text-gray-400 mt-2">{cliente.observaciones}</p>
                )}
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${cliente.saldo > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  ${cliente.saldo.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">{cliente.saldo > 0 ? 'Saldo pendiente' : 'Al día'}</p>
              </div>
            </div>

            {cliente.saldo > 0 && (
              <button
                onClick={() => openPagoModal()}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600"
              >
                <DollarSign className="w-4 h-4" />
                Registrar Pago
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Facturas Pendientes */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-500" />
          Facturas Pendientes ({ventasPendientes.length})
        </h3>

        {ventasPendientes.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-500">No hay facturas pendientes</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {ventasPendientes.map((venta) => (
              <div key={venta.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">{format(parseISO(venta.fecha), 'dd/MM/yyyy')}</span>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">{venta.estado}</span>
                    </div>
                    <p className="font-semibold mt-1">Factura #{venta.id?.slice(0, 8)}</p>
                    <div className="text-sm text-gray-500 mt-1">
                      {venta.items?.map((item: any, i: number) => (
                        <span key={i}>
                          {item.cantidad}x Huevo {item.size}{i < venta.items.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-bold">${venta.total?.toLocaleString()}</p>
                    <p className="text-sm text-green-600">Pagado: ${venta.pagado?.toLocaleString()}</p>
                    <p className="text-sm text-red-500 font-medium">Saldo: ${venta.saldo?.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => openPagoModal(venta)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 text-sm w-full sm:w-auto justify-center"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pagar Factura
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial de Pagadas */}
      {ventasPagadas.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Historial de Pagadas ({ventasPagadas.length})
          </h3>
          <div className="grid gap-3">
            {ventasPagadas.map((venta) => (
              <div key={venta.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 opacity-70">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">{format(parseISO(venta.fecha), 'dd/MM/yyyy')}</span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">pagada</span>
                  </div>
                  <p className="font-medium">${venta.total?.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Pago */}
      {pagoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              {selectedVenta ? 'Pagar Factura' : 'Registrar Pago'}
            </h3>

            {selectedVenta && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 mb-4 text-sm">
                <p>Factura #{selectedVenta.id?.slice(0, 8)}</p>
                <p className="text-red-500 font-medium">Saldo: ${selectedVenta.saldo?.toLocaleString()}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Monto a pagar {selectedVenta && `(máx. $${selectedVenta.saldo?.toLocaleString()})`}
              </label>
              <input
                type="number"
                value={pagoMonto}
                onChange={(e) => setPagoMonto(Math.min(
                  parseFloat(e.target.value) || 0,
                  selectedVenta ? selectedVenta.saldo : cliente!.saldo
                ))}
                className="w-full px-4 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700 text-lg"
                min="0"
                max={selectedVenta ? selectedVenta.saldo : cliente!.saldo}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setPagoModal(false); setSelectedVenta(null); setPagoMonto(0); }}
                className="flex-1 py-3 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handlePago}
                disabled={pagoMonto <= 0}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50"
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
