import { Request, Response } from 'express';
import { getDB } from '../config/db.js';

export async function getTransaksiForm(req: Request, res: Response) {
  try {
    const db = await getDB();
    const accounts = await db.query('SELECT * FROM akun ORDER BY kode_akun ASC');
    
    // Get all transactions to show in a database index list
    const transactionsRaw = await db.query(`
      SELECT t.id_transaksi, t.tanggal, t.keterangan,
             (SELECT SUM(nominal) FROM transaksi_detail WHERE id_transaksi = t.id_transaksi AND jenis_mutasi = 'Debit') as total_debit
      FROM transaksi t
      ORDER BY t.tanggal DESC, t.id_transaksi DESC
    `);

    const transactions = transactionsRaw.map(tx => ({
      ...tx,
      total_debit: Number(tx.total_debit || 0)
    }));

    res.render('transaksi/form', {
      accounts,
      transactions,
      title: 'Form & Daftar Transaksi | Bengkel Presisi',
      activePage: 'transaksi',
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('Error in getTransaksiForm:', error);
    res.status(500).send('Internal Server Error');
  }
}

export async function createTransaksi(req: Request, res: Response) {
  const { tanggal, keterangan, kode_akun, jenis_mutasi, nominal } = req.body;

  if (!tanggal || !keterangan || !kode_akun || !jenis_mutasi || !nominal) {
    return res.redirect('/transaksi?error=Formulir tidak lengkap atau detail masih kosong!');
  }

  // Support both single item (string) or multi item (arrays)
  const detailAccounts = Array.isArray(kode_akun) ? kode_akun : [kode_akun];
  const detailMutations = Array.isArray(jenis_mutasi) ? jenis_mutasi : [jenis_mutasi];
  const detailNominals = Array.isArray(nominal) ? nominal : [nominal];

  if (detailAccounts.length < 2) {
    return res.redirect('/transaksi?error=Transaksi harus memiliki minimal 2 jurnal (Debit & Kredit)!');
  }

  // Validate balance
  let sumDebit = 0;
  let sumKredit = 0;

  for (let i = 0; i < detailAccounts.length; i++) {
    const amount = parseFloat(detailNominals[i]);
    if (isNaN(amount) || amount <= 0) {
      return res.redirect('/transaksi?error=Nominal transaksi harus berupa angka positif!');
    }
    
    if (detailMutations[i] === 'Debit') {
      sumDebit += amount;
    } else if (detailMutations[i] === 'Kredit') {
      sumKredit += amount;
    }
  }

  // Allow minor floating point difference issues
  if (Math.abs(sumDebit - sumKredit) > 0.01) {
    return res.redirect(`/transaksi?error=Jurnal tidak seimbang! Total Debit (Rp ${sumDebit.toLocaleString('id-ID')}) tidak sama dengan Total Kredit (Rp ${sumKredit.toLocaleString('id-ID')}).`);
  }

  try {
    const db = await getDB();

    // 1. Insert parent transaksi
    const mainInsert = await db.execute(
      'INSERT INTO transaksi (tanggal, keterangan) VALUES (?, ?)',
      [tanggal, keterangan]
    );
    const idTransaksi = mainInsert.insertId;

    // 2. Insert detail rows
    for (let i = 0; i < detailAccounts.length; i++) {
       await db.execute(
         'INSERT INTO transaksi_detail (id_transaksi, kode_akun, jenis_mutasi, nominal) VALUES (?, ?, ?, ?)',
         [idTransaksi, detailAccounts[i], detailMutations[i], parseFloat(detailNominals[i])]
       );
    }

    res.redirect('/transaksi?success=Transaksi baru berhasil disimpan & otomatis dijurnalkan!');
  } catch (error) {
    console.error('Error in createTransaksi:', error);
    res.redirect('/transaksi?error=Kesalahan internal saat menyimpan transaksi.');
  }
}

export async function deleteTransaksi(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const db = await getDB();
    
    // Deleting from transaksi cascade deletes detail & trigger items due to foreign key deletes!
    // But to be absolutely safe on SQLite without explicit CASCADE active:
    await db.execute('DELETE FROM jurnal_umum WHERE id_transaksi = ?', [id]);
    await db.execute('DELETE FROM transaksi_detail WHERE id_transaksi = ?', [id]);
    await db.execute('DELETE FROM transaksi WHERE id_transaksi = ?', [id]);

    res.redirect('/transaksi?success=Transaksi beserta jurnalnya berhasil dihapus!');
  } catch (error) {
    console.error('Error in deleteTransaksi:', error);
    res.redirect('/transaksi?error=Gagal menghapus transaksi.');
  }
}
