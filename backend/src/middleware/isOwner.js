const { supabase } = require('../config/supabase');
const { ForbiddenError, NotFoundError } = require('../utils/errors');

async function isOwner(req, res, next) {
  const projectId = req.params.projectId;
  const { data, error } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', req.user.id)
    .single();
  if (error || !data) return next(new NotFoundError('Project not found'));
  if (data.role !== 'owner') return next(new ForbiddenError('Owner only'));
  next();
}

module.exports = isOwner;
