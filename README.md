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