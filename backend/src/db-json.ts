import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Estructura inicial de la base de datos
interface Database {
  users: any[];
  gallineros: any[];
  produccion: any[];
  clientes: any[];
  ventas: any[];
  venta_items: any[];
  pagos: any[];
}

let db: Database = { users: [], gallineros: [], produccion: [], clientes: [], ventas: [], venta_items: [], pagos: [] };

// Cargar o crear DB
export const initDB = () => {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } else {
    db = { users: [], gallineros: [], produccion: [], clientes: [], ventas: [], venta_items: [], pagos: [] };
    seedData();
    saveDB();
  }
  console.log('✅ JSON DB cargada');
};

const saveDB = () => {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
};

const seedData = () => {
  // Usuario admin
  db.users.push({
    id: crypto.randomUUID(),
    username: 'admin',
    password: bcrypt.hashSync('admin123', 10),
    name: 'Administrador',
    role: 'admin',
    active: true,
    created_at: new Date().toISOString(),
  });

  // Gallineros de ejemplo
  db.gallineros = [
    { id: crypto.randomUUID(), name: 'Gallinero A', description: 'Gallinas ponedoras norte', chicken_count: 50, status: 'active', created_at: new Date().toISOString() },
    { id: crypto.randomUUID(), name: 'Gallinero B', description: 'Gallinas ponedoras sur', chicken_count: 45, status: 'active', created_at: new Date().toISOString() },
    { id: crypto.randomUUID(), name: 'Gallinero C', description: 'Gallinas nuevas', chicken_count: 30, status: 'active', created_at: new Date().toISOString() },
  ];

  // Clientes de ejemplo
  const juanId = crypto.randomUUID();
  const mariaId = crypto.randomUUID();
  const pedroId = crypto.randomUUID();

  db.clientes = [
    { id: juanId, nombre: 'Juan Pérez', telefono: '123-456-7890', direccion: 'Calle Principal 123', observaciones: '', saldo: 0, created_at: new Date().toISOString() },
    { id: mariaId, nombre: 'María García', telefono: '098-765-4321', direccion: 'Avenida Central 456', observaciones: '', saldo: 0, created_at: new Date().toISOString() },
    { id: pedroId, nombre: 'Pedro López', telefono: '555-123-4567', direccion: 'Barrio Norte 789', observaciones: 'Cliente mayorista', saldo: 15000, created_at: new Date().toISOString() },
  ];

  // Venta seed para Pedro (deuda de ejemplo)
  const ventaPedroId = crypto.randomUUID();
  db.ventas.push({
    id: ventaPedroId,
    cliente_id: pedroId,
    fecha: new Date(Date.now() - 86400000).toISOString(), // ayer
    total: 25000,
    pagado: 10000,
    saldo: 15000,
    estado: 'parcial',
    es_fiado: 1,
    created_at: new Date().toISOString(),
  });
  db.venta_items.push(
    { id: crypto.randomUUID(), venta_id: ventaPedroId, size: 'L', cantidad: 50, precio_unitario: 300, subtotal: 15000 },
    { id: crypto.randomUUID(), venta_id: ventaPedroId, size: 'XL', cantidad: 20, precio_unitario: 500, subtotal: 10000 }
  );

  // Producción seed de hoy
  const hoy = new Date().toISOString().split('T')[0];
  db.gallineros.forEach((g: any) => {
    db.produccion.push({
      id: crypto.randomUUID(),
      gallinero_id: g.id,
      fecha: hoy,
      S: Math.floor(Math.random() * 5),
      M: Math.floor(Math.random() * 10) + 5,
      L: Math.floor(Math.random() * 15) + 10,
      XL: Math.floor(Math.random() * 8) + 2,
      created_at: new Date().toISOString(),
    });
  });
};

// API de base de datos
export const query = {
  // Users
  findUserByUsername: (username: string) => db.users.find(u => u.username === username && u.active),
  findUserById: (id: string) => db.users.find(u => u.id === id),

  // Gallineros
  getAllGallineros: () => db.gallineros.filter(g => g.status === 'active'),
  findGallineroById: (id: string) => db.gallineros.find(g => g.id === id),
  insertGallinero: (g: any) => { db.gallineros.push(g); saveDB(); return g; },
  updateGallinero: (id: string, data: any) => {
    const idx = db.gallineros.findIndex(g => g.id === id);
    if (idx >= 0) { db.gallineros[idx] = { ...db.gallineros[idx], ...data, updated_at: new Date().toISOString() }; saveDB(); }
    return idx >= 0;
  },
  deleteGallinero: (id: string) => {
    const idx = db.gallineros.findIndex(g => g.id === id);
    if (idx >= 0) { db.gallineros[idx].status = 'inactive'; saveDB(); }
    return idx >= 0;
  },

  // Producción
  getProduccionByDate: (fecha: string) => db.produccion.filter(p => p.fecha === fecha),
  insertProduccion: (p: any) => { db.produccion.push(p); saveDB(); return p; },
  getProduccionLast7Days: () => {
    const last7 = new Date(); last7.setDate(last7.getDate() - 7);
    return db.produccion.filter(p => new Date(p.fecha) >= last7);
  },

  // Clientes
  getAllClientes: () => db.clientes,
  findClienteById: (id: string) => db.clientes.find(c => c.id === id),
  insertCliente: (c: any) => { db.clientes.push(c); saveDB(); return c; },
  updateCliente: (id: string, data: any) => {
    const idx = db.clientes.findIndex(c => c.id === id);
    if (idx >= 0) { db.clientes[idx] = { ...db.clientes[idx], ...data, updated_at: new Date().toISOString() }; saveDB(); }
    return idx >= 0;
  },
  updateClienteSaldo: (id: string, saldo: number) => {
    const idx = db.clientes.findIndex(c => c.id === id);
    if (idx >= 0) { db.clientes[idx].saldo = saldo; saveDB(); }
  },

  // Ventas
  getAllVentas: () => db.ventas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
  insertVenta: (v: any) => { db.ventas.push(v); saveDB(); return v; },
  findVentaById: (id: string) => db.ventas.find(v => v.id === id),
  updateVenta: (id: string, data: any) => {
    const idx = db.ventas.findIndex(v => v.id === id);
    if (idx >= 0) { db.ventas[idx] = { ...db.ventas[idx], ...data, updated_at: new Date().toISOString() }; saveDB(); }
    return idx >= 0;
  },
  insertVentaItem: (i: any) => { db.venta_items.push(i); saveDB(); return i; },
  getVentaItems: (ventaId: string) => db.venta_items.filter(i => i.venta_id === ventaId),
  getVentasByDate: (fecha: string) => db.ventas.filter(v => v.fecha.startsWith(fecha)),

  // Pagos
  insertPago: (p: any) => { db.pagos.push(p); saveDB(); return p; },
};

export default db;
