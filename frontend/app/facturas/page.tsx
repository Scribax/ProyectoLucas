'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Download, Search, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function FacturasPage() {
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchVentas();
  }, []);

  const fetchVentas = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/ventas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVentas(res.data.ventas);
    } catch (error) {
      toast.error('Error cargando ventas');
    } finally {
      setLoading(false);
    }
  };

  const filteredVentas = ventas.filter((v: any) =>
    v.cliente_nombre?.toLowerCase().includes(search.toLowerCase())
  );

  const deleteVenta = async (venta: any) => {
    const ok = confirm(`¿Eliminar la factura/venta #${venta.id?.slice(0, 8)} de ${venta.cliente_nombre}? Esta acción no se puede deshacer.`);
    if (!ok) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/ventas/${venta.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVentas((prev) => prev.filter((v: any) => v.id !== venta.id));
      toast.success('Factura eliminada');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error eliminando factura');
    }
  };

  const downloadInvoice = (venta: any) => {
    // Crear una ventana para imprimir/descargar
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = venta.items?.map((item: any) => `
      <tr>
        <td>Huevo ${item.size}</td>
        <td>${item.cantidad}</td>
        <td>$${item.precio_unitario}</td>
        <td>$${item.subtotal}</td>
      </tr>
    `).join('') || '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Factura #${venta.id?.slice(0, 8)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 3px solid #eab308; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #333; }
          .header p { color: #666; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; }
          .total { font-size: 24px; font-weight: bold; text-align: right; margin-top: 20px; }
          .footer { text-align: center; margin-top: 40px; color: #666; font-size: 14px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>GRANJA AVÍCOLA</h1>
          <p>Factura de Venta</p>
          <p>#${venta.id?.slice(0, 8)}</p>
        </div>
        <p><strong>Cliente:</strong> ${venta.cliente_nombre}</p>
        <p><strong>Fecha:</strong> ${format(parseISO(venta.fecha), 'dd/MM/yyyy HH:mm')}</p>
        <table>
          <thead>
            <tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="total">
          TOTAL: $${venta.total?.toLocaleString()}<br>
          <span style="font-size: 16px;">Pagado: $${venta.pagado?.toLocaleString()}</span><br>
          ${venta.saldo > 0 ? `<span style="font-size: 16px; color: red;">Saldo: $${venta.saldo?.toLocaleString()}</span>` : ''}
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
  };

  return (
    <DashboardLayout title="Facturas">
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredVentas.map((venta: any) => (
            <div key={venta.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-lg">{venta.cliente_nombre}</p>
                  <p className="text-sm text-gray-500">{format(parseISO(venta.fecha), 'dd/MM/yyyy')}</p>
                  <p className="text-sm text-gray-500">#{venta.id?.slice(0, 8)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">${venta.total?.toLocaleString()}</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs ${
                    venta.estado === 'pagada' ? 'bg-green-100 text-green-700' :
                    venta.estado === 'parcial' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {venta.estado}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteVenta(venta)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 text-sm"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                  <button
                    onClick={() => downloadInvoice(venta)}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Ver Factura
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
