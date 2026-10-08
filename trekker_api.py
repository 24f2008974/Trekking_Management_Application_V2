from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    get_jwt_identity,
    jwt_required
)

from auth import role_required
from db import get_db_connection


trekker_bp = Blueprint(
    "trekker",
    __name__,
    url_prefix="/api/trekker"
)


# =========================================================
# DASHBOARD
# =========================================================

@trekker_bp.get("/dashboard")
@jwt_required()
@role_required("Trekker")
def trekker_dashboard():

    user_id = int(
        get_jwt_identity()
    )

    connection = get_db_connection()

    available_treks = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM treks
        WHERE status = 'Open'
        AND available_slots > 0
        """
    ).fetchone()["count"]

    active_bookings = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM bookings
        WHERE user_id = ?
        AND status = 'Booked'
        """,
        (user_id,)
    ).fetchone()["count"]

    completed_treks = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM bookings
        WHERE user_id = ?
        AND status = 'Completed'
        """,
        (user_id,)
    ).fetchone()["count"]

    cancelled_bookings = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM bookings
        WHERE user_id = ?
        AND status = 'Cancelled'
        """,
        (user_id,)
    ).fetchone()["count"]

    connection.close()

    return jsonify({
        "success": True,
        "stats": {
            "available_treks":
                available_treks,

            "active_bookings":
                active_bookings,

            "completed_treks":
                completed_treks,

            "cancelled_bookings":
                cancelled_bookings
        }
    })


# =========================================================
# VIEW OPEN TREKS + SEARCH / FILTER
# =========================================================

