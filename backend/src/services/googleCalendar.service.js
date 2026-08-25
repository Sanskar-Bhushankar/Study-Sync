const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE || 'Asia/Kolkata';
const SCOPES = [
  process.env.GOOGLE_CALENDAR_SCOPES || 'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

async function getProfileCalendar(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'google_calendar_connected, google_calendar_email, google_refresh_token, google_access_token, google_token_expires_at, google_calendar_id, google_sync_mode, google_auto_sync'
    )
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

function buildAuthUrl(userId) {
  if (!isConfigured()) throw new BadRequestError('Google Calendar is not configured on the server');
  const state = jwt.sign({ userId, purpose: 'google_calendar' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const oauth2 = getOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

async function handleOAuthCallback(code, state) {
  if (!isConfigured()) throw new BadRequestError('Google Calendar is not configured on the server');
  let userId;
  try {
    const payload = jwt.verify(state, process.env.JWT_SECRET);
    if (payload.purpose !== 'google_calendar') throw new Error('Invalid state');
    userId = payload.userId;
  } catch {
    throw new BadRequestError('Invalid or expired OAuth state');
  }

  const oauth2 = getOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
  const { data: googleUser } = await oauth2Api.userinfo.get();

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : new Date(Date.now() + 3600 * 1000).toISOString();

  const updatePayload = {
    google_calendar_connected: true,
    google_calendar_email: googleUser.email || null,
    google_access_token: tokens.access_token || null,
    google_token_expires_at: expiresAt,
  };
  if (tokens.refresh_token) updatePayload.google_refresh_token = tokens.refresh_token;

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('google_refresh_token')
    .eq('id', userId)
    .single();

  if (!tokens.refresh_token && !existingProfile?.google_refresh_token) {
    throw new BadRequestError('No refresh token received. Revoke app access in Google Account and reconnect.');
  }

  const { error } = await supabase.from('profiles').update(updatePayload).eq('id', userId);
  if (error) throw error;

  return { userId, email: googleUser.email };
}

async function disconnect(userId) {
  const profile = await getProfileCalendar(userId);
  if (profile?.google_refresh_token) {
    try {
      const oauth2 = getOAuthClient();
      await oauth2.revokeToken(profile.google_refresh_token);
    } catch (_) {}
  }
  await supabase
    .from('profiles')
    .update({
      google_calendar_connected: false,
      google_calendar_email: null,
      google_refresh_token: null,
      google_access_token: null,
      google_token_expires_at: null,
    })
    .eq('id', userId);
}

async function getAuthenticatedClient(userId) {
  const profile = await getProfileCalendar(userId);
  if (!profile?.google_calendar_connected || !profile.google_refresh_token) {
    throw new BadRequestError('Google Calendar not connected', 'GOOGLE_NOT_CONNECTED');
  }

  const oauth2 = getOAuthClient();
  oauth2.setCredentials({
    refresh_token: profile.google_refresh_token,
    access_token: profile.google_access_token,
    expiry_date: profile.google_token_expires_at ? new Date(profile.google_token_expires_at).getTime() : undefined,
  });

  oauth2.on('tokens', async (tokens) => {
    const patch = {};
    if (tokens.access_token) patch.google_access_token = tokens.access_token;
    if (tokens.expiry_date) patch.google_token_expires_at = new Date(tokens.expiry_date).toISOString();
    if (tokens.refresh_token) patch.google_refresh_token = tokens.refresh_token;
    if (Object.keys(patch).length) {
      await supabase.from('profiles').update(patch).eq('id', userId);
    }
  });

  return { oauth2, profile };
}

async function insertCalendarEvent(userId, profile, eventBody) {
  const { oauth2 } = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2 });
  const calendarId = profile.google_calendar_id || 'primary';
  const res = await calendar.events.insert({ calendarId, requestBody: eventBody });
  return { eventId: res.data.id, htmlLink: res.data.htmlLink, calendarId };
}

function dateStrInTz(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(d);
}

async function getTopicContext(projectId, topicId) {
  const [{ data: project }, { data: topic }] = await Promise.all([
    supabase.from('projects').select('title').eq('id', projectId).single(),
    supabase.from('topics').select('title').eq('id', topicId).single(),
  ]);
  return {
    projectTitle: project?.title || 'Project',
    topicTitle: topic?.title || 'Topic',
  };
}

async function isAlreadySynced(userId, eventType, filters) {
  let q = supabase.from('calendar_sync_log').select('id').eq('user_id', userId).eq('event_type', eventType);
  if (filters.topicId) q = q.eq('topic_id', filters.topicId);
  if (filters.revisionId) q = q.eq('revision_id', filters.revisionId);
  if (filters.summaryDate) q = q.eq('summary_date', filters.summaryDate);
  const { data } = await q.maybeSingle();
  return !!data;
}

async function logSync(userId, row) {
  const { error } = await supabase.from('calendar_sync_log').insert(row);
  if (error && error.code !== '23505') throw error;
}

async function createTopicCompleteEvent(userId, { projectId, topicId, completedAt, trigger = 'auto' }) {
  const profile = await getProfileCalendar(userId);
  if (!profile?.google_calendar_connected) return null;
  if (trigger === 'auto' && !profile.google_auto_sync) return null;

  const mode = profile.google_sync_mode || 'A';
  if (mode === 'C') {
    return appendDailyBuffer(userId, {
      kind: 'topic_complete',
      projectId,
      topicId,
      at: completedAt || new Date().toISOString(),
    }, trigger);
  }

  if (await isAlreadySynced(userId, 'topic_complete', { topicId })) {
    return { skipped: true, reason: 'already_synced' };
  }

  const { projectTitle, topicTitle } = await getTopicContext(projectId, topicId);
  const start = new Date(completedAt || Date.now());
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const frontend = FRONTEND_URL;

  const eventBody = {
    summary: `✅ ${projectTitle} — ${topicTitle}`,
    description: `Topic completed in StudySync\nProject: ${projectTitle}\nTopic: ${topicTitle}\n\nOpen: ${frontend}/projects/${projectId}`,
    start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
    end: { dateTime: end.toISOString(), timeZone: TIMEZONE },
    colorId: '2',
  };

  const { eventId, htmlLink, calendarId } = await insertCalendarEvent(userId, profile, eventBody);
  await logSync(userId, {
    user_id: userId,
    event_type: 'topic_complete',
    sync_mode: mode,
    sync_trigger: trigger,
    project_id: projectId,
    topic_id: topicId,
    google_event_id: eventId,
    google_calendar_id: calendarId,
    google_event_link: htmlLink,
  });
  return { eventId, htmlLink };
}

async function createRevisionEvent(userId, { projectId, topicId, revisionId, note, revisedAt, trigger = 'auto' }) {
  const profile = await getProfileCalendar(userId);
  if (!profile?.google_calendar_connected) return null;
  if (trigger === 'auto' && !profile.google_auto_sync) return null;

  const mode = profile.google_sync_mode || 'A';
  if (mode === 'A') return null;
  if (mode === 'C') {
    return appendDailyBuffer(userId, {
      kind: 'revision',
      projectId,
      topicId,
      revisionId,
      note,
      at: revisedAt || new Date().toISOString(),
    }, trigger);
  }

  if (await isAlreadySynced(userId, 'revision', { revisionId })) {
    return { skipped: true, reason: 'already_synced' };
  }

  const { projectTitle, topicTitle } = await getTopicContext(projectId, topicId);
  const start = new Date(revisedAt || Date.now());
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const eventBody = {
    summary: `🔁 Revised — ${topicTitle} (${projectTitle})`,
    description: note ? `Revision note: ${note}` : 'Revision logged in StudySync',
    start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
    end: { dateTime: end.toISOString(), timeZone: TIMEZONE },
    colorId: '3',
  };

  const { eventId, htmlLink, calendarId } = await insertCalendarEvent(userId, profile, eventBody);
  await logSync(userId, {
    user_id: userId,
    event_type: 'revision',
    sync_mode: mode,
    sync_trigger: trigger,
    project_id: projectId,
    topic_id: topicId,
    revision_id: revisionId,
    google_event_id: eventId,
    google_calendar_id: calendarId,
    google_event_link: htmlLink,
  });
  return { eventId, htmlLink };
}

async function appendDailyBuffer(userId, item, trigger = 'auto') {
  const profile = await getProfileCalendar(userId);
  if (!profile?.google_calendar_connected) return null;
  if (trigger === 'auto' && !profile.google_auto_sync) return null;

  const summaryDate = dateStrInTz(new Date(item.at || Date.now()));
  const { data: existing } = await supabase
    .from('calendar_daily_buffer')
    .select('payload')
    .eq('user_id', userId)
    .eq('summary_date', summaryDate)
    .maybeSingle();

  const payload = existing?.payload || { items: [] };
  payload.items = payload.items || [];
  payload.items.push(item);

  await supabase.from('calendar_daily_buffer').upsert(
    { user_id: userId, summary_date: summaryDate, payload },
    { onConflict: 'user_id,summary_date' }
  );

  return flushDailySummary(userId, summaryDate, trigger);
}

async function onSubtopicComplete(userId, { projectId, topicId, completedAt }) {
  const profile = await getProfileCalendar(userId);
  if (!profile?.google_calendar_connected || profile.google_sync_mode !== 'C') return null;
  if (!profile.google_auto_sync) return null;
  return appendDailyBuffer(userId, {
    kind: 'subtopic',
    projectId,
    topicId,
    at: completedAt || new Date().toISOString(),
  }, 'auto');
}

async function flushDailySummary(userId, summaryDate, trigger = 'auto') {
  const profile = await getProfileCalendar(userId);
  if (!profile?.google_calendar_connected) return null;

  const { data: buf } = await supabase
    .from('calendar_daily_buffer')
    .select('payload, google_event_id')
    .eq('user_id', userId)
    .eq('summary_date', summaryDate)
    .maybeSingle();

  if (!buf?.payload?.items?.length) return null;

  const items = buf.payload.items;
  const lines = [];
  let subtopics = 0;
  let topics = 0;
  let revisions = 0;

  for (const it of items) {
    if (it.kind === 'subtopic') subtopics++;
    if (it.kind === 'topic_complete') {
      topics++;
      const ctx = await getTopicContext(it.projectId, it.topicId);
      lines.push(`• Topic finished: ${ctx.topicTitle} (${ctx.projectTitle})`);
    }
    if (it.kind === 'revision') {
      revisions++;
      const ctx = await getTopicContext(it.projectId, it.topicId);
      lines.push(`• Revision: ${ctx.topicTitle} (${ctx.projectTitle})${it.note ? ` — ${it.note}` : ''}`);
    }
  }
  if (subtopics) lines.unshift(`• ${subtopics} subtopic${subtopics !== 1 ? 's' : ''} completed`);

  const description = lines.length ? lines.join('\n') : 'Study activity logged from StudySync';
  const title = `📚 StudySync — ${summaryDate}`;

  const { oauth2 } = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2 });
  const calendarId = profile.google_calendar_id || 'primary';

  const eventBody = {
    summary: title,
    description,
    start: { date: summaryDate },
    end: { date: summaryDate },
    colorId: '7',
  };

  let eventId = buf.google_event_id;
  let htmlLink;

  if (eventId) {
    const res = await calendar.events.patch({ calendarId, eventId, requestBody: eventBody });
    htmlLink = res.data.htmlLink;
  } else {
    const res = await calendar.events.insert({ calendarId, requestBody: eventBody });
    eventId = res.data.id;
    htmlLink = res.data.htmlLink;
    await supabase
      .from('calendar_daily_buffer')
      .update({ google_event_id: eventId })
      .eq('user_id', userId)
      .eq('summary_date', summaryDate);
  }

  const { data: existingLog } = await supabase
    .from('calendar_sync_log')
    .select('id')
    .eq('user_id', userId)
    .eq('event_type', 'daily_summary')
    .eq('summary_date', summaryDate)
    .maybeSingle();

  const logRow = {
    user_id: userId,
    event_type: 'daily_summary',
    sync_mode: 'C',
    sync_trigger: trigger,
    summary_date: summaryDate,
    google_event_id: eventId,
    google_calendar_id: calendarId,
    google_event_link: htmlLink,
    synced_at: new Date().toISOString(),
  };

  if (existingLog) {
    await supabase.from('calendar_sync_log').update(logRow).eq('id', existingLog.id);
  } else {
    await logSync(userId, logRow);
  }

  return { eventId, htmlLink };
}

