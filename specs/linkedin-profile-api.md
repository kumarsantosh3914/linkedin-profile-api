# LinkedIn Profile API — Technical Spec (Node.js)

## 1. Overview

A hosted REST API that accepts a LinkedIn profile URL and returns structured
JSON (name, headline, location, about, experience, education, skills,
certifications, languages, profile image). Backend authenticates to LinkedIn
using a personal account session (cookie-based), not a browser.

**Stack:** Node.js, Express, MongoDB (Mongoose), Redis (optional cache), Axios.

---

## 2. Project Structure

```
linkedin-profile-api/
├── src/
│   ├── config/
│   │   └── env.js                # loads & validates env vars
│   ├── routes/
│   │   └── profile.routes.js     # /api/v1/profile endpoints
│   ├── controllers/
│   │   └── profile.controller.js # request handling, orchestration
│   ├── services/
│   │   ├── sessionManager.js     # holds li_at/JSESSIONID, attaches to requests
│   │   ├── linkedinClient.js     # low-level HTTP client to LinkedIn endpoints
│   │   ├── scraperService.js     # orchestrates fetch + retry + rate limit
│   │   └── normalizerService.js  # raw LinkedIn JSON -> our schema
│   ├── db/
│   │   ├── models/
│   │   │   ├── Profile.js        # Mongoose schema (embeds experience/education/skills)
│   │   │   └── RequestLog.js
│   │   └── index.js              # Mongoose connection init
│   ├── cache/
│   │   └── redisClient.js
│   ├── middleware/
│   │   ├── validateUrl.js
│   │   ├── rateLimiter.js        # protects OUR api from abuse
│   │   └── errorHandler.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── throttle.js           # protects LinkedIn account from abuse
│   └── app.js
├── tests/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---



## 3. Environment Variables

```bash
PORT=3000
NODE_ENV=production

MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/linkedin_api
REDIS_URL=redis://host:6379

LINKEDIN_LI_AT=              # session cookie value
LINKEDIN_JSESSIONID=         # csrf token value

CACHE_TTL_HOURS=24
LINKEDIN_MAX_REQUESTS_PER_MIN=5
API_KEY=                     # simple auth for your own API consumers
```

---



## 4. API Contract



### POST /api/v1/profile

Request:

```json
{ "url": "https://www.linkedin.com/in/santoshkum" }
```

Response — cache hit (200):

```json
{
  "status": "success",
  "cached": true,
  "fetchedAt": "2026-08-20T10:00:00Z",
  "data": { "...": "see schema below" }
}
```

Response — cache miss, async job started (202):

```json
{ "status": "pending", "jobId": "a1b2c3" }
```

Response — LinkedIn session invalid (503):

```json
{ "status": "error", "code": "SESSION_EXPIRED", "message": "LinkedIn session needs refresh" }
```

Response — bad input (400):

```json
{ "status": "error", "code": "INVALID_URL", "message": "URL must be a linkedin.com/in/ profile link" }
```



### GET /api/v1/profile/status/:jobId

```json
{ "status": "success" | "pending" | "failed", "data": { "...": "..." } }
```



### GET /health

```json
{ "status": "ok", "linkedinSession": "valid" | "expired" | "unknown" }
```

---



## 5. Output Schema (normalized)

```json
{
  "name": "",
  "headline": "",
  "location": "",
  "about": "",
  "profileImageUrl": "",
  "experience": [
    { "title": "", "company": "", "duration": "", "description": "" }
  ],
  "education": [
    { "school": "", "degree": "", "years": "" }
  ],
  "skills": ["", ""],
  "certifications": ["", ""],
  "languages": ["", ""],
  "sourceUrl": "",
  "fetchedAt": ""
}
```

---



## 6. Database Schema (Mongoose)

Experience/education/skills are embedded sub-documents on the `Profile`
document rather than separate collections — they're always read/written
together with the parent profile, so embedding avoids needless joins/lookups
and keeps a single upsert per scrape.

```js
// models/Profile.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ExperienceSchema = new Schema({
  title: String,
  company: String,
  duration: String,
  description: String,
}, { _id: false });

const EducationSchema = new Schema({
  school: String,
  degree: String,
  years: String,
}, { _id: false });

const ProfileSchema = new Schema({
  linkedinUrl: { type: String, required: true, unique: true, index: true },
  name: String,
  headline: String,
  location: String,
  about: String,
  profileImageUrl: String,
  experience: [ExperienceSchema],
  education: [EducationSchema],
  skills: [String],
  certifications: [String],
  languages: [String],
  rawJson: Schema.Types.Mixed,      // full raw payload for debugging/audit
  fetchedAt: Date,
  expiresAt: { type: Date, index: true },  // TTL-friendly for cache invalidation
}, { timestamps: true });

