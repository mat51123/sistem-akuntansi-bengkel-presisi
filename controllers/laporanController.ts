import { Request, Response } from 'express';
import { getDB } from '../config/db.js';

export async function getLaporan(req: Request, res: Response) {
  try {
    const db = await getDB();

    // ==========================================
    // 1. LAPORAN LABA RUGI (PENDAPATAN - BEBAN)
    // ==========================================
    
    // Fetch all pendapatan (kode_akun kepala 4)
    const pendapatanRaw = await db.query(`
      SELECT a.kode_akun, a.nama_akun,
             SUM(j.kredit) - SUM(j.debit) as saldo
      FROM akun a
      JOIN jurnal_umum j ON a.kode_akun = j.kode_akun
      WHERE a.kode_akun LIKE '4%'
      GROUP BY a.kode_akun, a.nama_akun
      HAVING saldo != 0
    `);
    
    let totalPendapatan = 0;
    const listPendapatan = pendapatanRaw.map(p => {
      totalPendapatan += p.saldo;
      return { kode: p.kode_akun, nama: p.nama_akun, total: p.saldo };
    });

    // Fetch all beban (kode_akun kepala 5)
    const bebanRaw = await db.query(`
      SELECT a.kode_akun, a.nama_akun,
             SUM(j.debit) - SUM(j.kredit) as saldo
      FROM akun a
      JOIN jurnal_umum j ON a.kode_akun = j.kode_akun
      WHERE a.kode_akun LIKE '5%'
      GROUP BY a.kode_akun, a.nama_akun
      HAVING saldo != 0
    `);

    let totalBeban = 0;
    const listBeban = bebanRaw.map(b => {
      totalBeban += b.saldo;
      return { kode: b.kode_akun, nama: b.nama_akun, total: b.saldo };
    });

    const labaBersih = totalPendapatan - totalBeban;

    // ==========================================
    // 2. LAPORAN PERUBAHAN MODAL
    // ==========================================
    
    // Ambil saldo Modal Awal (semua akun kepala 3 kecuali 3102/Prive)
    const modalRaw = await db.query(`
      SELECT SUM(kredit) - SUM(debit) as saldo 
      FROM jurnal_umum 
      WHERE kode_akun LIKE '3%' AND kode_akun != '3102'
    `);
    const modalAwal = modalRaw[0]?.saldo || 0;

    // Ambil saldo Prive (kode_akun kepala 3, standar 3102 atau akun prive)
    const priveRaw = await db.query(`
      SELECT SUM(debit) - SUM(kredit) as saldo 
      FROM jurnal_umum 
      WHERE kode_akun = '3102'
    `);
    const totalPrive = priveRaw[0]?.saldo || 0;

    const modalAkhir = modalAwal + labaBersih - totalPrive;

    // ==========================================
    // 3. NERACA (ASET vs KEWAJIBAN + MODAL AKHIR)
    // ==========================================

    // List all Assets (KODE KEPALA 1)
    const asetRaw = await db.query(`
      SELECT a.kode_akun, a.nama_akun,
             SUM(j.debit) - SUM(j.kredit) as saldo
      FROM akun a
      JOIN jurnal_umum j ON a.kode_akun = j.kode_akun
      WHERE a.kode_akun LIKE '1%'
      GROUP BY a.kode_akun, a.nama_akun
      HAVING saldo != 0
    `);

    let totalAset = 0;
    const listAset = asetRaw.map(a => {
      totalAset += a.saldo;
      return { kode: a.kode_akun, nama: a.nama_akun, total: a.saldo };
    });

    // List all Liabilities (KODE KEPALA 2)
    const kewajibanRaw = await db.query(`
      SELECT a.kode_akun, a.nama_akun,
             SUM(j.kredit) - SUM(j.debit) as saldo
      FROM akun a
      JOIN jurnal_umum j ON a.kode_akun = j.kode_akun
      WHERE a.kode_akun LIKE '2%'
      GROUP BY a.kode_akun, a.nama_akun
      HAVING saldo != 0
    `);

    let totalKewajiban = 0;
    const listKewajiban = kewajibanRaw.map(k => {
      totalKewajiban += k.saldo;
      return { kode: k.kode_akun, nama: k.nama_akun, total: k.saldo };
    });

    const totalKewajibanDanEkuitas = totalKewajiban + modalAkhir;

    res.render('laporan/index', {
      listPendapatan,
      totalPendapatan,
      listBeban,
      totalBeban,
      labaBersih,
      modalAwal,
      totalPrive,
      modalAkhir,
      listAset,
      totalAset,
      listKewajiban,
      totalKewajiban,
      totalKewajibanDanEkuitas,
      title: 'Laporan Keuangan Otomatis | Bengkel Presisi',
      activePage: 'laporan'
    });
  } catch (error) {
    console.error('Error in getLaporan:', error);
    res.status(500).send('Internal Server Error');
  }
}
