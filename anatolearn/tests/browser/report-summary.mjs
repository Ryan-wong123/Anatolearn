import { readFileSync, writeFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('test-results/results.json', 'utf8'));
const projects = {};
function visit(suite) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
      const project = projects[test.projectName] ??= { passed: 0, failed: 0, skipped: 0, audits: 0, violations: 0, manualReviewRuleIds: [], checks: [] };
      const result = test.results.at(-1);
      const status = result.status === 'passed' ? 'passed' : result.status === 'skipped' ? 'skipped' : 'failed';
      project[status]++;
      project.checks.push({ title: spec.title, status, notes: test.annotations.filter(a => ['skip', 'limitation'].includes(a.type)).map(a => a.description) });
      for (const attachment of result.attachments ?? []) {
        if (!attachment.name.endsWith('-axe') || !attachment.body) continue;
        const audit = JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8'));
        project.audits++;
        project.violations += audit.violations.length;
        project.manualReviewRuleIds = [...new Set([...project.manualReviewRuleIds, ...audit.incomplete.map(item => item.id)])].sort();
      }
    }
  }
  for (const child of suite.suites ?? []) visit(child);
}
for (const suite of report.suites) visit(suite);
const summary = {
  startedAt: report.stats.startTime,
  durationSeconds: Math.round(report.stats.duration / 1000),
  scope: 'Local Docker app; WCAG 2 A/AA and 2.1 A/AA tagged automated checks. No spoken screen-reader or actual Safari certification.',
  projects,
};
writeFileSync('../docs/verification/browser-accessibility-summary.json', `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(projects).map(([name, result]) => [name, { passed: result.passed, failed: result.failed, skipped: result.skipped, audits: result.audits, violations: result.violations }]))));
