import os
from flask import Flask, jsonify
from flask_cors import CORS
from routes.laundry_routes import laundry_bp
from routes.admin_mgmt_routes import admin_mgmt_bp

def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "campus-laundry-secure-key-2026")

    # Enable CORS for Next.js frontend (default dev port 3000)
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Register API Blueprints
    app.register_blueprint(laundry_bp)
    app.register_blueprint(admin_mgmt_bp)

    @app.route("/")
    def health_check():
        return jsonify({
            "service": "CampusLaundry Backend API",
            "status": "Online",
            "version": "1.0.0",
            "policies": {
                "academic_months": 8,
                "quota_cycles": 30,
                "cycle_weight_cap_kg": 6.0,
                "turnaround_days": 3
            }
        })

    @app.errorhandler(404)
    def handle_not_found(e):
        return jsonify({"success": False, "error": "Endpoint not found."}), 404

    @app.errorhandler(500)
    def handle_server_error(e):
        return jsonify({"success": False, "error": "Internal server error."}), 500

    return app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f">> Starting CampusLaundry Flask API Server on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
