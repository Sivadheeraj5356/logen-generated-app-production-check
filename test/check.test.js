const test = require('node:test');
const assert = require('node:assert/strict');
const { check } = require('../check.js');

const codes = (r) => r.findings.map((f) => f.code);

test('flags a hardcoded API key in generated code', () => {
  const r = check('config.js | const apiKey = "sk_live_EXAMPLEONLY000"');
  assert.ok(codes(r).includes('HARDCODED_SECRET'));
});

test('flags dev URL in production config but not in dev config', () => {
  const bad = check('fly.toml | APP_URL = "http://localhost:3000"');
  assert.ok(codes(bad).includes('DEV_URL_IN_PROD'));
  const ok = check('src/api.js | const base = "http://localhost:3000"');
  assert.ok(!codes(ok).includes('DEV_URL_IN_PROD'));
});

test('flags payment webhook without signature verification', () => {
  const r = check('routes/webhook.js | app.post("/stripe/webhook", (req) => markPaid(req.body))');
  assert.ok(codes(r).includes('WEBHOOK_UNVERIFIED'));
  const ok = check('routes/webhook.js | stripe.webhooks.constructEvent(body, sig, secret) // verify stripe payment');
  assert.ok(!codes(ok).includes('WEBHOOK_UNVERIFIED'));
});

test('flags private route with no auth check on the line', () => {
  const r = check('routes/account/billing.js | export default function Billing() { return <Card/> }');
  assert.ok(codes(r).includes('AUTH_MISSING'));
  const ok = check('routes/account/billing.js | requireUser(session); export default function Billing() {}');
  assert.ok(!codes(ok).includes('AUTH_MISSING'));
});

test('flags schema change without migration files', () => {
  const r = check('db/schema.ts | CREATE TABLE payments (id serial)');
  assert.ok(codes(r).includes('SCHEMA_WITHOUT_MIGRATION'));
  const ok = check('db/schema.ts | CREATE TABLE payments (id serial)\nmigrations/0001.sql | CREATE TABLE payments (id serial)');
  assert.ok(!codes(ok).includes('SCHEMA_WITHOUT_MIGRATION'));
});

test('flags PII in logs and missing error handler', () => {
  const r = check('server/index.js | console.log("user email", user.email)\nserver/index.js | app.listen(3000)');
  assert.ok(codes(r).includes('PII_IN_LOGS'));
  assert.ok(codes(r).includes('NO_ERROR_HANDLER'));
});

test('clean generated app passes', () => {
  const r = check([
    'server/index.js | app.use(errorHandler); app.listen(process.env.PORT)',
    'routes/account/billing.js | requireUser(session); export default function Billing() {}',
    'routes/webhook.js | stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_SECRET)',
    'db/schema.ts | CREATE TABLE payments (id serial)',
    'migrations/0001.sql | CREATE TABLE payments (id serial)',
    'fly.toml | APP_URL = "https://app.example.com"',
  ].join('\n'));
  assert.deepEqual(codes(r), ['PRODUCTION_READY']);
  assert.equal(r.stats.lines, 6);
});
