from datetime import date, timedelta

from celery_app import celery_app
from db import get_db_connection


@celery_app.task(
    name="tasks.reminder_tasks.send_daily_trek_reminders"
)
def send_daily_trek_reminders():
    """
    Create one in-app reminder per active booking
    for treks starting tomorrow.
    """

    connection = get_db_connection()

    tomorrow = (
        date.today()
        + timedelta(days=1)
    ).isoformat()


    # =====================================================
    # FIND BOOKINGS FOR TREKS STARTING TOMORROW
    # =====================================================

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


    # =====================================================
    # CREATE NOTIFICATIONS
    # =====================================================

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


        # -------------------------------------------------
        # DUPLICATE REMINDER PROTECTION
        # -------------------------------------------------

        duplicate = connection.execute(
            """
            SELECT id

            FROM notifications

            WHERE user_id = ?

            AND notification_type =
                'Trek Reminder'

            AND title = ?

            AND message = ?

            AND date(created_at) =
                date('now')

            LIMIT 1
            """,
            (
                booking["user_id"],
                title,
                message
            )
        ).fetchone()


        if duplicate:

            continue


        # -------------------------------------------------
        # INSERT NOTIFICATION
        # -------------------------------------------------

        connection.execute(
            """
            INSERT INTO notifications
            (
                user_id,
                title,
                message,
                notification_type
            )

            VALUES (
                ?,
                ?,
                ?,
                'Trek Reminder'
            )
            """,
            (
                booking["user_id"],
                title,
                message
            )
        )


        reminder_count += 1


    connection.commit()

    connection.close()


    return {

        "success":
            True,

        "reminders_created":
            reminder_count,

        "trek_date":
            tomorrow
    }