@trekker_bp.get("/treks")
@jwt_required()
@role_required("Trekker")
def get_available_treks():

    search = request.args.get(
        "search",
        ""
    ).strip()

    difficulty = request.args.get(
        "difficulty",
        ""
    ).strip()

    location = request.args.get(
        "location",
        ""
    ).strip()

    duration = request.args.get(
        "duration",
        ""
    ).strip()

    query = """
        SELECT
            t.id,
            t.name,
            t.location,
            t.difficulty,
            t.duration,
            t.total_slots,
            t.available_slots,
            t.description,
            t.start_date,
            t.end_date,
            t.status,

            (
                SELECT GROUP_CONCAT(
                    u.name,
                    ', '
                )

                FROM staff_assignments sa

                JOIN users u
                    ON u.id = sa.staff_id

                WHERE sa.trek_id = t.id
            ) AS assigned_staff

        FROM treks t

        WHERE t.status = 'Open'
    """

    parameters = []

    if search:

        query += """
            AND (
                t.name LIKE ?
                OR t.location LIKE ?
                OR t.description LIKE ?
            )
        """

        like_search = f"%{search}%"

        parameters.extend([
            like_search,
            like_search,
            like_search
        ])

    if difficulty:

        query += """
            AND t.difficulty = ?
        """

        parameters.append(
            difficulty
        )

    if location:

        query += """
            AND t.location LIKE ?
        """

        parameters.append(
            f"%{location}%"
        )

    if duration:

        try:

            duration_value = int(
                duration
            )

        except ValueError:

            return jsonify({
                "success": False,
                "message":
                    "Duration must be a number"
            }), 400

        query += """
            AND t.duration <= ?
        """

        parameters.append(
            duration_value
        )

    query += """
        ORDER BY
            t.start_date ASC,
            t.id DESC
    """

    connection = get_db_connection()

    treks = connection.execute(
        query,
        parameters
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
# VIEW ONE OPEN TREK
# =========================================================

@trekker_bp.get("/treks/<int:trek_id>")
@jwt_required()
@role_required("Trekker")
def get_trek_details(trek_id):

    connection = get_db_connection()

    trek = connection.execute(
        """
        SELECT
            t.*,

            (
                SELECT GROUP_CONCAT(
                    u.name,
                    ', '
                )

                FROM staff_assignments sa

                JOIN users u
                    ON u.id = sa.staff_id

                WHERE sa.trek_id = t.id
            ) AS assigned_staff

        FROM treks t

        WHERE t.id = ?
        """,
        (trek_id,)
    ).fetchone()

    connection.close()

    if trek is None:

        return jsonify({
            "success": False,
            "message":
                "Trek not found"
        }), 404

    return jsonify({
        "success": True,
        "trek": dict(trek)
    })


# =========================================================
# BOOK TREK
# =========================================================

@trekker_bp.post(
    "/treks/<int:trek_id>/book"
)
@jwt_required()
@role_required("Trekker")
def book_trek(trek_id):

    user_id = int(
        get_jwt_identity()
    )

    connection = get_db_connection()

    try:

        # BEGIN IMMEDIATE obtains write lock early.
        # This helps avoid two users taking the
        # final available slot at the same time.
        connection.execute(
            "BEGIN IMMEDIATE"
        )

        user = connection.execute(
            """
            SELECT
                id,
                role,
                is_active,
                is_blacklisted

            FROM users

            WHERE id = ?
            """,
            (user_id,)
        ).fetchone()

        if user is None:

            connection.rollback()
            connection.close()

            return jsonify({
                "success": False,
                "message":
                    "User not found"
            }), 404

        if user["role"] != "Trekker":

            connection.rollback()
            connection.close()

            return jsonify({
                "success": False,
                "message":
                    "Only Trekkers can book treks"
            }), 403

        if not user["is_active"]:

            connection.rollback()
            connection.close()

            return jsonify({
                "success": False,
                "message":
                    "Your account is inactive"
            }), 403

        if user["is_blacklisted"]:

            connection.rollback()
            connection.close()

            return jsonify({
                "success": False,
                "message":
                    "Your account is blacklisted"
            }), 403

        trek = connection.execute(
            """
            SELECT *
            FROM treks
            WHERE id = ?
            """,
            (trek_id,)
        ).fetchone()

        if trek is None:

            connection.rollback()
            connection.close()

            return jsonify({
                "success": False,
                "message":
                    "Trek not found"
            }), 404

        if trek["status"] != "Open":

            connection.rollback()
            connection.close()

            return jsonify({
                "success": False,
                "message":
                    "Only Open treks can be booked"
            }), 400

        if trek["available_slots"] <= 0:

            connection.rollback()
            connection.close()

            return jsonify({
                "success": False,
                "message":
                    "No slots are available for this trek"
            }), 409

        existing_booking = connection.execute(
            """
            SELECT id
            FROM bookings

            WHERE user_id = ?
            AND trek_id = ?
            AND status = 'Booked'
            """,
            (
                user_id,
                trek_id
            )
        ).fetchone()

        if existing_booking:

            connection.rollback()
            connection.close()

            return jsonify({
                "success": False,
                "message":
                    "You have already booked this trek"
            }), 409

        cursor = connection.execute(
            """
            INSERT INTO bookings
            (
                user_id,
                trek_id,
                status,
                payment_status
            )
            VALUES (?, ?, 'Booked', 'Pending')
            """,
            (
                user_id,
                trek_id
            )
        )

        connection.execute(
            """
            UPDATE treks

            SET available_slots =
                available_slots - 1

            WHERE id = ?
            AND available_slots > 0
            """,
            (trek_id,)
        )

        connection.commit()

        booking_id = (
            cursor.lastrowid
        )

        connection.close()

        return jsonify({
            "success": True,

            "message":
                "Trek booked successfully",

            "booking_id":
                booking_id
        }), 201

    except Exception as error:

        connection.rollback()
        connection.close()

        return jsonify({
            "success": False,
            "message":
                f"Booking failed: {str(error)}"
        }), 500


# =========================================================
# MY ACTIVE BOOKINGS
# =========================================================

@trekker_bp.get("/bookings")
@jwt_required()
@role_required("Trekker")
def my_bookings():

    user_id = int(
        get_jwt_identity()
    )

    connection = get_db_connection()

    bookings = connection.execute(
        """
        SELECT
            b.id,
            b.booking_date,
            b.status AS booking_status,
            b.payment_status,

            t.id AS trek_id,
            t.name AS trek_name,
            t.location,
            t.difficulty,
            t.duration,
            t.start_date,
            t.end_date,
            t.status AS trek_status,
            t.available_slots,
            t.total_slots

        FROM bookings b

        JOIN treks t
            ON t.id = b.trek_id

        WHERE b.user_id = ?
        AND b.status = 'Booked'

        ORDER BY
            t.start_date ASC,
            b.id DESC
        """,
        (user_id,)
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
# CANCEL BOOKING
# =========================================================

@trekker_bp.patch(
    "/bookings/<int:booking_id>/cancel"
)
@jwt_required()
@role_required("Trekker")
def cancel_booking(booking_id):

    user_id = int(
        get_jwt_identity()
    )

    connection = get_db_connection()

    try:

        connection.execute(
            "BEGIN IMMEDIATE"
        )

        booking = connection.execute(
            """
            SELECT
                b.*,
                t.status AS trek_status

            FROM bookings b

            JOIN treks t
                ON t.id = b.trek_id

            WHERE b.id = ?
            AND b.user_id = ?
            """,
            (
                booking_id,
                user_id
            )
        ).fetchone()

        if booking is None:

            connection.rollback()
            connection.close()

            return jsonify({
                "success": False,
                "message":
                    "Booking not found"
            }), 404

        if (
            booking["status"]
            != "Booked"
        ):

            connection.rollback()
            connection.close()

            return jsonify({
                "success": False,
                "message":
                    "Only active bookings can be cancelled"
            }), 400

        if (
            booking["trek_status"]
            in (
                "Ongoing",
                "Completed"
            )
        ):

            connection.rollback()
            connection.close()

            return jsonify({
                "success": False,

                "message":
                    "Ongoing or completed trek booking cannot be cancelled"
            }), 400

        connection.execute(
            """
            UPDATE bookings

            SET status = 'Cancelled'

            WHERE id = ?
            """,
            (booking_id,)
        )

        connection.execute(
            """
            UPDATE treks

            SET available_slots =
                CASE
                    WHEN available_slots < total_slots
                    THEN available_slots + 1
                    ELSE total_slots
                END

            WHERE id = ?
            """,
            (
                booking["trek_id"],
            )
        )

        connection.commit()
        connection.close()

        return jsonify({
            "success": True,

            "message":
                "Booking cancelled successfully"
        })

    except Exception as error:

        connection.rollback()
        connection.close()

        return jsonify({
            "success": False,

            "message":
                f"Cancellation failed: {str(error)}"
        }), 500


# =========================================================
# COMPLETE BOOKING HISTORY
# =========================================================

@trekker_bp.get("/history")
@jwt_required()
@role_required("Trekker")
def trekking_history():

    user_id = int(
        get_jwt_identity()
    )

    connection = get_db_connection()

    history = connection.execute(
        """
        SELECT
            b.id,
            b.booking_date,
            b.status AS booking_status,
            b.payment_status,

            t.id AS trek_id,
            t.name AS trek_name,
            t.location,
            t.difficulty,
            t.duration,
            t.start_date,
            t.end_date,
            t.status AS trek_status

        FROM bookings b

        JOIN treks t
            ON t.id = b.trek_id

        WHERE b.user_id = ?

        ORDER BY
            b.booking_date DESC,
            b.id DESC
        """,
        (user_id,)
    ).fetchall()

    connection.close()

    return jsonify({
        "success": True,

        "history": [
            dict(row)
            for row in history
        ]
    })


# =========================================================
# PROFILE
# =========================================================

@trekker_bp.get("/profile")
@jwt_required()
@role_required("Trekker")
def get_profile():

    user_id = int(
        get_jwt_identity()
    )

    connection = get_db_connection()

    user = connection.execute(
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

        WHERE id = ?
        AND role = 'Trekker'
        """,
        (user_id,)
    ).fetchone()

    connection.close()

    if user is None:

        return jsonify({
            "success": False,
            "message":
                "Trekker profile not found"
        }), 404

    return jsonify({
        "success": True,
        "profile": dict(user)
    })


# =========================================================
# UPDATE PROFILE
# =========================================================

@trekker_bp.put("/profile")
@jwt_required()
@role_required("Trekker")
def update_profile():

    user_id = int(
        get_jwt_identity()
    )

    data = request.get_json(
        silent=True
    )

    if not data:

        return jsonify({
            "success": False,
            "message":
                "Request body is required"
        }), 400

    connection = get_db_connection()

    user = connection.execute(
        """
        SELECT *
        FROM users
        WHERE id = ?
        AND role = 'Trekker'
        """,
        (user_id,)
    ).fetchone()

    if user is None:

        connection.close()

        return jsonify({
            "success": False,
            "message":
                "User not found"
        }), 404

    name = str(
        data.get(
            "name",
            user["name"]
        )
    ).strip()

    phone = str(
        data.get(
            "phone",
            user["phone"] or ""
        )
    ).strip()

    if not name:

        connection.close()

        return jsonify({
            "success": False,
            "message":
                "Name is required"
        }), 400

    connection.execute(
        """
        UPDATE users

        SET
            name = ?,
            phone = ?

        WHERE id = ?
        """,
        (
            name,
            phone,
            user_id
        )
    )

    connection.commit()

    updated_user = connection.execute(
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

        WHERE id = ?
        """,
        (user_id,)
    ).fetchone()

    connection.close()

    return jsonify({
        "success": True,

        "message":
            "Profile updated successfully",

        "profile":
            dict(updated_user)
    })