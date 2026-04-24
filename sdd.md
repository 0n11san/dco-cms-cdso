# System Design Document (SDD)
## DCO Contract Management System (DCO CMS)

| Field | Value |
|---|---|
| **System Name** | DCO Contract Management System (DCO CMS) |
| **Version** | 1.0.0 |
| **Classification** | UNCLASSIFIED |
| **Owner Organization** | Defensive Cyber Operations (DCO), ARCYBER |
| **Deployment Target** | Gabriel Nimbus (GN) — NIPR Pre-Production |
| **Authorization Framework** | cDSO / ArCTIC |
| **Document Status** | Draft |
| **Last Updated** | 2026-04-23 |

---

## 1. Purpose

This System Design Document describes the architecture, components, data flows, and security posture of the DCO Contract Management System (DCO CMS). It is submitted as part of the cDSO authorization package to support the Authority to Operate (ATO) process under the ArCTIC framework.

---

## 2. System Overview

DCO CMS is an internal web application that enables ARCYBER Defensive Cyber Operations program managers to track, manage, and report on delivery orders and software contracts. The system provides:

- A searchable, filterable contract dashboard with role-based visibility controls
- Automated renewal tracking with configurable lead-time alerts
- Budget and fiscal year payment schedule views
- ARCYBER Priorities management
- Audit logging of all create, update, delete, and renewal actions
- Excel import/export for bulk data operations
- Vendor point-of-contact management

The system is intended for use by a small number of internal ARCYBER personnel on NIPR. It does not process classified information and does not interface with external commercial services.

---

## 3. Architecture Overview

DCO CMS follows a three-tier containerized architecture:

```
[User Browser]
      |
      | HTTPS (TLS 1.2+)
      |
[Nginx Frontend Container]
      |  Static file serving (HTML/CSS/JS)
      |  Reverse proxy for /api/* traffic
      |
[Node.js/Express Backend Container]
      |  REST API
      |  Server-side session management
      |  Role-based access control
      |
[PostgreSQL Database Container]
      |  Persistent contract and audit data
      |  Session store
```

All three containers run within the `dco-cms` Kubernetes namespace on Gabriel Nimbus. No container is exposed directly to the internet; all external traffic enters through the GN Istio ingress gateway.

---

## 4. Components

### 4.1 Frontend (Nginx)

| Property | Value |
|---|---|
| Base Image | `registry1.dso.mil/ironbank/opensource/nginx/nginx:1.25` |
| Role | Serves static HTML/CSS/JS; proxies `/api/*` to backend |
| Port | 80 (ClusterIP only — not externally exposed) |
| Replicas | 2 |

The frontend is a single-page application built with vanilla HTML5, CSS3, and JavaScript. It requires no build step and has no npm dependencies. The Nginx container is configured with:

- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`
- Static asset caching (7-day TTL for CSS/JS/images)
- SPA fallback routing (`try_files $uri /index.html`)

### 4.2 Backend (Node.js/Express)

| Property | Value |
|---|---|
| Runtime | Node.js 20 LTS (`registry1.dso.mil/ironbank/opensource/nodejs/nodejs:20`) |
| Framework | Express 4.x |
| Port | 3000 (ClusterIP only) |
| Replicas | 2 |

The backend exposes a JSON REST API consumed exclusively by the frontend. It handles:

- Authentication via `POST /api/auth/login` (bcrypt password validation)
- Session management via `express-session` with a PostgreSQL session store
- All contract CRUD operations
- Priority ordering
- Audit log writes on every mutating operation
- Email notification preview generation

The container runs as a non-root user (UID 1000) with `readOnlyRootFilesystem: true` and all Linux capabilities dropped.

### 4.3 Database (PostgreSQL)

| Property | Value |
|---|---|
| Image | `postgres:15-alpine` |
| Port | 5432 (ClusterIP only) |
| Replicas | 1 (stateful — single primary) |
| Persistence | Kubernetes PersistentVolumeClaim |

Tables:

| Table | Purpose |
|---|---|
| `users` | Usernames, bcrypt-hashed passwords, roles |
| `contracts` | All delivery order records (JSONB for flexible fields) |
| `renewals` | Renewal submissions per contract |
| `audit_log` | Immutable record of all system actions |
| `session` | Active user sessions (managed by connect-pg-simple) |

---

## 5. Data Flow

### 5.1 Authentication Flow

> **Pre-production only:** The flow below uses username/password authentication for development and pipeline testing. Prior to production deployment on Gabriel Nimbus, this must be replaced with CAC/PIV authentication via the GN Keycloak instance (OIDC/JWT). User identity and role assignment will move to Keycloak groups backed by Army Active Directory. No code changes to the frontend are required; only the backend auth middleware changes.

```
[PRE-PROD — username/password]
1. User submits username/password via login form
2. Browser POSTs to /api/auth/login
3. Backend queries users table, compares password with bcrypt hash
4. On success: server creates session record in PostgreSQL, sets httpOnly cookie
5. Browser stores username/role in sessionStorage (display cache only)
6. All subsequent API calls include the session cookie automatically
7. Sessions expire after 8 hours of inactivity

