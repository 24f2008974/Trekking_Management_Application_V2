from celery import Celery


celery_app = Celery(
    "trekking_management",
    broker="redis://127.0.0.1:6379/0",
    backend="redis://127.0.0.1:6379/1"
)


celery_app.conf.update(

    # JSON serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # India timezone
    timezone="Asia/Kolkata",
    enable_utc=True,

    # Result expiry
    result_expires=3600,

    # Import task modules
    imports=(
        "tasks.reminder_tasks",
        "tasks.report_tasks",
        "tasks.export_tasks",
    )
)


# =========================================================
# CELERY BEAT SCHEDULE
# =========================================================

celery_app.conf.beat_schedule = {

    # -----------------------------------------------------
    # DAILY UPCOMING TREK REMINDER
    # Runs every day at 8 AM
    # -----------------------------------------------------

    "daily-upcoming-trek-reminder": {

        "task":
            "tasks.reminder_tasks.send_daily_trek_reminders",

        "schedule":
            60.0 * 60.0 * 24.0
    },


    # -----------------------------------------------------
    # MONTHLY ADMIN REPORT
    # Approx every 30 days.
    # Later we can replace this with exact crontab.
    # -----------------------------------------------------

    "monthly-admin-report": {

        "task":
            "tasks.report_tasks.generate_monthly_admin_report",

        "schedule":
            60.0 * 60.0 * 24.0 * 30.0
    }
}