from datetime import datetime
from pathlib import Path

from flask import (
    Blueprint,
    jsonify,
    request,
    send_from_directory,
)

from flask_jwt_extended import (
    get_jwt_identity,
    jwt_required,
)

from auth import role_required
from celery_app import celery_app
from db import get_db_connection
from tasks.export_tasks import export_trekker_history
from tasks.report_tasks import generate_monthly_admin_report


job_bp = Blueprint(
    "jobs",
    __name__,
    url_prefix="/api/jobs"
)

BASE_DIR = Path(__file__).resolve().parent
EXPORTS_DIR = BASE_DIR / "exports"
REPORTS_DIR = BASE_DIR / "reports"


# =========================================================
# TREKKER CSV EXPORT
# =========================================================

@job_bp.post("/trekker/history-export")
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

    try:
        celery_result = (
            export_trekker_history.delay(
                user_id,
                export_job_id
            )
        )

    except Exception as error:
        connection = get_db_connection()

        connection.execute(
            """
            UPDATE export_jobs
            SET
                status = 'Failed',
                error_message = ?,
                completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                f"Could not queue export task: {error}",
                export_job_id
            )
        )

        connection.commit()
        connection.close()

        return jsonify({
            "success": False,
            "message": (
                "CSV export could not be queued. "
                "Make sure Redis and the Celery worker are running."
            )
        }), 503

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
        "message": "CSV export started in background",
        "job_id": export_job_id,
        "task_id": celery_result.id
    }), 202


@job_bp.get("/trekker/history-export/<int:job_id>")
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
        (job_id, user_id)
    ).fetchone()

    connection.close()

    if job is None:
        return jsonify({
            "success": False,
            "message": "Export job not found"
        }), 404

    return jsonify({
        "success": True,
        "job": dict(job)
    })


@job_bp.get("/trekker/history-export/<int:job_id>/download")
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
        (job_id, user_id)
    ).fetchone()

    connection.close()

    if job is None:
        return jsonify({
            "success": False,
            "message": "Export job not found"
        }), 404

    if job["status"] != "Completed":
        return jsonify({
            "success": False,
            "message": "Export is not completed yet"
        }), 409

    if not job["file_name"]:
        return jsonify({
            "success": False,
            "message": "Export file not found"
        }), 404

    file_path = (
        EXPORTS_DIR
        / job["file_name"]
    )

    if not file_path.is_file():
        return jsonify({
            "success": False,
            "message": "Export file is missing on the server"
        }), 404

    return send_from_directory(
        EXPORTS_DIR,
        job["file_name"],
        as_attachment=True
    )


# =========================================================
# NOTIFICATIONS
# =========================================================

@job_bp.get("/notifications")
@jwt_required()
@role_required("Admin", "Staff", "Trekker")
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
        LIMIT 100
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


@job_bp.patch("/notifications/<int:notification_id>/read")
@jwt_required()
@role_required("Admin", "Staff", "Trekker")
def mark_notification_read(notification_id):
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
        (notification_id, user_id)
    )

    connection.commit()
    connection.close()

    if result.rowcount == 0:
        return jsonify({
            "success": False,
            "message": "Notification not found"
        }), 404

    return jsonify({
        "success": True,
        "message": "Notification marked as read"
    })


# =========================================================
# ADMIN MONTHLY REPORTS
# =========================================================

def _validate_report_file_name(file_name):
    safe_name = Path(file_name).name

    if (
        safe_name != file_name
        or not safe_name.startswith("monthly_report_")
        or not safe_name.endswith(".html")
    ):
        return None

    return safe_name


@job_bp.get("/admin/reports")
@jwt_required()
@role_required("Admin")
def admin_reports():
    """List generated monthly HTML reports for the Admin UI."""

    REPORTS_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    reports = []

    for path in sorted(
        REPORTS_DIR.glob("monthly_report_*.html"),
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    ):
        month_key = path.stem.replace(
            "monthly_report_",
            "",
            1
        )

        try:
            display_month = datetime.strptime(
                month_key,
                "%Y-%m"
            ).strftime("%B %Y")
        except ValueError:
            display_month = month_key

        reports.append({
            "file_name": path.name,
            "month_key": month_key,
            "display_month": display_month,
            "size_bytes": path.stat().st_size,
            "modified_at": int(path.stat().st_mtime),
        })

    return jsonify({
        "success": True,
        "reports": reports
    })


@job_bp.post("/admin/reports/generate")
@jwt_required()
@role_required("Admin")
def generate_admin_report():
    """
    Queue a monthly report manually.

    Body:
        {"month": "2026-10"}

    This is mainly useful for Admin testing or regenerating
    a report. Celery Beat still generates the previous month
    automatically on the scheduled date.
    """

    data = request.get_json(
        silent=True
    ) or {}

    month = str(
        data.get("month", "")
    ).strip()

    if not month:
        return jsonify({
            "success": False,
            "message": "Month is required in YYYY-MM format"
        }), 400

    try:
        requested = datetime.strptime(
            month,
            "%Y-%m"
        )
    except ValueError:
        return jsonify({
            "success": False,
            "message": "Month must use YYYY-MM format"
        }), 400

    current_month = datetime.now().replace(
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    if requested > current_month:
        return jsonify({
            "success": False,
            "message": "A future month report cannot be generated"
        }), 400

    try:
        result = generate_monthly_admin_report.delay(
            month
        )

    except Exception as error:
        return jsonify({
            "success": False,
            "message": (
                "Report could not be queued. "
                "Make sure Redis and the Celery worker are running. "
                f"Details: {error}"
            )
        }), 503

    return jsonify({
        "success": True,
        "message": f"{month} report generation started",
        "task_id": result.id,
        "month": month
    }), 202


@job_bp.get("/admin/reports/task/<task_id>")
@jwt_required()
@role_required("Admin")
def admin_report_task_status(task_id):
    result = celery_app.AsyncResult(
        task_id
    )

    response = {
        "success": True,
        "task_id": task_id,
        "state": result.state,
    }

    if result.successful():
        response["result"] = result.result

    elif result.failed():
        response["error"] = str(
            result.result
        )

    return jsonify(response)


@job_bp.get("/admin/reports/<path:file_name>/view")
@jwt_required()
@role_required("Admin")
def view_admin_report(file_name):
    """Return a generated report inline so the Admin can view it."""

    safe_name = _validate_report_file_name(
        file_name
    )

    if safe_name is None:
        return jsonify({
            "success": False,
            "message": "Invalid report file"
        }), 400

    report_path = (
        REPORTS_DIR
        / safe_name
    )

    if not report_path.is_file():
        return jsonify({
            "success": False,
            "message": "Report not found"
        }), 404

    return send_from_directory(
        REPORTS_DIR,
        safe_name,
        as_attachment=False,
        mimetype="text/html"
    )


@job_bp.get("/admin/reports/<path:file_name>/download")
@jwt_required()
@role_required("Admin")
def download_admin_report(file_name):
    """Download a generated monthly report."""

    safe_name = _validate_report_file_name(
        file_name
    )

    if safe_name is None:
        return jsonify({
            "success": False,
            "message": "Invalid report file"
        }), 400

    report_path = (
        REPORTS_DIR
        / safe_name
    )

    if not report_path.is_file():
        return jsonify({
            "success": False,
            "message": "Report not found"
        }), 404

    return send_from_directory(
        REPORTS_DIR,
        safe_name,
        as_attachment=True,
        mimetype="text/html"
    )
