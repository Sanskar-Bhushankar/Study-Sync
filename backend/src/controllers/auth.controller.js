const authService = require('../services/auth.service');
const { requireFields, emailFormat } = require('../utils/validators');

async function register(req, res, next) {
  try {
    requireFields(req.body, ['email', 'password', 'full_name']);
    emailFormat(req.body.email);
    const data = await authService.register(req.body.email, req.body.password, req.body.full_name);
    const session = data?.session;
    const user = data?.user;
    let userProfile = null;
    if (session?.access_token && user?.id) {
      try {
        userProfile = await require('../services/user.service').getProfile(user.id);
      } catch (_) {}
    }
    res.status(201).json({
      success: true,
      data: { user: userProfile || user, session },
    });
  } catch (e) {
    next(e);
  }
}

async function login(req, res, next) {
  try {
    requireFields(req.body, ['email', 'password']);
    const data = await authService.login(req.body.email, req.body.password);
    const { access_token, refresh_token } = data.session;
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 60 * 60 * 24 * 7 * 1000,
    });
    const userRes = await require('../services/user.service').getProfile(data.user.id);
    res.json({ success: true, access_token, refresh_token, user: userRes });
  } catch (e) {
    next(e);
  }
}

async function logout(req, res, next) {
  try {
    res.clearCookie('refresh_token');
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

function getRefreshToken(req) {
  // 1. try HttpOnly cookie (same-domain / native app)
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/refresh_token=([^;]+)/);
  if (m) return m[1].trim();
  // 2. fallback: body field (cross-origin clients that can't send cookies)
  if (req.body?.refresh_token) return req.body.refresh_token;
  return null;
}

async function refresh(req, res, next) {
  try {
    const token = getRefreshToken(req);
    if (!token) return next(new (require('../utils/errors').UnauthorizedError)('No refresh token'));
    const data = await authService.refreshSession(token);
    const { access_token, refresh_token } = data.session;
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 60 * 60 * 24 * 7 * 1000,
    });
    const userRes = await require('../services/user.service').getProfile(data.user.id);
    res.json({ success: true, access_token, refresh_token, user: userRes });
  } catch (e) {
    next(e);
  }
}

module.exports = { register, login, logout, refresh };
