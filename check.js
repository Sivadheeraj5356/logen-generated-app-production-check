// Production-readiness QA for AI-generated apps: scans generated code lines for the
// failure modes that separate a toy prototype from a deployable product - leaked
// secrets, unauthenticated routes, unverified payment webhooks, dev URLs in prod
// config, schema drift without migrations, and PII in logs. Pure functions, no DOM.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GeneratedAppCheck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SECRET_RE = /(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{8,}['"]/i;
  const DEV_URL_RE = /(localhost|127\.0\.0\.1|\.local\b|dev\.[a-z0-9-]+\.)/i;
  const PII_RE = /(console\.(log|info|debug|warn)|logger?\.\w+)\s*\([^)]*(email|password|phone|ssn|card)/i;

  function parseLines(input) {
    const files = [];
    const skipped = [];
    input.split('\n').forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      const p = raw.split('|').map((s) => s.trim());
      if (p.length >= 2 && p[0]) files.push({ path: p[0], text: p.slice(1).join(' | '), line: i + 1 });
      else skipped.push(i + 1);
    });
    return { files, skipped };
  }

  function check(input) {
    const { files, skipped } = typeof input === 'string' ? parseLines(input) : input;
    const findings = [];
    const push = (level, code, text) => findings.push({ level, code, text });
    const paths = new Set(files.map((f) => f.path));
    const isProdConfig = (f) => /(prod|production|deploy|fly\.toml|vercel\.json|Dockerfile)/i.test(f.path);
    const isRoute = (f) => /(route|page|endpoint|api\/)/i.test(f.path);
    const isServerEntry = (f) => /(server|index|app|main)\.(js|ts|ex)$/.test(f.path);

    files.forEach((f) => {
      if (SECRET_RE.test(f.text))
        push('error', 'HARDCODED_SECRET', `${f.path}:${f.line} - possible credential literal in generated code: "${f.text.slice(0, 60)}". If this is a real secret, move it to env vars before deploy; the demo values shipped with this tool are synthetic.`);
      if (isProdConfig(f) && DEV_URL_RE.test(f.text))
        push('error', 'DEV_URL_IN_PROD', `${f.path}:${f.line} - production-named config references a dev URL: "${f.text.slice(0, 60)}". Verify whether this is intended.`);
      if (/webhook/i.test(f.path + ' ' + f.text) && /(stripe|razorpay|payment)/i.test(f.text) && !/(signature|verify|constructEvent)/i.test(f.text))
        push('error', 'WEBHOOK_UNVERIFIED', `${f.path}:${f.line} - payment webhook line with no signature verification visible here: "${f.text.slice(0, 60)}". Verification may live in another file not pasted; if it is genuinely absent, forged events would be possible.`);
      if (PII_RE.test(f.text))
        push('warn', 'PII_IN_LOGS', `${f.path}:${f.line} - appears to log a personal field: "${f.text.slice(0, 60)}". Review whether this should be logged.`);
      if (isRoute(f) && /(private|protected|account|billing|admin)/i.test(f.path) && !/(auth|session|requireUser|guard)/i.test(f.text))
        push('error', 'AUTH_MISSING', `${f.path}:${f.line} - private-looking route with no auth check on this line: "${f.text.slice(0, 60)}". A guard may be applied in middleware or a parent layout not pasted here; if not, the route may be exposed.`);
    });

    const hasSchema = files.some((f) => /(schema|model)/i.test(f.path) || /(CREATE TABLE|addColumn|new table)/i.test(f.text));
    const hasMigration = [...paths].some((p) => /migrat/i.test(p));
    if (hasSchema && !hasMigration)
      push('warn', 'SCHEMA_WITHOUT_MIGRATION', 'Schema/model definitions present but no migration files in the pasted input. Migrations may exist outside the pasted set; if they do not, deploys may not evolve the database safely.');

    const hasEntry = files.some(isServerEntry);
    const hasErrorHandler = files.some((f) => /(errorHandler|app\.use\(\s*\(err|on_error|rescue_from)/.test(f.text));
    if (hasEntry && !hasErrorHandler)
      push('warn', 'NO_ERROR_HANDLER', 'No error-handling middleware detected in the pasted input - it may live in a file not pasted. If genuinely absent, unhandled errors may crash the process or leak stack traces.');

    if (skipped.length)
      push('warn', 'UNPARSED', `Line(s) ${skipped.join(', ')} skipped - expected path | code.`);
    if (!findings.length)
      push('ok', 'PRODUCTION_READY', 'No issues detected by these line-level heuristics. This is not a security audit - see the Limitations section of the README.');
    return { findings, stats: { files: paths.size, lines: files.length } };
  }

  return { parseLines, check };
});
