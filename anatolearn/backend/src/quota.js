// Storage limits for uploads: per teacher (everything they own) and for the whole site. 0 means unlimited.
//   UPLOAD_QUOTA_MB_PER_USER  default 5120 (5 GB)    UPLOAD_QUOTA_MB_TOTAL  default 51200 (50 GB)
// Usage is the sum of file_size over models, videos and resources. It drops when content is deleted. Content without an owner
// counts only towards the site total.
const pool = require('./db');

const MB = 1024 * 1024;
const number = (value, fallback) => { const parsed = Number(value); return value !== undefined && value !== '' && Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback; };
const limits = (env = process.env) => ({ perUser: Math.round(number(env.UPLOAD_QUOTA_MB_PER_USER, 5120) * MB), total: Math.round(number(env.UPLOAD_QUOTA_MB_TOTAL, 51200) * MB) });

async function usage(userId) {
  const { rows: [row] } = await pool.query(`SELECT
      (SELECT COALESCE(SUM(file_size), 0) FROM models WHERE owner_id = $1) + (SELECT COALESCE(SUM(file_size), 0) FROM videos WHERE owner_id = $1)
        + (SELECT COALESCE(SUM(file_size), 0) FROM resources WHERE owner_id = $1) AS mine,
      (SELECT COALESCE(SUM(file_size), 0) FROM models) + (SELECT COALESCE(SUM(file_size), 0) FROM videos) + (SELECT COALESCE(SUM(file_size), 0) FROM resources) AS total`, [userId]);
  return { mine: Number(row.mine), total: Number(row.total) };
}

const size = (bytes) => bytes >= 1024 * MB ? `${(bytes / (1024 * MB)).toFixed(1)} GB` : `${Math.max(bytes / MB, 0.1).toFixed(1)} MB`;

// Returns a message when adding `incoming` bytes would exceed a limit, or null.
function problem({ mine, total }, incoming, { perUser, total: totalLimit }) {
  if (totalLimit && total + incoming > totalLimit) return 'The site has run out of storage space for uploads. Please contact an administrator.';
  if (perUser && mine + incoming > perUser)
    return `This upload would take you over your storage limit (${size(mine)} used of ${size(perUser)}). Delete content you no longer need, or ask an administrator to raise the limit.`;
  return null;
}

async function assertWithin(userId, incoming) {
  const message = problem(await usage(userId), incoming, limits());
  if (message) throw Object.assign(new Error(message), { status: 413 });
}

// Route guard that refuses an upload before anything is stored, using the declared Content-Length (a little larger than the file).
// The services check again with the real file size, because a client can omit or understate the header.
//
// The body is read and thrown away before replying. Answering while the browser is still sending makes the connection drop, and
// the person would see "network error" instead of the explanation. Discarding costs no disk, scanning or processing.
function enforceQuota(req, res, next) {
  const declared = Number(req.headers['content-length']);
  if (!Number.isFinite(declared) || declared <= 0) return next();
  assertWithin(req.user.id, declared).then(() => next(), (error) => {
    if (error.status !== 413) return next(error);
    let replied = false;
    const reply = () => { if (replied) return; replied = true; res.status(413).set('Connection', 'close').json({ message: error.message }); };
    req.once('end', reply); req.once('close', reply); req.once('error', reply);
    setTimeout(reply, 60 * 1000).unref();   // never hold the connection longer than a minute
    req.resume();
  });
}

module.exports = { limits, usage, problem, assertWithin, enforceQuota, size };
