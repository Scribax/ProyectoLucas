'use client';

import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { ShoppingCart, Plus, Search, Trash2, Download, Printer } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Cliente {
  id: string;
  nombre: string;
  saldo: number;
}

interface VentaItem {
  size: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export default function VentasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState<any>(null);
  
  // Form nueva venta
  const [clienteId, setClienteId] = useState('');
  const [items, setItems] = useState<VentaItem[]>([]);
  const [pagado, setPagado] = useState(0);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [clientesRes, ventasRes] = await Promise.all([
        axios.get(`${API_URL}/clientes`, { headers }),
        axios.get(`${API_URL}/ventas`, { headers }),
      ]);
      
      setClientes(clientesRes.data.clientes);
      setVentas(ventasRes.data.ventas);
    } catch (error) {
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, { size: 'M', cantidad: 1, precio_unitario: 0, subtotal: 0 }]);
  };

  const updateItem = (index: number, field: keyof VentaItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'cantidad' || field === 'precio_unitario') {
      newItems[index].subtotal = newItems[index].cantidad * newItems[index].precio_unitario;
    }
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  const saldo = total - pagado;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || items.length === 0) {
      toast.error('Selecciona cliente y agrega items');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_URL}/ventas`,
        {
          cliente_id: clienteId,
          items,
          pagado,
          es_fiado: saldo > 0,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Venta registrada');
      setModalOpen(false);
      setItems([]);
      setClienteId('');
      setPagado(0);
      fetchData();
      
      // Mostrar factura
      setInvoiceModal(res.data.venta);
    } catch (error) {
      toast.error('Error guardando venta');
    }
  };

  const downloadInvoice = async () => {
    if (!invoiceRef.current) return;
    const canvas = await html2canvas(invoiceRef.current, { scale: 2 });
    const link = document.createElement('a');
    link.download = `factura-${invoiceModal.id}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <DashboardLayout title="Ventas">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Historial de Ventas</h2>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600"
        >
          <Plus className="w-5 h-5" />
          Nueva Venta
        </button>
      </div>

      {/* Lista de ventas */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : (
        <div className="grid gap-4">
          {ventas.map((v) => (
            <div key={v.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{v.cliente_nombre}</p>
                  <p className="text-sm text-gray-500">{format(parseISO(v.fecha), 'dd/MM/yyyy')}</p>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      v.estado === 'pagada' ? 'bg-green-100 text-green-700' :
                      v.estado === 'parcial' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {v.estado}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">${v.total.toLocaleString()}</p>
                  {v.saldo > 0 && <p className="text-sm text-red-500">Saldo: ${v.saldo}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nueva Venta */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Nueva Venta</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cliente</label>
                <select
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre} {c.saldo > 0 && `(Debe $${c.saldo})`}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Items</label>
                  <button type="button" onClick={addItem} className="text-sm text-yellow-600 font-medium">
                    + Agregar
                  </button>
                </div>
                {items.map((item, i) => (
                  <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-center bg-gray-50 dark:bg-gray-700 p-2 rounded-xl">
                    <select
                      value={item.size}
                      onChange={(e) => updateItem(i, 'size', e.target.value)}
                      className="w-20 px-2 py-1 rounded border dark:border-gray-600 dark:bg-gray-600"
                    >
                      {['S', 'M', 'L', 'XL'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input
                      type="number"
                      placeholder="Cant"
                      value={item.cantidad}
                      onChange={(e) => updateItem(i, 'cantidad', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 rounded border dark:border-gray-600 dark:bg-gray-600"
                    />
                    <input
                      type="number"
                      placeholder="Precio"
                      value={item.precio_unitario}
                      onChange={(e) => updateItem(i, 'precio_unitario', parseFloat(e.target.value) || 0)}
                      className="flex-1 px-2 py-1 rounded border dark:border-gray-600 dark:bg-gray-600"
                    />
                    <span className="text-sm font-medium">${item.subtotal}</span>
                    <button type="button" onClick={() => removeItem(i)} className="text-red-500 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${total.toLocaleString()}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Paga ahora</label>
                  <input
                    type="number"
                    value={pagado}
                    onChange={(e) => setPagado(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>
                {saldo > 0 && (
                  <p className="text-red-500 text-sm">Saldo a fiar: ${saldo.toLocaleString()}</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 border rounded-xl"
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

      {/* Modal Factura Visual */}
      {invoiceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full overflow-hidden">
            {/* Factura para capturar */}
            <div ref={invoiceRef} className="p-8 bg-white">
              <div className="text-center border-b-2 border-yellow-400 pb-4 mb-4">
                <h2 className="text-2xl font-bold">GRANJA AVÍCOLA</h2>
                <p className="text-gray-600">Factura de Venta</p>
                <p className="text-sm text-gray-500">#{invoiceModal.id?.slice(0, 8)}</p>
              </div>
              
              <div className="mb-4">
                <p className="font-semibold">Cliente: {invoiceModal.cliente_nombre}</p>
                <p className="text-sm text-gray-600">{format(parseISO(invoiceModal.fecha), 'dd/MM/yyyy HH:mm')}</p>
              </div>

              <table className="w-full text-sm mb-4">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2">Tamaño</th>
                    <th className="text-center">Cant</th>
                    <th className="text-right">Precio</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceModal.items?.map((item: any, i: number) => (
                    <tr key={i}>
                      <td className="py-1">Huevo {item.size}</td>
                      <td className="text-center">{item.cantidad}</td>
                      <td className="text-right">${item.precio_unitario}</td>
                      <td className="text-right">${item.subtotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t pt-4 space-y-1">
                <div className="flex justify-between font-bold text-lg">
                  <span>TOTAL</span>
                  <span>${invoiceModal.total?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Pagado</span>
                  <span>${invoiceModal.pagado?.toLocaleString()}</span>
                </div>
                {invoiceModal.saldo > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Saldo pendiente</span>
                    <span>${invoiceModal.saldo?.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="text-center mt-6 pt-4 border-t text-sm text-gray-500">
                <p>¡Gracias por su compra!</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 flex gap-3">
              <button
                onClick={() => setInvoiceModal(null)}
                className="flex-1 py-2 border rounded-lg"
              >
                Cerrar
              </button>
              <button
                onClick={downloadInvoice}
                className="flex-1 py-2 bg-yellow-500 text-white rounded-lg flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
