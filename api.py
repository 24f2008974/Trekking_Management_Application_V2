from flask import Blueprint, jsonify
from flask_jwt_extended import (
    get_jwt,
    get_jwt_identity,
    jwt_required
)

from auth import role_required
from db import get_db_connection


api_bp = Blueprint(
    "api",
    __name__,
    url_prefix="/api"
)


# ---------------------------------------------------------
# BASIC API TEST
# ---------------------------------------------------------

@api_bp.get("/test")
def api_test():

    return jsonify({
        "success": True,
        "message": "Main API is working"
    })


# ---------------------------------------------------------
# AUTHENTICATED TEST
# ---------------------------------------------------------

@api_bp.get("/protected")
@jwt_required()
def protected_test():

    user_id = get_jwt_identity()

    claims = get_jwt()

    return jsonify({
        "success": True,
        "message": "Authentication successful",
        "user_id": user_id,
        "role": claims.get("role")
    })


# ---------------------------------------------------------
# ADMIN TEST
# ---------------------------------------------------------

@api_bp.get("/admin/test")
@jwt_required()
@role_required("Admin")
def admin_test():

    return jsonify({
        "success": True,
        "message": "Admin access confirmed"
    })


# ---------------------------------------------------------
# STAFF TEST
# ---------------------------------------------------------

@api_bp.get("/staff/test")
@jwt_required()
@role_required("Staff")
def staff_test():

    return jsonify({
        "success": True,
        "message": "Staff access confirmed"
    })


# ---------------------------------------------------------
# TREKKER TEST
# ---------------------------------------------------------

@api_bp.get("/trekker/test")
@jwt_required()
@role_required("Trekker")
def trekker_test():

    return jsonify({
        "success": True,
        "message": "Trekker access confirmed"
    })


# ---------------------------------------------------------
# ADMIN DATABASE STATS TEST
# ---------------------------------------------------------

@api_bp.get("/database/stats")
@jwt_required()
@role_required("Admin")
def database_stats():

    connection = get_db_connection()

    users_count = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM users
        """
    ).fetchone()["count"]

    staff_count = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM users
        WHERE role = 'Staff'
        """
    ).fetchone()["count"]

    trekkers_count = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM users
        WHERE role = 'Trekker'
        """
    ).fetchone()["count"]

    treks_count = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM treks
        """
    ).fetchone()["count"]

    bookings_count = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM bookings
        """
    ).fetchone()["count"]

    connection.close()

    return jsonify({
        "success": True,
        "stats": {
            "users": users_count,
            "staff": staff_count,
            "trekkers": trekkers_count,
            "treks": treks_count,
            "bookings": bookings_count
        }
    })