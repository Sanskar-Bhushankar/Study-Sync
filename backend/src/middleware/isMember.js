const { supabase } = require('../config/supabase');
const { ForbiddenError, NotFoundError } = require('../utils/errors');

async function isMember(req, res, next) {
  const projectId = req.params.projectId;
  const { data, error } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', req.user.id)
    .single();
  if (error || !data) return next(new NotFoundError('Project not found'));
  req.membership = data;
  next();
}

module.exports = isMember;
