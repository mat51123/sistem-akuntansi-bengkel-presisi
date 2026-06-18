import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const queries = [
  // 1. Table Pengguna
  `CREATE TABLE IF NOT EXISTS pengguna (
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(100) NOT NULL,
    PRIMARY KEY (username)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 2. Table Akun
  `CREATE TABLE IF NOT EXISTS akun (
    kode_akun VARCHAR(10) NOT NULL,
    nama_akun VARCHAR(100) NOT NULL,
    kelompok VARCHAR(50) NOT NULL,
    saldo_normal ENUM('Debit', 'Kredit') NOT NULL,
    PRIMARY KEY (kode_akun)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 3. Table Transaksi
  `CREATE TABLE IF NOT EXISTS transaksi (
    id_transaksi INT NOT NULL AUTO_INCREMENT,
    tanggal DATE NOT NULL,
    keterangan VARCHAR(255) NOT NULL,
    PRIMARY KEY (id_transaksi)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 4. Table Detail Transaksi
  `CREATE TABLE IF NOT EXISTS transaksi_detail (
    id_detail INT NOT NULL AUTO_INCREMENT,
    id_transaksi INT NOT NULL,
    kode_akun VARCHAR(10) NOT NULL,
    jenis_mutasi ENUM('Debit', 'Kredit') NOT NULL,
    nominal DECIMAL(15,2) NOT NULL,
    PRIMARY KEY (id_detail),
    CONSTRAINT fk_detail_transaksi FOREIGN KEY (id_transaksi) REFERENCES transaksi (id_transaksi) ON DELETE CASCADE,
    CONSTRAINT fk_detail_akun FOREIGN KEY (kode_akun) REFERENCES akun (kode_akun) ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 5. Table Jurnal Umum
  `CREATE TABLE IF NOT EXISTS jurnal_umum (
    id_jurnal INT NOT NULL AUTO_INCREMENT,
    id_transaksi INT NOT NULL,
    tanggal DATE NOT NULL,
    kode_akun VARCHAR(10) NOT NULL,
    debit DECIMAL(15,2) DEFAULT '0.00',
    kredit DECIMAL(15,2) DEFAULT '0.00',
    PRIMARY KEY (id_jurnal),
    CONSTRAINT fk_jurnal_transaksi FOREIGN KEY (id_transaksi) REFERENCES transaksi (id_transaksi) ON DELETE CASCADE,
    CONSTRAINT fk_jurnal_akun FOREIGN KEY (kode_akun) REFERENCES akun (kode_akun) ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 6. Drop Trigger
  `DROP TRIGGER IF EXISTS after_transaksi_detail_insert;`,

  // 7. Create Trigger
  `CREATE TRIGGER after_transaksi_detail_insert
  AFTER INSERT ON transaksi_detail
  FOR EACH ROW
  BEGIN
    DECLARE var_tanggal DATE;
    SELECT tanggal INTO var_tanggal FROM transaksi WHERE id_transaksi = NEW.id_transaksi;
    IF NEW.jenis_mutasi = 'Debit' THEN
      INSERT INTO jurnal_umum (id_transaksi, tanggal, kode_akun, debit, kredit)
      VALUES (NEW.id_transaksi, var_tanggal, NEW.kode_akun, NEW.nominal, 0.00);
    ELSEIF NEW.jenis_mutasi = 'Kredit' THEN
      INSERT INTO jurnal_umum (id_transaksi, tanggal, kode_akun, debit, kredit)
      VALUES (NEW.id_transaksi, var_tanggal, NEW.kode_akun, 0.00, NEW.nominal);
    END IF;
  END;`,

  // Cleanup old records to ensure only the requested accounts/data exist
  `DELETE FROM jurnal_umum;`,
  `DELETE FROM transaksi_detail;`,
  `DELETE FROM transaksi;`,
  `DELETE FROM akun;`,

  // 8. Seed Default Admin User
  `INSERT IGNORE INTO pengguna (username, password, nama_lengkap) VALUES ('admin', 'admin123', 'Budi Mekanik');`,

  // 9. Seed Chart of Accounts (COA)
  `INSERT IGNORE INTO akun (kode_akun, nama_akun, kelompok, saldo_normal) VALUES
  ('1101', 'Kas/Bank', 'Aset Lancar', 'Debit'),
  ('1102', 'Piutang Usaha', 'Aset Lancar', 'Debit'),
  ('1103', 'Perlengkapan Bengkel', 'Aset Lancar', 'Debit'),
  ('1201', 'Peralatan Bengkel', 'Aset Tetap', 'Debit'),
  ('2101', 'Utang Usaha', 'Kewajiban', 'Kredit'),
  ('3101', 'Modal Pemilik', 'Ekuitas', 'Kredit'),
  ('3102', 'Prive Pemilik', 'Ekuitas', 'Debit'),
  ('4101', 'Pendapatan Jasa Servis', 'Pendapatan', 'Kredit'),
  ('5101', 'Beban Gaji Karyawan', 'Beban', 'Debit'),
  ('5102', 'Beban Listrik & Air', 'Beban', 'Debit');`,

  // 10. Seed Default Transactions
  `INSERT IGNORE INTO transaksi (id_transaksi, tanggal, keterangan) VALUES
  (1, '2026-05-01', 'Setoran Modal Awal Budi'),
  (2, '2026-05-03', 'Pembelian Kompresor & Toolkit Tunai'),
  (3, '2026-05-10', 'Penerimaan Pendapatan Jasa Servis Motor'),
  (4, '2026-05-15', 'Pembayaran Listrik & Air Bengkel Mei'),
  (5, '2026-05-20', 'Pembayaran Gaji Mekanik'),
  (6, '2026-05-22', 'Penarikan Prive Kas untuk Budi');`,

  // 11. Seed Transaction Details
  `INSERT IGNORE INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES
  (1, '1101', 'Debit', 50000000.00),
  (1, '3101', 'Kredit', 50000000.00),
  (2, '1201', 'Debit', 15000000.00),
  (2, '1101', 'Kredit', 15000000.00),
  (3, '1101', 'Debit', 12500000.00),
  (3, '4101', 'Kredit', 12500000.00),
  (4, '5102', 'Debit', 750000.00),
  (4, '1101', 'Kredit', 750000.00),
  (5, '5101', 'Debit', 4500000.00),
  (5, '1101', 'Kredit', 4500000.00),
  (6, '3102', 'Debit', 1500000.00),
  (6, '1101', 'Kredit', 1500000.00);`
];

async function main() {
  if (!process.env.DB_HOST) {
    console.error('ERROR: DB_HOST tidak ditemukan di .env local!');
    process.exit(1);
  }

  console.log('Menghubungkan ke database MySQL Aiven...');
  console.log('Host:', process.env.DB_HOST);
  console.log('Database:', process.env.DB_NAME);

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '3306'),
      ssl: { rejectUnauthorized: false }
    });

    console.log('Berhasil terhubung ke database. Memulai instalasi skema...');

    for (let i = 0; i < queries.length; i++) {
      console.log(`Menjalankan query ${i + 1}/${queries.length}...`);
      await connection.query(queries[i]);
    }

    console.log('SUKSES: Seluruh tabel, trigger, dan data awal berhasil dimasukkan ke Aiven!');
    await connection.end();
  } catch (err: any) {
    console.error('SETUP FAILED:', err.message);
  }
}

main();
