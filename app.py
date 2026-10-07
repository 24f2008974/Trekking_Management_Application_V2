from flask import Flask, jsonify, render_template

from db import init_db
from auth import auth_bp
from api import api_bp


def create_app():

    app = Flask(__name__)

    app.config["SECRET_KEY"] = "change-this-secret-key-before-production"

    # Initialize database programmatically
    init_db()

    # Register API blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)

    @app.route("/")
    def index():
        return render_template("index.html")

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
    