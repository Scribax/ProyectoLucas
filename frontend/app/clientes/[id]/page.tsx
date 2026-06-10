'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ArrowLeft, Phone, MapPin, DollarSign, CreditCard, CheckCircle,
  User, Calendar, FileText, Trash2, Download, Ban, ChevronDown, ChevronUp,
  TrendingUp, ShoppingBag, Clock, AlertTriangle, MessageCircle, Pencil
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const buildWhatsAppUrl = (telefono: string, nombre: string, saldo: number) => {
  let num = telefono.replace(/[\s\-\(\)\+]/g, '');
  if (num.startsWith('0')) num = num.slice(1);
  if (!num.startsWith('549') && !num.startsWith('54')) num = '549' + num;
  else if (num.startsWith('54') && !num.startsWith('549')) num = '549' + num.slice(2);
  const mensaje = saldo > 0
    ? `Hola ${nombre}, te informamos que tenés un saldo pendiente de $${Number(saldo).toLocaleString()} con Granja Avícola. Cualquier consulta estamos a disposición. 🐣`
    : `Hola ${nombre}, te informamos que tu cuenta con Granja Avícola está al día. ¡Gracias por tu pago! 🐣`;
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
};

const SIZE_LABELS: Record<string, string> = {
  S: 'Chico', M: 'Mediano', L: 'Grande', XL: 'Extra Grande',
};

interface Cliente {
  id: string; nombre: string; telefono: string;
  direccion: string; observaciones: string; saldo: number;
}

interface Venta {
  id: string; fecha: string; total: number; pagado: number;
  saldo: number; estado: string; is_void: boolean;
  void_reason?: string; voided_at?: string; items: any[];
}

interface Pago {
  id: string; fecha: string; monto: number; metodo: string;
  observaciones?: string; venta_id?: string;
}

interface Estadisticas {
  total_ventas: string; total_comprado: string;
  total_pagado: string; saldo_pendiente: string;
}

