const finite = n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e7;
const point = p => p && typeof p === 'object' && finite(p.x) && finite(p.y) && finite(p.z);
const screenPoint = p => p && typeof p === 'object' && finite(p.x) && finite(p.y) &&
  p.x >= -0.001 && p.x <= 1.001 && p.y >= -0.001 && p.y <= 1.001;

function validCustomRegion(region) {
  if (!region || typeof region !== 'object' || !Array.isArray(region.points) ||
    region.points.length < 3 || region.points.length > 256 || !region.points.every(point)) return false;
  const mask = region.projectedMask;
  return mask && mask.mode === 'fill' && Number.isSafeInteger(mask.meshIndex) && mask.meshIndex >= 0 &&
    point(mask.position) && point(mask.orientation) && point(mask.size) &&
    mask.size.x > 0.000001 && mask.size.y > 0.000001 && mask.size.z > 0.000001 &&
    Array.isArray(mask.maskPoints) && mask.maskPoints.length === region.points.length &&
    mask.maskPoints.every(screenPoint) &&
    Math.abs(mask.maskPoints.reduce((sum,p,i,a) => sum + p.x * a[(i+1)%a.length].y - a[(i+1)%a.length].x*p.y, 0)) > 0.00001;
}
function validCustomMarkers(markers, targetCount) {
  if (!Array.isArray(markers) || markers.length < 2 || markers.length > 12) return false;
  const hasTarget = targetCount !== undefined;
  if (hasTarget && (!Number.isSafeInteger(targetCount) || targetCount < 2 || targetCount > 12 || markers.length !== targetCount)) return false;
  const ids = new Set(), names = new Set();
  for (const marker of markers) {
    if (!marker || !Number.isSafeInteger(marker.id) || marker.id < 1 || marker.id > 999999 ||
      typeof marker.label !== 'string' || !marker.label.trim() || marker.label.length > 120 ||
      !point(marker.position) || !point(marker.normal) ||
      !Number.isSafeInteger(marker.meshIndex) || marker.meshIndex < 0 ||
      (hasTarget && !validCustomRegion(marker.region)) ||
      (marker.region !== undefined && (!validCustomRegion(marker.region) || marker.region.projectedMask.meshIndex !== marker.meshIndex))) return false;
    const name = marker.label.trim().toLowerCase();
    if (ids.has(marker.id) || names.has(name)) return false;
    ids.add(marker.id); names.add(name);
  }
  return true;
}
function validQuestion(q) {
  if (typeof q.question !== 'string' || !q.question.trim()) return false;
  if (q.format === 'mcq') return ['option_a','option_b','option_c','option_d'].every(k => typeof q[k] === 'string' && q[k].trim()) && ['A','B','C','D'].includes(q.correct_option);
  if (q.format === 'open_ended') return typeof q.model_answer === 'string' && !!q.model_answer.trim();
  if (!['region_identification','annotation_matching'].includes(q.format)) return false;
  const c = q.question_config;
  if (!c || !Number.isSafeInteger(c.model_id) || c.model_id < 1) return false;
  if (JSON.stringify(c).length > 1000000) return false;
  if (c.source !== undefined && c.source !== 'existing' && c.source !== 'custom') return false;
  if (c.source === 'custom') {
    return q.format === 'region_identification'
      ? validCustomRegion(c.custom_region)
      : validCustomMarkers(c.custom_markers, c.target_count);
  }
  if (q.format === 'region_identification') return Number.isSafeInteger(c.reference_annotation_id) && c.reference_annotation_id > 0;
  return Array.isArray(c.annotation_ids) && c.annotation_ids.length >= 2 && c.annotation_ids.length <= 6 &&
    c.annotation_ids.every(id => Number.isSafeInteger(id) && id > 0) && new Set(c.annotation_ids).size === c.annotation_ids.length;
}
module.exports = { validQuestion, validCustomMarkers, validCustomRegion };
