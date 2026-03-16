const { supabase } = require('../config/supabase');
const { BadRequestError } = require('../utils/errors');

async function register(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
    emailRedirectTo: undefined,
  });
  if (error) {
    if (error.message?.includes('already registered') || error.message?.includes('already been registered')) throw new BadRequestError('Email already registered');
    throw new BadRequestError(error.message || 'Registration failed');
  }
  return data ?? {};
}

async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new BadRequestError('Invalid email or password');
  return data;
}

async function logout(accessToken) {
  await supabase.auth.signOut();
}

async function refreshSession(refreshToken) {
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error) throw new BadRequestError('Invalid refresh token');
  return data;
}

module.exports = { register, login, logout, refreshSession };