module.exports = mongoose.model('Profile', ProfileSchema);
```

```js
// models/RequestLog.js
const RequestLogSchema = new Schema({
  linkedinUrl: String,
  status: { type: String, enum: ['pending', 'success', 'failed', 'rate_limited'] },
  errorMessage: String,
}, { timestamps: true });

module.exports = mongoose.model('RequestLog', RequestLogSchema);
```

**Optional:** add a MongoDB TTL index on `expiresAt` if you want expired cache
entries automatically purged rather than just filtered out on read:

```js
ProfileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

---



## 7. Module Responsibilities

**sessionManager.js**

- Reads `LINKEDIN_LI_AT` / `LINKEDIN_JSESSIONID` from env
- Exposes `getAuthHeaders()` used by every outbound request
- Exposes `isSessionValid()` flag, flipped false on a detected auth failure
- Never logs credential values

**linkedinClient.js**

- Thin Axios wrapper: base URL, default headers (user-agent, csrf-token, cookie), timeout
- Translates non-2xx / redirect-to-login responses into a typed `SessionExpiredError`
- Single place to change if LinkedIn's request shape changes

**throttle.js**

- Token-bucket or simple sliding-window limiter capping requests/min to LinkedIn
- Applied inside `scraperService`, independent of your public API's own rate limiter

**scraperService.js**

- Orchestrates: check cache → check throttle → call `linkedinClient` → hand off to `normalizerService` → persist → return
- Retries transient failures (timeout, 429) with backoff; does not retry auth failures

**normalizerService.js**

- Pure function(s): raw LinkedIn payload → output schema above
- Isolated and unit-testable independent of network code

**validateUrl.js (middleware)**

- Regex/URL check for `linkedin.com/in/<slug>`,  rejects anything else with 400

**rateLimiter.js (middleware)**

- Protects *your* API from being hammered by its own callers (e.g. express-rate-limit + API key)

**errorHandler.js**

- Central error formatter → consistent `{status, code, message}` responses
- Maps `SessionExpiredError` → 503, `ValidationError` → 400, unknown → 500

---



## 8. Caching Strategy

- Check `profiles` collection (or Redis) for `linkedinUrl` with `expiresAt > now()`
- On hit: return immediately, `cached: true`
- On miss: proceed to scrape, upsert document (`findOneAndUpdate` with `upsert: true`), set `expiresAt = now() + CACHE_TTL_HOURS`
- Redis is optional — MongoDB alone is sufficient for the assignment; Redis is a nice-to-have if you want low-latency repeat lookups

---



## 9. Error Handling & Observability


| Scenario                           | Response              | Notes                                               |
| ---------------------------------- | --------------------- | --------------------------------------------------- |
| Invalid URL                        | 400                   | caught at middleware, never reaches scraper         |
| LinkedIn session expired/invalid   | 503 `SESSION_EXPIRED` | logged to `request_log`, alerting is a nice-to-have |
| LinkedIn rate-limited us           | 429 (proxied) or 503  | back off, don't retry immediately                   |
| Profile private / not found        | 404                   | distinguish from auth failure                       |
| Unexpected LinkedIn response shape | 500 `PARSE_ERROR`     | log raw payload (redacted) for debugging            |


---



## 10. Security Checklist

- [ ] `.env` in `.gitignore`, only `.env.example` committed
- [ ] Credentials read only via `process.env`, never hardcoded
- [ ] API itself requires an API key header (`x-api-key`) for callers
- [ ] Input validated/sanitized before any DB or outbound call
- [ ] No PII (raw scraped data) logged in plaintext logs
- [ ] Deployed over HTTPS only (platform-provided TLS is fine)

---



## 11. Deployment Notes

- Any platform with env-var secrets + HTTPS: Render / Railway / Fly.io
- MongoDB Atlas free tier works well as the managed DB — no server to provision
- Set `LINKEDIN_LI_AT`, `LINKEDIN_JSESSIONID`, `MONGODB_URI`, `API_KEY` as secret env vars in the platform dashboard
- No migration step needed — Mongoose schemas apply at the application layer, not the DB layer
- `/health` endpoint for uptime checks (include a Mongo connection ping)

---



## 12. README Requirements (for submission)

1. Setup instructions (env vars, `npm install`, `npm start`)
2. API documentation (endpoints, request/response examples)
3. Your approach (how you identified the LinkedIn endpoints, how auth works)
4. Known limitations:
  - Session expiry requires manual credential refresh
  - Personal account may be rate-limited/restricted by LinkedIn under heavy use
  - Fields vary by profile privacy settings and connection degree
  - No guarantee of long-term stability if LinkedIn changes internal response formats

