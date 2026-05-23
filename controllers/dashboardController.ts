import { Request, Response } from 'express';
import { getDB } from '../config/db.js';

export async function getDashboard(req: Request, res: Response) {
  try {
    const db = await getDB();

    // 1. Hitung total aset (akun kepala 1)
    const asetResult = await db.query(`
      SELECT 
        SUM(debit) as total_debit, 
        SUM(kredit) as total_kredit 
      FROM jurnal_umum 
      WHERE kode_akun LIKE '1%'
    `);
    const totalAset = (asetResult[0]?.total_debit || 0) - (asetResult[0]?.total_kredit || 0);

    // 2. Hitung total kewajiban (akun kepala 2)
    const kewajibanResult = await db.query(`
      SELECT 
        SUM(debit) as total_debit, 
        SUM(kredit) as total_kredit 
      FROM jurnal_umum 
      WHERE kode_akun LIKE '2%'
    `);
    const totalKewajiban = (kewajibanResult[0]?.total_kredit || 0) - (kewajibanResult[0]?.total_debit || 0);

    // 3. Jumlah Akun Aktif
    const akunResult = await db.query('SELECT COUNT(*) as count FROM akun');
    const jumlahAkun = akunResult[0]?.count || 0;

    // 4. Hitung Pendapatan & Beban untuk Laba Rugi ringkas di dashboard
    const pendapatanResult = await db.query(`
      SELECT SUM(kredit) - SUM(debit) as total 
      FROM jurnal_umum 
      WHERE kode_akun LIKE '4%'
    `);
    const totalPendapatan = pendapatanResult[0]?.total || 0;

    const bebanResult = await db.query(`
      SELECT SUM(debit) - SUM(kredit) as total 
      FROM jurnal_umum 
      WHERE kode_akun LIKE '5%'
    `);
    const totalBeban = bebanResult[0]?.total || 0;
    const labaBersih = totalPendapatan - totalBeban;

    // 5. Ambil 5 transaksi terbaru
    const recentTransactions = await db.query(`
      SELECT t.id_transaksi, t.tanggal, t.keterangan,
             (SELECT SUM(nominal) FROM transaksi_detail WHERE id_transaksi = t.id_transaksi AND jenis_mutasi = 'Debit') as total_nominal
      FROM transaksi t
      ORDER BY t.tanggal DESC, t.id_transaksi DESC
      LIMIT 5
    `);

    res.render('dashboard', {
      totalAset,
      totalKewajiban,
      jumlahAkun,
      labaBersih,
      recentTransactions,
      title: 'Dashboard | Bengkel Presisi',
      activePage: 'dashboard'
    });
  } catch (error) {
    console.error('Error in getDashboard:', error);
    res.status(500).send('Internal Server Error');
  }
}
