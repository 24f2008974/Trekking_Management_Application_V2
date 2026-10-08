import os

from celery import Celery

from celery.schedules import (
    crontab
)


BROKER_URL = os.getenv(
    "CELERY_BROKER_URL",
    "redis://127.0.0.1:6379/0"
)


RESULT_BACKEND = os.getenv(
    "CELERY_RESULT_BACKEND",
    "redis://127.0.0.1:6379/1"
)


celery_app = Celery(
    "trekking_management",
    broker=BROKER_URL,
    backend=RESULT_BACKEND
)


celery_app.conf.update(

    task_serializer="json",

    result_serializer="json",

    accept_content=[
        "json"
    ],

    timezone=
        "Asia/Kolkata",

    enable_utc=True,

    result_expires=3600,

    task_track_started=True,

    imports=(
        "tasks.reminder_tasks",
        "tasks.report_tasks",
        "tasks.export_tasks",
    ),
)


celery_app.conf.beat_schedule = {

    "daily-upcoming-trek-reminder": {

        "task":
            "tasks.reminder_tasks.send_daily_trek_reminders",

        "schedule":
            crontab(
                hour=8,
                minute=0
            ),
    },


    "monthly-admin-report": {

        "task":
            "tasks.report_tasks.generate_monthly_admin_report",

        "schedule":
            crontab(
                day_of_month=1,
                hour=9,
                minute=0
            ),
    },
}