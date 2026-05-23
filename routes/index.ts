import { Router } from 'express';
import { getDashboard } from '../controllers/dashboardController.js';
import {
  getAkunList,
  createAkun,
  updateAkun,
  deleteAkun
} from '../controllers/akunController.js';
import {
  getTransaksiForm,
  createTransaksi,
  deleteTransaksi
} from '../controllers/transaksiController.js';
import { getJurnal } from '../controllers/jurnalController.js';
import { getLaporan } from '../controllers/laporanController.js';
import {
  getLogin,
  postLogin,
  logout
} from '../controllers/authController.js';
import {
  requireAuth,
  redirectIfLoggedIn
} from '../middleware/authMiddleware.js';

const router = Router();

// Authentication Routes
router.get('/login', redirectIfLoggedIn, getLogin);
router.post('/login', redirectIfLoggedIn, postLogin);
router.get('/logout', logout);

// Protected Dashboard Routes
router.get('/', requireAuth, getDashboard);
router.get('/dashboard', requireAuth, getDashboard);

// Protected Akun (Chart of Accounts) CRUD Routes
router.get('/akun', requireAuth, getAkunList);
router.post('/akun', requireAuth, createAkun);
router.post('/akun/edit/:kode_akun', requireAuth, updateAkun);
router.get('/akun/delete/:kode_akun', requireAuth, deleteAkun);

// Protected Transaksi & Detail CRUD Routes
router.get('/transaksi', requireAuth, getTransaksiForm);
router.post('/transaksi', requireAuth, createTransaksi);
router.get('/transaksi/delete/:id', requireAuth, deleteTransaksi);

// Protected Jurnal Umum
router.get('/jurnal', requireAuth, getJurnal);

// Protected Laporan Keuangan Otomatis
router.get('/laporan', requireAuth, getLaporan);

export default router;
