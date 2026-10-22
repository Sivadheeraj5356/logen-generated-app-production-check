# Generated App Production Check

A client-side QA check for AI-generated apps, built with Logen.io's problem in mind: an AI app builder that takes users from idea to a deployable product - with auth, database, payments and custom domains - only earns trust if the generated app is actually safe to ship.

Paste generated code, one line per file as `path | code`, and the tool flags:

- **HARDCODED_SECRET** - credential literals in generated code instead of env vars
- **DEV_URL_IN_PROD** - production config pointing at localhost or dev URLs
- **WEBHOOK_UNVERIFIED** - payment webhook handlers with no signature verification
- **AUTH_MISSING** - private routes with no auth check
- **SCHEMA_WITHOUT_MIGRATION** - schema/model changes with no migration files
- **NO_ERROR_HANDLER** - server entry with no error-handling middleware
- **PII_IN_LOGS** - email, phone, password or card fields written to logs

Plain HTML, CSS and JavaScript. No build step, no external services.

## Run

Open `index.html` in a browser, paste generated code, click "Run production check".

## Test

```
npm test
```

Seven tests cover each rule's positive and negative case.
