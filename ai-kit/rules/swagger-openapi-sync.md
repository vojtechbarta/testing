# Swagger/OpenAPI Sync Rule

When changing backend API behavior, keep Swagger/OpenAPI documentation up to date in the same change.

## Update docs when API changes

- If you add/change/remove endpoints in `backend/src/routes/*.ts`, update `@openapi` annotations in the affected files.
- If request/response shapes, params, headers, auth, or status codes change, update corresponding OpenAPI schemas/components in `backend/src/docs/openapi.ts`.
- Keep docs endpoints intact in `backend/src/app.ts`:
  - `GET /docs-json`
  - `GET /docs`

## Verify before finishing

- Run `cd backend && npm run build`
- Run `cd backend && npm run docs:openapi`
- Confirm `backend/openapi.json` reflects your API changes.

## PR hygiene

- Do not merge API changes with stale OpenAPI docs.
- Treat OpenAPI drift as a bug.
