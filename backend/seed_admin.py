"""
Seed script to create the default admin user in the database.
Run this once after setting up the database schema.

Usage:
    python seed_admin.py
"""

import bcrypt
from database import execute_query


def seed_default_admin():
    """Insert the default superadmin account if it doesn't already exist."""

    username = "admin"
    password = "admin123"
    full_name = "Hostel Warden"
    role = "superadmin"

    # Check if admin already exists
    existing = execute_query(
        "SELECT admin_id FROM admin_users WHERE username = %s",
        (username,),
        fetchone=True,
    )

    if existing:
        print(f"[Seed] Admin user '{username}' already exists (ID: {existing['admin_id']}). Skipping.")
        return

    # Hash the password with bcrypt
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    execute_query(
        """
        INSERT INTO admin_users (username, password_hash, full_name, role)
        VALUES (%s, %s, %s, %s)
        """,
        (username, password_hash, full_name, role),
        commit=True,
    )

    print(f"[Seed] Default admin created — username: '{username}', password: '{password}'")


if __name__ == "__main__":
    seed_default_admin()
