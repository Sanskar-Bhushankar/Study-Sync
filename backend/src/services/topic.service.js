const { supabase } = require('../config/supabase');
const { NotFoundError, BadRequestError } = require('../utils/errors');

async function create(projectId, title, orderIndex) {
  let resolvedIndex = orderIndex;
  if (resolvedIndex === undefined || resolvedIndex === null) {
    const { data: rows, error: maxErr } = await supabase
      .from('topics')
      .select('order_index')
      .eq('project_id', projectId)
      .order('order_index', { ascending: false })
      .limit(1);
    if (maxErr) throw maxErr;
    const max = rows?.[0]?.order_index;
    resolvedIndex = typeof max === 'number' && !Number.isNaN(max) ? max + 1 : 0;
  }
  const { data, error } = await supabase.from('topics').insert({ project_id: projectId, title, order_index: resolvedIndex }).select().single();
  if (error) throw error;
  return data;
}

async function listByProject(projectId) {
  const { data, error } = await supabase
    .from('topics')
    .select('id, title, order_index, created_at')
    .eq('project_id', projectId)
    .order('order_index');
  if (error) throw error;
  const topics = data || [];
  // Batch-fetch all subtopics in one query (avoids N+1)
  const topicIds = topics.map((t) => t.id);
  if (topicIds.length === 0) return topics;
  const { data: allSubtopics, error: subsError } = await supabase
    .from('subtopics')
    .select('id, topic_id, title, order_index, created_at')
    .in('topic_id', topicIds)
    .order('order_index');
  if (subsError) throw subsError;
  const subsByTopic = (allSubtopics || []).reduce((acc, s) => {
    if (!acc[s.topic_id]) acc[s.topic_id] = [];
    acc[s.topic_id].push(s);
    return acc;
  }, {});
  return topics.map((t) => ({
    ...t,
    subtopics: (subsByTopic[t.id] || []).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
  }));
}

async function getById(topicId) {
  const { data, error } = await supabase.from('topics').select('*').eq('id', topicId).single();
  if (error || !data) throw new NotFoundError('Topic not found');
  return data;
}

async function update(topicId, updates) {
  const allowed = {};
  if (updates.title !== undefined) allowed.title = updates.title;
  if (updates.order_index !== undefined) allowed.order_index = updates.order_index;
  if (Object.keys(allowed).length === 0) return getById(topicId);
  const { data, error } = await supabase.from('topics').update(allowed).eq('id', topicId).select().single();
  if (error) throw error;
  return data;
}

async function remove(topicId) {
  const { error } = await supabase.from('topics').delete().eq('id', topicId);
  if (error) throw error;
}

async function reorder(projectId, orderMap) {
  for (const [id, order_index] of Object.entries(orderMap)) {
    await supabase.from('topics').update({ order_index }).eq('id', id).eq('project_id', projectId);
  }
  return listByProject(projectId);
}

/**
 * Bulk create topics and subtopics in a single transaction.
 * @param {string} projectId - Project UUID
 * @param {Array<{ title: string, subtopics: string[] }>} payload - Parsed syllabus from MD
 * @returns {Promise<{ topics: number, subtopics: number }>}
 */
async function createBulk(projectId, payload) {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new BadRequestError('topics array required and must not be empty');
  }

  const topicsPayload = payload.map((t, idx) => ({
    project_id: projectId,
    title: String(t.title || '').trim() || 'Untitled Topic',
    order_index: idx,
  }));

  const { data: insertedTopics, error: topicsError } = await supabase
    .from('topics')
    .insert(topicsPayload)
    .select('id, order_index');
  if (topicsError) {
    throw new BadRequestError(topicsError.message || 'Failed to create topics');
  }

  const topics = insertedTopics || [];
  const subtopicsPayload = [];
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const item = payload[i];
    const subs = Array.isArray(item.subtopics) ? item.subtopics : [];
    for (let j = 0; j < subs.length; j++) {
      const title = typeof subs[j] === 'string' ? subs[j].trim() : String(subs[j] || '').trim();
      if (title) {
        subtopicsPayload.push({
          topic_id: topic.id,
          title,
          order_index: j,
        });
      }
    }
  }

  if (subtopicsPayload.length > 0) {
    const { error: subsError } = await supabase.from('subtopics').insert(subtopicsPayload);
    if (subsError) {
      throw new BadRequestError(subsError.message || 'Failed to create subtopics');
    }
  }

  return { topics: topics.length, subtopics: subtopicsPayload.length };
}

module.exports = { create, listByProject, getById, update, remove, reorder, createBulk };
