from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from werkzeug.security import generate_password_hash

from auth import role_required
from db import get_db_connection


admin_bp = Blueprint(
    "admin",
    __name__,
    url_prefix="/api/admin"
)


# =========================================================
# HELPER
# =========================================================

def admin_only():
    pass


# =========================================================
# ADMIN DASHBOARD
# =========================================================

@admin_bp.get("/dashboard")
@jwt_required()
@role_required("Admin")
def admin_dashboard():

    connection = get_db_connection()

    total_treks = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM treks
        """
    ).fetchone()["count"]

    total_staff = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM users
        WHERE role = 'Staff'
        """
    ).fetchone()["count"]

    total_trekkers = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM users
        WHERE role = 'Trekker'
        """
    ).fetchone()["count"]

    total_bookings = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM bookings
        """
    ).fetchone()["count"]

    open_treks = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM treks
        WHERE status = 'Open'
        """
    ).fetchone()["count"]

    completed_treks = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM treks
        WHERE status = 'Completed'
        """
    ).fetchone()["count"]

    connection.close()

    return jsonify({
        "success": True,
        "stats": {
            "total_treks": total_treks,
            "total_staff": total_staff,
            "total_trekkers": total_trekkers,
            "total_bookings": total_bookings,
            "open_treks": open_treks,
            "completed_treks": completed_treks
        }
    })


# =========================================================
# CREATE TREK
# =========================================================

