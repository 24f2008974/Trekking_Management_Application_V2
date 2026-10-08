from datetime import datetime, timedelta
from html import escape
from pathlib import Path

from celery_app import celery_app
from db import get_db_connection


BASE_DIR = Path(__file__).resolve().parent.parent
REPORTS_DIR = BASE_DIR / "reports"


def _resolve_report_month(report_month=None):
    """
    Return (month_key, month_name).

    If report_month is omitted, use the previous completed
    calendar month. For manual testing/admin generation,
    report_month may be supplied as YYYY-MM.
    """

    now = datetime.now()

    if report_month:
        report_month = str(report_month).strip()

        try:
            requested = datetime.strptime(
                report_month,
                "%Y-%m"
            )
        except ValueError as error:
            raise ValueError(
                "Report month must use YYYY-MM format"
            ) from error

        current_month = now.replace(
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

        if requested > current_month:
            raise ValueError(
                "A future month report cannot be generated"
            )

        return (
            requested.strftime("%Y-%m"),
            requested.strftime("%B %Y")
        )

    first_day_current_month = now.replace(
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    previous_month_date = (
        first_day_current_month
        - timedelta(days=1)
    )

    return (
        previous_month_date.strftime("%Y-%m"),
        previous_month_date.strftime("%B %Y")
    )


@celery_app.task(
    name="tasks.report_tasks.generate_monthly_admin_report"
)
def generate_monthly_admin_report(report_month=None):
    """
    Generate a monthly HTML Admin report.

    Scheduled Celery Beat call:
        no argument -> previous completed month

    Manual/Admin call:
        "2026-10" -> October 2026
    """

    REPORTS_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    month_key, month_name = _resolve_report_month(
        report_month
    )

    connection = get_db_connection()

    try:
        # -------------------------------------------------
        # TREKS CONDUCTED DURING REPORT MONTH
        # -------------------------------------------------
        # The schema does not have completed_at, so the trek's
        # end_date (or start_date when end_date is missing) is
        # used as the reporting month for conducted treks.
        treks_conducted = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM treks
            WHERE status = 'Completed'
              AND substr(
                    COALESCE(end_date, start_date),
                    1,
                    7
                  ) = ?
            """,
            (month_key,)
        ).fetchone()["count"]

        # -------------------------------------------------
        # PARTICIPANTS OF TREKS CONDUCTED DURING MONTH
        # -------------------------------------------------
        total_participants = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM bookings b
            JOIN treks t
                ON t.id = b.trek_id
            WHERE b.status = 'Completed'
              AND t.status = 'Completed'
              AND substr(
                    COALESCE(t.end_date, t.start_date),
                    1,
                    7
                  ) = ?
            """,
            (month_key,)
        ).fetchone()["count"]

        # -------------------------------------------------
        # BOOKINGS CREATED DURING MONTH
        # -------------------------------------------------
        total_bookings = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM bookings
            WHERE substr(booking_date, 1, 7) = ?
            """,
            (month_key,)
        ).fetchone()["count"]

        active_bookings = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM bookings
            WHERE status = 'Booked'
              AND substr(booking_date, 1, 7) = ?
            """,
            (month_key,)
        ).fetchone()["count"]

        cancelled_bookings = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM bookings
            WHERE status = 'Cancelled'
              AND substr(booking_date, 1, 7) = ?
            """,
            (month_key,)
        ).fetchone()["count"]

        completed_bookings = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM bookings
            WHERE status = 'Completed'
              AND substr(booking_date, 1, 7) = ?
            """,
            (month_key,)
        ).fetchone()["count"]

        # -------------------------------------------------
        # POPULAR TREKS BASED ON NON-CANCELLED BOOKINGS
        # CREATED DURING THE REPORT MONTH
        # -------------------------------------------------
        popular_treks = connection.execute(
            """
            SELECT
                t.name,
                COUNT(b.id) AS participant_count
            FROM bookings b
            JOIN treks t
                ON t.id = b.trek_id
            WHERE substr(b.booking_date, 1, 7) = ?
              AND b.status IN ('Booked', 'Completed')
            GROUP BY
                t.id,
                t.name
            ORDER BY
                participant_count DESC,
                t.name ASC
            LIMIT 5
            """,
            (month_key,)
        ).fetchall()

        if popular_treks:
            popular_rows = "".join(
                "<tr><td>{}</td><td>{}</td></tr>".format(
                    escape(trek["name"]),
                    trek["participant_count"]
                )
                for trek in popular_treks
            )
        else:
            popular_rows = (
                '<tr>'
                '<td colspan="2">'
                'No non-cancelled bookings were created in this month.'
                '</td>'
                '</tr>'
            )

        generated_at = datetime.now().strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monthly Trekking Report - {escape(month_name)}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            margin: 40px;
            color: #222;
            background: #f7f8fa;
        }}
        .page {{
            max-width: 1100px;
            margin: auto;
            background: white;
            padding: 32px;
            border-radius: 12px;
            box-shadow: 0 2px 14px rgba(0,0,0,0.08);
        }}
        h1 {{ margin-bottom: 5px; }}
        .subtitle {{ color: #666; margin-bottom: 8px; }}
        .generated {{ color: #888; font-size: 13px; margin-bottom: 28px; }}
        .stats {{ display: flex; gap: 16px; flex-wrap: wrap; }}
        .card {{
            border: 1px solid #ddd;
            padding: 18px;
            min-width: 150px;
            border-radius: 8px;
            flex: 1;
        }}
        .card h2 {{ margin: 0 0 4px 0; }}
        .card p {{ margin: 0; color: #666; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        th, td {{ border: 1px solid #ddd; padding: 10px; text-align: left; }}
        th {{ background: #f0f2f5; }}
        .note {{
            margin-top: 28px;
            padding: 14px;
            background: #f8f9fa;
            border-left: 4px solid #6c757d;
            color: #555;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="page">
        <h1>Trekking Management Application</h1>
        <div class="subtitle">Monthly Admin Report - {escape(month_name)}</div>
        <div class="generated">Generated at: {escape(generated_at)}</div>

        <div class="stats">
            <div class="card"><h2>{treks_conducted}</h2><p>Treks Conducted</p></div>
            <div class="card"><h2>{total_participants}</h2><p>Completed Participants</p></div>
            <div class="card"><h2>{total_bookings}</h2><p>Bookings Created</p></div>
            <div class="card"><h2>{active_bookings}</h2><p>Currently Booked</p></div>
            <div class="card"><h2>{cancelled_bookings}</h2><p>Cancelled</p></div>
            <div class="card"><h2>{completed_bookings}</h2><p>Completed Bookings</p></div>
        </div>

        <h2>Popular Treks</h2>
        <p>Based on non-cancelled bookings created during {escape(month_name)}.</p>

        <table>
            <thead>
                <tr>
                    <th>Trek</th>
                    <th>Bookings / Participants</th>
                </tr>
            </thead>
            <tbody>{popular_rows}</tbody>
        </table>

        <div class="note">
            Treks Conducted and Completed Participants are based on completed trek dates.
            Booking counters are based on booking creation dates. The current schema does not
            store a separate cancellation timestamp.
        </div>
    </div>
</body>
</html>
"""

        file_name = f"monthly_report_{month_key}.html"
        report_path = REPORTS_DIR / file_name

        report_path.write_text(
            html,
            encoding="utf-8"
        )

        # -------------------------------------------------
        # NOTIFY ACTIVE ADMINS ONCE PER REPORT FILE
        # -------------------------------------------------
        admins = connection.execute(
            """
            SELECT id
            FROM users
            WHERE role = 'Admin'
              AND is_active = 1
              AND is_blacklisted = 0
            """
        ).fetchall()

        for admin in admins:
            already_notified = connection.execute(
                """
                SELECT id
                FROM notifications
                WHERE user_id = ?
                  AND notification_type = 'Monthly Report'
                  AND message LIKE ?
                LIMIT 1
                """,
                (
                    admin["id"],
                    f"%{file_name}%"
                )
            ).fetchone()

            if already_notified:
                continue

            connection.execute(
                """
                INSERT INTO notifications
                (
                    user_id,
                    title,
                    message,
                    notification_type
                )
                VALUES (?, ?, ?, 'Monthly Report')
                """,
                (
                    admin["id"],
                    f"Monthly Report Ready - {month_name}",
                    f"The monthly admin report is ready: {file_name}"
                )
            )

        connection.commit()

        return {
            "success": True,
            "file_name": file_name,
            "path": str(report_path),
            "month": month_name,
            "month_key": month_key,
            "stats": {
                "treks_conducted": treks_conducted,
                "completed_participants": total_participants,
                "total_bookings": total_bookings,
                "active_bookings": active_bookings,
                "cancelled_bookings": cancelled_bookings,
                "completed_bookings": completed_bookings,
            },
        }

    finally:
        connection.close()
