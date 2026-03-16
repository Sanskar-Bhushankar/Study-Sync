const { supabase } = require('../config/supabase');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/errors');

async function create(projectId, invitedEmail, invitedBy) {
  const { data: existing } = await supabase.from('project_invites').select('id').eq('project_id', projectId).eq('invited_email', invitedEmail).eq('status', 'pending').single();
  if (existing) throw new ConflictError('Invite already sent to this email');
  const { data: member } = await supabase.from('project_members').select('id').eq('project_id', projectId).eq('user_id', invitedBy).single();
  if (!member) throw new NotFoundError('Project not found');
  const { data, error } = await supabase.from('project_invites').insert({ project_id: projectId, invited_by: invitedBy, invited_email: invitedEmail, status: 'pending' }).select().single();
  if (error) throw error;
  return data;
}

async function listByProject(projectId) {
  const { data, error } = await supabase.from('project_invites').select('id, invited_email, invited_by, status, created_at, responded_at').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function cancel(projectId, inviteId) {
  const { error } = await supabase.from('project_invites').delete().eq('id', inviteId).eq('project_id', projectId).eq('status', 'pending');
  if (error) throw error;
}

async function getInvite(inviteId) {
  const { data, error } = await supabase.from('project_invites').select('*').eq('id', inviteId).single();
  if (error || !data) throw new NotFoundError('Invite not found');
  return data;
}

async function accept(inviteId, userEmail, userId) {
  const invite = await getInvite(inviteId);
  if (invite.invited_email !== userEmail) throw new BadRequestError('This invite is for a different email');
  if (invite.status !== 'pending') throw new ConflictError('Invite already responded');
  await supabase.from('project_members').insert({ project_id: invite.project_id, user_id: userId, role: 'member' });
  await supabase.from('project_invites').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('id', inviteId);
  return { project_id: invite.project_id };
}

async function decline(inviteId, userEmail) {
  const invite = await getInvite(inviteId);
  if (invite.invited_email !== userEmail) throw new BadRequestError('This invite is for a different email');
  if (invite.status !== 'pending') throw new ConflictError('Invite already responded');
  await supabase.from('project_invites').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', inviteId);
  return {};
}

module.exports = { create, listByProject, cancel, getInvite, accept, decline };
