import { Request, Response } from 'express';
import { getDB } from '../config/db.js';

export async function getAkunList(req: Request, res: Response) {
  try {
    const db = await getDB();
    const accounts = await db.query('SELECT * FROM akun ORDER BY kode_akun ASC');
    
    // Group totals for account dashboard
    const asetResult = await db.query("SELECT SUM(debit) - SUM(kredit) as total FROM jurnal_umum WHERE kode_akun LIKE '1%'");
    const kewajibanResult = await db.query("SELECT SUM(kredit) - SUM(debit) as total FROM jurnal_umum WHERE kode_akun LIKE '2%'");
    
    res.render('akun/index', {
      accounts,
      totalAset: asetResult[0]?.total || 0,
      totalKewajiban: kewajibanResult[0]?.total || 0,
      jumlahAkun: accounts.length,
      title: 'Daftar Akun | Bengkel Presisi',
      activePage: 'akun',
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('Error in getAkunList:', error);
    res.status(500).send('Internal Server Error');
  }
}

export async function createAkun(req: Request, res: Response) {
  const { kode_akun, nama_akun, kelompok, saldo_normal } = req.body;
  if (!kode_akun || !nama_akun || !kelompok || !saldo_normal) {
    return res.redirect('/akun?error=Semua field harus diisi!');
  }

  try {
    const db = await getDB();
    // Check if duplicate
    const existing = await db.query('SELECT * FROM akun WHERE kode_akun = ?', [kode_akun]);
    if (existing.length > 0) {
      return res.redirect(`/akun?error=Kode akun ${kode_akun} sudah terdaftar!`);
    }

    await db.execute(
      'INSERT INTO akun (kode_akun, nama_akun, kelompok, saldo_normal) VALUES (?, ?, ?, ?)',
      [kode_akun, nama_akun, kelompok, saldo_normal]
    );

    res.redirect('/akun?success=Akun berhasil didaftarkan!');
  } catch (error) {
    console.error('Error in createAkun:', error);
    res.redirect('/akun?error=Gagal menyimpan akun baru.');
  }
}

export async function updateAkun(req: Request, res: Response) {
  const { kode_akun } = req.params;
  const { nama_akun, kelompok, saldo_normal } = req.body;

  if (!nama_akun || !kelompok || !saldo_normal) {
    return res.redirect('/akun?error=Data edit tidak lengkap!');
  }

  try {
    const db = await getDB();
    await db.execute(
      'UPDATE akun SET nama_akun = ?, kelompok = ?, saldo_normal = ? WHERE kode_akun = ?',
      [nama_akun, kelompok, saldo_normal, kode_akun]
    );
    res.redirect('/akun?success=Data akun berhasil diperbarui!');
  } catch (error) {
    console.error('Error in updateAkun:', error);
    res.redirect('/akun?error=Gagal memperbarui data akun.');
  }
}

export async function deleteAkun(req: Request, res: Response) {
  const { kode_akun } = req.params;

  try {
    const db = await getDB();
    
    // Check if any transactions reference this account in jurnal_umum or detail
    const checks = await db.query('SELECT COUNT(*) as count FROM transaksi_detail WHERE kode_akun = ?', [kode_akun]);
    if (checks[0].count > 0) {
      return res.redirect('/akun?error=Akun ini tidak bisa dihapus karena sudah memiliki riwayat transaksi.');
    }

    await db.execute('DELETE FROM akun WHERE kode_akun = ?', [kode_akun]);
    res.redirect('/akun?success=Akun berhasil dihapus!');
  } catch (error) {
    console.error('Error in deleteAkun:', error);
    res.redirect('/akun?error=Gagal menghapus akun.');
  }
}
