'use client';

import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { ShoppingCart, Plus, Search, Trash2, Download, X, DollarSign } from 'lucide-react';
import { format, parseISO } from 'date-fns';
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
  // Para manejo de inputs sin bloquear borrado
  _cantidadStr?: string;
  _precioStr?: string;
}

const TAMAÑOS_HUEVO = [
  { value: 'S', label: 'Huevo Chico' },
  { value: 'M', label: 'Huevo Mediano' },
  { value: 'L', label: 'Huevo Grande' },
  { value: 'XL', label: 'Huevo Extra Grande' },
];

export default function VentasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState<any>(null);
  const [pagoRapidoModal, setPagoRapidoModal] = useState<any>(null);
  const [montoPago, setMontoPago] = useState('');
  const [savingPago, setSavingPago] = useState(false);

  // Form nueva venta
  const [clienteId, setClienteId] = useState('');
  const [items, setItems] = useState<VentaItem[]>([]);
  const [pagadoStr, setPagadoStr] = useState('0');
  const [saving, setSaving] = useState(false);
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
    setItems([
      ...items,
      {
        size: 'M',
        descripcion: 'Huevo Mediano',
        cantidad: 1,
        precio_unitario: 0,
        subtotal: 0,
        _cantidadStr: '1',
        _precioStr: '',
      },
    ]);
  };

  const updateItemOption = (index: number, selectionValue: string) => {
    const newItems = [...items];
    const isEgg = TAMAÑOS_HUEVO.some((t) => t.value === selectionValue);

    if (isEgg) {
      const egg = TAMAÑOS_HUEVO.find((t) => t.value === selectionValue)!;
      newItems[index] = {
        ...newItems[index],
        size: egg.value,
        articulo_id: undefined,
        descripcion: egg.label,
        precio_unitario: 0,
        _precioStr: '',
        subtotal: 0,
      };
    } else {
      const art = articulos.find((a) => a.id === selectionValue)!;
      newItems[index] = {
        ...newItems[index],
        size: undefined,
        articulo_id: art.id,
        descripcion: art.nombre,
        precio_unitario: art.precio_unitario,
        _precioStr: String(art.precio_unitario),
        subtotal: newItems[index].cantidad * art.precio_unitario,
      };
    }
    setItems(newItems);
  };

  const updateItemCantidad = (index: number, raw: string) => {
    const newItems = [...items];
    const num = parseInt(raw) || 0;
    newItems[index] = {
      ...newItems[index],
      _cantidadStr: raw,
      cantidad: num,
      subtotal: num * newItems[index].precio_unitario,
    };
    setItems(newItems);
  };

  const updateItemPrecio = (index: number, raw: string) => {
    const newItems = [...items];
    const num = parseFloat(raw) || 0;
    newItems[index] = {
      ...newItems[index],
      _precioStr: raw,
      precio_unitario: num,
      subtotal: newItems[index].cantidad * num,
    };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const pagado = parseFloat(pagadoStr) || 0;
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  const saldo = Math.max(total - pagado, 0);

  const selectedClient = clientes.find((c) => c.id === clienteId);
  const saldoPrevio = selectedClient ? parseFloat(String(selectedClient.saldo)) || 0 : 0;
  const nuevoSaldoAcumulado = saldoPrevio + saldo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || items.length === 0) {
      toast.error('Selecciona cliente y agrega items');
      return;
    }
    // Validar que todos los items tengan cantidad > 0
    if (items.some((it) => it.cantidad <= 0)) {
      toast.error('Todos los items deben tener cantidad mayor a 0');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const itemsToSend = items.map(({ _cantidadStr, _precioStr, ...rest }) => rest);
      const res = await axios.post(
        `${API_URL}/ventas`,
        {
          cliente_id: clienteId,
          items: itemsToSend,
          pagado,
          es_fiado: saldo > 0,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('¡Venta registrada!');
      setModalOpen(false);
      setItems([]);
      setClienteId('');
      setPagadoStr('0');
      fetchData();
      setInvoiceModal(res.data.venta);
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Error guardando venta';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openInvoice = async (venta: any) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/ventas/${venta.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInvoiceModal(res.data.venta);
    } catch (error) {
      toast.error('Error cargando factura');
    }
  };

  const downloadInvoice = async () => {
    if (!invoiceRef.current) return;
    const canvas = await html2canvas(invoiceRef.current, { scale: 2 });
    const link = document.createElement('a');
    link.download = `factura-${invoiceModal.id?.slice(0, 8)}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const handlePagoRapido = async () => {
    const monto = parseFloat(montoPago);
    if (!monto || monto <= 0) {
      toast.error('Ingresá un monto válido');
      return;
    }
    if (monto > parseFloat(String(pagoRapidoModal.saldo || 0))) {
      toast.error('El pago no puede superar el saldo pendiente');
      return;
    }
    try {
      setSavingPago(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/clientes/${pagoRapidoModal.cliente_id}/pagos`,
        { monto, metodo: 'efectivo', venta_id: pagoRapidoModal.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('¡Pago registrado!');
      setPagoRapidoModal(null);
      setMontoPago('');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error registrando pago');
    } finally {
      setSavingPago(false);
    }
  };

  const getEggFriendlyName = (size: string) => {
    const found = TAMAÑOS_HUEVO.find((t) => t.value === size);
    return found ? found.label : `Huevo ${size}`;
  };

  return (
    <DashboardLayout title="Ventas">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Historial de Ventas</h2>
        <button
          onClick={() => {
            setItems([
              {
                size: 'M',
                descripcion: 'Huevo Mediano',
                cantidad: 1,
                precio_unitario: 0,
                subtotal: 0,
                _cantidadStr: '1',
                _precioStr: '',
              },
            ]);
            setPagadoStr('0');
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
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => openInvoice(v)}
                >
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{v.cliente_nombre}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{format(parseISO(v.fecha), 'dd/MM/yyyy HH:mm')}</p>
                  <div className="flex gap-2 mt-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        v.estado === 'pagada'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : v.estado === 'parcial'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      }`}
                    >
                      {v.estado === 'pagada' ? 'Pagada' : v.estado === 'parcial' ? 'Pago Parcial' : 'Fiar'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-950 dark:text-white">${parseFloat(String(v.total)).toLocaleString()}</p>
                  {parseFloat(String(v.saldo)) > 0 ? (
                    <p className="text-sm text-red-500 font-medium mt-0.5">
                      Debe: ${parseFloat(String(v.saldo)).toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-sm text-green-500 font-medium mt-0.5">Al día ✓</p>
                  )}
                  {/* Botón pago rápido */}
                  {parseFloat(String(v.saldo)) > 0 && (
                    <button
                      onClick={() => {
                        setPagoRapidoModal(v);
                        setMontoPago(String(v.saldo));
                      }}
                      className="mt-2 flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition-colors ml-auto"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Registrar Pago
                    </button>
                  )}
                </div>
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
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Cliente *
                </label>
                <select
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 text-gray-950 dark:text-white"
                  required
                >
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}{' '}
                      {parseFloat(String(c.saldo)) > 0
                        ? `(Debe $${parseFloat(String(c.saldo)).toLocaleString()})`
                        : '(Al día)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Saldo pendiente previo */}
              {selectedClient && saldoPrevio > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-xl text-sm flex justify-between items-center">
                  <span className="font-medium">⚠️ Saldo pendiente previo:</span>
                  <span className="font-bold">${saldoPrevio.toLocaleString()}</span>
                </div>
              )}
              {selectedClient && saldoPrevio === 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 rounded-xl text-sm flex justify-between items-center">
                  <span className="font-medium">✓ Cliente al día</span>
                  <span className="font-bold">$0</span>
                </div>
              )}

              {/* Items */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Items de Venta
                  </label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-sm text-yellow-600 dark:text-yellow-400 font-bold hover:underline"
                  >
                    + Agregar Ítem
                  </button>
                </div>
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-2xl border border-gray-150 dark:border-gray-650"
                  >
                    {/* Selector Producto */}
                    <div className="col-span-12 sm:col-span-4">
                      <select
                        value={item.articulo_id || item.size || 'M'}
                        onChange={(e) => updateItemOption(i, e.target.value)}
                        className="w-full px-2 py-2 rounded-lg border dark:border-gray-500 dark:bg-gray-600 text-sm"
                      >
                        <optgroup label="Huevos (Producción)">
                          {TAMAÑOS_HUEVO.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </optgroup>
                        {articulos.length > 0 && (
                          <optgroup label="Artículos / Productos">
                            {articulos.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.nombre}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {/* Cantidad */}
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Cant"
                        value={item._cantidadStr ?? String(item.cantidad)}
                        onChange={(e) => updateItemCantidad(i, e.target.value)}
                        className="w-full px-2 py-2 rounded-lg border dark:border-gray-500 dark:bg-gray-600 text-sm text-center"
                        required
                      />
                    </div>

                    {/* Precio Unitario */}
                    <div className="col-span-5 sm:col-span-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Precio"
                        value={item._precioStr ?? String(item.precio_unitario)}
                        onChange={(e) => updateItemPrecio(i, e.target.value)}
                        className="w-full px-2 py-2 rounded-lg border dark:border-gray-500 dark:bg-gray-600 text-sm text-center font-semibold text-gray-900 dark:text-white"
                        required
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="col-span-2 sm:col-span-2 text-right text-sm font-bold text-gray-800 dark:text-gray-200">
                      ${item.subtotal.toLocaleString()}
                    </div>

                    {/* Borrar */}
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

              {/* Totales */}
              <div className="border-t dark:border-gray-700 pt-4 space-y-3">
                <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white">
                  <span>Total Venta:</span>
                  <span>${total.toLocaleString()}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Paga ahora
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pagadoStr}
                    onFocus={(e) => {
                      if (pagadoStr === '0') setPagadoStr('');
                    }}
                    onBlur={() => {
                      if (pagadoStr === '' || pagadoStr === '-') setPagadoStr('0');
                    }}
                    onChange={(e) => setPagadoStr(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 text-lg font-bold text-gray-900 dark:text-white"
                  />
                </div>

                {saldo > 0 && (
                  <p className="text-red-500 text-sm font-semibold">
                    Saldo a fiar en esta venta: ${saldo.toLocaleString()}
                  </p>
                )}

                {selectedClient && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-sm space-y-1">
                    <div className="flex justify-between text-gray-500">
                      <span>Deuda anterior acumulada:</span>
                      <span>${saldoPrevio.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-red-500 font-medium">
                      <span>Nueva deuda generada:</span>
                      <span>${saldo.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t dark:border-gray-600 pt-1 text-gray-800 dark:text-gray-100">
                      <span>Deuda total final:</span>
                      <span>${nuevoSaldoAcumulado.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Confirmar Venta'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pago Rápido */}
      {pagoRapidoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Registrar Pago</h3>
              <button
                onClick={() => {
                  setPagoRapidoModal(null);
                  setMontoPago('');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Cliente: <span className="font-bold">{pagoRapidoModal.cliente_nombre}</span>
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                Saldo pendiente en esta venta:{' '}
                <span className="font-bold">${parseFloat(String(pagoRapidoModal.saldo)).toLocaleString()}</span>
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Monto recibido
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  inputMode="decimal"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 text-xl font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="0"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setPagoRapidoModal(null);
                  setMontoPago('');
                }}
                className="flex-1 py-3 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handlePagoRapido}
                disabled={savingPago}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingPago ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <DollarSign className="w-5 h-5" />
                    Confirmar Pago
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Factura Visual */}
      {invoiceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div ref={invoiceRef} className="p-8 bg-white text-gray-900">
              <div className="text-center border-b-2 border-yellow-400 pb-4 mb-4">
                <h2 className="text-2xl font-bold tracking-wide">GRANJA AVÍCOLA</h2>
                <p className="text-gray-500 text-sm mt-0.5">Comprobante de Venta</p>
                <p className="text-xs text-gray-400 mt-1">ID: #{invoiceModal.id?.slice(0, 8)}</p>
              </div>

              <div className="mb-5 text-sm space-y-1">
                <p className="font-bold">
                  Cliente: <span className="font-normal">{invoiceModal.cliente_nombre}</span>
                </p>
                <p className="text-gray-500">
                  Fecha: {format(parseISO(invoiceModal.fecha), 'dd/MM/yyyy HH:mm')}
                </p>
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
                    const detalle =
                      item.descripcion ||
                      (item.size ? getEggFriendlyName(item.size) : 'Artículo');
                    return (
                      <tr key={i} className="text-gray-700">
                        <td className="py-2.5 font-medium">{detalle}</td>
                        <td className="text-center py-2.5">{item.cantidad}</td>
                        <td className="text-right py-2.5">
                          ${parseFloat(String(item.precio_unitario)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right py-2.5 font-semibold">
                          ${parseFloat(String(item.subtotal)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
                <div className="flex justify-between font-bold text-base text-gray-900">
                  <span>Total de esta Venta:</span>
                  <span>
                    ${parseFloat(String(invoiceModal.total)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Monto Pagado Hoy:</span>
                  <span>
                    ${parseFloat(String(invoiceModal.pagado)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {parseFloat(String(invoiceModal.saldo)) > 0 && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>Saldo a fiar hoy:</span>
                    <span>
                      ${parseFloat(String(invoiceModal.saldo)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {invoiceModal.saldo_anterior !== undefined && (
                  <div className="border-t border-dashed border-gray-200 pt-2 space-y-1">
                    <div className="flex justify-between text-gray-500">
                      <span>Deuda anterior:</span>
                      <span>
                        ${parseFloat(String(invoiceModal.saldo_anterior)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 border-t pt-1">
                      <span>Saldo total pendiente:</span>
                      <span>
                        ${parseFloat(String(invoiceModal.saldo_acumulado || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center mt-8 pt-4 border-t border-gray-100 text-xs text-gray-400">
                <p className="font-medium">¡Muchas gracias por su confianza!</p>
                <p className="mt-0.5">Granja Avícola</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 flex gap-3 border-t border-gray-100">
              <button
                onClick={() => setInvoiceModal(null)}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
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
