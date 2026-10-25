const { canRead } = require('../access');
const { canManage, resolve } = require('../ownership');

// Route guard for teacher write routes: the signed-in teacher must own (or the content must be unclaimed) what the route changes.
//   what   which row decides access: models, videos, quizzes, resources, bank, announcements, question, annotation, answer
//   param  the route parameter holding the id (default "id")
// 404 when the content is not visible to the teacher at all (another teacher's draft), 403 when it is visible but not theirs.
function manage(what, param = 'id') {
  const guard = (req, res, next) => {
    (async () => {
      const row = await resolve(what, req.params[param]);
      if (!row || !canRead(req.user, row)) return res.status(404).json({ message: 'Not found' });
      if (!canManage(req.user, row)) return res.status(403).json({ message: 'This belongs to another teacher. Only its owner can change it.' });
      req.managed = row;
      next();
    })().catch(next);
  };
  guard.ownership = what;   // lets tests prove every teacher write route is guarded
  return guard;
}

// For /api/:kind/:id/... routes where the kind is in the URL (models, videos, quizzes or resources).
function manageByKind() {
  const guards = {};
  const guard = (req, res, next) => {
    const kind = req.params.kind;
    if (!['models', 'videos', 'quizzes', 'resources'].includes(kind)) return res.status(404).json({ message: 'Not found' });
    return (guards[kind] ??= manage(kind))(req, res, next);
  };
  guard.ownership = 'by-kind';
  return guard;
}

module.exports = { manage, manageByKind };
