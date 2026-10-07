from functools import wraps

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash

from db import get_db_connection


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/register")
def register():
    """
    Trekker self-registration.
    Admin and Staff cannot be created through public registration.
    """

    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "success": False,
            "message": "Request body is required"
        }), 400

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    phone = data.get("phone", "").strip()

    if not name or not email or not password:
        return jsonify({
            "success": False,
            "message": "Name, email and password are required"
        }), 400

    connection = get_db_connection()

    existing_user = connection.execute(
        """
        SELECT id
        FROM users
        WHERE email = ?
        """,
        (email,)
    ).fetchone()

    if existing_user:
        connection.close()

        return jsonify({
            "success": False,
            "message": "Email already registered"
        }), 409

    from werkzeug.security import generate_password_hash

    hashed_password = generate_password_hash(password)

    cursor = connection.execute(
        """
        INSERT INTO users
        (
            name,
            email,
            password,
            phone,
            role
        )
        VALUES (?, ?, ?, ?, 'Trekker')
        """,
        (
            name,
            email,
            hashed_password,
            phone
        )
    )

    connection.commit()

    user_id = cursor.lastrowid

    connection.close()

    return jsonify({
        "success": True,
        "message": "Trekker registered successfully",
        "user": {
            "id": user_id,
            "name": name,
            "email": email,
            "role": "Trekker"
        }
    }), 201


@auth_bp.post("/login")
def login():
    """
    Login for Admin, Staff and Trekker.
    """

    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "success": False,
            "message": "Request body is required"
        }), 400

    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Email and password are required"
        }), 400

    connection = get_db_connection()

    user = connection.execute(
        """
        SELECT *
        FROM users
        WHERE email = ?
        """,
        (email,)
    ).fetchone()

    connection.close()

    if user is None:
        return jsonify({
            "success": False,
            "message": "Invalid email or password"
        }), 401

    if not user["is_active"]:
        return jsonify({
            "success": False,
            "message": "Account is inactive"
        }), 403

    if user["is_blacklisted"]:
        return jsonify({
            "success": False,
            "message": "Account is blacklisted"
        }), 403

    if not check_password_hash(user["password"], password):
        return jsonify({
            "success": False,
            "message": "Invalid email or password"
        }), 401

    session.clear()

    session["user_id"] = user["id"]
    session["role"] = user["role"]

    return jsonify({
        "success": True,
        "message": "Login successful",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        }
    })


@auth_bp.post("/logout")
def logout():
    """
    Logout the currently logged-in user.
    """

    session.clear()

    return jsonify({
        "success": True,
        "message": "Logout successful"
    })


@auth_bp.get("/me")
def current_user():
    """
    Return currently authenticated user.
    """

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Not authenticated"
        }), 401

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
        """,
        (user_id,)
    ).fetchone()

    connection.close()

    if user is None:
        session.clear()

        return jsonify({
            "success": False,
            "message": "User not found"
        }), 401

    return jsonify({
        "success": True,
        "user": dict(user)
    })


def login_required(function):
    """
    Require any authenticated user.
    """

    @wraps(function)
    def decorated_function(*args, **kwargs):

        if "user_id" not in session:
            return jsonify({
                "success": False,
                "message": "Authentication required"
            }), 401

        return function(*args, **kwargs)

    return decorated_function


def role_required(*allowed_roles):
    """
    Require authentication plus one of the specified roles.
    """

    def decorator(function):

        @wraps(function)
        def decorated_function(*args, **kwargs):

            if "user_id" not in session:
                return jsonify({
                    "success": False,
                    "message": "Authentication required"
                }), 401

            user_role = session.get("role")

            if user_role not in allowed_roles:
                return jsonify({
                    "success": False,
                    "message": "Access denied"
                }), 403

            return function(*args, **kwargs)

        return decorated_function

    return decorator