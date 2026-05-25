import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

// Let's create an interface for our database executor
export interface Database {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<any>;
  close(): Promise<void>;
  isMySQL(): boolean;
}

// Global DB instance
let dbInstance: Database | null = null;

class SQLiteDatabase implements Database {
  private db: any;

  constructor(sqlite3Lib: any, filePath: string) {
    this.db = new sqlite3Lib.Database(filePath);
  }

  isMySQL(): boolean {
    return false;
  }

  query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows as T[]);
      });
    });
  }

  execute(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ insertId: this.lastID, changes: this.changes });
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}

class MySQLDatabase implements Database {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }

  isMySQL(): boolean {
    return true;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const [rows] = await this.pool.query(sql, params);
    return rows as T[];
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    const [result] = await this.pool.execute(sql, params);
    const res = result as any;
    return { insertId: res.insertId, changes: res.affectedRows };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export async function getDB(): Promise<Database> {
  if (dbInstance) return dbInstance;

  let lastError: Error | null = null;

  // If DB_HOST is defined, attempt to connect to MySQL
  if (process.env.DB_HOST) {
    try {
      console.log('Connecting to MySQL database...');
      dbInstance = new MySQLDatabase();
      // Test the pool
      await dbInstance.query('SELECT 1');
      console.log('Successfully connected to MySQL database.');
      // Auto-initialize MySQL tables if they don't exist
      await initMySQL(dbInstance);
    } catch (error: any) {
      console.error('Failed to connect to MySQL database:', error);
      lastError = error;
      dbInstance = null;
    }
  }

  if (!dbInstance) {
    if (process.env.VERCEL === '1') {
      const technicalDetails = lastError ? ` (Detail: ${lastError.message})` : ' (Detail: DB_HOST tidak dikonfigurasi)';
      throw new Error(`DATABASE CONNECTION ERROR: Database MySQL gagal terhubung pada lingkungan Vercel.${technicalDetails}. Harap periksa apakah Environment Variables Anda sudah benar dan lengkap.`);
    }
    console.log('Initializing local SQLite database (for sandbox preview)...');
    const sqlite3 = await import('sqlite3');
    const dbPath = path.resolve(process.cwd(), 'bengkel.db');
    dbInstance = new SQLiteDatabase(sqlite3.default, dbPath);
    await initSQLite(dbInstance);
  }

  return dbInstance;
}

// Auto-initialize MySQL tables if they don't exist
async function initMySQL(db: Database) {
  // Create table pengguna
  await db.execute(`
    CREATE TABLE IF NOT EXISTS pengguna (
      username VARCHAR(50) NOT NULL,
      password VARCHAR(255) NOT NULL,
      nama_lengkap VARCHAR(100) NOT NULL,
      PRIMARY KEY (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Seed default admin user
  const existUser = await db.query("SELECT COUNT(*) as count FROM pengguna WHERE username = 'admin'");
  if (existUser[0].count === 0) {
    console.log('Seeding default admin user in MySQL...');
    await db.execute(
      "INSERT INTO pengguna (username, password, nama_lengkap) VALUES (?, ?, ?)",
      ['admin', 'admin123', 'Budi Mekanik']
    );
  }
}

// Initialize SQLite schema with triggers and sample seed data
async function initSQLite(db: Database) {
  // Create tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS pengguna (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      nama_lengkap TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS akun (
      kode_akun TEXT PRIMARY KEY,
      nama_akun TEXT NOT NULL,
      kelompok TEXT NOT NULL,
      saldo_normal TEXT NOT NULL CHECK(saldo_normal IN ('Debit', 'Kredit'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS transaksi (
      id_transaksi INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL,
      keterangan TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS transaksi_detail (
      id_detail INTEGER PRIMARY KEY AUTOINCREMENT,
      id_transaksi INTEGER NOT NULL,
      kode_akun TEXT NOT NULL,
      jenis_mutasi TEXT NOT NULL CHECK(jenis_mutasi IN ('Debit', 'Kredit')),
      nominal REAL NOT NULL,
      FOREIGN KEY (id_transaksi) REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
      FOREIGN KEY (kode_akun) REFERENCES akun(kode_akun)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS jurnal_umum (
      id_jurnal INTEGER PRIMARY KEY AUTOINCREMENT,
      id_transaksi INTEGER NOT NULL,
      tanggal TEXT NOT NULL,
      kode_akun TEXT NOT NULL,
      debit REAL DEFAULT 0.0,
      kredit REAL DEFAULT 0.0,
      FOREIGN KEY (id_transaksi) REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
      FOREIGN KEY (kode_akun) REFERENCES akun(kode_akun)
    );
  `);

  // Create SQLite Trigger that automatically populates 'jurnal_umum' table
  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS after_transaksi_detail_insert
    AFTER INSERT ON transaksi_detail
    FOR EACH ROW
    BEGIN
      INSERT INTO jurnal_umum (id_transaksi, tanggal, kode_akun, debit, kredit)
      SELECT 
        NEW.id_transaksi,
        t.tanggal,
        NEW.kode_akun,
        CASE WHEN NEW.jenis_mutasi = 'Debit' THEN NEW.nominal ELSE 0.0 END,
        CASE WHEN NEW.jenis_mutasi = 'Kredit' THEN NEW.nominal ELSE 0.0 END
      FROM transaksi t
      WHERE t.id_transaksi = NEW.id_transaksi;
    END;
  `);

  // Seed default admin user if not exists
  const existUser = await db.query("SELECT COUNT(*) as count FROM pengguna WHERE username = 'admin'");
  if (existUser[0].count === 0) {
    console.log('Seeding default admin user...');
    await db.execute(
      "INSERT INTO pengguna (username, password, nama_lengkap) VALUES (?, ?, ?)",
      ['admin', 'admin123', 'Budi Mekanik']
    );
  }

  // Seed sample data if table 'akun' is empty
  const existAkun = await db.query('SELECT COUNT(*) as count FROM akun');
  if (existAkun[0].count === 0) {
    console.log('Seeding initial Chart of Accounts...');
    const coaList = [
      { code: '1101', name: 'Kas/Bank', group: 'Aset Lancar', normal: 'Debit' },
      { code: '1102', name: 'Piutang Usaha', group: 'Aset Lancar', normal: 'Debit' },
      { code: '1103', name: 'Perlengkapan Bengkel', group: 'Aset Lancar', normal: 'Debit' },
      { code: '1201', name: 'Peralatan Bengkel', group: 'Aset Tetap', normal: 'Debit' },
      { code: '1202', name: 'Akumulasi Penyusutan Peralatan', group: 'Aset Tetap', normal: 'Kredit' },
      { code: '2101', name: 'Utang Usaha', group: 'Kewajiban', normal: 'Kredit' },
      { code: '3101', name: 'Modal Pemilik', group: 'Ekuitas', normal: 'Kredit' },
      { code: '3102', name: 'Prive Pemilik', group: 'Ekuitas', normal: 'Debit' },
      { code: '4101', name: 'Pendapatan Jasa Servis', group: 'Pendapatan', normal: 'Kredit' },
      { code: '4102', name: 'Pendapatan Penjualan Sparepart', group: 'Pendapatan', normal: 'Kredit' },
      { code: '5101', name: 'Beban Gaji Karyawan', group: 'Beban', normal: 'Debit' },
      { code: '5102', name: 'Beban Listrik & Air', group: 'Beban', normal: 'Debit' },
      { code: '5103', name: 'Beban Perlengkapan', group: 'Beban', normal: 'Debit' },
    ];

    for (const coa of coaList) {
      await db.execute(
        'INSERT INTO akun (kode_akun, nama_akun, kelompok, saldo_normal) VALUES (?, ?, ?, ?)',
        [coa.code, coa.name, coa.group, coa.normal]
      );
    }

    console.log('Seeding initial transactions...');

    // Transaction 1: Modal Awal Budi
    await db.execute('INSERT INTO transaksi (tanggal, keterangan) VALUES (?, ?)', ['2026-05-01', 'Setoran Modal Awal Budi']);
    await db.execute('INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES (?, ?, ?, ?)', [1, '1101', 'Debit', 50000000]);
    await db.execute('INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES (?, ?, ?, ?)', [1, '3101', 'Kredit', 50000000]);

    // Transaction 2: Pembelian Peralatan Bengkel
    await db.execute('INSERT INTO transaksi (tanggal, keterangan) VALUES (?, ?)', ['2026-05-03', 'Pembelian Kompresor & Toolkit Tunai']);
    await db.execute('INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES (?, ?, ?, ?)', [2, '1201', 'Debit', 15000000]);
    await db.execute('INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES (?, ?, ?, ?)', [2, '1101', 'Kredit', 15000000]);

    // Transaction 3: Pendapatan Jasa Servis Total
    await db.execute('INSERT INTO transaksi (tanggal, keterangan) VALUES (?, ?)', ['2026-05-10', 'Penerimaan Pendapatan Jasa Servis Motor']);
    await db.execute('INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES (?, ?, ?, ?)', [3, '1101', 'Debit', 12500000]);
    await db.execute('INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES (?, ?, ?, ?)', [3, '4101', 'Kredit', 12500000]);

    // Transaction 4: Beban Listrik & Air
    await db.execute('INSERT INTO transaksi (tanggal, keterangan) VALUES (?, ?)', ['2026-05-15', 'Pembayaran Listrik & Air Bengkel Mei']);
    await db.execute('INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES (?, ?, ?, ?)', [4, '5102', 'Debit', 750000]);
    await db.execute('INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES (?, ?, ?, ?)', [4, '1101', 'Kredit', 750000]);

    // Transaction 5: Beban Gaji Karyawan
    await db.execute('INSERT INTO transaksi (tanggal, keterangan) VALUES (?, ?)', ['2026-05-20', 'Pembayaran Gaji Mekanik']);
    await db.execute('INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES (?, ?, ?, ?)', [5, '5101', 'Debit', 4500000]);
    await db.execute('INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES (?, ?, ?, ?)', [5, '1101', 'Kredit', 4500000]);

    // Transaction 6: Prive Pemilik
    await db.execute('INSERT INTO transaksi (tanggal, keterangan) VALUES (?, ?)', ['2026-05-22', 'Penarikan Prive Kas untuk Budi']);
    await db.execute('INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES (?, ?, ?, ?)', [6, '3102', 'Debit', 1500000]);
    await db.execute('INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES (?, ?, ?, ?)', [6, '1101', 'Kredit', 1500000]);

    console.log('Database seeded successfully.');
  }
}
