from datetime import datetime
from pathlib import Path

from celery_app import celery_app
from db import get_db_connection


BASE_DIR = Path(__file__).resolve().parent.parent

REPORTS_DIR = (
    BASE_DIR / "reports"
)


@celery_app.task(
    name="tasks.report_tasks.generate_monthly_admin_report"
)
def generate_monthly_admin_report():

    REPORTS_DIR.mkdir(
        exist_ok=True
    )

    connection = get_db_connection()


    # -----------------------------------------------------
    # CURRENT MONTH
    # -----------------------------------------------------

    now = datetime.now()

    month_key = now.strftime(
        "%Y-%m"
    )

    month_name = now.strftime(
        "%B %Y"
    )


    # -----------------------------------------------------
    # TREKS CONDUCTED
    # -----------------------------------------------------

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


    # -----------------------------------------------------
    # TOTAL PARTICIPANTS
    # -----------------------------------------------------

    total_participants = connection.execute(
        """
        SELECT COUNT(*) AS count

        FROM bookings b

        JOIN treks t
            ON t.id = b.trek_id

        WHERE b.status = 'Completed'

        AND substr(
            COALESCE(t.end_date, t.start_date),
            1,
            7
        ) = ?
        """,
        (month_key,)
    ).fetchone()["count"]


    # -----------------------------------------------------
    # POPULAR TREKS
    # -----------------------------------------------------

    popular_treks = connection.execute(
        """
        SELECT
            t.name,

            COUNT(b.id) AS participant_count

        FROM treks t

        LEFT JOIN bookings b
            ON b.trek_id = t.id

        WHERE substr(
            COALESCE(
                t.end_date,
                t.start_date
            ),
            1,
            7
        ) = ?

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


    # -----------------------------------------------------
    # BOOKING STATISTICS
    # -----------------------------------------------------

    total_bookings = connection.execute(
        """
        SELECT COUNT(*) AS count

        FROM bookings

        WHERE substr(
            booking_date,
            1,
            7
        ) = ?
        """,
        (month_key,)
    ).fetchone()["count"]


    cancelled_bookings = connection.execute(
        """
        SELECT COUNT(*) AS count

        FROM bookings

        WHERE status = 'Cancelled'

        AND substr(
            booking_date,
            1,
            7
        ) = ?
        """,
        (month_key,)
    ).fetchone()["count"]


    connection.close()


    # -----------------------------------------------------
    # POPULAR TREK HTML
    # -----------------------------------------------------

    popular_rows = ""


    if popular_treks:

        for trek in popular_treks:

            popular_rows += f"""
                <tr>
                    <td>{trek['name']}</td>
                    <td>{trek['participant_count']}</td>
                </tr>
            """

    else:

        popular_rows = """
            <tr>
                <td colspan="2">
                    No trekking data available.
                </td>
            </tr>
        """


    # -----------------------------------------------------
    # HTML REPORT
    # -----------------------------------------------------

    html = f"""
    <!DOCTYPE html>

    <html>

    <head>

        <meta charset="UTF-8">

        <title>
            Monthly Trekking Report
        </title>

        <style>

            body {{
                font-family:
                    Arial,
                    sans-serif;

                margin: 40px;

                color: #222;
            }}

            h1 {{
                margin-bottom: 5px;
            }}

            .subtitle {{
                color: #666;
                margin-bottom: 30px;
            }}

            .stats {{
                display: flex;
                gap: 20px;
                flex-wrap: wrap;
            }}

            .card {{
                border: 1px solid #ddd;
                padding: 20px;
                min-width: 180px;
                border-radius: 8px;
            }}

            .card h2 {{
                margin: 0;
            }}

            table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }}

            th,
            td {{
                border: 1px solid #ddd;
                padding: 10px;
                text-align: left;
            }}

            th {{
                background: #f5f5f5;
            }}

        </style>

    </head>


    <body>


        <h1>
            Trekking Management Application
        </h1>


        <div class="subtitle">
            Monthly Admin Report -
            {month_name}
        </div>


        <div class="stats">


            <div class="card">

                <h2>
                    {treks_conducted}
                </h2>

                <p>
                    Treks Conducted
                </p>

            </div>


            <div class="card">

                <h2>
                    {total_participants}
                </h2>

                <p>
                    Participants
                </p>

            </div>


            <div class="card">

                <h2>
                    {total_bookings}
                </h2>

                <p>
                    Total Bookings
                </p>

            </div>


            <div class="card">

                <h2>
                    {cancelled_bookings}
                </h2>

                <p>
                    Cancelled Bookings
                </p>

            </div>


        </div>


        <h2>
            Popular Treks
        </h2>


        <table>

            <thead>

                <tr>

                    <th>
                        Trek
                    </th>

                    <th>
                        Participants
                    </th>

                </tr>

            </thead>


            <tbody>

                {popular_rows}

            </tbody>

        </table>


    </body>

    </html>
    """


    # -----------------------------------------------------
    # SAVE HTML REPORT
    # -----------------------------------------------------

    file_name = (
        f"monthly_report_{month_key}.html"
    )

    report_path = (
        REPORTS_DIR /
        file_name
    )


    report_path.write_text(
        html,
        encoding="utf-8"
    )


    return {
        "success": True,
        "file_name":
            file_name,

        "path":
            str(report_path),

        "month":
            month_name
    }