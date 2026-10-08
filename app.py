from datetime import timedelta

from flask import (
    Flask,
    jsonify,
    render_template,
    request
)

from flask_jwt_extended import (
    JWTManager
)

from admin_api import admin_bp
from api import api_bp
from auth import auth_bp

from cache import (
    cache_health,
    invalidate_trek_cache
)

from db import init_db

from job_api import job_bp

from staff_api import staff_bp

from trekker_api import trekker_bp


def create_app():

    app = Flask(__name__)


    # =====================================================
    # APPLICATION CONFIGURATION
    # =====================================================

    app.config[
        "SECRET_KEY"
    ] = "change-this-secret-key"


    app.config[
        "JWT_SECRET_KEY"
    ] = "change-this-jwt-secret-key"


    app.config[
        "JWT_ACCESS_TOKEN_EXPIRES"
    ] = timedelta(
        hours=8
    )


    # =====================================================
    # JWT
    # =====================================================

    JWTManager(app)


    # =====================================================
    # DATABASE
    # =====================================================

    init_db()


    # =====================================================
    # BLUEPRINTS
    # =====================================================

    app.register_blueprint(
        auth_bp
    )

    app.register_blueprint(
        api_bp
    )

    app.register_blueprint(
        admin_bp
    )

    app.register_blueprint(
        staff_bp
    )

    app.register_blueprint(
        trekker_bp
    )

    app.register_blueprint(
        job_bp
    )


    # =====================================================
    # FRONTEND
    # =====================================================

    @app.route("/")
    def index():

        return render_template(
            "index.html"
        )


    # =====================================================
    # HEALTH CHECK
    # =====================================================

    @app.get("/api/health")
    def health_check():

        return jsonify({

            "success": True,

            "message":
                "Trekking Management Application API is running",

            "version":
                "2.0",

            "redis_cache":
                (
                    "connected"
                    if cache_health()
                    else "unavailable"
                )
        })


    # =====================================================
    # AUTOMATIC CACHE INVALIDATION
    # =====================================================

    @app.after_request
    def invalidate_cache_after_write(
        response
    ):

        # Only successful write operations
        if (
            request.method
            in {
                "POST",
                "PUT",
                "PATCH",
                "DELETE"
            }

            and

            200
            <=
            response.status_code
            <
            400
        ):

            path = request.path


            # ---------------------------------------------
            # ADMIN CHANGES TO TREKS
            # ---------------------------------------------

            if path.startswith(
                "/api/admin/treks"
            ):

                invalidate_trek_cache()


            # ---------------------------------------------
            # STAFF CHANGES TO TREKS
            # ---------------------------------------------

            elif path.startswith(
                "/api/staff/treks"
            ):

                invalidate_trek_cache()


            # ---------------------------------------------
            # TREKKER BOOKING AFFECTS SLOTS
            # ---------------------------------------------

            elif path.startswith(
                "/api/trekker/treks"
            ):

                invalidate_trek_cache()


            elif path.startswith(
                "/api/trekker/bookings"
            ):

                invalidate_trek_cache()


        return response


    return app


app = create_app()


if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )