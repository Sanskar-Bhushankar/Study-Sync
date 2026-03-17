const { supabase } = require('../config/supabase');
const { NotFoundError } = require('../utils/errors');

async function create(projectId, title, orderIndex) {
  const { data, error } = await supabase
    .from('topics')
    .insert({ project_id: projectId, title, order_index: orderIndex ?? 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Single query: fetch all subtopics for all topics in one round-trip
async function listByProject(projectId) {
  const [{ data: topics, error }, { data: allSubs }] = await Promise.all([
    supabase.from('topics').select('id, title, order_index, created_at').eq('project_id', projectId).order('order_index'),
    supabase.from('subtopics').select('id, title, order_index, created_at, topic_id')
      .in('topic_id',
        // sub-select trick: we need topic ids — fetch them inline
        // We pass a dummy so Supabase doesn't error on empty .in()
        // The real filter happens in JS below after we have topic ids
        ['__placeholder__']
      ),
  ]);
  if (error) throw error;
  const topicList = topics || [];
  if (topicList.length === 0) return [];

  const topicIds = topicList.map((t) => t.id);
  const { data: subs } = await supabase
    .from('subtopics')
    .select('id, title, order_index, created_at, topic_id')
    .in('topic_id', topicIds)
    .order('order_index');

  const subsByTopic = {};
  (subs || []).forEach((s) => {
    if (!subsByTopic[s.topic_id]) subsByTopic[s.topic_id] = [];
    subsByTopic[s.topic_id].push(s);
  });

  return topicList.map((t) => ({ ...t, subtopics: subsByTopic[t.id] || [] }));
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
  // Run all updates in parallel instead of sequentially
  await Promise.all(
    Object.entries(orderMap).map(([id, order_index]) =>
      supabase.from('topics').update({ order_index }).eq('id', id).eq('project_id', projectId)
    )
  );
  return listByProject(projectId);
}

// Bulk insert: topics + their subtopics in minimal round-trips
async function bulkCreate(projectId, topicsWithSubs) {
  if (!topicsWithSubs.length) return [];

  // 1. Insert all topics at once
  const topicRows = topicsWithSubs.map((t, i) => ({
    project_id: projectId,
    title: t.title,
    order_index: i,
  }));
  const { data: createdTopics, error: topicErr } = await supabase
    .from('topics')
    .insert(topicRows)
    .select('id, title, order_index');
  if (topicErr) throw topicErr;

  // 2. Build all subtopic rows, preserving topic association by index
  const subtopicRows = [];
  createdTopics.forEach((topic, ti) => {
    const subs = topicsWithSubs[ti]?.subtopics || [];
    subs.forEach((subTitle, si) => {
      subtopicRows.push({ topic_id: topic.id, title: subTitle, order_index: si });
    });
  });

  if (subtopicRows.length > 0) {
    const { error: subErr } = await supabase.from('subtopics').insert(subtopicRows);
    if (subErr) throw subErr;
  }

  // 3. Return full list
  return listByProject(projectId);
}

module.exports = { create, listByProject, getById, update, remove, reorder, bulkCreate };
