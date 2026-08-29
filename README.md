# DEMO VIDEO


https://github.com/user-attachments/assets/0947716d-97d4-4627-8ea9-bb0243507815

# LinkedIn Profile API

A hosted REST API that accepts a LinkedIn profile URL and returns structured
JSON (name, headline, location, about, experience, education, skills,
certifications, languages, profile image). The backend authenticates to
LinkedIn using a personal account session (`li_at` / `JSESSIONID` cookies)
and talks to LinkedIn's internal Voyager API directly over HTTP — there is
no browser anywhere in the request path.

**Stack:** Node.js, TypeScript, Express 5, MongoDB (Mongoose), Redis, Axios.

**Live deployment:** `https://api.santoshdev.win`

## Try it live

A demo `API_KEY` has been shared separately via email — replace
`YOUR_API_KEY` below with that value. It's a temporary demo credential;
happy to issue a fresh one if it's rotated or expired by the time you try
this.

```bash
# 1. Health check — no API key required
curl https://api.santoshdev.win/health
# {"status":"ok","linkedinSession":"valid"}

# 2. Request a profile scrape
curl -X POST https://api.santoshdev.win/api/v1/profile \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"url":"https://www.linkedin.com/in/santoshkum"}'
# Cache miss -> 202 { "status": "pending", "jobId": "<uuid>" }
# Cache hit  -> 200 { "status": "success", "cached": true, "fetchedAt": "...", "data": { ... } }

# 3. Poll the job until it completes (use the jobId from step 2)
curl https://api.santoshdev.win/api/v1/profile/status/<jobId> \
  -H "x-api-key: YOUR_API_KEY"
```

Example completed response (trimmed):
```json
{
  "status": "success",
  "data": {
    "name": "Santosh Kumar",
    "headline": "Software Engineer | Scalable Backend Systems (Node.js, TypeScript, Go) | ...",
    "location": "Noida, Uttar Pradesh, India",
    "about": "Software Engineer focused on high-performance backend systems and distributed architecture...",
    "profileImageUrl": "https://media.licdn.com/dms/image/v2/...",
    "experience": [
      {
        "title": "Software Engineer",
        "company": "Indorise Technologies Private Limited",
        "duration": "8/2025 - Present",
        "description": "Building SecureConnect, an on-demand security-personnel marketplace..."
      }
    ],
    "education": [
      { "school": "Giani Zail Singh College of Engineering & Technology, Bathinda", "degree": "Bachelor of Technology - BTech", "years": "9/2020 - 7/2024" }
    ],
    "skills": ["Distributed Systems", "Redis", "Amazon Web Services (AWS)", "..."],
    "certifications": ["Agentic AI Engineering"],
    "languages": ["Hindi", "English"],
    "sourceUrl": "https://www.linkedin.com/in/santoshkum",
    "fetchedAt": "2026-08-27T19:00:26.409Z"
  }
}
```

## Setup

