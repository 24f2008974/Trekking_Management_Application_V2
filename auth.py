import re
import sqlite3

from functools import wraps

from flask import (
    Blueprint,
    jsonify,
    request
)

from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
)

from werkzeug.security import (
    check_password_hash,
    generate_password_hash
)

from db import get_db_connection


auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth"
)


EMAIL_PATTERN = re.compile(
    r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
)


# =========================================================
# REGISTER TREKKER
# =========================================================

@auth_bp.post("/register")
def register():
    """
    Public self-registration.

    Every public registration is always a Trekker.
    """

    data = request.get_json(
        silent=True
    )


    if not data:

        return jsonify({
            "success": False,
            "message":
                "Request body is required"
        }), 400


    name = str(
        data.get(
            "name",
            ""
        )
    ).strip()


    email = str(
        data.get(
            "email",
            ""
        )
    ).strip().lower()


    password = str(
        data.get(
            "password",
            ""
        )
    )


    phone = str(
        data.get(
            "phone",
            ""
        )
    ).strip()


    if not name:

        return jsonify({
            "success": False,
            "message":
                "Name is required"
        }), 400


    if (
        not email
        or
        not EMAIL_PATTERN.match(
            email
        )
    ):

        return jsonify({
            "success": False,
            "message":
                "A valid email is required"
        }), 400


    if len(password) < 6:

        return jsonify({
            "success": False,
            "message":
                "Password must contain at least 6 characters"
        }), 400


    connection = get_db_connection()


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

            VALUES (
                ?,
                ?,
                ?,
                ?,
                'Trekker',
                1,
                0
            )
            """,
            (
                name,
                email,
                generate_password_hash(
                    password
                ),
                phone
            )
        )


        connection.commit()


        user_id = (
            cursor.lastrowid
        )


    except sqlite3.IntegrityError:

        connection.rollback()

        connection.close()


        return jsonify({
            "success": False,
            "message":
                "Email already registered"
        }), 409


    connection.close()


    return jsonify({

        "success": True,

        "message":
            "Trekker registered successfully",

        "user": {

            "id":
                user_id,

            "name":
                name,

            "email":
                email,

            "phone":
                phone,

            "role":
                "Trekker"
        }

    }), 201


# =========================================================
# LOGIN
# =========================================================

@auth_bp.post("/login")
def login():
    """
    Authenticate Admin, Staff or Trekker
    and return JWT access token.
    """

    data = request.get_json(
        silent=True
    )


    if not data:

        return jsonify({
            "success": False,
            "message":
                "Request body is required"
        }), 400


    email = str(
        data.get(
            "email",
            ""
        )
    ).strip().lower()


    password = str(
        data.get(
            "password",
            ""
        )
    )


    if (
        not email
        or
        not password
    ):

        return jsonify({
            "success": False,
            "message":
                "Email and password are required"
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


    if (
        user is None
        or
        not check_password_hash(
            user["password"],
            password
        )
    ):

        return jsonify({
            "success": False,
            "message":
                "Invalid email or password"
        }), 401


    if not user["is_active"]:

        return jsonify({
            "success": False,
            "message":
                "Your account is inactive"
        }), 403


    if user["is_blacklisted"]:

        return jsonify({
            "success": False,
            "message":
                "Your account has been blacklisted"
        }), 403


    access_token = create_access_token(

        identity=str(
            user["id"]
        ),

        additional_claims={

            "role":
                user["role"],

            "name":
                user["name"]
        }
    )


    return jsonify({

        "success": True,

        "message":
            "Login successful",

        "access_token":
            access_token,

        "user": {

            "id":
                user["id"],

            "name":
                user["name"],

            "email":
                user["email"],

            "phone":
                user["phone"],

            "role":
                user["role"]
        }
    })


# =========================================================
# CURRENT USER
# =========================================================

@auth_bp.get("/me")
@jwt_required()
def current_user():
    """
    Return current authenticated user
    only if account is still valid.
    """

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
        """,
        (user_id,)
    ).fetchone()


    connection.close()


    if user is None:

        return jsonify({
            "success": False,
            "message":
                "User not found"
        }), 404


    if not user["is_active"]:

        return jsonify({
            "success": False,
            "message":
                "Your account is inactive"
        }), 403


    if user["is_blacklisted"]:

        return jsonify({
            "success": False,
            "message":
                "Your account has been blacklisted"
        }), 403


    return jsonify({
        "success": True,
        "user":
            dict(user)
    })


# =========================================================
# LOGOUT
# =========================================================

@auth_bp.post("/logout")
@jwt_required()
def logout():

    return jsonify({
        "success": True,
        "message":
            "Logout successful"
    })


# =========================================================
# ROLE BASED ACCESS CONTROL
# =========================================================

def role_required(
    *allowed_roles
):
    """
    Restrict endpoint to:

    1. Existing user
    2. Active user
    3. Non-blacklisted user
    4. Allowed role

    Account state is checked from SQLite on every
    protected role request.

    Therefore if Admin deactivates/blacklists a user,
    even an already-issued JWT immediately stops working.
    """

    def decorator(
        function
    ):

        @wraps(function)
        def decorated_function(
            *args,
            **kwargs
        ):

            user_id = int(
                get_jwt_identity()
            )


            connection = (
                get_db_connection()
            )


            user = connection.execute(
                """
                SELECT
                    role,
                    is_active,
                    is_blacklisted

                FROM users

                WHERE id = ?
                """,
                (user_id,)
            ).fetchone()


            connection.close()


            if user is None:

                return jsonify({
                    "success": False,
                    "message":
                        "User not found"
                }), 401


            if not user[
                "is_active"
            ]:

                return jsonify({
                    "success": False,
                    "message":
                        "Your account is inactive"
                }), 403


            if user[
                "is_blacklisted"
            ]:

                return jsonify({
                    "success": False,
                    "message":
                        "Your account has been blacklisted"
                }), 403


            if (
                user["role"]
                not in
                allowed_roles
            ):

                return jsonify({
                    "success": False,
                    "message":
                        "Access denied"
                }), 403


            return function(
                *args,
                **kwargs
            )


        return decorated_function


    return decorator