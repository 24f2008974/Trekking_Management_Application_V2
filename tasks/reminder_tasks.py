from datetime import date, timedelta

from celery_app import celery_app
from db import get_db_connection


@celery_app.task(
    name="tasks.reminder_tasks.send_daily_trek_reminders"
)
def send_daily_trek_reminders():

    connection = get_db_connection()

    today = date.today()

    tomorrow = (
        today + timedelta(days=1)
    ).isoformat()


    # -----------------------------------------------------
    # Find Trekker bookings for treks starting tomorrow
    # -----------------------------------------------------

    bookings = connection.execute(
        """
        SELECT
            b.id AS booking_id,

            u.id AS user_id,
            u.name AS user_name,

            t.id AS trek_id,
            t.name AS trek_name,
            t.location,
            t.start_date

        FROM bookings b

        JOIN users u
            ON u.id = b.user_id

        JOIN treks t
            ON t.id = b.trek_id

        WHERE b.status = 'Booked'

        AND t.status IN (
            'Open',
            'Closed'
        )

        AND t.start_date = ?

        AND u.is_active = 1

        AND u.is_blacklisted = 0
        """,
        (tomorrow,)
    ).fetchall()


    reminder_count = 0


    for booking in bookings:

        title = (
            "Upcoming Trek Reminder"
        )

        message = (
            f"Hello {booking['user_name']}, "
            f"your trek '{booking['trek_name']}' "
            f"at {booking['location']} "
            f"is scheduled for tomorrow "
            f"({booking['start_date']})."
        )


        connection.execute(
            """
            INSERT INTO notifications
            (
                user_id,
                title,
                message,
                notification_type
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                booking["user_id"],
                title,
                message,
                "Trek Reminder"
            )
        )


        reminder_count += 1


    connection.commit()
    connection.close()


    return {
        "success": True,
        "reminders_created":
            reminder_count
    }