async function getStatus(userId) {
  const profile = await getProfileCalendar(userId);
  return {
    connected: !!profile?.google_calendar_connected,
    email: profile?.google_calendar_email || null,
    calendar_id: profile?.google_calendar_id || 'primary',
    sync_mode: profile?.google_sync_mode || 'A',
    auto_sync: profile?.google_auto_sync !== false,
    configured: isConfigured(),
  };
}

async function getSettings(userId) {
  return getStatus(userId);
}

async function updateSettings(userId, { sync_mode, auto_sync, calendar_id }) {
  const patch = {};
  if (sync_mode !== undefined) {
    if (!['A', 'B', 'C'].includes(sync_mode)) throw new BadRequestError('sync_mode must be A, B, or C');
    patch.google_sync_mode = sync_mode;
  }
  if (auto_sync !== undefined) patch.google_auto_sync = !!auto_sync;
  if (calendar_id !== undefined) patch.google_calendar_id = calendar_id || 'primary';
  if (!Object.keys(patch).length) return getSettings(userId);
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
  return getSettings(userId);
}

async function getSyncLog(userId, limit = 50) {
  const { data: logs, error } = await supabase
    .from('calendar_sync_log')
    .select('*')
    .eq('user_id', userId)
    .order('synced_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const topicIds = [...new Set((logs || []).map((l) => l.topic_id).filter(Boolean))];
  const projectIds = [...new Set((logs || []).map((l) => l.project_id).filter(Boolean))];
  const [{ data: topics }, { data: projects }] = await Promise.all([
    topicIds.length ? supabase.from('topics').select('id, title').in('id', topicIds) : { data: [] },
    projectIds.length ? supabase.from('projects').select('id, title').in('id', projectIds) : { data: [] },
  ]);
  const topicMap = new Map((topics || []).map((t) => [t.id, t.title]));
  const projectMap = new Map((projects || []).map((p) => [p.id, p.title]));

  const enriched = (logs || []).map((l) => ({
    ...l,
    topic_title: l.topic_id ? topicMap.get(l.topic_id) : null,
    project_title: l.project_id ? projectMap.get(l.project_id) : null,
  }));

  const pending = await getPendingItems(userId);
  return { logs: enriched, pending };
}

async function getPendingItems(userId) {
  const profile = await getProfileCalendar(userId);
  if (!profile?.google_calendar_connected) return [];

  const mode = profile.google_sync_mode || 'A';
  const pending = [];

  if (mode === 'A' || mode === 'B') {
    const { data: completions } = await supabase
      .from('topic_completions')
      .select('topic_id, project_id, uploaded_at')
      .eq('user_id', userId);

    const { data: syncedTopics } = await supabase
      .from('calendar_sync_log')
      .select('topic_id')
      .eq('user_id', userId)
      .eq('event_type', 'topic_complete');

    const syncedSet = new Set((syncedTopics || []).map((r) => r.topic_id));
    const topicIds = [...new Set((completions || []).map((c) => c.topic_id))];
    const projectIds = [...new Set((completions || []).map((c) => c.project_id))];
    const [{ data: topics }, { data: projects }] = await Promise.all([
      topicIds.length ? supabase.from('topics').select('id, title').in('id', topicIds) : { data: [] },
      projectIds.length ? supabase.from('projects').select('id, title').in('id', projectIds) : { data: [] },
    ]);
    const topicMap = new Map((topics || []).map((t) => [t.id, t.title]));
    const projectMap = new Map((projects || []).map((p) => [p.id, p.title]));

    for (const c of completions || []) {
      if (!syncedSet.has(c.topic_id)) {
        pending.push({
          type: 'topic_complete',
          topic_id: c.topic_id,
          project_id: c.project_id,
          topic_title: topicMap.get(c.topic_id),
          project_title: projectMap.get(c.project_id),
          at: c.uploaded_at,
        });
      }
    }
  }

  if (mode === 'B') {
    const { data: revisions } = await supabase
      .from('topic_revisions')
      .select('id, topic_id, project_id, revised_at, note')
      .eq('user_id', userId);

    const { data: syncedRevs } = await supabase
      .from('calendar_sync_log')
      .select('revision_id')
      .eq('user_id', userId)
      .eq('event_type', 'revision');

    const syncedRevSet = new Set((syncedRevs || []).map((r) => r.revision_id));
    const topicIds = [...new Set((revisions || []).map((r) => r.topic_id))];
    const projectIds = [...new Set((revisions || []).map((r) => r.project_id))];
    const [{ data: topics }, { data: projects }] = await Promise.all([
      topicIds.length ? supabase.from('topics').select('id, title').in('id', topicIds) : { data: [] },
      projectIds.length ? supabase.from('projects').select('id, title').in('id', projectIds) : { data: [] },
    ]);
    const topicMap = new Map((topics || []).map((t) => [t.id, t.title]));
    const projectMap = new Map((projects || []).map((p) => [p.id, p.title]));

    for (const r of revisions || []) {
      if (!syncedRevSet.has(r.id)) {
        pending.push({
          type: 'revision',
          revision_id: r.id,
          topic_id: r.topic_id,
          project_id: r.project_id,
          topic_title: topicMap.get(r.topic_id),
          project_title: projectMap.get(r.project_id),
          note: r.note,
          at: r.revised_at,
        });
      }
    }
  }

  return pending;
}

async function manualSync(userId, body) {
  const { type, projectId, topicId, revisionId, date } = body || {};
  if (type === 'topic_complete') {
    if (!projectId || !topicId) throw new BadRequestError('projectId and topicId required');
    const { data: c } = await supabase
      .from('topic_completions')
      .select('uploaded_at')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .eq('topic_id', topicId)
      .single();
    if (!c) throw new NotFoundError('Topic not completed');
    return createTopicCompleteEvent(userId, { projectId, topicId, completedAt: c.uploaded_at, trigger: 'manual' });
  }
  if (type === 'revision') {
    if (!revisionId) throw new BadRequestError('revisionId required');
    const { data: r } = await supabase
      .from('topic_revisions')
      .select('project_id, topic_id, note, revised_at')
      .eq('id', revisionId)
      .eq('user_id', userId)
      .single();
    if (!r) throw new NotFoundError('Revision not found');
    return createRevisionEvent(userId, {
      projectId: r.project_id,
      topicId: r.topic_id,
      revisionId,
      note: r.note,
      revisedAt: r.revised_at,
      trigger: 'manual',
    });
  }
  if (type === 'daily_summary') {
    const summaryDate = date || dateStrInTz();
    return flushDailySummary(userId, summaryDate, 'manual');
  }
  throw new BadRequestError('Invalid sync type');
}

async function syncAllPending(userId) {
  const pending = await getPendingItems(userId);
  const results = [];
  for (const item of pending) {
    try {
      if (item.type === 'topic_complete') {
        results.push(await manualSync(userId, { type: 'topic_complete', projectId: item.project_id, topicId: item.topic_id }));
      } else if (item.type === 'revision') {
        results.push(await manualSync(userId, { type: 'revision', revisionId: item.revision_id }));
      }
    } catch (e) {
      results.push({ error: e.message });
    }
  }
  return { synced: results.filter((r) => r && !r.error && !r.skipped).length, results };
}

function safeSync(fn) {
  return fn.catch((err) => console.error('[googleCalendar]', err.message || err));
}

module.exports = {
  isConfigured,
  buildAuthUrl,
  handleOAuthCallback,
  disconnect,
  getStatus,
  getSettings,
  updateSettings,
  getSyncLog,
  getPendingItems,
  manualSync,
  syncAllPending,
  createTopicCompleteEvent,
  createRevisionEvent,
  onSubtopicComplete,
  flushDailySummary,
  safeSync,
  FRONTEND_URL,
};
