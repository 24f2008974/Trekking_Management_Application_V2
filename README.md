# Trekking Management Application V2

A web-based trekking management application built for MAD2.

## Technology Stack

- Flask
- Vue.js
- Bootstrap
- SQLite
- Redis
- Celery

## User Roles

### Admin

- Manage treks
- Create/manage staff
- Assign staff
- Manage users
- View bookings
- View reports

### Trek Staff

- View assigned treks
- Manage trek slots
- Update trek status
- View participants
- Complete treks

### Trekker

- Register
- Login
- Browse treks
- Search/filter treks
- Book treks
- View bookings
- View trekking history
- Export history

## Project Structure

```text
Trekking_Management_Application_V2/
│
├── app.py
├── db.py
├── auth.py
├── api.py
├── requirements.txt
│
├── templates/
├── static/
├── tasks/
├── services/
├── data/
├── exports/
└── reports/

## Project Milestone Progress

| Milestone | Status |
|---|---|
| Milestone 0 - GitHub Setup | In Progress |
| Database Models & Schema | In Progress |
| Authentication & RBAC | In Progress |
| Admin Dashboard | Not Started |
| Trek Staff Dashboard | Not Started |
| Trekker Dashboard | Not Started |
| Booking History & Tracking | Not Started |
| Celery Background Jobs | Not Started |
| Redis Caching | Not Started |
| UI/UX & PWA | Not Started |
| Reports & Analytics | Not Started |
| Milestone 6 - Booking History & Trek Status Tracking | Completed |
| Milestone 8 - Redis API Caching | Completed |

## Issues and Resolutions

### Flask not found in virtual environment
**Issue:** `ModuleNotFoundError: No module named 'flask'`

**Resolution:** Added Flask to `requirements.txt` and installed dependencies.

### curl request body issue on Windows PowerShell
**Issue:** Flask received an empty JSON request body while testing with `curl.exe`.

**Resolution:** Used PowerShell `Invoke-RestMethod` with `ConvertTo-Json`.