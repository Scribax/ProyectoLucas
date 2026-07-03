export interface VentaVencidaRow {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  fecha: string | Date;
  total: number | string;
  pagado: number | string;
  saldo: number | string;
  estado: 'pendiente' | 'parcial' | string;
  dias_vencida: number | string;
  ultima_notificacion_at?: string | Date | null;
}

export interface CobroPendiente {
  venta_id: string;
  cliente_id: string;
  cliente_nombre: string;
  telefono: string;
  telefono_whatsapp: string;
  fecha: string | Date;
  total: number;
  pagado: number;
  saldo: number;
  estado: string;
  dias_vencida: number;
  mensaje: string;
  whatsapp_url: string;
  ultima_notificacion_at?: string | Date | null;
}

const DEFAULT_COUNTRY_CODE = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '1';

export const normalizePhoneForWhatsApp = (
  telefono?: string | null,
  defaultCountryCode = DEFAULT_COUNTRY_CODE
): string | null => {
  if (!telefono) return null;

  const trimmed = telefono.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (hasPlus) return digits;

  const countryCode = defaultCountryCode.replace(/\D/g, '');
  if (!countryCode) return digits;

  if (digits.startsWith(countryCode)) return digits;

  return `${countryCode}${digits}`;
};

export const formatMoney = (value: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
  }).format(value);
};

export const buildCobroMessage = (row: {
  cliente_nombre: string;
  saldo: number | string;
  fecha: string | Date;
  dias_vencida: number | string;
}): string => {
  const saldo = Number(row.saldo) || 0;
  const dias = Number(row.dias_vencida) || 0;
  const fecha = new Date(row.fecha).toLocaleDateString('es-AR');

  return [
    `Hola ${row.cliente_nombre}, bendiciones.`,
    `Le recordamos que tiene un saldo pendiente de ${formatMoney(saldo)} de su compra del ${fecha}.`,
    `Ya han pasado ${dias} días. Cuando pueda, favor realizar el pago o comunicarse con nosotros.`,
    'Gracias.',
  ].join(' ');
};

export const mapVentaVencidaToCobroPendiente = (row: VentaVencidaRow): CobroPendiente | null => {
  const telefonoWhatsapp = normalizePhoneForWhatsApp(row.cliente_telefono);
  if (!telefonoWhatsapp) return null;

  const mensaje = buildCobroMessage(row);

  return {
    venta_id: row.id,
    cliente_id: row.cliente_id,
    cliente_nombre: row.cliente_nombre,
    telefono: row.cliente_telefono || '',
    telefono_whatsapp: telefonoWhatsapp,
    fecha: row.fecha,
    total: Number(row.total) || 0,
    pagado: Number(row.pagado) || 0,
    saldo: Number(row.saldo) || 0,
    estado: row.estado,
    dias_vencida: Number(row.dias_vencida) || 0,
    mensaje,
    whatsapp_url: `https://wa.me/${telefonoWhatsapp}?text=${encodeURIComponent(mensaje)}`,
    ultima_notificacion_at: row.ultima_notificacion_at || null,
  };
};
