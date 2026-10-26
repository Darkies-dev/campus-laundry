"""
Admin Authentication Routes
Handles login, logout, and session verification for hostel admin users.
"""

import bcrypt
from flask import Blueprint, request, jsonify, make_response
from database import execute_procedure, execute_query
from auth_middleware import create_session, get_session, destroy_session, require_admin

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/login", methods=["POST"])
def admin_login():
    """
    Authenticate an admin user against the admin_users table.
    Uses sp_AuthenticateAdmin stored procedure + bcrypt password verification.
    """
    data = request.get_json() or {}
    username = (data.get("username") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"success": False, "error": "Username and password are required."}), 400

    # Call stored procedure to fetch admin record
    rows = execute_procedure("sp_AuthenticateAdmin", (username,))

    if not rows:
        return jsonify({"success": False, "error": "Invalid username or password."}), 401

    admin = rows[0]
    stored_hash = admin["password_hash"]

    # Verify password with bcrypt
    if not bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8")):
        return jsonify({"success": False, "error": "Invalid username or password."}), 401

    # Update last_login timestamp
    execute_query(
        "UPDATE admin_users SET last_login = NOW() WHERE admin_id = %s",
        (admin["admin_id"],),
        commit=True
    )

    # Create server-side session
    token = create_session(admin)

    response = make_response(jsonify({
        "success": True,
        "message": f"Welcome, {admin['full_name']}.",
        "admin": {
            "admin_id": admin["admin_id"],
            "username": admin["username"],
            "full_name": admin["full_name"],
            "role": admin["role"],
        },
        "token": token,
    }))

    # Set session cookie (httponly for security)
    response.set_cookie(
        "admin_session",
        token,
        httponly=True,
        samesite="Lax",
        max_age=86400,  # 24 hours
    )

    return response


@auth_bp.route("/me", methods=["GET"])
def check_session():
    """Check if the current session is valid. Used by frontend on page load."""
    token = None

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]

    if not token:
        token = request.cookies.get("admin_session")

    if not token:
        return jsonify({"success": False, "authenticated": False}), 401

    session = get_session(token)
    if not session:
        return jsonify({"success": False, "authenticated": False}), 401

    return jsonify({
        "success": True,
        "authenticated": True,
        "admin": session,
    })


@auth_bp.route("/logout", methods=["POST"])
def admin_logout():
    """Destroy the current admin session."""
    token = None

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]

    if not token:
        token = request.cookies.get("admin_session")

    if token:
        destroy_session(token)

    response = make_response(jsonify({"success": True, "message": "Logged out."}))
    response.delete_cookie("admin_session")
    return response
