"""
Admin Authentication Middleware
Provides session-based auth for protecting admin-only API endpoints.
"""

import os
import secrets
from functools import wraps
from flask import request, jsonify

# Server-side session store: { token: { admin_id, username, full_name, role } }
_sessions = {}


def generate_session_token():
    """Generate a cryptographically secure session token."""
    return secrets.token_hex(32)


def create_session(admin_data):
    """Create a new session for an authenticated admin and return the token."""
    token = generate_session_token()
    _sessions[token] = {
        "admin_id": admin_data["admin_id"],
        "username": admin_data["username"],
        "full_name": admin_data["full_name"],
        "role": admin_data["role"],
    }
    return token


def get_session(token):
    """Retrieve session data by token. Returns None if invalid."""
    return _sessions.get(token)


def destroy_session(token):
    """Remove a session by token."""
    _sessions.pop(token, None)


def require_admin(f):
    """
    Decorator to protect admin-only routes.
    Checks for a valid session token in the Authorization header or cookie.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # Check Authorization header first: "Bearer <token>"
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

        # Fallback to cookie
        if not token:
            token = request.cookies.get("admin_session")

        if not token:
            return jsonify({"success": False, "error": "Authentication required. Please log in."}), 401

        session = get_session(token)
        if not session:
            return jsonify({"success": False, "error": "Session expired or invalid. Please log in again."}), 401

        # Attach admin info to request context
        request.admin = session
        return f(*args, **kwargs)

    return decorated
