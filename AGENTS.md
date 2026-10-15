# Working on Unlock Lingo

Expo SDK 57 development build (not Expo Go), TypeScript strict, Expo Router in `src/app`.

- Install Expo packages at the SDK-compatible version (`npx expo install <pkg>`, or the version in
  `node_modules/expo/bundledNativeModules.json` when offline).
- Keep business logic out of components: pure logic goes in `src/features/*/domain`, SQL only in
  `src/repositories`, orchestration in services and hooks.
- Never edit a shipped migration. Add `src/services/database/migrations/00N_*.ts`.
- Seed content changes require bumping `CONTENT_VERSION`.
- `/android` is generated. Configure native behaviour through `app.json` or config plugins.
- No `any`. Validate untrusted data (JSON columns, settings) with Zod.
- Before declaring work done, run `npm run check` (typecheck, lint, tests).

## Branches

Name branches `<type>/<short-kebab-description>` after the work they contain, never after a
tool or session. Types: `feature`, `fix`, `docs`, `chore`, `refactor`, `test`. Examples:
`feature/learning-engine`, `feature/alarms`, `feature/unlock-cards`, `fix/queue-ordering`.
One branch per phase or coherent change; commit after each significant step.
