const { supabase } = require('../config/supabase');
const { UnauthorizedError } = require('../utils/errors');

async function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return next(new UnauthorizedError('Missing token'));
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return next(new UnauthorizedError('Invalid or expired token'));
  req.user = { id: data.user.id, email: data.user.email };
  next();
}

module.exports = authenticate;
