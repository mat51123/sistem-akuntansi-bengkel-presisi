import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import router from './routes/index.js';
import { getDB } from './config/db.js';

dotenv.config();

const app = express();
const PORT = 3000;

// Set up EJS template engine
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

// Handlers for Request Payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static resources if needed
app.use(express.static(path.join(process.cwd(), 'public')));

// Intercept database errors and render a beautiful, detailed error page
app.use(async (req, res, next) => {
  try {
    await getDB();
    next();
  } catch (err: any) {
    console.error('Database connection error intercepted:', err.message);
    res.status(500).render('db-error', {
      title: 'Koneksi Database Gagal - Bengkel Presisi',
      error: err.message,
      host: process.env.DB_HOST || '(belum diatur)',
      user: process.env.DB_USER || '(belum diatur)',
      port: process.env.DB_PORT || '(belum diatur)',
      database: process.env.DB_NAME || '(belum diatur)'
    });
  }
});

// Set up unified application router
app.use('/', router);

// Handle page not found errors (404)
app.use((req, res) => {
  res.status(404).send('Halaman Akuntansi Tidak Ditemukan - Bengkel Presisi (404)');
});

async function startServer() {
  try {
    // Force database initialization on startup
    const db = await getDB();
    console.log('Database pool verified.');
  } catch (err) {
    console.error('Warning: Failed to connect database on startup:', err);
    if (process.env.VERCEL !== '1') {
      console.error('Fatal: Exiting local server startup due to db failure.');
      process.exit(1);
    }
  }

  // Only start listening if not running on Vercel (serverless mode)
  if (process.env.VERCEL !== '1') {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Express app running on http://localhost:${PORT}`);
    });
  }
}

startServer();
export default app;

