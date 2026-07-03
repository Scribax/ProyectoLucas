import {
  buildCobroMessage,
  mapVentaVencidaToCobroPendiente,
  normalizePhoneForWhatsApp,
} from '../src/services/cobrosService';

describe('cobrosService', () => {
  it('normaliza telefonos dominicanos para WhatsApp', () => {
    expect(normalizePhoneForWhatsApp('(809) 555-1234')).toBe('18095551234');
    expect(normalizePhoneForWhatsApp('+1 829 555 0000')).toBe('18295550000');
  });

  it('construye el mensaje de cobro con cliente, saldo y dias vencidos', () => {
    const mensaje = buildCobroMessage({
      cliente_nombre: 'Colmado Ana',
      saldo: 1250,
      fecha: '2026-07-01T10:00:00.000Z',
      dias_vencida: 6,
    });

    expect(mensaje).toContain('Hola Colmado Ana');
    expect(mensaje).toContain('6 días');
    expect(mensaje).toContain('saldo pendiente');
  });

  it('mapea una venta vencida a cobro pendiente con URL wa.me', () => {
    const cobro = mapVentaVencidaToCobroPendiente({
      id: 'venta-1',
      cliente_id: 'cliente-1',
      cliente_nombre: 'Mini Market Luz',
      cliente_telefono: '809-555-9999',
      fecha: '2026-07-01T10:00:00.000Z',
      total: '2000.00',
      pagado: '500.00',
      saldo: '1500.00',
      estado: 'parcial',
      dias_vencida: '7',
      ultima_notificacion_at: null,
    });

    expect(cobro).not.toBeNull();
    expect(cobro?.telefono_whatsapp).toBe('18095559999');
    expect(cobro?.whatsapp_url).toContain('https://wa.me/18095559999?text=');
    expect(cobro?.mensaje).toContain('Mini Market Luz');
  });

  it('omite ventas vencidas sin telefono valido', () => {
    const cobro = mapVentaVencidaToCobroPendiente({
      id: 'venta-1',
      cliente_id: 'cliente-1',
      cliente_nombre: 'Sin Telefono',
      cliente_telefono: '',
      fecha: '2026-07-01T10:00:00.000Z',
      total: 100,
      pagado: 0,
      saldo: 100,
      estado: 'pendiente',
      dias_vencida: 5,
    });

    expect(cobro).toBeNull();
  });
});
