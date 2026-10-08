# Trekking Management Application V2

A role-based trekking management web application developed for IIT Madras MAD-II using Flask, Vue 3, SQLite, Redis and Celery.

## Technology Stack

- Flask REST API
- Flask-JWT-Extended for JWT authentication
- Vue 3 via CDN
- Bootstrap 5 via CDN
- SQLite with programmatic schema creation
- Redis for caching and Celery broker/backend
- Celery Worker and Celery Beat for background/scheduled jobs

## User Roles

### Admin

- Pre-created Admin account
- Dashboard statistics
- Create, edit and delete treks
- Approve/open/close/manage trek status
- Create Trek Staff accounts
- Assign and remove staff assignments
- Activate/deactivate and blacklist users/staff
- View complete booking history
- Search treks, trekkers and staff by name/email/ID
- View and download generated monthly reports

### Trek Staff

- Login using an account created by Admin
- View only assigned treks
- View assigned-trek participant counts
- Update trek capacity before the trek starts
- Manage the controlled trek lifecycle
- View participants only for assigned treks
- Mark a trek completed, which completes active bookings
- View staff profile

### Trekker

- Self-register and login
- View/update profile
- Browse only Open treks
- Search/filter by trek text, difficulty, location and duration
- View trek details
- Book available treks
- Duplicate/full/closed booking prevention
- Cancel eligible active bookings
- View active bookings and complete booking history
- Request asynchronous CSV history export
- Download completed CSV exports
- Receive in-app trek reminders and export notifications

## Trek Status Lifecycle

Admin can create/manage treks with these statuses:

`Pending -> Approved -> Open -> Closed/Ongoing -> Completed`

Staff operations are deliberately restricted to valid operational transitions:

- `Approved -> Open` or `Approved -> Closed`
- `Open -> Closed` or `Open -> Ongoing`
- `Closed -> Open`
- `Ongoing -> Completed`
- `Completed` is terminal

## Background Jobs

### Daily reminder

Celery Beat runs the reminder task every day at **08:00 Asia/Kolkata**.

It creates an in-app notification for active bookings whose trek starts the next day.

Duplicate reminders for the same day are prevented.

### Monthly Admin report

Celery Beat runs on the **1st day of every month at 09:00 Asia/Kolkata** and generates the report for the previous calendar month.

The HTML report contains:

- completed treks
- participant count
- total bookings
- cancelled bookings
- popular treks

Generated reports are available through the Admin **Reports** page.

### Asynchronous CSV export

A Trekker can request a CSV export of complete booking history.

The request creates an export job, Celery processes it in the background, and an in-app notification is created when the file is ready.

## Redis Caching

Redis databases are separated by responsibility:

- DB `0`: Celery broker
- DB `1`: Celery result backend
- DB `2`: API cache

Frequently accessed Trekker trek-list and trek-detail responses are cached for 120 seconds.

Successful trek/booking write operations invalidate trek cache entries so stale slot/status data is not served.

If Redis cache is temporarily unavailable, normal Flask/SQLite endpoints continue to work; caching behaves as a cache miss.

## Project Structure