@admin_bp.post("/treks")
@jwt_required()
@role_required("Admin")
def create_trek():

    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "success": False,
            "message": "Request body is required"
        }), 400

    name = str(data.get("name", "")).strip()
    location = str(data.get("location", "")).strip()
    difficulty = str(data.get("difficulty", "")).strip()
    description = str(data.get("description", "")).strip()
    start_date = str(data.get("start_date", "")).strip()
    end_date = str(data.get("end_date", "")).strip()
    status = str(data.get("status", "Pending")).strip()

    try:
        duration = int(data.get("duration", 0))
        total_slots = int(data.get("total_slots", 0))
    except (TypeError, ValueError):

        return jsonify({
            "success": False,
            "message": "Duration and total slots must be numbers"
        }), 400

    if not name:
        return jsonify({
            "success": False,
            "message": "Trek name is required"
        }), 400

    if not location:
        return jsonify({
            "success": False,
            "message": "Location is required"
        }), 400

    allowed_difficulties = [
        "Easy",
        "Moderate",
        "Hard"
    ]

    if difficulty not in allowed_difficulties:
        return jsonify({
            "success": False,
            "message": "Difficulty must be Easy, Moderate or Hard"
        }), 400

    if duration <= 0:
        return jsonify({
            "success": False,
            "message": "Duration must be greater than 0"
        }), 400

    if total_slots <= 0:
        return jsonify({
            "success": False,
            "message": "Total slots must be greater than 0"
        }), 400

    allowed_statuses = [
        "Pending",
        "Approved",
        "Open",
        "Closed",
        "Completed"
    ]

    if status not in allowed_statuses:
        return jsonify({
            "success": False,
            "message": "Invalid trek status"
        }), 400

    connection = get_db_connection()

    cursor = connection.execute(
        """
        INSERT INTO treks
        (
            name,
            location,
            difficulty,
            duration,
            total_slots,
            available_slots,
            description,
            start_date,
            end_date,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            name,
            location,
            difficulty,
            duration,
            total_slots,
            total_slots,
            description,
            start_date,
            end_date,
            status
        )
    )

    connection.commit()

    trek_id = cursor.lastrowid

    connection.close()

    return jsonify({
        "success": True,
        "message": "Trek created successfully",
        "trek_id": trek_id
    }), 201


# =========================================================
# VIEW ALL TREKS
# =========================================================

@admin_bp.get("/treks")
@jwt_required()
@role_required("Admin")
def get_all_treks():

    connection = get_db_connection()

    treks = connection.execute(
        """
        SELECT
            t.*,

            (
                SELECT COUNT(*)
                FROM bookings b
                WHERE b.trek_id = t.id
                AND b.status = 'Booked'
            ) AS booked_count,

            (
                SELECT GROUP_CONCAT(u.name, ', ')
                FROM staff_assignments sa

                JOIN users u
                    ON u.id = sa.staff_id

                WHERE sa.trek_id = t.id
            ) AS assigned_staff

        FROM treks t

        ORDER BY t.id DESC
        """
    ).fetchall()

    connection.close()

    return jsonify({
        "success": True,
        "treks": [
            dict(trek)
            for trek in treks
        ]
    })


# =========================================================
# VIEW ONE TREK
# =========================================================

@admin_bp.get("/treks/<int:trek_id>")
@jwt_required()
@role_required("Admin")
def get_trek(trek_id):

    connection = get_db_connection()

    trek = connection.execute(
        """
        SELECT *
        FROM treks
        WHERE id = ?
        """,
        (trek_id,)
    ).fetchone()

    connection.close()

    if trek is None:

        return jsonify({
            "success": False,
            "message": "Trek not found"
        }), 404

    return jsonify({
        "success": True,
        "trek": dict(trek)
    })


# =========================================================
# UPDATE TREK
# =========================================================

@admin_bp.put("/treks/<int:trek_id>")
@jwt_required()
@role_required("Admin")
def update_trek(trek_id):

    data = request.get_json(silent=True)

    if not data:

        return jsonify({
            "success": False,
            "message": "Request body is required"
        }), 400

    connection = get_db_connection()

    existing = connection.execute(
        """
        SELECT *
        FROM treks
        WHERE id = ?
        """,
        (trek_id,)
    ).fetchone()

    if existing is None:

        connection.close()

        return jsonify({
            "success": False,
            "message": "Trek not found"
        }), 404

    name = str(
        data.get("name", existing["name"])
    ).strip()

    location = str(
        data.get("location", existing["location"])
    ).strip()

    difficulty = str(
        data.get(
            "difficulty",
            existing["difficulty"]
        )
    ).strip()

    description = str(
        data.get(
            "description",
            existing["description"] or ""
        )
    ).strip()

    start_date = str(
        data.get(
            "start_date",
            existing["start_date"] or ""
        )
    ).strip()

    end_date = str(
        data.get(
            "end_date",
            existing["end_date"] or ""
        )
    ).strip()

    status = str(
        data.get(
            "status",
            existing["status"]
        )
    ).strip()

    try:

        duration = int(
            data.get(
                "duration",
                existing["duration"]
            )
        )

        total_slots = int(
            data.get(
                "total_slots",
                existing["total_slots"]
            )
        )

    except (TypeError, ValueError):

        connection.close()

        return jsonify({
            "success": False,
            "message": "Duration and slots must be numbers"
        }), 400

    allowed_difficulties = [
        "Easy",
        "Moderate",
        "Hard"
    ]

    if difficulty not in allowed_difficulties:

        connection.close()

        return jsonify({
            "success": False,
            "message": "Invalid difficulty"
        }), 400

    allowed_statuses = [
        "Pending",
        "Approved",
        "Open",
        "Closed",
        "Completed"
    ]

    if status not in allowed_statuses:

        connection.close()

        return jsonify({
            "success": False,
            "message": "Invalid trek status"
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
            "message":
                "Total slots cannot be less than current bookings"
        }), 400

    available_slots = total_slots - booked_count

    connection.execute(
        """
        UPDATE treks

        SET
            name = ?,
            location = ?,
            difficulty = ?,
            duration = ?,
            total_slots = ?,
            available_slots = ?,
            description = ?,
            start_date = ?,
            end_date = ?,
            status = ?

        WHERE id = ?
        """,
        (
            name,
            location,
            difficulty,
            duration,
            total_slots,
            available_slots,
            description,
            start_date,
            end_date,
            status,
            trek_id
        )
    )

    connection.commit()
    connection.close()

    return jsonify({
        "success": True,
        "message": "Trek updated successfully"
    })


# =========================================================
# DELETE TREK
# =========================================================

@admin_bp.delete("/treks/<int:trek_id>")
@jwt_required()
@role_required("Admin")
def delete_trek(trek_id):

    connection = get_db_connection()

    trek = connection.execute(
        """
        SELECT id
        FROM treks
        WHERE id = ?
        """,
        (trek_id,)
    ).fetchone()

    if trek is None:

        connection.close()

        return jsonify({
            "success": False,
            "message": "Trek not found"
        }), 404

    booking_count = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM bookings
        WHERE trek_id = ?
        """,
        (trek_id,)
    ).fetchone()["count"]

    if booking_count > 0:

        connection.close()

        return jsonify({
            "success": False,
            "message":
                "Cannot delete trek because booking history exists. Close the trek instead."
        }), 409

    connection.execute(
        """
        DELETE FROM treks
        WHERE id = ?
        """,
        (trek_id,)
    )

    connection.commit()
    connection.close()

    return jsonify({
        "success": True,
        "message": "Trek deleted successfully"
    })


