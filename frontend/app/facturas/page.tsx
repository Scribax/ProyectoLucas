'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Download, Search, Trash2, Filter, Ban, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const SIZE_LABELS: Record<string, string> = {
  S: 'Chico', M: 'Mediano', L: 'Grande', XL: 'Extra Grande',
};

export default function FacturasPage() {
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showFilters, setShowFilters] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [incluirAnuladas, setIncluirAnuladas] = useState(false);

  const [voidModal, setVoidModal] = useState<any>(null);
  const [voidMotivo, setVoidMotivo] = useState('');
  const [voidSaving, setVoidSaving] = useState(false);

  useEffect(() => { fetchVentas(); }, [filtroEstado, filtroDesde, filtroHasta, incluirAnuladas]);

  const fetchVentas = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params: Record<string, string> = {};
      if (filtroEstado) params.estado = filtroEstado;
      if (filtroDesde) params.desde = filtroDesde;
      if (filtroHasta) params.hasta = `${filtroHasta}T23:59:59`;
      if (incluirAnuladas) params.incluir_anuladas = 'true';
      const res = await axios.get(`${API_URL}/ventas`, {
        headers: { Authorization: `Bearer ${token}` }, params,
      });
      setVentas(res.data.ventas);
    } catch { toast.error('Error cargando ventas'); }
    finally { setLoading(false); }
  };

  const filteredVentas = ventas.filter((v: any) =>
    v.cliente_nombre?.toLowerCase().includes(search.toLowerCase())
  );

  const clearFilters = () => { setFiltroEstado(''); setFiltroDesde(''); setFiltroHasta(''); setIncluirAnuladas(false); };
  const hasActiveFilters = filtroEstado || filtroDesde || filtroHasta || incluirAnuladas;

  const openVoidModal = (venta: any) => { setVoidModal(venta); setVoidMotivo(''); };

  const confirmVoid = async () => {
    if (!voidModal) return;
    try {
      setVoidSaving(true);
      const token = localStorage.getItem('token');
      await axios.patch(`${API_URL}/ventas/${voidModal.id}/anular`,
        { motivo: voidMotivo.trim() || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Factura anulada');
      setVoidModal(null); setVoidMotivo('');
      fetchVentas();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error anulando factura');
    } finally { setVoidSaving(false); }
  };

  const downloadInvoice = (venta: any) => {
    const getEggFriendlyName = (size?: string) => size ? `Huevo ${SIZE_LABELS[size] || size}` : 'Artículo';
    const itemsHtml = venta.items?.map((item: any) =>
      `<tr><td>${item.descripcion || item.articulo_nombre || getEggFriendlyName(item.size)}</td><td>${item.cantidad}</td><td>$${item.precio_unitario}</td><td>$${item.subtotal}</td></tr>`
    ).join('') || '';
    const voidBanner = venta.is_void ? `
      <div style="background:#fef2f2;border:2px solid #ef4444;padding:12px;text-align:center;margin-bottom:20px;border-radius:8px;">
        <span style="color:#dc2626;font-weight:bold;font-size:18px;">FACTURA ANULADA</span>
        ${venta.void_reason ? `<p style="color:#dc2626;margin:6px 0 0;font-size:14px;">Motivo: ${venta.void_reason}</p>` : ''}
      </div>` : '';

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Factura #${venta.id?.slice(0, 8)}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;max-width:600px;margin:0 auto}
        .header{text-align:center;border-bottom:3px solid #eab308;padding-bottom:20px;margin-bottom:20px}
        .header h1{margin:0;color:#333}.header p{color:#666;margin:5px 0}
        table{width:100%;border-collapse:collapse;margin:20px 0}
        th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd}
        th{background:#f5f5f5}.total{font-size:24px;font-weight:bold;text-align:right;margin-top:20px}
        .footer{text-align:center;margin-top:40px;color:#666;font-size:14px}
        @media print{button{display:none}}
      </style></head><body>
      ${voidBanner}
      <div class="header"><h1>GRANJA AVICOLA</h1><p>Factura de Venta</p><p>#${venta.id?.slice(0, 8)}</p></div>
      <p><strong>Cliente:</strong> ${venta.cliente_nombre}</p>
      <p><strong>Fecha:</strong> ${format(parseISO(venta.fecha), 'dd/MM/yyyy HH:mm')}</p>
      <table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
      <tbody>${itemsHtml}</tbody></table>
      <div class="total">TOTAL: $${venta.total?.toLocaleString()}<br>
        <span style="font-size:16px">Pagado: $${venta.pagado?.toLocaleString()}</span><br>
        ${venta.saldo > 0 && !venta.is_void ? `<span style="font-size:16px;color:red">Saldo: $${venta.saldo?.toLocaleString()}</span>` : ''}
      </div>
      <div class="footer"><p>Gracias por su compra!</p></div>
      <button onclick="window.print()" style="width:100%;padding:15px;background:#eab308;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;margin-top:20px">
        Imprimir / Guardar PDF
      </button></body></html>`;

    // Blob URL en lugar de window.open + document.write — compatible con Safari/iOS
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    if (newWindow) {
      newWindow.addEventListener('load', () => URL.revokeObjectURL(url));
    } else {
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  };

  return (
    <DashboardLayout title="Facturas">
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Buscar por cliente..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border font-medium transition-colors ${hasActiveFilters ? 'bg-yellow-50 border-yellow-400 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-600 dark:text-yellow-400' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">Filtros</span>
            {hasActiveFilters && <span className="w-2 h-2 bg-yellow-500 rounded-full" />}
          </button>
        </div>

        {showFilters && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Filtros</h4>
              {hasActiveFilters && <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-medium">Limpiar filtros</button>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estado</label>
                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 text-sm">
                  <option value="">Todos</option>
                  <option value="pagada">Pagada</option>
                  <option value="parcial">Pago Parcial</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Desde</label>
                <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Hasta</label>
                <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={incluirAnuladas} onChange={(e) => setIncluirAnuladas(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Incluir facturas anuladas</span>
            </label>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : filteredVentas.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-gray-500 font-medium">No hay facturas que coincidan</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-3 text-sm text-yellow-600 hover:text-yellow-700 font-medium">Limpiar filtros</button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredVentas.map((venta: any) => (
            <div key={venta.id}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border transition-shadow ${venta.is_void ? 'border-red-200 dark:border-red-800/50 opacity-75' : 'border-gray-100 dark:border-gray-700'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-lg">{venta.cliente_nombre}</p>
                  <p className="text-sm text-gray-500">{format(parseISO(venta.fecha), 'dd/MM/yyyy')}</p>
                  <p className="text-sm text-gray-400">#{venta.id?.slice(0, 8)}</p>
                  {venta.is_void && venta.void_reason && (
                    <p className="text-xs text-gray-400 mt-1 italic">Motivo: {venta.void_reason}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${venta.is_void ? 'line-through text-gray-400' : ''}`}>
                    ${venta.total?.toLocaleString()}
                  </p>
                  {venta.is_void ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                      <Ban className="w-3 h-3" />Anulada
                    </span>
                  ) : (
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${venta.estado === 'pagada' ? 'bg-green-100 text-green-700' : venta.estado === 'parcial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {venta.estado === 'pagada' ? 'Pagada' : venta.estado === 'parcial' ? 'Pago Parcial' : 'Pendiente'}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                {!venta.is_void && (
                  <button onClick={() => openVoidModal(venta)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 text-sm">
                    <Trash2 className="w-4 h-4" />Anular
                  </button>
                )}
                <button onClick={() => downloadInvoice(venta)}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 text-sm">
                  <Download className="w-4 h-4" />Ver Factura
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {voidModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Anular Factura</h3>
                <p className="text-sm text-gray-500 mt-0.5">#{voidModal.id?.slice(0, 8)} — {voidModal.cliente_nombre}</p>
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3 mb-4 text-sm text-red-700 dark:text-red-400">
              Esta acción anulará la factura. El registro se conserva pero no contará en reportes ni deudas.
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Motivo de anulación <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea value={voidMotivo} onChange={(e) => setVoidMotivo(e.target.value)}
                placeholder="Ej: Error de carga, pedido cancelado por el cliente..."
                rows={3} autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 text-sm resize-none focus:ring-2 focus:ring-red-300 outline-none" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setVoidModal(null); setVoidMotivo(''); }}
                className="flex-1 py-3 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium">
                Cancelar
              </button>
              <button onClick={confirmVoid} disabled={voidSaving}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {voidSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Ban className="w-4 h-4" />Confirmar Anulación</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
