-- ====================================================================
-- SKEMA & TRIGGER DATABASE BENGKEL PRESISI (MySQL) FOR UAS
-- ====================================================================
-- Deskripsi: Script ini berisi deklarasi tabel-tabel berserta relasinya, 
--            data awal (seeding), dan database TRIGGER AFTER INSERT 
--            sesuai instruksi soal UAS Akuntansi Bengkel.
-- RDBMS: MySQL v8.0 / MariaDB

CREATE DATABASE IF NOT EXISTS uas_bengkel;
USE uas_bengkel;

-- 0. TABEL PENGGUNA (User Authentication)
CREATE TABLE IF NOT EXISTS pengguna (
  username VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  nama_lengkap VARCHAR(100) NOT NULL,
  PRIMARY KEY (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 1. TABEL AKUN (Chart of Accounts)
CREATE TABLE IF NOT EXISTS akun (
  kode_akun VARCHAR(10) NOT NULL,
  nama_akun VARCHAR(100) NOT NULL,
  kelompok VARCHAR(50) NOT NULL,
  saldo_normal ENUM('Debit', 'Kredit') NOT NULL,
  PRIMARY KEY (kode_akun)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. TABEL TRANSAKSI (Transaksi Induk)
CREATE TABLE IF NOT EXISTS transaksi (
  id_transaksi INT NOT NULL AUTO_INCREMENT,
  tanggal DATE NOT NULL,
  keterangan VARCHAR(255) NOT NULL,
  PRIMARY KEY (id_transaksi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. TABEL TRANSAKSI DETAIL (Detail Jurnal Mutasi Tunggal)
CREATE TABLE IF NOT EXISTS transaksi_detail (
  id_detail INT NOT NULL AUTO_INCREMENT,
  id_transaksi INT NOT NULL,
  kode_akun VARCHAR(10) NOT NULL,
  jenis_mutasi ENUM('Debit', 'Kredit') NOT NULL,
  nominal DECIMAL(15,2) NOT NULL,
  PRIMARY KEY (id_detail),
  KEY fk_detail_transaksi (id_transaksi),
  KEY fk_detail_akun (kode_akun),
  CONSTRAINT fk_detail_transaksi FOREIGN KEY (id_transaksi) REFERENCES transaksi (id_transaksi) ON DELETE CASCADE,
  CONSTRAINT fk_detail_akun FOREIGN KEY (kode_akun) REFERENCES akun (kode_akun) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. TABEL JURNAL UMUM (Buku Besar Multi Entri Otomatis)
CREATE TABLE IF NOT EXISTS jurnal_umum (
  id_jurnal INT NOT NULL AUTO_INCREMENT,
  id_transaksi INT NOT NULL,
  tanggal DATE NOT NULL,
  kode_akun VARCHAR(10) NOT NULL,
  debit DECIMAL(15,2) DEFAULT '0.00',
  kredit DECIMAL(15,2) DEFAULT '0.00',
  PRIMARY KEY (id_jurnal),
  KEY fk_jurnal_transaksi (id_transaksi),
  KEY fk_jurnal_akun (kode_akun),
  CONSTRAINT fk_jurnal_transaksi FOREIGN KEY (id_transaksi) REFERENCES transaksi (id_transaksi) ON DELETE CASCADE,
  CONSTRAINT fk_jurnal_akun FOREIGN KEY (kode_akun) REFERENCES akun (kode_akun) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ====================================================================
-- DATABASE TRIGGER: AFTER INSERT ON transaksi_detail (MySQL)
-- ====================================================================
-- Logika: Setiap kali mutasi baru diinput melalui transaksi_detail, 
--         jurnal otomatis menyalin record tersebut ke tabel 'jurnal_umum'.
--         jenis_mutasi='Debit' disalin ke debit, jenis_mutasi='Kredit' ke kredit.

DELIMITER $$

DROP TRIGGER IF EXISTS after_transaksi_detail_insert$$

CREATE TRIGGER after_transaksi_detail_insert
AFTER INSERT ON transaksi_detail
FOR EACH ROW
BEGIN
  DECLARE var_tanggal DATE;
  
  -- Ambil tanggal transaksi dari tabel induk transaksi
  SELECT tanggal INTO var_tanggal 
  FROM transaksi 
  WHERE id_transaksi = NEW.id_transaksi;
  
  -- Insert otomatis ke dalam tabel jurnal_umum berdasarkan mutasi nominal
  IF NEW.jenis_mutasi = 'Debit' THEN
    INSERT INTO jurnal_umum (id_transaksi, tanggal, kode_akun, debit, kredit)
    VALUES (NEW.id_transaksi, var_tanggal, NEW.kode_akun, NEW.nominal, 0.00);
  ELSEIF NEW.jenis_mutasi = 'Kredit' THEN
    INSERT INTO jurnal_umum (id_transaksi, tanggal, kode_akun, debit, kredit)
    VALUES (NEW.id_transaksi, var_tanggal, NEW.kode_akun, 0.00, NEW.nominal);
  END IF;
END$$

DELIMITER ;


-- ====================================================================
-- SEED SAMPLE COA & DATA TRANSAKSI AWAL (UAS DEMO DATA)
-- ====================================================================

-- Input Pengguna Default
INSERT IGNORE INTO pengguna (username, password, nama_lengkap) VALUES
('admin', 'admin123', 'Budi Mekanik');

-- Input Bagan Perkiraan Akun Bengkel standar
INSERT INTO akun (kode_akun, nama_akun, kelompok, saldo_normal) VALUES
('1101', 'Kas/Bank', 'Aset Lancar', 'Debit'),
('1102', 'Piutang Usaha', 'Aset Lancar', 'Debit'),
('1103', 'Perlengkapan Bengkel', 'Aset Lancar', 'Debit'),
('1201', 'Peralatan Bengkel', 'Aset Tetap', 'Debit'),
('1202', 'Akumulasi Penyusutan Peralatan', 'Aset Tetap', 'Kredit'),
('2101', 'Utang Usaha', 'Kewajiban', 'Kredit'),
('3101', 'Modal Pemilik', 'Ekuitas', 'Kredit'),
('3102', 'Prive Pemilik', 'Ekuitas', 'Debit'),
('4101', 'Pendapatan Jasa Servis', 'Pendapatan', 'Kredit'),
('4102', 'Pendapatan Penjualan Sparepart', 'Pendapatan', 'Kredit'),
('5101', 'Beban Gaji Karyawan', 'Beban', 'Debit'),
('5102', 'Beban Listrik & Air', 'Beban', 'Debit'),
('5103', 'Beban Perlengkapan', 'Beban', 'Debit');

-- Input Transaksi Induk
INSERT INTO transaksi (id_transaksi, tanggal, keterangan) VALUES
(1, '2026-05-01', 'Setoran Modal Awal Budi'),
(2, '2026-05-03', 'Pembelian Kompresor & Toolkit Tunai'),
(3, '2026-05-10', 'Penerimaan Pendapatan Jasa Servis Motor'),
(4, '2026-05-15', 'Pembayaran Listrik & Air Bengkel Mei'),
(5, '2026-05-20', 'Pembayaran Gaji Mekanik'),
(6, '2026-05-22', 'Penarikan Prive Kas untuk Budi');

-- Input Rincian Transaksi (Ini akan memicu database TRIGGER di atas secara otomatis mengisi 'jurnal_umum')
INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES
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
(6, '1101', 'Kredit', 1500000.00);


-- ====================================================================
-- QUERY VERIFIKASI SEED DATA (Klik Run di Workbench)
-- ====================================================================
-- SELECT * FROM akun;
-- SELECT * FROM transaksi;
-- SELECT * FROM transaksi_detail;
-- SELECT * FROM jurnal_umum; -- (Otomatis berisi data dari TRIGGER)
