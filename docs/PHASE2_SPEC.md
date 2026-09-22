# Phase 2 Feature Spec (2026-09-20)

This document is the **interface contract** for phase 2: three new features (`config` / `mail` / `import`).
Teammate A's GUI integrates against this file; the implementer (operator) delivers against this file.
All endpoints share the prefix `/features/<feature>/api` and return JSON; errors are uniformly `{ error: string }` plus an appropriate status code.

## 0. Scope Statement (what's in this phase vs. not)

| Feature | This phase (in scope) | Later (reserved, not this phase) |
|---|---|---|
| config | Config read/write endpoints + encrypted storage + masked echo + connection testing + priority-chain settings | Per-user configs for multiple users |
| mail | Gmail connection status/initiate/disconnect endpoints, CRUD and switching across multiple Supabase projects | Real OAuth callback, email send/receive polling |
| import | Single-file/multi-select/folder upload endpoints, validation chain, dedup, content detection, recomputable | Resumable uploads, large-file chunking |

## 1. Security Model

> The passphrase rule in this section governs only the endpoints belonging to **the three features covered by this
> document** (config/mail/import). The project separately has `POST` endpoints on the
> `classification`/`extraction`/`comparison` modules (single-document classify/extract/compare) — those three POST
> endpoints don't write to the database and are open, requiring no passphrase. Don't misread the rule below as
> "every POST in the whole project needs a passphrase" — see `SHARED_INTERFACES.md` for the exact contract.

- Read endpoints: fully open (consistent with the existing demo; judges can browse freely)
- Write endpoints (PUT/POST/DELETE): require the `x-admin-token: <ADMIN_TOKEN>` request header.
  - The server **refuses all write operations** and returns a readable error when `ADMIN_TOKEN` isn't configured (secure default)
  - GUI write operations: **recommended not to build a write entry point at all**; if one is built, the operator must manually enter the passphrase, have it validated server-side, and only then place it in `x-admin-token` (see "Write Protection" in SHARED_INTERFACES) — the server **must never** auto-inject a token for a request that an anonymous user could trigger
- Sensitive fields (API keys, OAuth tokens, Supabase service key):
  - Storage: AES-256-GCM encrypted (see section 2)
  - Echo: only ever returns a mask like `sk-ant-…f3a2` plus `has_value: true` — **never returns the plaintext**
- New environment variables (added to .env.example):
  - `ENCRYPTION_MASTER_KEY`: 32-byte base64; sensitive-field writes are refused when missing (read endpoints are unaffected)
  - `ADMIN_TOKEN`: the passphrase for write operations; unconfigured = writes are forbidden

## 2. Encryption Scheme (decided: AES-256-GCM)

- File: `lib/shared/crypto.ts`, interface:
  - `encryptSecret(plain: string): string` — returns `v1.<iv_b64>.<tag_b64>.<cipher_b64>`
  - `decryptSecret(payload: string): string`
  - `maskSecret(plain: string): string` — produces a `sk-ant-…f3a2`-style mask (keeps 4-6 characters on each end)
- Rationale: symmetric encryption (the key must be recoverable for use); GCM provides authentication (tamper protection); native to Node with no dependency; the `v` prefix leaves room for future master-key rotation
- Constraints: only ciphertext is ever stored in the database, plaintext exists only in server-side memory; logs/error messages must never print plaintext

## 3. config feature

### 3.1 Table `app_config`

| Column | Type | Description |
|---|---|---|
| key | text PK | The config item's unique name |
| category | text | `llm` / `pipeline` / `mail` / `storage` / `general` |
| value | jsonb | The value (string/number/boolean/array) |
| is_secret | boolean | A sensitive value (ciphertext is stored, a mask is echoed back) |
| updated_at | timestamptz | Used for concurrency-conflict warnings (required by spec) |

### 3.2 Config Item List (key names are fixed; the GUI renders based on this)

