require('dotenv').config();

/** Comma-separated browser origins (no spaces, or trim-safe). Set in .env locally and in Vercel env. */
function getAllowedOrigins() {
  const list = (process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(list)];
}

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) throw new Error(`Missing env: ${missing.join(', ')}`);

if ((process.env.NODE_ENV || 'development') === 'production' && getAllowedOrigins().length === 0) {
  throw new Error('Missing env: FRONTEND_ORIGINS (comma-separated CORS origins for your frontend URLs)');
}

module.exports = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  port: parseInt(process.env.PORT, 10) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  getAllowedOrigins,
};