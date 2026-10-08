from pathlib import Path

from flask import (
    Blueprint,
    jsonify,
    send_from_directory
)

from flask_jwt_extended import (
    get_jwt_identity,
    jwt_required
)

from auth import role_required
from db import get_db_connection

from tasks.export_tasks import (
    export_trekker_history
)


job_bp = Blueprint(
    "jobs",
    __name__,
    url_prefix="/api/jobs"
)


BASE_DIR = Path(
    __file__
).resolve().parent


EXPORTS_DIR = (
    BASE_DIR / "exports"
)


REPORTS_DIR = (
    BASE_DIR / "reports"
)


# =========================================================
# START TREKKER CSV EXPORT
# =========================================================

@job_bp.post(
    "/trekker/history-export"
)
@jwt_required()
@role_required("Trekker")
def start_history_export():

    user_id = int(
        get_jwt_identity()
    )

    connection = get_db_connection()


    cursor = connection.execute(
        """
        INSERT INTO export_jobs
        (
            user_id,
            status
        )

        VALUES (?, 'Pending')
        """,
        (user_id,)
    )


    connection.commit()


    export_job_id = (
        cursor.lastrowid
    )


    connection.close()


    celery_result = (
        export_trekker_history.delay(
            user_id,
            export_job_id
        )
    )


    connection = get_db_connection()


    connection.execute(
        """
        UPDATE export_jobs

        SET celery_task_id = ?

        WHERE id = ?
        """,
        (
            celery_result.id,
            export_job_id
        )
    )


    connection.commit()
    connection.close()


    return jsonify({
        "success": True,

        "message":
            "CSV export started in background",

        "job_id":
            export_job_id,

        "task_id":
            celery_result.id
    }), 202


# =========================================================
# EXPORT JOB STATUS
# =========================================================

@job_bp.get(
    "/trekker/history-export/<int:job_id>"
)
@jwt_required()
@role_required("Trekker")
def export_status(job_id):

    user_id = int(
        get_jwt_identity()
    )

    connection = get_db_connection()


    job = connection.execute(
        """
        SELECT *
        FROM export_jobs

        WHERE id = ?
        AND user_id = ?
        """,
        (
            job_id,
            user_id
        )
    ).fetchone()


    connection.close()


    if job is None:

        return jsonify({
            "success": False,
            "message":
                "Export job not found"
        }), 404


    data = dict(job)


    return jsonify({
        "success": True,
        "job": data
    })


# =========================================================
# DOWNLOAD COMPLETED CSV
# =========================================================

@job_bp.get(
    "/trekker/history-export/<int:job_id>/download"
)
@jwt_required()
@role_required("Trekker")
def download_history_export(job_id):

    user_id = int(
        get_jwt_identity()
    )

    connection = get_db_connection()


    job = connection.execute(
        """
        SELECT *
        FROM export_jobs

        WHERE id = ?
        AND user_id = ?
        """,
        (
            job_id,
            user_id
        )
    ).fetchone()


    connection.close()


    if job is None:

        return jsonify({
            "success": False,
            "message":
                "Export job not found"
        }), 404


    if (
        job["status"]
        != "Completed"
    ):

        return jsonify({
            "success": False,
            "message":
                "Export is not completed yet"
        }), 409


    if not job["file_name"]:

        return jsonify({
            "success": False,
            "message":
                "Export file not found"
        }), 404


    return send_from_directory(
        EXPORTS_DIR,
        job["file_name"],
        as_attachment=True
    )


# =========================================================
# USER NOTIFICATIONS
# =========================================================

@job_bp.get("/notifications")
@jwt_required()
def get_notifications():

    user_id = int(
        get_jwt_identity()
    )

    connection = get_db_connection()


    notifications = connection.execute(
        """
        SELECT
            id,
            title,
            message,
            notification_type,
            is_read,
            created_at

        FROM notifications

        WHERE user_id = ?

        ORDER BY id DESC
        """,
        (user_id,)
    ).fetchall()


    connection.close()


    return jsonify({
        "success": True,

        "notifications": [
            dict(row)
            for row in notifications
        ]
    })


# =========================================================
# MARK NOTIFICATION READ
# =========================================================

@job_bp.patch(
    "/notifications/<int:notification_id>/read"
)
@jwt_required()
def mark_notification_read(
    notification_id
):

    user_id = int(
        get_jwt_identity()
    )

    connection = get_db_connection()


    result = connection.execute(
        """
        UPDATE notifications

        SET is_read = 1

        WHERE id = ?
        AND user_id = ?
        """,
        (
            notification_id,
            user_id
        )
    )


    connection.commit()
    connection.close()


    if result.rowcount == 0:

        return jsonify({
            "success": False,
            "message":
                "Notification not found"
        }), 404


    return jsonify({
        "success": True,
        "message":
            "Notification marked as read"
    })