const pool = require('./db');

// Best-effort: an audit write must never fail the request it describes.
async function record({ actor, action, targetType = null, targetId = null, detail = {}, ip = null }) {
  try {
    await pool.query(`INSERT INTO audit_log(actor_id, actor_name, action, target_type, target_id, detail, ip)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [actor?.id ?? null, actor?.name ?? null, action, targetType, targetId == null ? null : String(targetId), JSON.stringify(detail), ip]);
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
}

// Logs every successful state-changing API call by a signed-in user (who, what, which record) without bodies.
function auditMutations(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || process.env.AUDIT_MUTATIONS === 'false') return next();
  res.once('finish', () => {
    if (res.statusCode >= 400 || !req.user) return;
    const pathName = req.originalUrl.split('?')[0].replace(/^\/api/, '');
    const target = /^\/([a-z-]+)\/(\d+)/.exec(pathName);
    void record({ actor: req.user, action: `${req.method} ${pathName.replace(/\/\d+/g, '/:id')}`,
      targetType: target?.[1] ?? null, targetId: target?.[2] ?? null, ip: req.ip });
  });
  next();
}
module.exports = { record, auditMutations };
