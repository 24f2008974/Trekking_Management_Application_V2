from flask import Blueprint, jsonify, session

from auth import login_required, role_required
from db import get_db_connection


api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/test")
def api_test():
    return jsonify({
        "success": True,
        "message": "Main API is working"
    })


@api_bp.get("/protected")
@login_required
def protected_test():
    return jsonify({
        "success": True,
        "message": "You are authenticated",
        "user_id": session["user_id"],
        "role": session["role"]
    })


@api_bp.get("/admin/test")
@role_required("Admin")
def admin_test():
    return jsonify({
        "success": True,
        "message": "Admin access confirmed",
        "role": session["role"]
    })


@api_bp.get("/staff/test")
@role_required("Staff")
def staff_test():
    return jsonify({
        "success": True,
        "message": "Staff access confirmed",
        "role": session["role"]
    })


@api_bp.get("/trekker/test")
@role_required("Trekker")
def trekker_test():
    return jsonify({
        "success": True,
        "message": "Trekker access confirmed",
        "role": session["role"]
    })


@api_bp.get("/database/stats")
@role_required("Admin")
def database_stats():

    connection = get_db_connection()

    users_count = connection.execute(
        "SELECT COUNT(*) AS count FROM users"
    ).fetchone()["count"]

    treks_count = connection.execute(
        "SELECT COUNT(*) AS count FROM treks"
    ).fetchone()["count"]

    bookings_count = connection.execute(
        "SELECT COUNT(*) AS count FROM bookings"
    ).fetchone()["count"]

    connection.close()

    return jsonify({
        "success": True,
        "stats": {
            "users": users_count,
            "treks": treks_count,
            "bookings": bookings_count
        }
    })