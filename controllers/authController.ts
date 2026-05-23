import { Request, Response } from 'express';
import { getDB } from '../config/db.js';

export function getLogin(req: Request, res: Response) {
  res.render('login', {
    title: 'Login | Bengkel Presisi',
    error: req.query.error || null
  });
}

export async function postLogin(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.redirect('/login?error=Username dan password wajib diisi!');
  }

  try {
    const db = await getDB();
    const result = await db.query(
      'SELECT * FROM pengguna WHERE username = ? AND password = ?',
      [username, password]
    );

    if (result.length > 0) {
      const user = result[0];
      
      // Set simple cookies for session tracking
      res.cookie('session_username', user.username, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true });
      res.cookie('session_nama', encodeURIComponent(user.nama_lengkap), { maxAge: 24 * 60 * 60 * 1000, httpOnly: true });
      
      return res.redirect('/dashboard');
    } else {
      return res.redirect('/login?error=Username atau password salah!');
    }
  } catch (error) {
    console.error('Error in postLogin:', error);
    return res.redirect('/login?error=Terjadi kesalahan pada server.');
  }
}

export function logout(req: Request, res: Response) {
  res.clearCookie('session_username');
  res.clearCookie('session_nama');
  res.redirect('/login');
}
