import hashlib
import json
import sqlite3
from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from auth import role_required
from cache import get_json_cache, set_json_cache
from db import get_db_connection


trekker_bp = Blueprint(
    "trekker",
    __name__,
    url_prefix="/api/trekker"
)


@trekker_bp.get("/dashboard")
@jwt_required()
@role_required("Trekker")
def trekker_dashboard():
    user_id = int(get_jwt_identity())
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
            "available_treks": available_treks,
            "active_bookings": active_bookings,
            "completed_treks": completed_treks,
            "cancelled_bookings": cancelled_bookings,
        }
    })


@trekker_bp.get("/treks")
@jwt_required()
@role_required("Trekker")
def get_available_treks():
    search = request.args.get("search", "").strip()
    difficulty = request.args.get("difficulty", "").strip()
    location = request.args.get("location", "").strip()
    duration = request.args.get("duration", "").strip()

    duration_value = None
    if duration:
        try:
            duration_value = int(duration)
            if duration_value <= 0:
                raise ValueError
        except ValueError:
            return jsonify({
                "success": False,
                "message": "Duration must be a positive number"
            }), 400

    normalized_filters = {
        "search": search.lower(),
        "difficulty": difficulty,
        "location": location.lower(),
        "duration": duration_value,
    }
    query_hash = hashlib.sha256(
        json.dumps(
            normalized_filters,
            sort_keys=True,
            separators=(",", ":")
        ).encode("utf-8")
    ).hexdigest()
    cache_key = f"trekker:treks:list:{query_hash}"

    cached_data = get_json_cache(cache_key)
    if cached_data is not None:
        cached_data["cache"] = "HIT"
        return jsonify(cached_data)

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
                SELECT GROUP_CONCAT(u.name, ', ')
                FROM staff_assignments sa
                JOIN users u ON u.id = sa.staff_id
                WHERE sa.trek_id = t.id
                  AND u.is_active = 1
                  AND u.is_blacklisted = 0
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
                OR COALESCE(t.description, '') LIKE ?
            )
        """
        like_search = f"%{search}%"
        parameters.extend([like_search, like_search, like_search])

    if difficulty:
        if difficulty not in {"Easy", "Moderate", "Hard"}:
            return jsonify({
                "success": False,
                "message": "Invalid difficulty"
            }), 400
        query += " AND t.difficulty = ? "
        parameters.append(difficulty)

    if location:
        query += " AND t.location LIKE ? "
        parameters.append(f"%{location}%")

    if duration_value is not None:
        query += " AND t.duration <= ? "
        parameters.append(duration_value)

    query += " ORDER BY t.start_date ASC, t.id DESC "

    connection = get_db_connection()
    treks = connection.execute(query, parameters).fetchall()
    connection.close()

    result = {
        "success": True,
        "treks": [dict(trek) for trek in treks],
        "cache": "MISS",
    }
    set_json_cache(cache_key, result, ttl=120)

    return jsonify(result)


@trekker_bp.get("/treks/<int:trek_id>")
@jwt_required()
@role_required("Trekker")
def get_trek_details(trek_id):
    cache_key = f"trekker:treks:detail:{trek_id}"

    cached_data = get_json_cache(cache_key)
    if cached_data is not None:
        cached_data["cache"] = "HIT"
        return jsonify(cached_data)

    connection = get_db_connection()
    trek = connection.execute(
        """
        SELECT
            t.*,
            (
                SELECT GROUP_CONCAT(u.name, ', ')
                FROM staff_assignments sa
                JOIN users u ON u.id = sa.staff_id
                WHERE sa.trek_id = t.id
                  AND u.is_active = 1
                  AND u.is_blacklisted = 0
            ) AS assigned_staff
        FROM treks t
        WHERE t.id = ?
          AND t.status = 'Open'
        """,
        (trek_id,)
    ).fetchone()
    connection.close()

    if trek is None:
        return jsonify({
            "success": False,
            "message": "Open trek not found"
        }), 404

    result = {
        "success": True,
        "trek": dict(trek),
        "cache": "MISS",
    }
    set_json_cache(cache_key, result, ttl=120)
    return jsonify(result)


@trekker_bp.post("/treks/<int:trek_id>/book")
@jwt_required()
@role_required("Trekker")
def book_trek(trek_id):
    user_id = int(get_jwt_identity())
    connection = get_db_connection()

    try:
        connection.execute("BEGIN IMMEDIATE")

        user = connection.execute(
            """
            SELECT id, role, is_active, is_blacklisted
            FROM users
            WHERE id = ?
            """,
            (user_id,)
        ).fetchone()

        if user is None:
            connection.rollback()
            connection.close()
            return jsonify({"success": False, "message": "User not found"}), 404

        if user["role"] != "Trekker" or not user["is_active"] or user["is_blacklisted"]:
            connection.rollback()
            connection.close()
            return jsonify({
                "success": False,
                "message": "Your account is not allowed to create bookings"
            }), 403

        trek = connection.execute(
            "SELECT * FROM treks WHERE id = ?",
            (trek_id,)
        ).fetchone()

        if trek is None:
            connection.rollback()
            connection.close()
            return jsonify({"success": False, "message": "Trek not found"}), 404

        if trek["status"] != "Open":
            connection.rollback()
            connection.close()
            return jsonify({
                "success": False,
                "message": "Only Open treks can be booked"
            }), 400

        if trek["start_date"]:
            try:
                if date.fromisoformat(trek["start_date"]) < date.today():
                    connection.rollback()
                    connection.close()
                    return jsonify({
                        "success": False,
                        "message": "Past treks cannot be booked"
                    }), 400
            except ValueError:
                connection.rollback()
                connection.close()
                return jsonify({
                    "success": False,
                    "message": "Trek has an invalid start date"
                }), 500

        if trek["available_slots"] <= 0:
            connection.rollback()
            connection.close()
            return jsonify({
                "success": False,
                "message": "No slots are available for this trek"
            }), 409

        existing_booking = connection.execute(
            """
            SELECT id
            FROM bookings
            WHERE user_id = ?
              AND trek_id = ?
              AND status = 'Booked'
            """,
            (user_id, trek_id)
        ).fetchone()

        if existing_booking:
            connection.rollback()
            connection.close()
            return jsonify({
                "success": False,
                "message": "You have already booked this trek"
            }), 409

        cursor = connection.execute(
            """
            INSERT INTO bookings
            (user_id, trek_id, status, payment_status)
            VALUES (?, ?, 'Booked', 'Pending')
            """,
            (user_id, trek_id)
        )

        slot_update = connection.execute(
            """
            UPDATE treks
            SET available_slots = available_slots - 1
            WHERE id = ?
              AND status = 'Open'
              AND available_slots > 0
            """,
            (trek_id,)
        )

        if slot_update.rowcount != 1:
            connection.rollback()
            connection.close()
            return jsonify({
                "success": False,
                "message": "No slots are available for this trek"
            }), 409

        connection.commit()
        booking_id = cursor.lastrowid
        connection.close()

        return jsonify({
            "success": True,
            "message": "Trek booked successfully",
            "booking_id": booking_id,
        }), 201

    except sqlite3.IntegrityError:
        connection.rollback()
        connection.close()
        return jsonify({
            "success": False,
            "message": "You already have an active booking for this trek"
        }), 409

    except Exception as error:
        connection.rollback()
        connection.close()
        return jsonify({
            "success": False,
            "message": f"Booking failed: {error}"
        }), 500


@trekker_bp.get("/bookings")
@jwt_required()
@role_required("Trekker")
def my_bookings():
    user_id = int(get_jwt_identity())
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
        JOIN treks t ON t.id = b.trek_id
        WHERE b.user_id = ?
          AND b.status = 'Booked'
        ORDER BY t.start_date ASC, b.id DESC
        """,
        (user_id,)
    ).fetchall()
    connection.close()

    return jsonify({
        "success": True,
        "bookings": [dict(row) for row in bookings]
    })