| key | Example value | Description |
|---|---|---|
| `llm.provider_priority` | `["rules","jev","gemini"]` | Classification/comparison engine priority chain (a display item; see DECISION_SPEC for actual runtime behavior) |
| `llm.jev.confidence_threshold` | `0.85` | Below this Jev confidence, human review is triggered |
| `llm.default_provider` | `"gemini"` | The fallback text model (the runtime default is also gemini) |
| `llm.anthropic_api_key` | ciphertext | Corresponds to ANTHROPIC_API_KEY |
| `llm.openai_api_key` | ciphertext | Corresponds to OPENAI_API_KEY |
| `llm.deepseek_api_key` | ciphertext | Corresponds to DEEPSEEK_API_KEY |
| `llm.gemini_api_key` | ciphertext | Corresponds to GOOGLE_GENERATIVE_AI_API_KEY |
| `llm.typesafe_api_key` | ciphertext | Corresponds to TYPESAFE_API_KEY |
| `llm.lmstudio_base_url` | `"http://localhost:1234/v1"` | Plaintext |
| `pipeline.concurrency` | `4` | Batch concurrency cap |
| `pipeline.batch_limit` | `50` | Cap on a single batch |
| `storage.upload_max_file_mb` | `20` | Per-file size cap |
| `storage.upload_max_batch_mb` | `3` | Cap on the total per request (leaves headroom under Vercel's 4.5MB limit) |
| `mail.auto_sync_enabled` | `false` | Reserved |
| `mail.sync_interval_minutes` | `15` | Reserved |

Config priority convention: **a database value > an environment variable > the code default**; when the env var exists and has never been overridden in the database, the echoed value is tagged `source: "env"`.

### 3.3 Endpoints

```
GET  /features/config/api                       Read all config (sensitive items masked; filter with ?category=llm)
PUT  /features/config/api                       Batch write: { updates: [{ key, value }] } (write-protected)
POST /features/config/api/test                  Test a connection: { target: "claude"|"openai"|"deepseek"|"gemini"|"typesafe"|"supabase"|"lmstudio" }
                                                -> { ok: boolean, detail: string } (write-protected; the server decrypts and makes a real call)
```

Response example (GET):
```json
{
  "items": [
    { "key": "llm.default_provider", "category": "llm", "value": "gemini", "is_secret": false, "source": "db", "updated_at": "..." },
    { "key": "llm.anthropic_api_key", "category": "llm", "value": "sk-ant-…f3a2", "is_secret": true, "has_value": true, "source": "env", "updated_at": null }
  ]
}
```

## 4. mail feature (placeholder skeleton; real connections left for later)

### 4.1 Tables

`mail_accounts`: `id`(uuid) / `provider`(`gmail`) / `email_address` / `status`(`disconnected|pending|connected|error`) /
`access_token`(ciphertext) / `refresh_token`(ciphertext) / `token_expires_at` / `scopes` / `last_synced_at` / `updated_at`

`supabase_projects`: `id`(uuid) / `label` / `project_url` / `anon_key`(plaintext, public information) / `service_key`(ciphertext) /
`is_active`(bool, unique) / `updated_at`

### 4.2 Endpoints

```
GET  /features/mail/api/gmail                    Connection status (never returns the token)
POST /features/mail/api/gmail/connect            Initiate a connection -> { status: "not_implemented", message, redirect_uri } (write-protected)
POST /features/mail/api/gmail/disconnect         Disconnect (write-protected)
GET  /features/mail/api/supabase-projects        List projects (service_key masked)
POST /features/mail/api/supabase-projects        Create/update a project (write-protected)
POST /features/mail/api/supabase-projects/activate  Switch the active project (write-protected)
POST /features/mail/api/supabase-projects/deactivate  Deactivate the current project and fall back to the environment-variable config (write-protected; the recovery path after switching to a misconfigured project)
```

Supabase client resolution priority: `supabase_projects.is_active > environment variable`. The existing env-based setup keeps working; after switching projects, newly created requests go through the new project.

### 4.3 Reserved Future Path (documented in the endpoint comments)

Once really wired up: Gmail OAuth (scope `gmail.readonly`) -> the callback stores an encrypted token -> `users.messages.list` is triggered on a schedule or manually ->
the existing classification/extraction/comparison pipeline is reused -> the result lands in `verification_results`.

## 5. import feature

### 5.1 Table and Storage

- Supabase Storage bucket: `uploads` (private)
  - Path: `documents/<first 2 chars of sha256>/<sha256>/<original filename>`
- Table `uploaded_documents`:

| Column | Description |
|---|---|
| id | uuid PK |
| file_name / file_size / mime | Original file info |
| storage_path | Storage path (of the original file) |
| file_hash | sha256, unique, the basis for dedup |
| parse_status | `ok` / `unreadable` / `unsupported` |
| parse_error | Reason it couldn't be read |
| extracted_text | The parsed-out text |
| detected_type | `SI` / `BL` / `OTHER` / `UNKNOWN` (detected from content, not filename) |
| review_status | `pending` (UNKNOWN, awaiting manual classification) / `filed` / `skipped` (duplicate) |
| uploaded_by | Reserved (currently always written as `"admin"`) |
| updated_at | Used for conflict warnings |

### 5.2 Validation Chain (in order)

1. Extension allowlist: `.txt .md .pdf .docx .xlsx`
2. Magic-number check: PDF=`%PDF`, DOCX/XLSX=ZIP header `PK\x03\x04`, TXT must contain no binary control characters
3. Size: per-file <= `storage.upload_max_file_mb`
4. Content hash: if it already exists -> `skipped` (duplicate), not re-parsed
5. Parse text -> detect type from content (SI signals / BL signals / other document signals / unknown)
6. Persist to the database + store the original file (upsert by `file_hash`)

### 5.3 Endpoints

```
POST /features/import/api/upload     write-protected
  body: { files: [{ name, mime?, data_base64 }], batch_id? }
  limit: total per request <= storage.upload_max_batch_mb (default 3MB); exceeding it returns 413 + a readable message
  returns: { batch_id, items: [{ name, status: "stored"|"duplicate"|"rejected", reason?, id?, detected_type? }] }
  -- one file's failure doesn't affect the others (per-file try/catch)

GET  /features/import/api/documents  List (?review_status=pending|filed|skipped&detected_type=SI|BL|OTHER|UNKNOWN&limit=&offset=)
PUT  /features/import/api/documents  Manual classification: { id, detected_type } (write-protected)
```

(There's no export endpoint here — the uploaded-document pool doesn't feed the official submission export; that's the responsibility of the `results` module's `GET /features/results/api/export`. Don't conflate the two.)

GUI-side convention: after getting the file list from folder upload via `<input webkitdirectory>`, split it into requests **of up to 3MB per batch**;
show each batch's results in place, and let failed ones be retried individually.

### 5.4 Relationship Between Uploads and the Main Flow

- Documents with `detected_type=SI|BL`: enter the "document pool" and can later be attached to an email/participate in comparison (this phase just stores them + makes them queryable)
- `UNKNOWN`: `review_status=pending`, the GUI prompts for manual classification; becomes `filed` once classified
- `OTHER`: marked as "not an SI/BL document," excluded from comparison by default

## 6. Concurrency and Consistency

- Every write uses `upsert` (`app_config.key` / `uploaded_documents.file_hash` / `mail_accounts.id` / `supabase_projects.id`)
- Every table carries `updated_at`; PUT supports an optional `expected_updated_at`, returning `409` + a readable message on a mismatch (optimistic locking)
- Concurrency inside the upload endpoint is capped at 3 (`mapWithConcurrencyLimit`); batch size is controlled by the client per batch
- Module-level mutable state is forbidden; the Supabase client is created per request (especially important in the multi-project scenario)

## 7. MCP Exposure (this phase)

Actually delivered (consistent with SHARED_INTERFACES.md; 3 new tools added, 11 total):
- `sync_gmail` (placeholder: returns a readable `not_implemented` message)
- `list_uploaded_documents` (read-only)
- `classify_uploaded_document` (writes to the database, manual classification, `readOnlyHint:false`)

Note: the originally planned `get_config` / `update_config` tools were not built this cycle (config is read/written
via the REST endpoints, which is sufficient for GUI integration; if an MCP client ever needs config capability, it
can be added later following the same mcp/index.ts pattern).
New tools are always defined in each feature's own `mcp/index.ts`; `app/core/mcp-server/tools.ts` only aggregates and registers them.

## 8. Acceptance Checklist

- [ ] `npm run typecheck` + `npm run build` pass
- [ ] Encryption unit tests: encrypt/decrypt round trip, tampered ciphertext errors, writes refused when the master key is missing
- [ ] config: GET masking is correct, PUT write protection works (401/403 without a token), the test endpoint returns a readable error for an unconfigured key
- [ ] import: one real file each of txt/pdf/docx/xlsx uploads successfully; bad files/over-limit/duplicates each return the correct status
- [ ] mail: the disconnected state is readable; connect returns not_implemented; after switching projects, endpoints use the new project
- [ ] The existing 520-email evaluation doesn't regress (`npm run evaluate -- --no-write`)
- [ ] Docs kept in sync: SHARED_INTERFACES.md / README / .env.example / DATA_FLOW.md

## 9. Explicitly Out of Scope (to prevent over-engineering)

- No plugin registry/dynamic loading
- No client-side encryption (the server must be able to decrypt and use the values)
- No envelope encryption/per-user data keys (this is a single-tenant phase; the `v` prefix leaves an upgrade path)
- No real OAuth callback (mail stays a placeholder)
- No resumable uploads/chunking for uploads (the batch mechanism is sufficient)
