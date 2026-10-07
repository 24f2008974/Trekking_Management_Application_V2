from functools import wraps

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt,
    get_jwt_identity,
    jwt_required
)
from werkzeug.security import check_password_hash, generate_password_hash

from db import get_db_connection


auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth"
)


# ---------------------------------------------------------
# REGISTER TREKKER
# ---------------------------------------------------------

@auth_bp.post("/register")
def register():
    """
    Public registration endpoint.

    Only Trekkers can self-register.
    Admin and Staff are not allowed to register here.
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

    if not name:
        return jsonify({
            "success": False,
            "message": "Name is required"
        }), 400

    if not email:
        return jsonify({
            "success": False,
            "message": "Email is required"
        }), 400

    if not password:
        return jsonify({
            "success": False,
            "message": "Password is required"
        }), 400

    if len(password) < 6:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 6 characters"
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

    hashed_password = generate_password_hash(password)

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
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            name,
            email,
            hashed_password,
            phone,
            "Trekker",
            1,
            0
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
            "phone": phone,
            "role": "Trekker"
        }
    }), 201


# ---------------------------------------------------------
# LOGIN
# ---------------------------------------------------------

@auth_bp.post("/login")
def login():
    """
    Login endpoint for:
    - Admin
    - Staff
    - Trekker
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

    if not check_password_hash(
        user["password"],
        password
    ):
        return jsonify({
            "success": False,
            "message": "Invalid email or password"
        }), 401

    if not user["is_active"]:
        return jsonify({
            "success": False,
            "message": "Your account is inactive"
        }), 403

    if user["is_blacklisted"]:
        return jsonify({
            "success": False,
            "message": "Your account has been blacklisted"
        }), 403

    additional_claims = {
        "role": user["role"],
        "name": user["name"]
    }

    access_token = create_access_token(
        identity=str(user["id"]),
        additional_claims=additional_claims
    )

    return jsonify({
        "success": True,
        "message": "Login successful",
        "access_token": access_token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user["phone"],
            "role": user["role"]
        }
    })


# ---------------------------------------------------------
# CURRENT USER
# ---------------------------------------------------------

@auth_bp.get("/me")
@jwt_required()
def current_user():
    """
    Return currently authenticated user's information.
    """

    user_id = get_jwt_identity()

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
        return jsonify({
            "success": False,
            "message": "User not found"
        }), 404

    return jsonify({
        "success": True,
        "user": dict(user)
    })


# ---------------------------------------------------------
# LOGOUT
# ---------------------------------------------------------

@auth_bp.post("/logout")
@jwt_required()
def logout():
    """
    JWT tokens are stored client-side.

    Frontend logout will remove the token from localStorage.
    """

    return jsonify({
        "success": True,
        "message": "Logout successful"
    })


# ---------------------------------------------------------
# ROLE REQUIRED DECORATOR
# ---------------------------------------------------------

def role_required(*allowed_roles):
    """
    Restrict an endpoint to specific roles.

    Example:

    @jwt_required()
    @role_required("Admin")
    """

    def decorator(function):

        @wraps(function)
        def decorated_function(*args, **kwargs):

            claims = get_jwt()

            user_role = claims.get("role")

            if user_role not in allowed_roles:
                return jsonify({
                    "success": False,
                    "message": "Access denied"
                }), 403

            return function(*args, **kwargs)

        return decorated_function

    return decorator