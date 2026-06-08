'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { ArrowLeft, Phone, MapPin, DollarSign, CreditCard, CheckCircle, User, Calendar, FileText, Trash2, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const SIZE_LABELS: Record<string, string> = {
  S: 'Chico',
  M: 'Mediano',
  L: 'Grande',
  XL: 'Extra Grande',
};

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

  const escapeHtml = (value: any) => {
    const str = String(value ?? '');
    return str
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };

  const viewFactura = async (ventaId: string) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/ventas/${ventaId}`, { headers });
      const venta = res.data?.venta;

      if (!venta) {
        toast.error('No se pudo cargar la factura');
        return;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const getEggFriendlyName = (size: string) => {
        return SIZE_LABELS[size] || size;
      };

      const itemsHtml = (venta.items || []).map((item: any) => {
        const nombre =
          item.descripcion ||
          item.articulo_nombre ||
          (item.size ? `Huevo ${getEggFriendlyName(item.size)}` : 'Artículo');

        return `
          <tr>
            <td>${escapeHtml(nombre)}</td>
            <td>${escapeHtml(item.cantidad)}</td>
            <td>$${escapeHtml(item.precio_unitario)}</td>
            <td>$${escapeHtml(item.subtotal)}</td>
          </tr>
        `;
      }).join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Factura #${escapeHtml(venta.id?.slice(0, 8))}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 3px solid #eab308; padding-bottom: 20px; margin-bottom: 20px; }
            .header h1 { margin: 0; color: #333; }
            .header p { color: #666; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f5f5f5; }
            .total { font-size: 22px; font-weight: bold; text-align: right; margin-top: 20px; }
            .footer { text-align: center; margin-top: 40px; color: #666; font-size: 14px; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>GRANJA AVÍCOLA</h1>
            <p>Factura de Venta</p>
            <p>#${escapeHtml(venta.id?.slice(0, 8))}</p>
          </div>
          <p><strong>Cliente:</strong> ${escapeHtml(venta.cliente_nombre || cliente?.nombre || '')}</p>
          <p><strong>Fecha:</strong> ${escapeHtml(format(parseISO(venta.fecha), 'dd/MM/yyyy HH:mm'))}</p>
          <table>
            <thead>
              <tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="total">
            TOTAL: $${escapeHtml(Number(venta.total || 0).toLocaleString())}<br>
            <span style="font-size: 16px;">Pagado: $${escapeHtml(Number(venta.pagado || 0).toLocaleString())}</span><br>
            ${(Number(venta.saldo) || 0) > 0 ? `<span style="font-size: 16px; color: red;">Saldo: $${escapeHtml(Number(venta.saldo || 0).toLocaleString())}</span>` : ''}
          </div>
          <div class="footer">
            <p>¡Gracias por su compra!</p>
          </div>
          <button onclick="window.print()" style="width: 100%; padding: 15px; background: #eab308; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 20px;">
            Imprimir / Guardar PDF
          </button>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error cargando factura');
    }
  };

  const deleteCliente = async () => {
    if (!cliente) return;
    if (cliente.saldo > 0) {
      toast.error('No se puede eliminar un cliente con saldo pendiente');
      return;
    }

    const ok = confirm(`¿Eliminar el cliente "${cliente.nombre}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API_URL}/clientes/${cliente.id}`, { headers });
      toast.success('Cliente eliminado');
      router.push('/clientes');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error eliminando cliente');
    }
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
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/clientes')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold">{cliente.nombre}</h2>
        </div>
        <button
          onClick={deleteCliente}
          disabled={cliente.saldo > 0}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          title={cliente.saldo > 0 ? 'No se puede eliminar con saldo pendiente' : 'Eliminar cliente'}
        >
          <Trash2 className="w-4 h-4" />
          Eliminar
        </button>
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
                      {venta.items?.map((item: any, i: number) => {
                        const getEggFriendlyName = (size: string) => {
                          return SIZE_LABELS[size] || size;
                        };
                        const detalle = item.descripcion || (item.size ? `Huevo ${getEggFriendlyName(item.size)}` : 'Artículo');
                        return (
                          <span key={i}>
                            {item.cantidad}x {detalle}{i < venta.items.length - 1 ? ', ' : ''}
                          </span>
                        );
                      })}
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
                  <button
                    onClick={() => viewFactura(venta.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 text-sm w-full sm:w-auto justify-center"
                  >
                    <Download className="w-4 h-4" />
                    Ver Factura
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
