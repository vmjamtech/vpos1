# VPOS1 Copilot Instructions

VPOS1 is an existing Angular/Ionic/Capacitor POS application. Make the smallest safe change that correctly solves the request.

## Working Rules

- Inspect the owning implementation and nearby tests before changing behavior.
- Reuse existing services, utilities, and UI patterns; avoid unrelated refactors and dependencies.
- Preserve existing behavior unless the request requires a change. Explain meaningful tradeoffs before implementation.
- Keep investigation, code changes, and responses concise without skipping necessary verification or safety checks.

## Data and High-Risk Changes

- Treat the existing SQLite database and user records as production data. Never casually delete, replace, recreate, or reset them.
- Before database initialization, query, or migration changes, inspect how existing data is affected and prefer additive, backward-compatible changes.
- Treat printing, authentication, Android configuration, dependencies, and shared services as high-risk. Trace all affected callers and preserve unrelated behavior.
- Do not change Gradle, Java, Android SDK, or Capacitor configuration without a clear requirement.

## Verification

- Use the repo-local scripts: `npm run build`, `npm test`, and `npm run lint` as appropriate.
- For Android work, preserve the existing Capacitor setup and verify the relevant Android build when needed.
- Report what changed, why, affected files, and the checks run. State clearly if a check could not be completed.
