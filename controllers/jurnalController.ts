import { Request, Response } from 'express';
import { getDB } from '../config/db.js';

export async function getJurnal(req: Request, res: Response) {
  try {
    const { start_date, end_date, kode_akun } = req.query;
    const db = await getDB();

    // Prepare query parameters and where clause
    let sql = `
      SELECT j.*, t.keterangan, a.nama_akun 
      FROM jurnal_umum j
      JOIN transaksi t ON j.id_transaksi = t.id_transaksi
      JOIN akun a ON j.kode_akun = a.kode_akun
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (start_date) {
      conditions.push('t.tanggal >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('t.tanggal <= ?');
      params.push(end_date);
    }
    if (kode_akun && kode_akun !== 'Semua') {
      conditions.push('j.kode_akun = ?');
      params.push(kode_akun);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    // Sort chronologically by date, transaction, and debits first (standard accounting style)
    sql += ' ORDER BY t.tanggal ASC, t.id_transaksi ASC, j.debit DESC, j.id_jurnal ASC';

    const journalEntries = await db.query(sql, params);

    // Group journal entries by id_transaksi to render them beautifully in textbook style
    const groupedJurnal: any[] = [];
    const transactionMap: { [key: number]: any } = {};

    for (const entry of journalEntries) {
      const txId = entry.id_transaksi;
      if (!transactionMap[txId]) {
        transactionMap[txId] = {
          id_transaksi: txId,
          tanggal: entry.tanggal,
          keterangan: entry.keterangan,
          items: [],
          total_tx: 0
        };
        groupedJurnal.push(transactionMap[txId]);
      }
      transactionMap[txId].items.push({
        id_jurnal: entry.id_jurnal,
        kode_akun: entry.kode_akun,
        nama_akun: entry.nama_akun,
        debit: entry.debit,
        kredit: entry.kredit
      });
      transactionMap[txId].total_tx += entry.debit; // Summing debits only for balance display
    }

    // Sum overall debit & credit for the footer
    let totalOverallDebit = 0;
    let totalOverallKredit = 0;
    for (const entry of journalEntries) {
      totalOverallDebit += entry.debit;
      totalOverallKredit += entry.kredit;
    }

    // Get list of accounts for the filter dropdown
    const accounts = await db.query('SELECT * FROM akun ORDER BY kode_akun ASC');

    res.render('jurnal/index', {
      groupedJurnal,
      totalOverallDebit,
      totalOverallKredit,
      accounts,
      filters: { start_date, end_date, kode_akun },
      title: 'Jurnal Umum | Bengkel Presisi',
      activePage: 'jurnal'
    });
  } catch (error) {
    console.error('Error in getJurnal:', error);
    res.status(500).send('Internal Server Error');
  }
}