```bash
npm install
cp .env.example .env   # fill in the values below
npm start               # ts-node src/server.ts
# or, for local development with auto-restart:
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on (default `3000`) |
| `NODE_ENV` | `development` / `production` |
| `MONGODB_URI` | Mongo connection string |
| `REDIS_URL` | Redis connection string |
| `LINKEDIN_LI_AT` | Your LinkedIn session cookie value (`li_at`) |
| `LINKEDIN_JSESSIONID` | Your LinkedIn session cookie value (`JSESSIONID`), e.g. `ajax:1234567890` — no surrounding quotes |
| `CACHE_TTL_HOURS` | How long a scraped profile stays cached before re-scraping (default `24`) |
| `LINKEDIN_MAX_REQUESTS_PER_MIN` | Outbound rate cap to LinkedIn itself (default `5`) |
| `API_KEY` | Required in the `x-api-key` header by callers of this API |

`LINKEDIN_LI_AT` and `LINKEDIN_JSESSIONID` come from your browser's cookies
while logged into linkedin.com (DevTools → Application → Cookies). Never
commit `.env` — only `.env.example` is tracked.

## API documentation

All `/api/v1/*` routes require an `x-api-key` header matching `API_KEY`.

### `POST /api/v1/profile`

Request:
```json
{ "url": "https://www.linkedin.com/in/some-person" }
```

**Cache hit** — `200`:
```json
{
  "status": "success",
  "cached": true,
  "fetchedAt": "2026-08-27T16:39:04.837Z",
  "data": { "...": "see Output Schema below" }
}
```

**Cache miss, scrape started in the background** — `202`:
```json
{ "status": "pending", "jobId": "35f87c57-c6e2-4682-8898-631f36b2fb99" }
```

**Invalid URL** — `400`:
```json
{ "status": "error", "code": "INVALID_URL", "message": "URL must be a linkedin.com/in/ profile link" }
```

**LinkedIn session invalid** — `503`:
```json
{ "status": "error", "code": "SESSION_EXPIRED", "message": "LinkedIn session needs refresh" }
```

**Missing/invalid API key** — `401`.

### `GET /api/v1/profile/status/:jobId`

Poll after a `202`.

```json
{ "status": "pending" | "success" | "failed", "data": { "...": "..." } }
```

A `failed` status also includes a `message` describing the error.
An unknown `jobId` returns `404`.

### `GET /health`

No API key required.

```json
{ "status": "ok" | "error", "linkedinSession": "valid" | "expired" | "unknown" }
```

`status` reflects the live MongoDB connection. `linkedinSession` is
`"unknown"` until the first scrape attempt (or if no credentials are
configured), then flips to `"valid"`/`"expired"` based on the last
LinkedIn response.

### Output schema (`data` field)

```json
{
  "name": "",
  "headline": "",
  "location": "",
  "about": "",
  "profileImageUrl": "",
  "experience": [{ "title": "", "company": "", "duration": "", "description": "" }],
  "education": [{ "school": "", "degree": "", "years": "" }],
  "skills": [""],
  "certifications": [""],
  "languages": [""],
  "sourceUrl": "",
  "fetchedAt": ""
}
```

## Approach

LinkedIn's profile page is served through its internal **Voyager API**,
which is undocumented and not stable. Rather than guess at it, the actual
current endpoint was found by inspecting real, authenticated network
traffic from a logged-in browser session (a one-time diagnostic step —
the shipped code never uses a browser).

That inspection showed two things the original assumption got wrong:

1. The commonly-referenced legacy endpoint
   (`GET /voyager/api/identity/profiles/{id}/profileView`) is retired —
   it returns `410 Gone`.
2. The current endpoint is:

   ```
   GET /voyager/api/identity/dash/profiles
     ?q=memberIdentity&memberIdentity={publicId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93
   ```

   and its response is **not** a clean nested object. LinkedIn's REST.li
   "normalized+json" format returns a flat `included` array of entity
   fragments (profile, positions, education, geo, company, etc.), each
   tagged with an `entityUrn` and `$type`, plus cross-references between
   them (e.g. the profile's location is a `*geo` URN pointing at a
   separate `Geo` entity elsewhere in the array, not an inline string).

`src/services/normalizer.service.ts` reassembles this: it locates the core
profile entity by `entityUrn` containing `fsd_profile:`, collects
entities whose `$type` ends in `Position`/`Education`/`Skill`/
`Certification`/`Language`, and resolves URN references (like the geo
lookup) against the same `included` array.

**Auth** is cookie-based, matching how the LinkedIn web app itself
authenticates: the `li_at` and `JSESSIONID` cookies are sent on every
request, with `JSESSIONID`'s value (stripped of quotes) repeated as a
`csrf-token` header and `x-restli-protocol-version: 2.0.0` set, exactly as
LinkedIn's own frontend does it. See `src/services/session.service.ts` and
`src/services/linkedinClient.service.ts`.

**Request flow** (`src/services/scraper.service.ts`): check Mongo for a
non-expired cached `Profile` → apply an outbound sliding-window throttle
(`LINKEDIN_MAX_REQUESTS_PER_MIN`, independent of this API's own
consumer-facing rate limiter) → fetch → normalize → upsert into Mongo with
a `CACHE_TTL_HOURS` expiry → log the outcome to `RequestLog`. Transient
failures (timeouts, `429`) retry with backoff; a dead session
(`SessionExpiredError`, raised on any non-2xx or 3xx response from
LinkedIn) fails immediately without retrying.

Because a scrape can take a few seconds, `POST /profile` returns
immediately: a cache hit responds inline, a cache miss kicks off the
scrape in the background and returns a `jobId` to poll via
`GET /profile/status/:jobId`.

## Known limitations

- **Session expiry requires manual credential refresh.** `li_at`/
  `JSESSIONID` are tied to a real login session and expire, or can be
  invalidated by LinkedIn server-side (observed directly during
  development: a `Set-Cookie: li_at=delete me` response after automated
  traffic on the account triggered a device-verification challenge).
  When this happens, `/health` reports `linkedinSession: "expired"` and
  scrapes fail with `SESSION_EXPIRED` until fresh cookies are set.
- **The personal account can be rate-limited or challenged by LinkedIn
  under heavy or automated-looking use.** This was observed firsthand,
  not just theorized — keep request volume low and realistic.
- **Fields vary by profile privacy settings, connection degree, and how
  complete the profile itself is.** A sparsely-filled profile will
  legitimately return empty arrays for `experience`, `skills`,
  `certifications`, and `languages` — this isn't always a parsing gap.
- **`Skill`/`Certification`/`Language` extraction uses a `$type`-suffix
  match**, the same pattern confirmed for `Position`/`Education` — verified
  end-to-end against a real, richly-populated profile (see the example
  response above). If a field ever comes back empty on a profile you know
  has that data, the `$type` string for that entity may have changed and
  would need adjusting in `normalizer.service.ts`.
- **No guarantee of long-term stability.** This is exactly what happened
  during development — LinkedIn had already retired the endpoint this
  project originally targeted. Internal API paths, `decorationId` values,
  and response shapes can change without notice and will require
  re-inspecting live traffic to fix.
- **Background job state is in-memory** (`src/services/job.service.ts`).
  It doesn't survive a process restart and isn't shared across multiple
  instances — fine for a single-process deployment, not for horizontal
  scaling without moving this to Redis or Mongo.
