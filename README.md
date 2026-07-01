# Hierarchical Multi-Tenant Analytics Dashboard

A full-stack analytics platform with real-time collaboration, team data isolation, KPI calculations, and anomaly detection.

## Architecture

```
Organization (Acme Corp)
├── Team: Finance
│   ├── Projects: Q1 Budget, Revenue Tracking
│   ├── Members: Admin, Editor, Viewer
│   └── Dashboards with widgets (revenue, errors)
├── Team: Marketing
│   ├── Projects: Campaign Alpha, Social Media
│   ├── Members: Admin, Editor
│   └── Dashboards with widgets (page views, clicks)
```

**Tech Stack:**
- **Backend:** Node.js, Express, TypeScript, PostgreSQL with Row Level Security
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, react-grid-layout
- **Real-time:** Socket.io (collaborative editing + live metrics)
- **Charts:** Recharts

## Features Implemented

### Tier 1 (Core)
- [x] Org → Team → Project hierarchy
- [x] User roles: Admin, Editor, Viewer with permission enforcement
- [x] Create dashboards with drag-and-drop widgets
- [x] Metrics: page views, clicks, errors, revenue, users
- [x] Data persistence (PostgreSQL)
- [x] Database isolation via PostgreSQL RLS policies

### Tier 2 (Collaboration)
- [x] Multiple users edit same dashboard simultaneously
- [x] Real-time widget sync (position, add, delete)
- [x] Live collaborator presence indicators
- [x] KPI calculations (ARPU = Revenue / Users)
- [x] Anomaly detection (alert when metric > 2σ from mean)
- [x] Real-time metrics updates (every 5 seconds)

### Tier 3 (Advanced)
- [x] Three-level hierarchy (Org → Team → Project)
- [x] Webhook subscriptions for anomaly events
- [x] Audit logs (who accessed what, when)
- [x] Custom metric definitions

## Quick Start

### Prerequisites
- Node.js 18+
- Docker (for PostgreSQL)

### Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL
npm run db:up

# Wait for DB to be ready, then migrate and seed
npm run db:migrate
npm run db:seed

# Start dev servers (backend :3001, frontend :5173)
npm run dev
```

Open http://localhost:5173

### Demo Accounts

| Email | Password | Role | Access |
|-------|----------|------|--------|
| admin@acme.com | password123 | Admin | Finance + Marketing (full) |
| editor@acme.com | password123 | Editor | Finance (edit), Marketing (view) |
| viewer@acme.com | password123 | Viewer | Finance (read-only) |
| finance@acme.com | password123 | Editor | Finance only |
| marketing@acme.com | password123 | Editor | Marketing only |

## Deployment

This repo is ready for deployment on Render:

1. Push your code to GitHub.
2. Create a Render account and connect your GitHub repo.
3. Render will detect `render.yaml` and create:
   - a Docker backend service using `backend/Dockerfile`
   - a static frontend site using `frontend/dist`
   - a managed PostgreSQL database
4. In Render, make sure the frontend service uses:
   - `VITE_API_URL = https://hierarchical-analytics-backend.onrender.com/api`
5. In Render, make sure the backend service uses:
   - `JWT_SECRET = super_secret_jwt_key`
   - `CORS_ORIGIN = https://hierarchical-analytics-frontend.onrender.com`
   - `DATABASE_URL` from the managed database connection string

Once deployed, the public URLs will be:

- Frontend: `https://hierarchical-analytics-frontend.onrender.com`
- Backend API: `https://hierarchical-analytics-backend.onrender.com/api`

## Testing Data Isolation

1. Login as `finance@acme.com` — see only Finance dashboards and metrics
2. Login as `marketing@acme.com` — see only Marketing dashboards
3. Login as `viewer@acme.com` — can view but cannot edit dashboards
4. Open same dashboard in two browsers with different editors — see real-time sync

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Authenticate |
| GET | /api/org/teams | List user's teams |
| GET | /api/dashboards/team/:teamId | List team dashboards |
| GET | /api/dashboards/:id | Get dashboard with widgets |
| POST | /api/dashboards/team/:teamId | Create dashboard |
| GET | /api/metrics/team/:teamId/latest | Latest metric values |
| GET | /api/metrics/team/:teamId/kpis | KPI calculations |
| GET | /api/metrics/team/:teamId/anomalies | Anomaly alerts |
| GET | /api/audit/team/:teamId | Audit logs |
| GET | /api/webhooks/team/:teamId | Webhook subscriptions |

## Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| join-dashboard | Client → Server | Join collaboration room |
| widget-update | Bidirectional | Sync widget changes |
| widget-position | Bidirectional | Sync drag-and-drop |
| metric-update | Server → Client | Live metric values |
| anomaly-detected | Server → Client | Anomaly alerts |
| collaborators | Server → Client | Active users list |

## Row Level Security

PostgreSQL RLS policies enforce team data isolation at the database level:

```sql
CREATE POLICY metrics_isolation ON metric_data_points
  FOR ALL USING (team_id = ANY(current_user_team_ids()));
```

The application sets `app.current_team_ids` per request, ensuring Finance teams cannot query Marketing data even with direct SQL access.

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── db/          # Schema, migrations, seed
│   │   ├── middleware/   # Auth, permissions
│   │   ├── routes/       # REST API
│   │   ├── services/     # Metrics, webhooks, audit
│   │   └── sockets/      # Real-time collaboration
├── frontend/
│   └── src/
│       ├── components/   # UI components
│       ├── pages/        # Login, dashboard list, editor
│       ├── context/      # Auth state
│       └── api.ts        # API client
└── docker-compose.yml    # PostgreSQL
```
