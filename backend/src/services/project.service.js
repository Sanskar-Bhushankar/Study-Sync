const { supabase } = require('../config/supabase');
const storageService = require('./storage.service');
const { NotFoundError } = require('../utils/errors');

async function create(title, description, userId) {
  const { data: project, error: projErr } = await supabase.from('projects').insert({ title, description, created_by: userId }).select().single();
  if (projErr) throw projErr;
  await supabase.from('project_members').insert({ project_id: project.id, user_id: userId, role: 'owner' });
  return project;
}

async function listByUser(userId) {
  const { data, error } = await supabase
    .from('project_members')
    .select('project_id, role, joined_at, is_pinned, projects(id, title, description, created_by, created_at)')
    .eq('user_id', userId);
  if (error) throw error;
  const projects = (data || []).map((m) => ({
    ...m.projects, role: m.role, joined_at: m.joined_at, is_pinned: m.is_pinned || false,
  }));
  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);
  const [{ data: subActivity }, { data: topicActivity }, { data: revisionActivity }] = await Promise.all([
    supabase.from('subtopic_progress').select('project_id, completed_at').eq('user_id', userId).in('project_id', projectIds).eq('is_completed', true).not('completed_at', 'is', null),
    supabase.from('topic_completions').select('project_id, uploaded_at').eq('user_id', userId).in('project_id', projectIds),
    supabase.from('topic_revisions').select('project_id, revised_at').eq('user_id', userId).in('project_id', projectIds),
  ]);

  const lastActivity = {};
  const setIfNewer = (pid, dateStr) => {
    if (dateStr && (!lastActivity[pid] || dateStr > lastActivity[pid])) lastActivity[pid] = dateStr;
  };
  (subActivity || []).forEach((r) => setIfNewer(r.project_id, r.completed_at));
  (topicActivity || []).forEach((r) => setIfNewer(r.project_id, r.uploaded_at));
  (revisionActivity || []).forEach((r) => setIfNewer(r.project_id, r.revised_at));

  return projects
    .map((p) => ({ ...p, last_activity: lastActivity[p.id] || null }))
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      const aDate = a.last_activity || a.created_at || '';
      const bDate = b.last_activity || b.created_at || '';
      return bDate.localeCompare(aDate);
    });
}

async function updatePin(projectId, userId, isPinned) {
  const { error } = await supabase
    .from('project_members')
    .update({ is_pinned: isPinned })
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw error;
  return { is_pinned: isPinned };
}

async function getById(projectId) {
  const { data, error } = await supabase.from('projects').select('id, title, description, created_by, created_at').eq('id', projectId).single();
  if (error || !data) throw new NotFoundError('Project not found');
  const { data: owner } = await supabase.from('profiles').select('full_name').eq('id', data.created_by).single();
  return { ...data, owner: owner?.full_name };
}

async function update(projectId, updates) {
  const allowed = {};
  if (updates.title !== undefined) allowed.title = updates.title;
  if (updates.description !== undefined) allowed.description = updates.description;
  if (Object.keys(allowed).length === 0) return getById(projectId);
  const { data, error } = await supabase.from('projects').update(allowed).eq('id', projectId).select().single();
  if (error) throw error;
  return data;
}

async function remove(projectId) {
  // 1. Delete all storage files under study-notes/{projectId}/
  try {
    await storageService.deleteProjectStorage(projectId);
  } catch (storageErr) {
    console.error('[project.remove] Storage delete failed:', storageErr?.message);
    throw new Error(`Failed to delete project files: ${storageErr?.message || 'storage error'}`);
  }

  // 2. Delete DB rows in dependency order (children before parents)
  const tables = [
    'subtopic_progress',
    'topic_completions',
    'topic_revisions',
    'project_invites',
    'project_members',
    'topics',
    'projects',
  ];
  for (const table of tables) {
    const key = table === 'projects' ? 'id' : 'project_id';
    const { error } = await supabase.from(table).delete().eq(key, projectId);
    if (error) {
      console.error(`[project.remove] DB delete failed for ${table}:`, error?.message);
      throw new Error(`Failed to delete project: ${error?.message || 'database error'}`);
    }
  }
}

async function getMembers(projectId) {
  const { data, error } = await supabase
    .from('project_members')
    .select('user_id, role, joined_at, profiles(full_name, avatar_url)')
    .eq('project_id', projectId);
  if (error) throw error;
  return (data || []).map((m) => ({ user_id: m.user_id, full_name: m.profiles?.full_name, avatar_url: m.profiles?.avatar_url, role: m.role, joined_at: m.joined_at }));
}

async function removeMember(projectId, userId) {
  const { error } = await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);
  if (error) throw error;
}

module.exports = { create, listByUser, getById, update, remove, getMembers, removeMember, updatePin };
