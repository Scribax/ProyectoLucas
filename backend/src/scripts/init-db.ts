import db from '../config/database';
import bcrypt from 'bcryptjs';

console.log('🗄️ Inicializando base de datos SQLite...');

// Crear tablas
db.exec(`
  -- Tabla de usuarios
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'employee', 'guest')) DEFAULT 'employee',
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Tabla de gallineros
  CREATE TABLE IF NOT EXISTS gallineros (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    chicken_count INTEGER DEFAULT 0,
    status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Tabla de producción
  CREATE TABLE IF NOT EXISTS produccion (
    id TEXT PRIMARY KEY,
    gallinero_id TEXT NOT NULL,
    fecha DATE NOT NULL,
    S INTEGER DEFAULT 0,
    M INTEGER DEFAULT 0,
    L INTEGER DEFAULT 0,
    XL INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gallinero_id) REFERENCES gallineros(id) ON DELETE CASCADE
  );

  -- Tabla de clientes
  CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    telefono TEXT,
    direccion TEXT,
    observaciones TEXT,
    saldo REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Tabla de ventas
  CREATE TABLE IF NOT EXISTS ventas (
    id TEXT PRIMARY KEY,
    cliente_id TEXT NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    total REAL NOT NULL,
    pagado REAL DEFAULT 0,
    saldo REAL DEFAULT 0,
    estado TEXT CHECK(estado IN ('pagada', 'parcial', 'fiada')) DEFAULT 'pagada',
    es_fiado INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT
  );

  -- Tabla de items de venta
  CREATE TABLE IF NOT EXISTS venta_items (
    id TEXT PRIMARY KEY,
    venta_id TEXT NOT NULL,
    size TEXT CHECK(size IN ('S', 'M', 'L', 'XL')),
    cantidad INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE
  );

  -- Tabla de pagos
  CREATE TABLE IF NOT EXISTS pagos (
    id TEXT PRIMARY KEY,
    cliente_id TEXT NOT NULL,
    venta_id TEXT,
    monto REAL NOT NULL,
    metodo TEXT CHECK(metodo IN ('efectivo', 'transferencia', 'cheque', 'otro')) DEFAULT 'efectivo',
    observaciones TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE SET NULL
  );

  -- Tabla de auditoría
  CREATE TABLE IF NOT EXISTS auditoria (
    id TEXT PRIMARY KEY,
    tabla TEXT NOT NULL,
    accion TEXT CHECK(accion IN ('INSERT', 'UPDATE', 'DELETE')) NOT NULL,
    registro_id TEXT NOT NULL,
    datos_anteriores TEXT,
    datos_nuevos TEXT,
    user_id TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Verificar si ya hay usuarios
const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

if (existingUsers.count === 0) {
  console.log('👤 Creando usuario admin...');
  
  const adminId = crypto.randomUUID();
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  
  db.prepare(`
    INSERT INTO users (id, username, password, name, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, 'admin', hashedPassword, 'Administrador', 'admin');

  // Crear algunos gallineros de ejemplo
  console.log('🐔 Creando gallineros de ejemplo...');
  
  const gallineros = [
    { id: crypto.randomUUID(), name: 'Gallinero A', description: 'Gallinas ponedoras - lado norte', chicken_count: 50 },
    { id: crypto.randomUUID(), name: 'Gallinero B', description: 'Gallinas ponedoras - lado sur', chicken_count: 45 },
    { id: crypto.randomUUID(), name: 'Gallinero C', description: 'Gallinas nuevas', chicken_count: 30 },
  ];

  const insertGallinero = db.prepare(`
    INSERT INTO gallineros (id, name, description, chicken_count)
    VALUES (?, ?, ?, ?)
  `);

  gallineros.forEach(g => insertGallinero.run(g.id, g.name, g.description, g.chicken_count));

  // Crear clientes de ejemplo
  console.log('👥 Creando clientes de ejemplo...');
  
  const clientes = [
    { id: crypto.randomUUID(), nombre: 'Juan Pérez', telefono: '123-456-7890', direccion: 'Calle Principal 123' },
    { id: crypto.randomUUID(), nombre: 'María García', telefono: '098-765-4321', direccion: 'Avenida Central 456' },
    { id: crypto.randomUUID(), nombre: 'Pedro López', telefono: '555-123-4567', direccion: 'Barrio Norte 789' },
  ];

  const insertCliente = db.prepare(`
    INSERT INTO clientes (id, nombre, telefono, direccion)
    VALUES (?, ?, ?, ?)
  `);

  clientes.forEach(c => insertCliente.run(c.id, c.nombre, c.telefono, c.direccion));

  console.log('✅ Datos de ejemplo creados');
  console.log('');
  console.log('🔑 Credenciales de acceso:');
  console.log('   Usuario: admin');
  console.log('   Contraseña: admin123');
} else {
  console.log('✅ Base de datos ya inicializada');
}

console.log('');
console.log('🎉 Base de datos lista!');

process.exit(0);
