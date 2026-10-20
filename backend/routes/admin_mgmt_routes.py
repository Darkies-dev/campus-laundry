"""
Admin Data Management Blueprint
Allows the Hostel Admin / Staff to perform Full CRUD (Create, Read, Update, Delete)
across core campus tables:
1. students
2. vendor
3. drop_point
4. laundry_item
5. laundry_transaction
6. transaction_item
"""

from flask import Blueprint, request, jsonify
from database import execute_query, DatabaseTransaction
from datetime import datetime, timedelta

admin_mgmt_bp = Blueprint("admin_mgmt", __name__, url_prefix="/api/admin/tables")

ALLOWED_TABLES = [
    "students",
    "vendor",
    "drop_point",
    "laundry_item",
    "laundry_transaction",
    "transaction_item"
]

PRIMARY_KEYS = {
    "students": "std_id",
    "vendor": "Vendor_ID",
    "drop_point": "Drop_Point_ID",
    "laundry_item": "Item_ID",
    "laundry_transaction": "Transaction_ID",
    "transaction_item": "Transaction_ID",
}

# -------------------------------------------------------------
# 1. GET ALL RECORDS
# -------------------------------------------------------------
@admin_mgmt_bp.route("/<table_name>", methods=["GET"])
def get_table_records(table_name):
    """Retrieve all rows for a given database table."""
    if table_name not in ALLOWED_TABLES:
        return jsonify({"success": False, "error": f"Table '{table_name}' is not allowed or does not exist."}), 400

    try:
        rows = execute_query(f"SELECT * FROM {table_name}", fetchall=True)
        
        clean_rows = []
        for r in (rows or []):
            item = {}
            for k, v in r.items():
                if hasattr(v, "isoformat"):
                    item[k] = v.isoformat()
                elif hasattr(v, "__float__") and not isinstance(v, (int, float)):
                    item[k] = float(v)
                else:
                    item[k] = v
            clean_rows.append(item)

        return jsonify({
            "success": True,
            "table": table_name,
            "count": len(clean_rows),
            "records": clean_rows
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------------------------------------
# 2. INSERT RECORD (CREATE)
# -------------------------------------------------------------
@admin_mgmt_bp.route("/<table_name>", methods=["POST"])
def add_table_record(table_name):
    """Insert a new record into any of the 6 tables with proper validation."""
    if table_name not in ALLOWED_TABLES:
        return jsonify({"success": False, "error": f"Table '{table_name}' is not allowed."}), 400

    payload = request.get_json() or {}

    try:
        if table_name == "students":
            std_id = str(payload.get("std_id", "")).strip().upper()
            std_name = str(payload.get("std_name", "")).strip()
            contact = payload.get("contact", 9876543210)
            hostel = str(payload.get("hostel", "B1")).strip()
            room = str(payload.get("room", "")).strip()
            quota = int(payload.get("quota", 30))
            cycle_used = int(payload.get("cycle_used", 0))
            cycle_remaining = int(payload.get("cycle_remaining", quota - cycle_used))

            if not std_id or not std_name:
                return jsonify({"success": False, "error": "std_id and std_name are required."}), 400

            academic_year = payload.get("academic_year")
            if not academic_year:
                prefix = std_id[:2]
                if prefix == "26": academic_year = "1st Year"
                elif prefix == "25": academic_year = "2nd Year"
                elif prefix == "24": academic_year = "3rd Year"
                elif prefix == "23": academic_year = "4th Year"
                else: academic_year = "Undergraduate"

            execute_query(
                """
                INSERT INTO students 
                (std_id, std_name, contact, hostel, room, academic_year, quota, cycle_used, cycle_remaining)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (std_id, std_name, contact, hostel, room, academic_year, quota, cycle_used, cycle_remaining),
                commit=True
            )

        elif table_name == "vendor":
            vendor_id = str(payload.get("Vendor_ID", "")).strip()
            vendor_name = str(payload.get("Vendor_Name", "")).strip()
            contact_no = payload.get("Contact_No", 9876543210)

            if not vendor_id or not vendor_name:
                return jsonify({"success": False, "error": "Vendor_ID and Vendor_Name are required."}), 400

            execute_query(
                "INSERT INTO vendor (Vendor_ID, Vendor_Name, Contact_No) VALUES (%s, %s, %s)",
                (vendor_id, vendor_name, contact_no),
                commit=True
            )

        elif table_name == "drop_point":
            dp_id = str(payload.get("Drop_Point_ID", "")).strip()
            location = str(payload.get("Location", "")).strip()
            status = str(payload.get("Operational_Status", "Active")).strip()
            vendor_id = str(payload.get("Vendor_ID", "")).strip()

            if not dp_id or not location or not vendor_id:
                return jsonify({"success": False, "error": "Drop_Point_ID, Location, and Vendor_ID are required."}), 400

            execute_query(
                """
                INSERT INTO drop_point (Drop_Point_ID, Location, Operational_Status, Vendor_ID)
                VALUES (%s, %s, %s, %s)
                """,
                (dp_id, location, status, vendor_id),
                commit=True
            )

        elif table_name == "laundry_item":
            item_id = str(payload.get("Item_ID", "")).strip()
            item_name = str(payload.get("Item_Name", "")).strip()
            category = str(payload.get("Category", "Everyday Wear")).strip()
            std_weight = float(payload.get("Standard_Weight", 0.50))

            if not item_id or not item_name:
                return jsonify({"success": False, "error": "Item_ID and Item_Name are required."}), 400

            execute_query(
                """
                INSERT INTO laundry_item (Item_ID, Item_Name, Category, Standard_Weight)
                VALUES (%s, %s, %s, %s)
                """,
                (item_id, item_name, category, std_weight),
                commit=True
            )

        elif table_name == "laundry_transaction":
            txn_id = str(payload.get("Transaction_ID", "")).strip()
            std_id = str(payload.get("std_id", "")).strip().upper()
            dp_id = str(payload.get("Drop_Point_ID", "")).strip()
            vendor_id = str(payload.get("Vendor_ID", "")).strip()
            total_weight = float(payload.get("Total_Weight", 0.0))
            cycles_deducted = int(payload.get("Cycles_Deducted", 1))
            status = str(payload.get("Status", "Dropped")).strip()

            now = datetime.now()
            drop_date = payload.get("Drop_Off_Date") or now.strftime("%Y-%m-%d")
            comp_date = payload.get("Expected_Completion_Date") or (now + timedelta(days=3)).strftime("%Y-%m-%d")

            if not txn_id or not std_id or not dp_id or not vendor_id:
                return jsonify({"success": False, "error": "Transaction_ID, std_id, Drop_Point_ID, and Vendor_ID are required."}), 400

            execute_query(
                """
                INSERT INTO laundry_transaction
                (Transaction_ID, std_id, Drop_Point_ID, Vendor_ID, Drop_Off_Date, Expected_Completion_Date, Total_Weight, Cycles_Deducted, Status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (txn_id, std_id, dp_id, vendor_id, drop_date, comp_date, total_weight, cycles_deducted, status),
                commit=True
            )

        elif table_name == "transaction_item":
            txn_id = str(payload.get("Transaction_ID", "")).strip()
            item_id = str(payload.get("Item_ID", "")).strip()
            quantity = int(payload.get("Quantity", 1))

            if not txn_id or not item_id:
                return jsonify({"success": False, "error": "Transaction_ID and Item_ID are required."}), 400

            execute_query(
                """
                INSERT INTO transaction_item (Transaction_ID, Item_ID, Quantity)
                VALUES (%s, %s, %s)
                """,
                (txn_id, item_id, quantity),
                commit=True
            )

        return jsonify({
            "success": True,
            "message": f"Successfully inserted new record into '{table_name}'.",
            "inserted": payload
        }), 201

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


# -------------------------------------------------------------
# 3. UPDATE RECORD (PUT / PATCH)
# -------------------------------------------------------------
@admin_mgmt_bp.route("/<table_name>/<path:record_id>", methods=["PUT", "PATCH"])
def update_table_record(table_name, record_id):
    """
    Update changes to any record in students, vendor, drop_point, laundry_item, etc.
    """
    if table_name not in ALLOWED_TABLES:
        return jsonify({"success": False, "error": f"Table '{table_name}' is not allowed."}), 400

    pk_field = PRIMARY_KEYS.get(table_name)
    if not pk_field:
        return jsonify({"success": False, "error": f"No primary key defined for '{table_name}'."}), 400

    payload = request.get_json() or {}
    if not payload:
        return jsonify({"success": False, "error": "No update fields provided."}), 400

    try:
        # Check if record exists
        existing = execute_query(
            f"SELECT * FROM {table_name} WHERE {pk_field} = %s",
            (record_id,),
            fetchone=True
        )
        if not existing:
            return jsonify({"success": False, "error": f"Record with {pk_field}='{record_id}' not found in {table_name}."}), 404

        # Specific table update rules
        if table_name == "students":
            std_name = payload.get("std_name", existing["std_name"])
            contact = payload.get("contact", existing["contact"])
            hostel = payload.get("hostel", existing["hostel"])
            room = payload.get("room", existing["room"])
            academic_year = payload.get("academic_year", existing["academic_year"])
            quota = int(payload.get("quota", existing["quota"]))
            cycle_used = int(payload.get("cycle_used", existing["cycle_used"]))
            cycle_remaining = int(payload.get("cycle_remaining", quota - cycle_used))

            execute_query(
                """
                UPDATE students
                SET std_name = %s, contact = %s, hostel = %s, room = %s, academic_year = %s,
                    quota = %s, cycle_used = %s, cycle_remaining = %s
                WHERE std_id = %s
                """,
                (std_name, contact, hostel, room, academic_year, quota, cycle_used, cycle_remaining, record_id),
                commit=True
            )

        elif table_name == "vendor":
            vendor_name = payload.get("Vendor_Name", existing["Vendor_Name"])
            contact_no = payload.get("Contact_No", existing["Contact_No"])
            execute_query(
                "UPDATE vendor SET Vendor_Name = %s, Contact_No = %s WHERE Vendor_ID = %s",
                (vendor_name, contact_no, record_id),
                commit=True
            )

        elif table_name == "drop_point":
            location = payload.get("Location", existing["Location"])
            status = payload.get("Operational_Status", existing["Operational_Status"])
            vendor_id = payload.get("Vendor_ID", existing["Vendor_ID"])
            execute_query(
                "UPDATE drop_point SET Location = %s, Operational_Status = %s, Vendor_ID = %s WHERE Drop_Point_ID = %s",
                (location, status, vendor_id, record_id),
                commit=True
            )

        elif table_name == "laundry_item":
            item_name = payload.get("Item_Name", existing["Item_Name"])
            category = payload.get("Category", existing["Category"])
            std_weight = float(payload.get("Standard_Weight", existing["Standard_Weight"]))
            execute_query(
                "UPDATE laundry_item SET Item_Name = %s, Category = %s, Standard_Weight = %s WHERE Item_ID = %s",
                (item_name, category, std_weight, record_id),
                commit=True
            )

        elif table_name == "laundry_transaction":
            status = payload.get("Status", existing["Status"])
            total_weight = float(payload.get("Total_Weight", existing["Total_Weight"]))
            actual_date = payload.get("Actual_Completion_Date") or existing.get("Actual_Completion_Date")
            
            # If changing to Completed or Ready and no actual date was set, auto set today
            if status in ("Ready", "Completed") and not actual_date:
                actual_date = datetime.now().strftime("%Y-%m-%d")

            execute_query(
                "UPDATE laundry_transaction SET Status = %s, Total_Weight = %s, Actual_Completion_Date = %s WHERE Transaction_ID = %s",
                (status, total_weight, actual_date, record_id),
                commit=True
            )

        return jsonify({
            "success": True,
            "message": f"Successfully updated record in '{table_name}' where {pk_field}='{record_id}'.",
            "updated_fields": payload
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


# -------------------------------------------------------------
# 4. DELETE RECORD (DELETE)
# -------------------------------------------------------------
@admin_mgmt_bp.route("/<table_name>/<path:record_id>", methods=["DELETE"])
def delete_table_record(table_name, record_id):
    """
    Safely delete a record by its primary key.
    Handles foreign key dependencies gracefully (e.g. cascading or error feedback).
    """
    if table_name not in ALLOWED_TABLES:
        return jsonify({"success": False, "error": f"Table '{table_name}' is not allowed."}), 400

    pk_field = PRIMARY_KEYS.get(table_name)
    if not pk_field:
        return jsonify({"success": False, "error": f"No primary key defined for '{table_name}'."}), 400

    try:
        # Check record existence first
        existing = execute_query(
            f"SELECT * FROM {table_name} WHERE {pk_field} = %s",
            (record_id,),
            fetchone=True
        )
        if not existing:
            return jsonify({"success": False, "error": f"Record with {pk_field}='{record_id}' not found in {table_name}."}), 404

        # If deleting student, vendor, or drop_point, handle child dependencies
        if table_name == "students":
            # Delete student transactions or cascade
            execute_query("DELETE FROM laundry_transaction WHERE std_id = %s", (record_id,), commit=True)
            execute_query("DELETE FROM students WHERE std_id = %s", (record_id,), commit=True)

        elif table_name == "vendor":
            # Set vendor_id null or check if attached drop points
            execute_query("DELETE FROM vendor WHERE Vendor_ID = %s", (record_id,), commit=True)

        elif table_name == "drop_point":
            execute_query("DELETE FROM drop_point WHERE Drop_Point_ID = %s", (record_id,), commit=True)

        elif table_name == "laundry_item":
            execute_query("DELETE FROM transaction_item WHERE Item_ID = %s", (record_id,), commit=True)
            execute_query("DELETE FROM laundry_item WHERE Item_ID = %s", (record_id,), commit=True)

        elif table_name == "laundry_transaction":
            execute_query("DELETE FROM transaction_item WHERE Transaction_ID = %s", (record_id,), commit=True)
            execute_query("DELETE FROM laundry_transaction WHERE Transaction_ID = %s", (record_id,), commit=True)

        else:
            execute_query(f"DELETE FROM {table_name} WHERE {pk_field} = %s", (record_id,), commit=True)

        return jsonify({
            "success": True,
            "message": f"Successfully deleted record from '{table_name}' with {pk_field}='{record_id}'."
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400