export default function ClienteDetallePage() {
  const params = useParams();
  const router = useRouter();
  const clienteId = params.id as string;

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [ventasAnuladas, setVentasAnuladas] = useState<Venta[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnuladas, setShowAnuladas] = useState(false);
  const [pagoModal, setPagoModal] = useState(false);
  const [pagoMonto, setPagoMonto] = useState(0);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ nombre: '', telefono: '', direccion: '', observaciones: '' });

  useEffect(() => { fetchData(); }, [clienteId]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const clienteRes = await axios.get(`${API_URL}/clientes/${clienteId}`, { headers });
      setCliente(clienteRes.data.cliente);
      setVentas(clienteRes.data.ventas || []);
      setVentasAnuladas(clienteRes.data.ventas_anuladas || []);
      setPagos(clienteRes.data.pagos || []);
      setEstadisticas(clienteRes.data.estadisticas || null);
    } catch { toast.error('Error cargando datos del cliente'); }
    finally { setLoading(false); }
  };

  const openEditModal = () => {
    if (!cliente) return;
    setEditForm({
      nombre: cliente.nombre || '',
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || '',
      observaciones: cliente.observaciones || '',
    });
    setEditModal(true);
  };

  const handleEdit = async () => {
    if (!cliente || !editForm.nombre.trim()) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/clientes/${clienteId}`, editForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Cliente actualizado');
      setEditModal(false);
      fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error actualizando cliente');
    }
  };

  const handlePago = async () => {
    if (!cliente || pagoMonto <= 0) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/clientes/${clienteId}/pagos`,
        { monto: pagoMonto, venta_id: selectedVenta?.id || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Pago registrado');
      setPagoModal(false); setPagoMonto(0); setSelectedVenta(null);
      fetchData();
    } catch { toast.error('Error registrando pago'); }
  };

  const openPagoModal = (venta?: Venta) => {
    setSelectedVenta(venta || null);
    setPagoMonto(venta ? venta.saldo : (cliente?.saldo || 0));
    setPagoModal(true);
  };

  const escapeHtml = (value: any) => {
    const str = String(value ?? '');
    return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  };

  const viewFactura = async (ventaId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/ventas/${ventaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const venta = res.data?.venta;
      if (!venta) { toast.error('No se pudo cargar la factura'); return; }

      const itemsHtml = (venta.items || []).map((item: any) => {
        const nombre = item.descripcion || item.articulo_nombre ||
          (item.size ? `Huevo ${SIZE_LABELS[item.size] || item.size}` : 'Articulo');
        return `<tr><td>${escapeHtml(nombre)}</td><td>${escapeHtml(item.cantidad)}</td><td>$${escapeHtml(item.precio_unitario)}</td><td>$${escapeHtml(item.subtotal)}</td></tr>`;
      }).join('');

      const voidBanner = venta.is_void ? `
        <div style="background:#fef2f2;border:2px solid #ef4444;padding:12px;text-align:center;margin-bottom:20px;border-radius:8px;">
          <span style="color:#dc2626;font-weight:bold;font-size:18px;">FACTURA ANULADA</span>
          ${venta.void_reason ? `<p style="color:#dc2626;margin:6px 0 0;font-size:14px;">Motivo: ${escapeHtml(venta.void_reason)}</p>` : ''}
        </div>` : '';

      const html = `<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Factura #${escapeHtml(venta.id?.slice(0, 8))}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:0 auto}
          .header{text-align:center;border-bottom:3px solid #eab308;padding-bottom:20px;margin-bottom:20px}
          .header h1{margin:0;color:#333}.header p{color:#666;margin:5px 0}
          table{width:100%;border-collapse:collapse;margin:20px 0}
          th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd}
          th{background:#f5f5f5}.total{font-size:22px;font-weight:bold;text-align:right;margin-top:20px}
          .footer{text-align:center;margin-top:40px;color:#666;font-size:14px}
          @media print{button{display:none}}
        </style></head><body>
        ${voidBanner}
        <div class="header"><h1>GRANJA AVICOLA</h1><p>Factura de Venta</p><p>#${escapeHtml(venta.id?.slice(0, 8))}</p></div>
        <p><strong>Cliente:</strong> ${escapeHtml(venta.cliente_nombre || cliente?.nombre || '')}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(format(parseISO(venta.fecha), 'dd/MM/yyyy HH:mm'))}</p>
        <table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>${itemsHtml}</tbody></table>
        <div class="total">TOTAL: $${escapeHtml(Number(venta.total || 0).toLocaleString())}<br>
          <span style="font-size:16px">Pagado: $${escapeHtml(Number(venta.pagado || 0).toLocaleString())}</span><br>
          ${(Number(venta.saldo) || 0) > 0 && !venta.is_void ? `<span style="font-size:16px;color:red">Saldo: $${escapeHtml(Number(venta.saldo || 0).toLocaleString())}</span>` : ''}
        </div>
        <div class="footer"><p>Gracias por su compra!</p></div>
        <button onclick="window.print()" style="width:100%;padding:15px;background:#eab308;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;margin-top:20px">
          Imprimir / Guardar PDF
        </button></body></html>`;

      // Usamos Blob URL en lugar de window.open + document.write
      // Esto es compatible con Safari/iOS que bloquea about:blank con document.write
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');

      // Liberar la URL del blob cuando la ventana cargue (o tras 60s como fallback)
      if (newWindow) {
        newWindow.addEventListener('load', () => URL.revokeObjectURL(url));
      } else {
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error cargando factura');
    }
  };

  const deleteCliente = async () => {
    if (!cliente) return;
    if (cliente.saldo > 0) { toast.error('No se puede eliminar un cliente con saldo pendiente'); return; }
    const ok = confirm(`Eliminar el cliente "${cliente.nombre}"? Esta accion no se puede deshacer.`);
    if (!ok) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/clientes/${cliente.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
          <button onClick={() => router.push('/clientes')} className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded-xl">Volver</button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={cliente.nombre}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/clientes')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold">{cliente.nombre}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openEditModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600">
            <Pencil className="w-4 h-4" />Editar
          </button>
          <button onClick={deleteCliente} disabled={cliente.saldo > 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title={cliente.saldo > 0 ? 'No se puede eliminar con saldo pendiente' : 'Eliminar cliente'}>
            <Trash2 className="w-4 h-4" />Eliminar
          </button>
        </div>
      </div>

      {/* Info del Cliente */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-5">
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
                    <a
                      href={buildWhatsAppUrl(cliente.telefono, cliente.nombre, cliente.saldo)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-green-600 hover:text-green-700 transition-colors"
                      title="Abrir WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />{cliente.telefono}
                    </a>
                  )}
                  {cliente.direccion && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{cliente.direccion}</span>}
                </div>
                {cliente.observaciones && <p className="text-sm text-gray-400 mt-2">{cliente.observaciones}</p>}
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${cliente.saldo > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  ${Number(cliente.saldo).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">{cliente.saldo > 0 ? 'Saldo pendiente' : 'Al dia'}</p>
              </div>
            </div>
            {cliente.saldo > 0 && (
              <button onClick={() => openPagoModal()}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600">
                <DollarSign className="w-4 h-4" />Registrar Pago
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Estadisticas */}
      {estadisticas && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { icon: <ShoppingBag className="w-5 h-5 text-blue-500" />, label: 'Total ventas', value: estadisticas.total_ventas || '0', color: 'text-blue-600' },
            { icon: <TrendingUp className="w-5 h-5 text-purple-500" />, label: 'Total comprado', value: `$${Number(estadisticas.total_comprado || 0).toLocaleString()}`, color: 'text-purple-600' },
            { icon: <CheckCircle className="w-5 h-5 text-green-500" />, label: 'Total pagado', value: `$${Number(estadisticas.total_pagado || 0).toLocaleString()}`, color: 'text-green-600' },
            { icon: <Clock className="w-5 h-5 text-red-500" />, label: 'Saldo pendiente', value: `$${Number(estadisticas.saldo_pendiente || 0).toLocaleString()}`, color: Number(estadisticas.saldo_pendiente) > 0 ? 'text-red-600' : 'text-green-600' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">{stat.icon}</div>
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Facturas Pendientes */}
      <div className="mb-5">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-500" />
          Facturas Pendientes ({ventasPendientes.length})
        </h3>
        {ventasPendientes.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-500">No hay facturas pendientes</p>
          </div>
        ) : (
          <div className="grid gap-3">
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
                      {venta.items?.filter((i: any) => i?.id).map((item: any, i: number) => {
                        const detalle = item.descripcion || (item.size ? `Huevo ${SIZE_LABELS[item.size] || item.size}` : 'Articulo');
                        return <span key={i}>{item.cantidad}x {detalle}{i < venta.items.length - 1 ? ', ' : ''}</span>;
                      })}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-bold">${Number(venta.total).toLocaleString()}</p>
                    <p className="text-sm text-green-600">Pagado: ${Number(venta.pagado).toLocaleString()}</p>
                    <p className="text-sm text-red-500 font-medium">Saldo: ${Number(venta.saldo).toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button onClick={() => openPagoModal(venta)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 text-sm">
                    <CreditCard className="w-4 h-4" />Pagar Factura
                  </button>
                  <button onClick={() => viewFactura(venta.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 text-sm">
                    <Download className="w-4 h-4" />Ver Factura
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial de Pagos */}
      {pagos.length > 0 && (
        <div className="mb-5">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            Historial de Pagos ({pagos.length})
          </h3>
          <div className="grid gap-2">
            {pagos.map((pago) => (
              <div key={pago.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {pago.metodo ? pago.metodo.charAt(0).toUpperCase() + pago.metodo.slice(1) : 'Efectivo'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(parseISO(pago.fecha), 'dd/MM/yyyy HH:mm')}
                      {pago.venta_id && <span className="ml-2">· Factura #{pago.venta_id.slice(0, 8)}</span>}
                    </p>
                    {pago.observaciones && <p className="text-xs text-gray-400 italic">{pago.observaciones}</p>}
                  </div>
                </div>
                <p className="font-bold text-green-600 text-lg">${Number(pago.monto).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ventas Pagadas */}
      {ventasPagadas.length > 0 && (
        <div className="mb-5">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Ventas Pagadas ({ventasPagadas.length})
          </h3>
          <div className="grid gap-2">
            {ventasPagadas.map((venta) => (
              <div key={venta.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">#{venta.id?.slice(0, 8)}</p>
                      <p className="text-xs text-gray-400">{format(parseISO(venta.fecha), 'dd/MM/yyyy')}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Pagada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">${Number(venta.total).toLocaleString()}</p>
                    <button onClick={() => viewFactura(venta.id)}
                      className="p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 text-yellow-600 rounded-lg transition-colors"
                      title="Ver factura">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ventas Anuladas (toggle) */}
      {ventasAnuladas.length > 0 && (
        <div className="mb-5">
          <button onClick={() => setShowAnuladas(!showAnuladas)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-400">
              <Ban className="w-4 h-4" />Ventas Anuladas ({ventasAnuladas.length})
            </span>
            {showAnuladas ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showAnuladas && (
            <div className="grid gap-2 mt-2">
              {ventasAnuladas.map((venta) => (
                <div key={venta.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-red-100 dark:border-red-900/30 opacity-70">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-500">{format(parseISO(venta.fecha), 'dd/MM/yyyy')}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                          <Ban className="w-3 h-3" />Anulada
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1">#{venta.id?.slice(0, 8)}</p>
                      {venta.void_reason && <p className="text-xs text-gray-400 mt-0.5 italic">Motivo: {venta.void_reason}</p>}
                      {venta.voided_at && (
                        <p className="text-xs text-gray-400">Anulada el {format(parseISO(venta.voided_at), 'dd/MM/yyyy HH:mm')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium line-through text-gray-400">${Number(venta.total).toLocaleString()}</p>
                      <button onClick={() => viewFactura(venta.id)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 rounded-lg transition-colors"
                        title="Ver factura">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sin actividad */}
      {ventas.length === 0 && ventasAnuladas.length === 0 && pagos.length === 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-10 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Sin actividad registrada</p>
          <p className="text-gray-400 text-sm mt-1">Aun no hay ventas ni pagos para este cliente.</p>
        </div>
      )}

      {/* Modal de Edición */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Editar Cliente</h3>
            <div className="grid gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  type="text"
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
                  placeholder="Nombre del cliente"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <input
                  type="text"
                  value={editForm.telefono}
                  onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
                  placeholder="Ej: 2604123456"
                />
                <p className="text-xs text-gray-400 mt-1">Sin el 0 ni el 15. Se usará para WhatsApp.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Dirección</label>
                <input
                  type="text"
                  value={editForm.direccion}
                  onChange={(e) => setEditForm({ ...editForm, direccion: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
                  placeholder="Dirección (opcional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Observaciones</label>
                <textarea
                  value={editForm.observaciones}
                  onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700 resize-none"
                  rows={2}
                  placeholder="Observaciones (opcional)"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setEditModal(false)}
                className="flex-1 py-3 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancelar
              </button>
              <button onClick={handleEdit} disabled={!editForm.nombre.trim()}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pago */}
      {pagoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">
              {selectedVenta ? 'Pagar Factura' : 'Registrar Pago'}
            </h3>
            {selectedVenta && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 mb-4 text-sm">
                <p>Factura #{selectedVenta.id?.slice(0, 8)}</p>
                <p className="text-red-500 font-medium">Saldo: ${Number(selectedVenta.saldo).toLocaleString()}</p>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Monto a pagar{selectedVenta ? ` (max. $${Number(selectedVenta.saldo).toLocaleString()})` : ''}
              </label>
              <input type="number" value={pagoMonto}
                onChange={(e) => setPagoMonto(Math.min(
                  parseFloat(e.target.value) || 0,
                  selectedVenta ? selectedVenta.saldo : cliente!.saldo
                ))}
                className="w-full px-4 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700 text-lg"
                min="0" max={selectedVenta ? selectedVenta.saldo : cliente!.saldo} autoFocus />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setPagoModal(false); setSelectedVenta(null); setPagoMonto(0); }}
                className="flex-1 py-3 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancelar
              </button>
              <button onClick={handlePago} disabled={pagoMonto <= 0}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50">
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