[PRODUCTION — CAC/PIV via Keycloak]
1. User inserts CAC → redirected to GN Keycloak login
2. Keycloak authenticates against Army Active Directory
3. Keycloak issues signed JWT with role claims (e.g. dco-cms-superuser)
4. Backend validates JWT on every request via OIDC middleware
5. Role read from token claims — no local user database required
```

### 5.2 Contract Data Flow

```
1. Authenticated user action triggers a fetch() call in the browser
2. Request sent to Nginx with session cookie
3. Nginx proxies /api/* to the backend container
4. Backend middleware validates session against PostgreSQL session table
5. Route handler executes query against contracts table
6. Audit log entry written for any CREATE / UPDATE / DELETE
7. JSON response returned to browser
```

---

## 6. API Endpoints

| Method | Path | Auth Required | Description |
|---|---|---|---|
| POST | `/api/auth/login` | No | Authenticate and create session |
| POST | `/api/auth/logout` | Yes | Destroy session |
| GET | `/api/auth/me` | Yes | Return current session user |
| GET | `/api/contracts` | Yes | List all contracts |
| POST | `/api/contracts` | Yes | Create contract |
| PUT | `/api/contracts/:id` | Yes | Update contract |
| DELETE | `/api/contracts/:id` | Yes | Delete contract |
| POST | `/api/contracts/:id/renewal` | Yes | Submit renewal action |
| GET | `/api/priorities` | Yes | Get priority ordering |
| PUT | `/api/priorities` | Yes | Save priority ordering |
| GET | `/api/audit-log` | Yes | Retrieve audit log entries |
| GET | `/api/email-preview/:id` | Yes | Generate renewal email preview |
| GET | `/health` | No | Liveness/readiness probe |

---

## 7. Role-Based Access Control

| Feature | Superuser (APM) | Regular User |
|---|---|---|
| View all contract fields | ✅ | ❌ (cost/vendor fields hidden) |
| Create contracts | ✅ | ❌ |
| Edit contracts | ✅ | ❌ |
| Delete contracts | ✅ | ❌ |
| Submit renewals | ✅ | ✅ |
| View audit log | ✅ | ❌ |
| Manage priorities | ✅ | ❌ |
| Export to Excel | ✅ | ✅ |

Roles are assigned at user creation in the `users` table and enforced server-side on every request.

---

## 8. Security Controls

| Control | Implementation |
|---|---|
| Authentication | Server-side bcrypt (12 rounds) password validation |
| Session management | httpOnly, Secure, SameSite=Lax cookie; 8-hour TTL; PostgreSQL-backed |
| Transport security | TLS 1.2+ enforced at GN Istio ingress layer |
| Authorization | Role checked server-side on every API call |
| Audit logging | All mutating operations logged with username, role, timestamp |
| Container hardening | Non-root user, `readOnlyRootFilesystem`, all capabilities dropped |
| Secret management | Passwords and session secret injected via K8s Secrets (not in image) |
| HTTP security headers | X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy |
| Dependency scanning | Trivy container scan in cDSO pipeline (HIGH/CRITICAL = pipeline fail) |
| SBOM | Generated via Syft in SPDX-JSON format, retained 90 days |
| SAST | Semgrep scan of backend source in cDSO pipeline |
| Secret detection | TruffleHog scan on every commit |

---

## 9. Secrets Management

No secrets are stored in the container images or committed to the repository. The following secrets are injected at runtime via Kubernetes Secrets:

| Secret | Description |
|---|---|
| `DB_PASSWORD` | PostgreSQL connection password |
| `SESSION_SECRET` | Express session signing key |

In the cDSO pipeline, these values are stored as masked GitLab CI/CD variables and applied to the cluster at deploy time. In production, integration with a Vault instance is recommended.

---

## 10. External Dependencies

DCO CMS has **no external internet dependencies at runtime**. All functionality operates within the GN cluster boundary.

| Dependency | Purpose | Source |
|---|---|---|
| `express` | HTTP server framework | npm (bundled in image) |
| `pg` | PostgreSQL client | npm (bundled in image) |
| `bcryptjs` | Password hashing | npm (bundled in image) |
| `express-session` | Session management | npm (bundled in image) |
| `connect-pg-simple` | PostgreSQL session store | npm (bundled in image) |
| `helmet` | HTTP security headers | npm (bundled in image) |
| `uuid` | UUID generation | npm (bundled in image) |
| SheetJS (xlsx) v0.18.5 | Excel import/export | Vendored at `js/vendor/xlsx.full.min.js` |
| SortableJS v1.15.0 | Drag-and-drop priority ordering | Vendored at `js/vendor/Sortable.min.js` |
| Chart.js v4.4.0 | Budget charts | Vendored at `js/vendor/chart.umd.min.js` |

---

## 11. Deployment

### 11.1 Pipeline

The application is built and deployed via the cDSO CI/CD pipeline with the following stages:

| Stage | Jobs |
|---|---|
| Pre-test | Secret scan (TruffleHog), Dockerfile lint (Hadolint), JS lint |
| Pre-build | npm audit dependency check, K8s manifest dry-run |
| Build | Docker image build and push to cDSO Harbor registry |
| Post-test | Container scan (Trivy), SBOM generation (Syft), SAST (Semgrep) |
| Review | Manual approval gate (AO/ISSO) |
| Clean | Intermediate image pruning |
| Deliver | `kubectl apply` to GN pre-production namespace |

### 11.2 Kubernetes Resources

| Resource | Count | Namespace |
|---|---|---|
| Deployments | 2 (frontend, backend) | `dco-cms` |
| Services | 2 (ClusterIP) | `dco-cms` |
| Ingress | 1 (Istio) | `dco-cms` |
| ConfigMap | 1 | `dco-cms` |
| Secret | 1 | `dco-cms` |
| PersistentVolumeClaim | 1 (PostgreSQL) | `dco-cms` |

---

## 12. Known Gaps and Remediation Plan

| Gap | Risk | Remediation |
|---|---|---|
| Username/password auth (pre-prod only) | High — not compliant with DoD CAC/PIV requirement for production | Integrate with GN Keycloak instance via OIDC before go-live; replace login endpoint with JWT validation middleware; assign roles via Keycloak groups tied to AD |
| User management in local database | High — identity should live in AD/Keycloak, not app DB | Remove `users` table and local credential management upon Keycloak integration; role claims read from JWT |
| PostgreSQL single replica | Medium — no HA for DB | Acceptable for pre-prod; production should use a managed PG instance or operator |
| No rate limiting on login endpoint | Low — mitigated by Keycloak in production | Add `express-rate-limit` middleware; resolved automatically upon Keycloak integration |
| Session secret rotation not automated | Low | Document manual rotation procedure in runbook |

---

## 13. Points of Contact

| Role | Name | Organization |
|---|---|---|
| System Owner | TBD | DCO, ARCYBER |
| ISSM | TBD | ARCYBER G6 / Cyber |
| Developer | TBD | DCO Program Office |

---

*This document is UNCLASSIFIED. Do not include real contract data, PII, or operational details in this file.*