```text
Trekking_Management_Application_V2/
├── app.py
├── auth.py
├── api.py
├── admin_api.py
├── staff_api.py
├── trekker_api.py
├── job_api.py
├── db.py
├── cache.py
├── celery_app.py
├── requirements.txt
├── README.md
├── data/
│   └── .gitkeep
├── exports/
│   └── .gitkeep
├── reports/
│   └── .gitkeep
├── tasks/
│   ├── __init__.py
│   ├── reminder_tasks.py
│   ├── report_tasks.py
│   └── export_tasks.py
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

## Installation

### 1. Create and activate a virtual environment

Windows PowerShell:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```powershell
python -m pip install -r requirements.txt
```

### 3. Start Redis

When Redis is installed inside WSL Ubuntu:

```bash
sudo service redis-server start
redis-cli ping
```

Expected output:

```text
PONG
```

### 4. Start Flask

Windows PowerShell:

```powershell
python app.py
```

Application:

```text
http://127.0.0.1:5000
```

The SQLite database is created automatically on first start.

### 5. Start Celery Worker

In another activated PowerShell terminal:

```powershell
celery -A celery_app.celery_app worker --loglevel=info --pool=solo
```

`--pool=solo` is used for the Windows development environment.

### 6. Start Celery Beat

In another activated PowerShell terminal:

```powershell
celery -A celery_app.celery_app beat --loglevel=info
```

## Default Admin

```text
Email: admin@trekking.com
Password: admin123
```

These defaults are intended for the local academic project.

They can be overridden with `TMA_ADMIN_EMAIL` and `TMA_ADMIN_PASSWORD` environment variables before the database is created.

## Optional Environment Variables

The application works with local defaults, but supports:

```text
SECRET_KEY
JWT_SECRET_KEY
TMA_ADMIN_EMAIL
TMA_ADMIN_PASSWORD
TMA_DATABASE_PATH
REDIS_CACHE_URL
CACHE_TTL_SECONDS
CELERY_BROKER_URL
CELERY_RESULT_BACKEND
FLASK_DEBUG
```

## Manual Background-Job Tests

Daily reminder:

```powershell
python -c "from tasks.reminder_tasks import send_daily_trek_reminders; print(send_daily_trek_reminders.delay().get(timeout=20))"
```

Monthly report:

```powershell
python -c "from tasks.report_tasks import generate_monthly_admin_report; print(generate_monthly_admin_report.delay().get(timeout=20))"
```

## Core Milestone Progress

| Milestone | Status |
|---|---|
| Milestone 0 - GitHub Setup | Completed |
| Milestone 1 - Database Models and Schema | Completed |
| Milestone 2 - JWT Authentication and RBAC | Completed |
| Milestone 3 - Admin Dashboard and Management | Completed |
| Milestone 4 - Trek Staff Dashboard and Operations | Completed |
| Milestone 5 - Trekker Dashboard and Booking | Completed |
| Milestone 6 - Booking History and Trek Status Tracking | Completed |
| Milestone 7 - Celery Background Jobs | Completed |
| Milestone 8 - Redis API Caching | Completed |

Optional enhancements such as PWA support or additional Chart.js analytics can be added after the core project; they are not required for the core milestone implementation described above.

## Important Integrity Rules Implemented

- passwords are hashed using Werkzeug
- public registration always creates a Trekker
- Admin is created programmatically
- inactive/blacklisted accounts are rejected immediately even if an older JWT still exists
- Staff can operate only assigned treks
- duplicate active bookings are prevented at both API and database-index level
- booking slot changes use SQLite write transactions to reduce race-condition risk
- full or non-Open treks cannot be booked
- cancelled bookings restore one slot
- completed treks complete active bookings
- completed treks cannot be reopened by Staff
- generated CSV downloads are restricted to the owning Trekker
- monthly report downloads are restricted to Admin

## Issues and Resolutions

### Flask missing in virtual environment

**Issue:** `ModuleNotFoundError: No module named 'flask'`

**Resolution:** Added required packages to `requirements.txt` and installed them inside the virtual environment.

### PowerShell curl JSON body issue

**Issue:** Flask received an empty/malformed JSON body while testing with `curl.exe`.

**Resolution:** Used PowerShell `Invoke-RestMethod` with `ConvertTo-Json` for API testing.

### Celery export tables missing on a fresh database

**Issue:** The background export/notification code referenced `export_jobs` and `notifications`, but the schema did not originally create those tables.

**Resolution:** Both tables and supporting indexes are now created programmatically by `init_db()`.

### Redis unavailable causing slow requests

**Issue:** Redis fallback existed but connection attempts could wait too long when Redis was unavailable.

**Resolution:** Added short Redis socket/connect timeouts so cache failure quickly falls back to SQLite.

### Invalid Staff status transitions

**Issue:** Staff could previously reopen a completed trek or jump directly between incompatible statuses.

**Resolution:** Added an explicit status-transition map and made `Completed` terminal.

### Deactivated user with an existing JWT

**Issue:** A previously issued JWT could continue to access role-protected APIs after Admin deactivation/blacklisting.

**Resolution:** Role authorization now re-checks the user account in SQLite on every protected role request.