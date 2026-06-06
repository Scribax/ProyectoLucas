'use client';

import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { ShoppingCart, Plus, Search, Trash2, Download, Printer, X } from 'lucide-react';
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

interface Articulo {
  id: string;
  nombre: string;
  precio_unitario: number;
}

interface VentaItem {
  size?: string;
  articulo_id?: string;
  descripcion?: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

const TAMAÑOS_HUEVO = [
  { value: 'S', label: 'Huevo Chico' },
  { value: 'M', label: 'Huevo Mediano' },
  { value: 'L', label: 'Huevo Grande' },
  { value: 'XL', label: 'Huevo Extra' },
];

export default function VentasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
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
      
      const [clientesRes, ventasRes, articulosRes] = await Promise.all([
        axios.get(`${API_URL}/clientes`, { headers }),
        axios.get(`${API_URL}/ventas`, { headers }),
        axios.get(`${API_URL}/articulos`, { headers }),
      ]);
      
      setClientes(clientesRes.data.clientes);
      setVentas(ventasRes.data.ventas);
      setArticulos(articulosRes.data.articulos);
    } catch (error) {
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    // Por defecto agregamos un Huevo Mediano
    setItems([...items, { size: 'M', descripcion: 'Huevo Mediano', cantidad: 1, precio_unitario: 0, subtotal: 0 }]);
  };

  const updateItemOption = (index: number, selectionValue: string) => {
    const newItems = [...items];
    const isEgg = TAMAÑOS_HUEVO.some(t => t.value === selectionValue);

    if (isEgg) {
      const egg = TAMAÑOS_HUEVO.find(t => t.value === selectionValue)!;
      newItems[index] = {
        ...newItems[index],
        size: egg.value,
        articulo_id: undefined,
        descripcion: egg.label,
        precio_unitario: 0, // precio inicial para cargar
        subtotal: newItems[index].cantidad * 0
      };
    } else {
      const art = articulos.find(a => a.id === selectionValue)!;
      newItems[index] = {
        ...newItems[index],
        size: undefined,
        articulo_id: art.id,
        descripcion: art.nombre,
        precio_unitario: art.precio_unitario,
        subtotal: newItems[index].cantidad * art.precio_unitario
      };
    }
    setItems(newItems);
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

  const selectedClient = clientes.find(c => c.id === clienteId);
  const saldoPrevio = selectedClient ? parseFloat(String(selectedClient.saldo)) : 0;
  const nuevoSaldoAcumulado = saldoPrevio + (saldo > 0 ? saldo : 0);

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

  const openInvoice = async (venta: any) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/ventas/${venta.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoiceModal(res.data.venta);
    } catch (error) {
      toast.error('Error cargando factura');
    } finally {
      setLoading(false);
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

  const getEggFriendlyName = (size: string) => {
    const found = TAMAÑOS_HUEVO.find(t => t.value === size);
    return found ? found.label : `Huevo ${size}`;
  };

  return (
    <DashboardLayout title="Ventas">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Historial de Ventas</h2>
        <button
          onClick={() => {
            setItems([{ size: 'M', descripcion: 'Huevo Mediano', cantidad: 1, precio_unitario: 0, subtotal: 0 }]);
            setPagado(0);
            setClienteId('');
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 font-medium transition-colors shadow-sm"
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
      ) : ventas.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No hay ventas registradas</p>
          <p className="text-gray-400 text-sm mt-1">Hacé clic en "Nueva Venta" para registrar tu primera venta.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {ventas.map((v) => (
            <div 
              key={v.id} 
              onClick={() => openInvoice(v)}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer flex justify-between items-center"
            >
              <div>
                <p className="font-semibold text-gray-850 dark:text-gray-100 text-lg">{v.cliente_nombre}</p>
                <p className="text-sm text-gray-400 mt-0.5">{format(parseISO(v.fecha), 'dd/MM/yyyy HH:mm')}</p>
                <div className="flex gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    v.estado === 'pagada' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                    v.estado === 'parcial' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                    'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                  }`}>
                    {v.estado === 'pagada' ? 'Pagada' : v.estado === 'parcial' ? 'Pago Parcial' : 'Fiar'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-950 dark:text-white">${v.total.toLocaleString()}</p>
                {v.saldo > 0 ? (
                  <p className="text-sm text-red-500 font-medium mt-0.5">Saldo pendiente: ${v.saldo.toLocaleString()}</p>
                ) : (
                  <p className="text-sm text-green-500 font-medium mt-0.5">Al día</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nueva Venta */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Venta</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Cliente *</label>
                <select
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 text-gray-950 dark:text-white"
                  required
                >
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.saldo > 0 ? `(Debe $${parseFloat(String(c.saldo)).toLocaleString()})` : '(Al día)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Informar saldo pendiente en tiempo real */}
              {selectedClient && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-xl text-sm flex justify-between items-center">
                  <span className="font-medium">Saldo pendiente previo del cliente:</span>
                  <span className="font-bold">${saldoPrevio.toLocaleString()}</span>
                </div>
              )}

              {/* Items */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Items de Venta</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-sm text-yellow-600 dark:text-yellow-400 font-bold hover:underline"
                  >
                    + Agregar Ítem
                  </button>
                </div>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-2xl border border-gray-150 dark:border-gray-650">
                    {/* Selector Producto (Huevo o Artículo) */}
                    <div className="col-span-12 sm:col-span-4">
                      <select
                        value={item.articulo_id || item.size}
                        onChange={(e) => updateItemOption(i, e.target.value)}
                        className="w-full px-2 py-2 rounded-lg border dark:border-gray-500 dark:bg-gray-600 text-sm"
                      >
                        <optgroup label="Huevos (Producción)">
                          {TAMAÑOS_HUEVO.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </optgroup>
                        {articulos.length > 0 && (
                          <optgroup label="Artículos / Productos">
                            {articulos.map(a => (
                              <option key={a.id} value={a.id}>{a.nombre}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {/* Cantidad */}
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        placeholder="Cant"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => updateItem(i, 'cantidad', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-2 rounded-lg border dark:border-gray-500 dark:bg-gray-600 text-sm text-center"
                        required
                      />
                    </div>

                    {/* Precio Unitario */}
                    <div className="col-span-5 sm:col-span-3">
                      <input
                        type="number"
                        placeholder="Precio Unit."
                        min="0"
                        step="0.01"
                        value={item.precio_unitario}
                        onChange={(e) => updateItem(i, 'precio_unitario', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-2 rounded-lg border dark:border-gray-500 dark:bg-gray-600 text-sm text-center font-semibold text-gray-900 dark:text-white"
                        required
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="col-span-2 sm:col-span-2 text-right text-sm font-bold text-gray-800 dark:text-gray-200">
                      ${item.subtotal.toLocaleString()}
                    </div>

                    {/* Botón borrar */}
                    <div className="col-span-1 text-right">
                      <button 
                        type="button" 
                        onClick={() => removeItem(i)} 
                        disabled={items.length === 1}
                        className="text-red-500 hover:text-red-700 disabled:opacity-30 p-1"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totales y Pago */}
              <div className="border-t dark:border-gray-700 pt-4 space-y-3">
                <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white">
                  <span>Total Venta:</span>
                  <span>${total.toLocaleString()}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Paga ahora *</label>
                  <input
                    type="number"
                    value={pagado}
                    onChange={(e) => setPagado(parseFloat(e.target.value) || 0)}
                    min="0"
                    max={total}
                    step="0.01"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 text-lg font-bold text-gray-900 dark:text-white"
                  />
                </div>

                {saldo > 0 && (
                  <p className="text-red-500 text-sm font-semibold">
                    Saldo a fiar en esta venta: ${saldo.toLocaleString()}
                  </p>
                )}

                {/* Mostrar proyección del saldo total */}
                {selectedClient && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-sm space-y-1">
                    <div className="flex justify-between text-gray-500">
                      <span>Deuda anterior acumulada:</span>
                      <span>${saldoPrevio.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-red-500 font-medium">
                      <span>Nueva deuda generada:</span>
                      <span>${(saldo > 0 ? saldo : 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t dark:border-gray-600 pt-1 text-gray-800 dark:text-gray-100">
                      <span>Deuda total final:</span>
                      <span>${nuevoSaldoAcumulado.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 dark:border-gray-650 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 font-bold transition-colors"
                >
                  Confirmar Venta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Factura Visual */}
      {invoiceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            {/* Factura para capturar */}
            <div ref={invoiceRef} className="p-8 bg-white text-gray-900">
              <div className="text-center border-b-2 border-yellow-400 pb-4 mb-4">
                <h2 className="text-2xl font-bold tracking-wide">GRANJA AVÍCOLA</h2>
                <p className="text-gray-500 text-sm mt-0.5">Comprobante de Venta</p>
                <p className="text-xs text-gray-400 mt-1">ID: #{invoiceModal.id?.slice(0, 8)}</p>
              </div>
              
              <div className="mb-5 text-sm space-y-1">
                <p className="font-bold">Cliente: <span className="font-normal">{invoiceModal.cliente_nombre}</span></p>
                <p className="text-gray-500">Fecha: {format(parseISO(invoiceModal.fecha), 'dd/MM/yyyy HH:mm')}</p>
              </div>

              <table className="w-full text-sm mb-5">
                <thead className="border-b-2 border-gray-100">
                  <tr className="text-gray-500 font-medium">
                    <th className="text-left py-2">Detalle</th>
                    <th className="text-center">Cant</th>
                    <th className="text-right">P. Unit.</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoiceModal.items?.map((item: any, i: number) => {
                    const detalle = item.descripcion || (item.size ? getEggFriendlyName(item.size) : 'Artículo');
                    return (
                      <tr key={i} className="text-gray-700">
                        <td className="py-2.5 font-medium">{detalle}</td>
                        <td className="text-center py-2.5">{item.cantidad}</td>
                        <td className="text-right py-2.5">${parseFloat(String(item.precio_unitario)).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                        <td className="text-right py-2.5 font-semibold">${parseFloat(String(item.subtotal)).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
                <div className="flex justify-between font-bold text-base text-gray-900">
                  <span>Total de esta Venta:</span>
                  <span>${parseFloat(String(invoiceModal.total)).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Monto Pagado Hoy:</span>
                  <span>${parseFloat(String(invoiceModal.pagado)).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                </div>
                
                {parseFloat(String(invoiceModal.saldo)) > 0 && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>Saldo a fiar hoy:</span>
                    <span>${parseFloat(String(invoiceModal.saldo)).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                  </div>
                )}

                {/* Mostrar saldo histórico de cuenta corriente */}
                {invoiceModal.saldo_anterior !== undefined && (
                  <div className="border-t border-dashed border-gray-200 pt-2 space-y-1">
                    <div className="flex justify-between text-gray-500">
                      <span>Deuda anterior acumulada:</span>
                      <span>${parseFloat(String(invoiceModal.saldo_anterior)).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 border-t pt-1">
                      <span>Saldo total pendiente:</span>
                      <span>${parseFloat(String(invoiceModal.saldo_acumulado)).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center mt-8 pt-4 border-t border-gray-100 text-xs text-gray-400">
                <p className="font-medium">¡Muchas gracias por su confianza!</p>
                <p className="mt-0.5">Granja Avícola</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 flex gap-3 border-t dark:border-gray-700">
              <button
                onClick={() => setInvoiceModal(null)}
                className="flex-1 py-3 border border-gray-200 dark:border-gray-650 rounded-xl text-sm font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={downloadInvoice}
                className="flex-1 py-3 bg-yellow-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-yellow-600 transition-colors shadow-sm"
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