# =========================================================
# CREATE STAFF
# =========================================================

@admin_bp.post("/staff")
@jwt_required()
@role_required("Admin")
def create_staff():

    data = request.get_json(silent=True)

    if not data:

        return jsonify({
            "success": False,
            "message": "Request body is required"
        }), 400

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", "")).strip()
    phone = str(data.get("phone", "")).strip()

    experience = str(
        data.get("experience", "")
    ).strip()

    specialization = str(
        data.get("specialization", "")
    ).strip()

    emergency_contact = str(
        data.get("emergency_contact", "")
    ).strip()

    address = str(
        data.get("address", "")
    ).strip()

    if not name or not email or not password:

        return jsonify({
            "success": False,
            "message":
                "Name, email and password are required"
        }), 400

    if len(password) < 6:

        return jsonify({
            "success": False,
            "message":
                "Password must contain at least 6 characters"
        }), 400

    connection = get_db_connection()

    existing = connection.execute(
        """
        SELECT id
        FROM users
        WHERE email = ?
        """,
        (email,)
    ).fetchone()

    if existing:

        connection.close()

        return jsonify({
            "success": False,
            "message": "Email already exists"
        }), 409

    hashed_password = generate_password_hash(
        password
    )

    try:

        cursor = connection.execute(
            """
            INSERT INTO users
            (
                name,
                email,
                password,
                phone,
                role,
                is_active,
                is_blacklisted
            )
            VALUES (?, ?, ?, ?, 'Staff', 1, 0)
            """,
            (
                name,
                email,
                hashed_password,
                phone
            )
        )

        staff_id = cursor.lastrowid

        connection.execute(
            """
            INSERT INTO staff_profiles
            (
                user_id,
                experience,
                specialization,
                emergency_contact,
                address
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                staff_id,
                experience,
                specialization,
                emergency_contact,
                address
            )
        )

        connection.commit()

    except Exception as error:

        connection.rollback()
        connection.close()

        return jsonify({
            "success": False,
            "message": str(error)
        }), 500

    connection.close()

    return jsonify({
        "success": True,
        "message": "Staff created successfully",
        "staff_id": staff_id
    }), 201


# =========================================================
# VIEW STAFF
# =========================================================

@admin_bp.get("/staff")
@jwt_required()
@role_required("Admin")
def get_staff():

    connection = get_db_connection()

    staff = connection.execute(
        """
        SELECT
            u.id,
            u.name,
            u.email,
            u.phone,
            u.is_active,
            u.is_blacklisted,
            u.created_at,

            sp.experience,
            sp.specialization,
            sp.emergency_contact,
            sp.address,

            (
                SELECT COUNT(*)
                FROM staff_assignments sa
                WHERE sa.staff_id = u.id
            ) AS assigned_treks

        FROM users u

        LEFT JOIN staff_profiles sp
            ON sp.user_id = u.id

        WHERE u.role = 'Staff'

        ORDER BY u.id DESC
        """
    ).fetchall()

    connection.close()

    return jsonify({
        "success": True,
        "staff": [
            dict(row)
            for row in staff
        ]
    })


# =========================================================
# ASSIGN STAFF TO TREK
# =========================================================

@admin_bp.post("/treks/<int:trek_id>/assign-staff")
@jwt_required()
@role_required("Admin")
def assign_staff(trek_id):

    data = request.get_json(silent=True)

    if not data or not data.get("staff_id"):

        return jsonify({
            "success": False,
            "message": "Staff ID is required"
        }), 400

    try:
        staff_id = int(data["staff_id"])

    except (TypeError, ValueError):

        return jsonify({
            "success": False,
            "message": "Invalid staff ID"
        }), 400

    connection = get_db_connection()

    trek = connection.execute(
        """
        SELECT id
        FROM treks
        WHERE id = ?
        """,
        (trek_id,)
    ).fetchone()

    if trek is None:

        connection.close()

        return jsonify({
            "success": False,
            "message": "Trek not found"
        }), 404

    staff = connection.execute(
        """
        SELECT id, is_active, is_blacklisted
        FROM users
        WHERE id = ?
        AND role = 'Staff'
        """,
        (staff_id,)
    ).fetchone()

    if staff is None:

        connection.close()

        return jsonify({
            "success": False,
            "message": "Staff member not found"
        }), 404

    if not staff["is_active"] or staff["is_blacklisted"]:

        connection.close()

        return jsonify({
            "success": False,
            "message":
                "Inactive or blacklisted staff cannot be assigned"
        }), 400

    existing = connection.execute(
        """
        SELECT id
        FROM staff_assignments
        WHERE staff_id = ?
        AND trek_id = ?
        """,
        (
            staff_id,
            trek_id
        )
    ).fetchone()

    if existing:

        connection.close()

        return jsonify({
            "success": False,
            "message":
                "Staff is already assigned to this trek"
        }), 409

    connection.execute(
        """
        INSERT INTO staff_assignments
        (
            staff_id,
            trek_id
        )
        VALUES (?, ?)
        """,
        (
            staff_id,
            trek_id
        )
    )

    connection.commit()
    connection.close()

    return jsonify({
        "success": True,
        "message": "Staff assigned successfully"
    }), 201


# =========================================================
# REMOVE STAFF ASSIGNMENT
# =========================================================

@admin_bp.delete(
    "/treks/<int:trek_id>/staff/<int:staff_id>"
)
@jwt_required()
@role_required("Admin")
def remove_staff_assignment(
    trek_id,
    staff_id
):

    connection = get_db_connection()

    result = connection.execute(
        """
        DELETE FROM staff_assignments

        WHERE trek_id = ?
        AND staff_id = ?
        """,
        (
            trek_id,
            staff_id
        )
    )

    connection.commit()
    connection.close()

    if result.rowcount == 0:

        return jsonify({
            "success": False,
            "message": "Assignment not found"
        }), 404

    return jsonify({
        "success": True,
        "message":
            "Staff assignment removed successfully"
    })


# =========================================================
# USERS
# =========================================================

@admin_bp.get("/users")
@jwt_required()
@role_required("Admin")
def get_users():

    connection = get_db_connection()

    users = connection.execute(
        """
        SELECT
            id,
            name,
            email,
            phone,
            role,
            is_active,
            is_blacklisted,
            created_at

        FROM users

        WHERE role != 'Admin'

        ORDER BY id DESC
        """
    ).fetchall()

    connection.close()

    return jsonify({
        "success": True,
        "users": [
            dict(user)
            for user in users
        ]
    })


# =========================================================
# USER / STAFF STATUS
# =========================================================

@admin_bp.patch("/users/<int:user_id>/status")
@jwt_required()
@role_required("Admin")
def update_user_status(user_id):

    data = request.get_json(silent=True)

    if not data:

        return jsonify({
            "success": False,
            "message": "Request body is required"
        }), 400

    connection = get_db_connection()

    user = connection.execute(
        """
        SELECT *
        FROM users
        WHERE id = ?
        AND role != 'Admin'
        """,
        (user_id,)
    ).fetchone()

    if user is None:

        connection.close()

        return jsonify({
            "success": False,
            "message": "User not found"
        }), 404

    is_active = data.get(
        "is_active",
        user["is_active"]
    )

    is_blacklisted = data.get(
        "is_blacklisted",
        user["is_blacklisted"]
    )

    is_active = 1 if bool(is_active) else 0
    is_blacklisted = (
        1 if bool(is_blacklisted) else 0
    )

    connection.execute(
        """
        UPDATE users

        SET
            is_active = ?,
            is_blacklisted = ?

        WHERE id = ?
        """,
        (
            is_active,
            is_blacklisted,
            user_id
        )
    )

    connection.commit()
    connection.close()

    return jsonify({
        "success": True,
        "message": "User status updated successfully"
    })


# =========================================================
# ALL BOOKINGS
# =========================================================

@admin_bp.get("/bookings")
@jwt_required()
@role_required("Admin")
def get_all_bookings():

    connection = get_db_connection()

    bookings = connection.execute(
        """
        SELECT
            b.id,
            b.booking_date,
            b.status,
            b.payment_status,

            u.id AS user_id,
            u.name AS user_name,
            u.email AS user_email,

            t.id AS trek_id,
            t.name AS trek_name,
            t.location,
            t.start_date,
            t.end_date

        FROM bookings b

        JOIN users u
            ON u.id = b.user_id

        JOIN treks t
            ON t.id = b.trek_id

        ORDER BY b.id DESC
        """
    ).fetchall()

    connection.close()

    return jsonify({
        "success": True,
        "bookings": [
            dict(row)
            for row in bookings
        ]
    })


# =========================================================
# SEARCH
# =========================================================

@admin_bp.get("/search")
@jwt_required()
@role_required("Admin")
def admin_search():

    query = request.args.get(
        "q",
        ""
    ).strip()

    if not query:

        return jsonify({
            "success": True,
            "treks": [],
            "users": [],
            "staff": []
        })

    like_query = f"%{query}%"

    connection = get_db_connection()

    treks = connection.execute(
        """
        SELECT *
        FROM treks

        WHERE
            name LIKE ?
            OR location LIKE ?
            OR CAST(id AS TEXT) LIKE ?

        ORDER BY id DESC
        """,
        (
            like_query,
            like_query,
            like_query
        )
    ).fetchall()

    users = connection.execute(
        """
        SELECT
            id,
            name,
            email,
            phone,
            role,
            is_active,
            is_blacklisted

        FROM users

        WHERE
            role = 'Trekker'
            AND
            (
                name LIKE ?
                OR email LIKE ?
                OR CAST(id AS TEXT) LIKE ?
            )

        ORDER BY id DESC
        """,
        (
            like_query,
            like_query,
            like_query
        )
    ).fetchall()

    staff = connection.execute(
        """
        SELECT
            id,
            name,
            email,
            phone,
            role,
            is_active,
            is_blacklisted

        FROM users

        WHERE
            role = 'Staff'
            AND
            (
                name LIKE ?
                OR email LIKE ?
                OR CAST(id AS TEXT) LIKE ?
            )

        ORDER BY id DESC
        """,
        (
            like_query,
            like_query,
            like_query
        )
    ).fetchall()

    connection.close()

    return jsonify({
        "success": True,

        "treks": [
            dict(row)
            for row in treks
        ],

        "users": [
            dict(row)
            for row in users
        ],

        "staff": [
            dict(row)
            for row in staff
        ]
    })