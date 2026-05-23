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

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Express app running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Fatal: Failed to startup full-stack accountant application:', err);
    process.exit(1);
  }
}

startServer();
export default app;
