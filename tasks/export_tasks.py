import csv

from datetime import datetime

from pathlib import Path

from celery_app import celery_app

from db import get_db_connection


BASE_DIR = (
    Path(__file__)
    .resolve()
    .parent
    .parent
)


EXPORTS_DIR = (
    BASE_DIR
    / "exports"
)


# =========================================================
# CSV FORMULA INJECTION PROTECTION
# =========================================================

def _safe_csv_value(
    value
):
    """
    Prevent spreadsheet software from interpreting
    exported text values as formulas.
    """

    if value is None:

        return ""


    text = str(
        value
    )


    if text.startswith(
        (
            "=",
            "+",
            "-",
            "@"
        )
    ):

        return (
            "'"
            + text
        )


    return text


# =========================================================
# TREKKER HISTORY EXPORT
# =========================================================

@celery_app.task(
    bind=True,
    name="tasks.export_tasks.export_trekker_history"
)
def export_trekker_history(
    self,
    user_id,
    export_job_id
):

    EXPORTS_DIR.mkdir(
        parents=True,
        exist_ok=True
    )


    connection = (
        get_db_connection()
    )


    try:

        # =================================================
        # SET JOB PROCESSING
        # =================================================

        connection.execute(
            """
            UPDATE export_jobs

            SET
                status =
                    'Processing',

                celery_task_id = ?,

                error_message =
                    NULL

            WHERE id = ?

            AND user_id = ?
            """,
            (
                self.request.id,
                export_job_id,
                user_id
            )
        )


        connection.commit()


        # =================================================
        # VERIFY USER
        # =================================================

        user = connection.execute(
            """
            SELECT
                id,
                name,
                email

            FROM users

            WHERE id = ?

            AND role =
                'Trekker'
            """,
            (user_id,)
        ).fetchone()


        if user is None:

            raise ValueError(
                "Trekker not found"
            )


        # =================================================
        # FETCH COMPLETE HISTORY
        # =================================================

        history = connection.execute(
            """
            SELECT
                b.id AS booking_id,

                b.booking_date,

                b.status
                    AS booking_status,

                b.payment_status,

                t.id
                    AS trek_id,

                t.name
                    AS trek_name,

                t.location,

                t.difficulty,

                t.duration,

                t.start_date,

                t.end_date,

                t.status
                    AS trek_status

            FROM bookings b

            JOIN treks t

                ON t.id =
                    b.trek_id

            WHERE b.user_id = ?

            ORDER BY
                b.booking_date DESC,
                b.id DESC
            """,
            (user_id,)
        ).fetchall()


        # =================================================
        # FILE NAME
        # =================================================

        timestamp = (
            datetime.now()
            .strftime(
                "%Y%m%d_%H%M%S"
            )
        )


        file_name = (
            f"trek_history_user_"
            f"{user_id}_"
            f"{timestamp}.csv"
        )


        file_path = (
            EXPORTS_DIR
            / file_name
        )


        # =================================================
        # WRITE CSV
        # =================================================

        with file_path.open(
            "w",
            newline="",
            encoding="utf-8-sig"
        ) as csv_file:

            writer = csv.writer(
                csv_file
            )


            writer.writerow([
                "Booking ID",
                "Booking Date",
                "Booking Status",
                "Payment Status",
                "Trek ID",
                "Trek Name",
                "Location",
                "Difficulty",
                "Duration",
                "Start Date",
                "End Date",
                "Trek Status"
            ])


            for row in history:

                writer.writerow([

                    _safe_csv_value(
                        row[
                            "booking_id"
                        ]
                    ),

                    _safe_csv_value(
                        row[
                            "booking_date"
                        ]
                    ),

                    _safe_csv_value(
                        row[
                            "booking_status"
                        ]
                    ),

                    _safe_csv_value(
                        row[
                            "payment_status"
                        ]
                    ),

                    _safe_csv_value(
                        row[
                            "trek_id"
                        ]
                    ),

                    _safe_csv_value(
                        row[
                            "trek_name"
                        ]
                    ),

                    _safe_csv_value(
                        row[
                            "location"
                        ]
                    ),

                    _safe_csv_value(
                        row[
                            "difficulty"
                        ]
                    ),

                    _safe_csv_value(
                        row[
                            "duration"
                        ]
                    ),

                    _safe_csv_value(
                        row[
                            "start_date"
                        ]
                    ),

                    _safe_csv_value(
                        row[
                            "end_date"
                        ]
                    ),

                    _safe_csv_value(
                        row[
                            "trek_status"
                        ]
                    )
                ])


        # =================================================
        # JOB COMPLETED
        # =================================================

        connection.execute(
            """
            UPDATE export_jobs

            SET
                status =
                    'Completed',

                file_name = ?,

                error_message =
                    NULL,

                completed_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?

            AND user_id = ?
            """,
            (
                file_name,
                export_job_id,
                user_id
            )
        )


        # =================================================
        # COMPLETION NOTIFICATION
        # =================================================

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
                'Export'
            )
            """,
            (
                user_id,

                "CSV Export Ready",

                (
                    "Your trekking history "
                    "CSV export has been "
                    "generated successfully."
                )
            )
        )


        connection.commit()

        connection.close()


        return {

            "success":
                True,

            "file_name":
                file_name,

            "export_job_id":
                export_job_id
        }


    # =====================================================
    # HANDLE TASK FAILURE
    # =====================================================

    except Exception as error:

        connection.rollback()


        connection.execute(
            """
            UPDATE export_jobs

            SET
                status =
                    'Failed',

                error_message = ?,

                completed_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?

            AND user_id = ?
            """,
            (
                str(error),
                export_job_id,
                user_id
            )
        )


        connection.commit()

        connection.close()


        raise