function validQuestion(q) {
  if (typeof q.question !== 'string' || !q.question.trim()) return false;
  if (q.format === 'mcq') return ['option_a','option_b','option_c','option_d'].every(k => typeof q[k] === 'string' && q[k].trim()) && ['A','B','C','D'].includes(q.correct_option);
  if (q.format === 'open_ended') return typeof q.model_answer === 'string' && !!q.model_answer.trim();
  if (!['region_identification','annotation_matching'].includes(q.format)) return false;
  const c = q.question_config;
  if (!c || !Number.isSafeInteger(c.model_id) || c.model_id < 1) return false;
  if (q.format === 'region_identification') return Number.isSafeInteger(c.reference_annotation_id) && c.reference_annotation_id > 0;
  return Array.isArray(c.annotation_ids) && c.annotation_ids.length >= 2 && c.annotation_ids.length <= 6 &&
    c.annotation_ids.every(id => Number.isSafeInteger(id) && id > 0) && new Set(c.annotation_ids).size === c.annotation_ids.length;
}
module.exports = { validQuestion };
