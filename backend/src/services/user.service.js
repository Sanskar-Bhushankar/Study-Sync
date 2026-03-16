const { supabase } = require('../config/supabase');
const { NotFoundError } = require('../utils/errors');

async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('id, email, full_name, avatar_url, created_at').eq('id', userId);
  if (error) throw error;
  if (!data || data.length === 0) throw new NotFoundError('Profile not found');
  return data[0];
}

async function updateProfile(userId, updates) {
  const allowed = {};
  if (updates.full_name !== undefined) allowed.full_name = updates.full_name;
  if (updates.avatar_url !== undefined) allowed.avatar_url = updates.avatar_url;
  if (Object.keys(allowed).length === 0) return getProfile(userId);
  const { data, error } = await supabase.from('profiles').update(allowed).eq('id', userId).select();
  if (error) throw error;
  return data[0];
}

async function getPendingInvites(email) {
  const { data, error } = await supabase
    .from('project_invites')
    .select('id, project_id, invited_by, invited_email, created_at, projects(title)')
    .eq('invited_email', email)
    .eq('status', 'pending');
  if (error) throw error;
  return data || [];
}

module.exports = { getProfile, updateProfile, getPendingInvites };
