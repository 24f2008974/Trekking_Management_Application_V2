from datetime import timedelta

from flask import Flask, jsonify, render_template
from flask_jwt_extended import JWTManager
from admin_api import admin_bp
from auth import auth_bp
from api import api_bp
from db import init_db


def create_app():

    app = Flask(__name__)

    # -----------------------------------------------------
    # APP CONFIGURATION
    # -----------------------------------------------------

    app.config["SECRET_KEY"] = "change-this-secret-key"

    app.config["JWT_SECRET_KEY"] = "change-this-jwt-secret-key"

    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)

    # -----------------------------------------------------
    # EXTENSIONS
    # -----------------------------------------------------

    JWTManager(app)

    # -----------------------------------------------------
    # DATABASE
    # -----------------------------------------------------

    init_db()

    # -----------------------------------------------------
    # BLUEPRINTS
    # -----------------------------------------------------

    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(admin_bp)

    # -----------------------------------------------------
    # FRONTEND ENTRY POINT
    # -----------------------------------------------------

    @app.route("/")
    def index():
        return render_template("index.html")

    # -----------------------------------------------------
    # HEALTH CHECK
    # -----------------------------------------------------

    @app.get("/api/health")
    def health_check():
        return jsonify({
            "success": True,
            "message": "Trekking Management Application API is running",
            "version": "2.0"
        })

    return app


app = create_app()


if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )