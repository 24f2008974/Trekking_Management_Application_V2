from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from auth import role_required
from db import get_db_connection


staff_bp = Blueprint(
    "staff",
    __name__,
    url_prefix="/api/staff"
)


STAFF_STATUS_TRANSITIONS = {
    "Pending": set(),
    "Approved": {"Open", "Closed"},
    "Open": {"Closed", "Ongoing"},
    "Closed": {"Open"},
    "Ongoing": {"Completed"},
    "Completed": set(),
}


def get_staff_assignment(connection, staff_id, trek_id):
    return connection.execute(
        """
        SELECT id
        FROM staff_assignments
        WHERE staff_id = ?
          AND trek_id = ?
        """,
        (staff_id, trek_id)
    ).fetchone()


@staff_bp.get("/dashboard")
@jwt_required()
@role_required("Staff")
def staff_dashboard():
    staff_id = int(get_jwt_identity())
    connection = get_db_connection()

    assigned_treks = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM staff_assignments
        WHERE staff_id = ?
        """,
        (staff_id,)
    ).fetchone()["count"]

    open_treks = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM staff_assignments sa
        JOIN treks t ON t.id = sa.trek_id
        WHERE sa.staff_id = ?
          AND t.status = 'Open'
        """,
        (staff_id,)
    ).fetchone()["count"]

    ongoing_treks = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM staff_assignments sa
        JOIN treks t ON t.id = sa.trek_id
        WHERE sa.staff_id = ?
          AND t.status = 'Ongoing'
        """,
        (staff_id,)
    ).fetchone()["count"]

    completed_treks = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM staff_assignments sa
        JOIN treks t ON t.id = sa.trek_id
        WHERE sa.staff_id = ?
          AND t.status = 'Completed'
        """,
        (staff_id,)
    ).fetchone()["count"]

    total_participants = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM bookings b
        JOIN staff_assignments sa
            ON sa.trek_id = b.trek_id
        WHERE sa.staff_id = ?
          AND b.status IN ('Booked', 'Completed')
        """,
        (staff_id,)
    ).fetchone()["count"]

    connection.close()

    return jsonify({
        "success": True,
        "stats": {
            "assigned_treks": assigned_treks,
            "open_treks": open_treks,
            "ongoing_treks": ongoing_treks,
            "completed_treks": completed_treks,
            "total_participants": total_participants,
        }
    })


@staff_bp.get("/treks")
@jwt_required()
@role_required("Staff")
def staff_treks():
    staff_id = int(get_jwt_identity())
    connection = get_db_connection()

    treks = connection.execute(
        """
        SELECT
            t.*,
            (
                SELECT COUNT(*)
                FROM bookings b
                WHERE b.trek_id = t.id
                  AND b.status IN ('Booked', 'Completed')
            ) AS participant_count
        FROM treks t
        JOIN staff_assignments sa
            ON sa.trek_id = t.id
        WHERE sa.staff_id = ?
        ORDER BY t.start_date ASC, t.id DESC
        """,
        (staff_id,)
    ).fetchall()

    connection.close()

    return jsonify({
        "success": True,
        "treks": [dict(trek) for trek in treks]
    })


@staff_bp.get("/treks/<int:trek_id>")
@jwt_required()
@role_required("Staff")
def staff_get_trek(trek_id):
    staff_id = int(get_jwt_identity())
    connection = get_db_connection()

    assignment = get_staff_assignment(connection, staff_id, trek_id)
    if assignment is None:
        connection.close()
        return jsonify({
            "success": False,
            "message": "You are not assigned to this trek"
        }), 403

    trek = connection.execute(
        "SELECT * FROM treks WHERE id = ?",
        (trek_id,)
    ).fetchone()
    connection.close()

    if trek is None:
        return jsonify({"success": False, "message": "Trek not found"}), 404

    return jsonify({"success": True, "trek": dict(trek)})


@staff_bp.patch("/treks/<int:trek_id>/slots")
@jwt_required()
@role_required("Staff")
def update_trek_slots(trek_id):
    staff_id = int(get_jwt_identity())
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"success": False, "message": "Request body is required"}), 400

    try:
        total_slots = int(data.get("total_slots"))
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Total slots must be a number"
        }), 400

    if total_slots <= 0:
        return jsonify({
            "success": False,
            "message": "Total slots must be greater than 0"
        }), 400

    connection = get_db_connection()

    if get_staff_assignment(connection, staff_id, trek_id) is None:
        connection.close()
        return jsonify({
            "success": False,
            "message": "You are not assigned to this trek"
        }), 403

    trek = connection.execute(
        "SELECT * FROM treks WHERE id = ?",
        (trek_id,)
    ).fetchone()

    if trek is None:
        connection.close()
        return jsonify({"success": False, "message": "Trek not found"}), 404

    if trek["status"] not in {"Approved", "Open", "Closed"}:
        connection.close()
        return jsonify({
            "success": False,
            "message": "Slots can only be changed before the trek starts"
        }), 400

    booked_count = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM bookings
        WHERE trek_id = ?
          AND status = 'Booked'
        """,
        (trek_id,)
    ).fetchone()["count"]

    if total_slots < booked_count:
        connection.close()
        return jsonify({
            "success": False,
            "message": "Total slots cannot be less than current bookings"
        }), 400

    available_slots = total_slots - booked_count

    connection.execute(
        """
        UPDATE treks
        SET total_slots = ?, available_slots = ?
        WHERE id = ?
        """,
        (total_slots, available_slots, trek_id)
    )
    connection.commit()
    connection.close()

    return jsonify({
        "success": True,
        "message": "Trek slots updated successfully",
        "total_slots": total_slots,
        "available_slots": available_slots,
    })


@staff_bp.patch("/treks/<int:trek_id>/status")
@jwt_required()
@role_required("Staff")
def update_trek_status(trek_id):
    staff_id = int(get_jwt_identity())
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"success": False, "message": "Request body is required"}), 400

    new_status = str(data.get("status", "")).strip()

    connection = get_db_connection()

    if get_staff_assignment(connection, staff_id, trek_id) is None:
        connection.close()
        return jsonify({
            "success": False,
            "message": "You are not assigned to this trek"
        }), 403

    trek = connection.execute(
        "SELECT * FROM treks WHERE id = ?",
        (trek_id,)
    ).fetchone()

    if trek is None:
        connection.close()
        return jsonify({"success": False, "message": "Trek not found"}), 404

    current_status = trek["status"]
    allowed_next = STAFF_STATUS_TRANSITIONS.get(current_status, set())

    if new_status not in allowed_next:
        connection.close()

        if current_status == "Pending":
            message = "Pending trek must first be approved by Admin"
        elif current_status == "Completed":
            message = "A completed trek cannot be reopened"
        else:
            allowed_text = ", ".join(sorted(allowed_next)) or "none"
            message = (
                f"Invalid status transition from {current_status} to {new_status}. "
                f"Allowed next status: {allowed_text}"
            )

        return jsonify({"success": False, "message": message}), 400

    connection.execute(
        "UPDATE treks SET status = ? WHERE id = ?",
        (new_status, trek_id)
    )

    if new_status == "Completed":
        connection.execute(
            """
            UPDATE bookings
            SET status = 'Completed'
            WHERE trek_id = ?
              AND status = 'Booked'
            """,
            (trek_id,)
        )

    connection.commit()
    connection.close()

    return jsonify({
        "success": True,
        "message": f"Trek status changed to {new_status}"
    })


@staff_bp.get("/treks/<int:trek_id>/participants")
@jwt_required()
@role_required("Staff")
def trek_participants(trek_id):
    staff_id = int(get_jwt_identity())
    connection = get_db_connection()

    if get_staff_assignment(connection, staff_id, trek_id) is None:
        connection.close()
        return jsonify({
            "success": False,
            "message": "You are not assigned to this trek"
        }), 403

    trek = connection.execute(
        "SELECT id, name, status FROM treks WHERE id = ?",
        (trek_id,)
    ).fetchone()

    if trek is None:
        connection.close()
        return jsonify({"success": False, "message": "Trek not found"}), 404

    participants = connection.execute(
        """
        SELECT
            b.id AS booking_id,
            b.booking_date,
            b.status AS booking_status,
            b.payment_status,
            u.id AS user_id,
            u.name,
            u.email,
            u.phone
        FROM bookings b
        JOIN users u ON u.id = b.user_id
        WHERE b.trek_id = ?
          AND b.status IN ('Booked', 'Completed')
        ORDER BY b.booking_date ASC, b.id ASC
        """,
        (trek_id,)
    ).fetchall()

    connection.close()

    return jsonify({
        "success": True,
        "trek": dict(trek),
        "participants": [dict(row) for row in participants]
    })


@staff_bp.get("/participants")
@jwt_required()
@role_required("Staff")
def all_staff_participants():
    staff_id = int(get_jwt_identity())
    connection = get_db_connection()

    participants = connection.execute(
        """
        SELECT
            b.id AS booking_id,
            b.booking_date,
            b.status AS booking_status,
            b.payment_status,
            u.id AS user_id,
            u.name AS user_name,
            u.email AS user_email,
            u.phone AS user_phone,
            t.id AS trek_id,
            t.name AS trek_name,
            t.status AS trek_status
        FROM staff_assignments sa
        JOIN treks t ON t.id = sa.trek_id
        JOIN bookings b ON b.trek_id = t.id
        JOIN users u ON u.id = b.user_id
        WHERE sa.staff_id = ?
          AND b.status IN ('Booked', 'Completed')
        ORDER BY t.start_date ASC, b.booking_date ASC, b.id ASC
        """,
        (staff_id,)
    ).fetchall()

    connection.close()

    return jsonify({
        "success": True,
        "participants": [dict(row) for row in participants]
    })


@staff_bp.get("/profile")
@jwt_required()
@role_required("Staff")
def staff_profile():
    staff_id = int(get_jwt_identity())
    connection = get_db_connection()

    profile = connection.execute(
        """
        SELECT
            u.id,
            u.name,
            u.email,
            u.phone,
            u.role,
            u.is_active,
            u.is_blacklisted,
            sp.experience,
            sp.specialization,
            sp.emergency_contact,
            sp.address
        FROM users u
        LEFT JOIN staff_profiles sp
            ON sp.user_id = u.id
        WHERE u.id = ?
          AND u.role = 'Staff'
        """,
        (staff_id,)
    ).fetchone()

    connection.close()

    if profile is None:
        return jsonify({
            "success": False,
            "message": "Staff profile not found"
        }), 404

    return jsonify({"success": True, "profile": dict(profile)})