@trekker_bp.patch("/bookings/<int:booking_id>/cancel")
@jwt_required()
@role_required("Trekker")
def cancel_booking(booking_id):
    user_id = int(get_jwt_identity())
    connection = get_db_connection()

    try:
        connection.execute("BEGIN IMMEDIATE")

        booking = connection.execute(
            """
            SELECT b.*, t.status AS trek_status
            FROM bookings b
            JOIN treks t ON t.id = b.trek_id
            WHERE b.id = ?
              AND b.user_id = ?
            """,
            (booking_id, user_id)
        ).fetchone()

        if booking is None:
            connection.rollback()
            connection.close()
            return jsonify({"success": False, "message": "Booking not found"}), 404

        if booking["status"] != "Booked":
            connection.rollback()
            connection.close()
            return jsonify({
                "success": False,
                "message": "Only active bookings can be cancelled"
            }), 400

        if booking["trek_status"] in {"Ongoing", "Completed"}:
            connection.rollback()
            connection.close()
            return jsonify({
                "success": False,
                "message": "Ongoing or completed trek booking cannot be cancelled"
            }), 400

        connection.execute(
            "UPDATE bookings SET status = 'Cancelled' WHERE id = ?",
            (booking_id,)
        )

        connection.execute(
            """
            UPDATE treks
            SET available_slots = CASE
                WHEN available_slots < total_slots THEN available_slots + 1
                ELSE total_slots
            END
            WHERE id = ?
            """,
            (booking["trek_id"],)
        )

        connection.commit()
        connection.close()

        return jsonify({
            "success": True,
            "message": "Booking cancelled successfully"
        })

    except Exception as error:
        connection.rollback()
        connection.close()
        return jsonify({
            "success": False,
            "message": f"Cancellation failed: {error}"
        }), 500


@trekker_bp.get("/history")
@jwt_required()
@role_required("Trekker")
def trekking_history():
    user_id = int(get_jwt_identity())
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
        JOIN treks t ON t.id = b.trek_id
        WHERE b.user_id = ?
        ORDER BY b.booking_date DESC, b.id DESC
        """,
        (user_id,)
    ).fetchall()
    connection.close()

    return jsonify({
        "success": True,
        "history": [dict(row) for row in history]
    })


@trekker_bp.get("/profile")
@jwt_required()
@role_required("Trekker")
def get_profile():
    user_id = int(get_jwt_identity())
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
            "message": "Trekker profile not found"
        }), 404

    return jsonify({"success": True, "profile": dict(user)})


@trekker_bp.put("/profile")
@jwt_required()
@role_required("Trekker")
def update_profile():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"success": False, "message": "Request body is required"}), 400

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
        return jsonify({"success": False, "message": "User not found"}), 404

    name = str(data.get("name", user["name"])).strip()
    phone = str(data.get("phone", user["phone"] or "")).strip()

    if not name:
        connection.close()
        return jsonify({"success": False, "message": "Name is required"}), 400

    connection.execute(
        """
        UPDATE users
        SET name = ?, phone = ?
        WHERE id = ?
        """,
        (name, phone, user_id)
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
        "message": "Profile updated successfully",
        "profile": dict(updated_user)
    })
