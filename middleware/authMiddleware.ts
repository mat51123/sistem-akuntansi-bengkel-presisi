import { Request, Response, NextFunction } from 'express';

// Extend Express Request interface to include session info
declare global {
  namespace Express {
    interface Request {
      session?: {
        username: string;
        nama_lengkap: string;
      };
    }
  }
}

export function parseCookies(cookieHeader: string) {
  const list: { [key: string]: string } = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=');
    if (name && value) {
      list[name] = value;
    }
  });

  return list;
}

// Middleware to protect routes and require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie || '');
  
  if (cookies.session_username && cookies.session_nama) {
    req.session = {
      username: cookies.session_username,
      nama_lengkap: decodeURIComponent(cookies.session_nama)
    };
    // Expose session to EJS views
    res.locals.session = req.session;
    return next();
  }

  // Redirect to login if unauthorized
  res.redirect('/login');
}

// Middleware for auth pages (redirects logged-in users away from /login)
export function redirectIfLoggedIn(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie || '');
  
  if (cookies.session_username && cookies.session_nama) {
    return res.redirect('/dashboard');
  }
  
  next();
}
