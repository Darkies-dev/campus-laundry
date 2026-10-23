import re
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
import time
from database import execute_query, execute_procedure, DatabaseTransaction, get_connection

# In-Memory Response Cache for high-performance sub-second loads
_CACHE = {}

def get_from_cache(key, ttl_seconds):
    entry = _CACHE.get(key)
    if entry and (time.time() - entry['time'] < ttl_seconds):
        return entry['data']
    return None

def set_cache(key, data):
    _CACHE[key] = {'data': data, 'time': time.time()}

def invalidate_cache(key_prefix=None):
    if key_prefix is None:
        _CACHE.clear()
    else:
        keys_to_del = [k for k in _CACHE if k.startswith(key_prefix)]
        for k in keys_to_del:
            _CACHE.pop(k, None)

laundry_bp = Blueprint("laundry", __name__, url_prefix="/api")

# Campus Policy Constants
ACADEMIC_YEAR_MONTHS = 8
TOTAL_QUOTA_CYCLES = 30
CYCLE_WEIGHT_CAP_KG = 6.0
DEFAULT_TURNAROUND_DAYS = 3

def generate_id(table, id_col, prefix=""):
    sql = f"SELECT {id_col} FROM {table} ORDER BY LENGTH({id_col}) DESC, {id_col} DESC LIMIT 1"
    row = execute_query(sql, fetchone=True)
    if not row or not row.get(id_col):
        return f"{prefix}1001" if prefix else "1001"
    curr = str(row[id_col])
    match = re.search(r'(\d+)$', curr)
    if match:
        num = int(match.group(1)) + 1
        return f"{curr[:match.start()]}{num}"
    return f"{prefix}{curr}_1"

# --- 1. Student Quota & 8-Month Academic Pace ---
@laundry_bp.route("/student/<std_id>", methods=["GET"])
def get_student_quota(std_id):
    clean_id = std_id.strip().upper()
    cache_key = f"student_{clean_id}"
    cached = get_from_cache(cache_key, ttl_seconds=15)
    if cached is not None:
        return jsonify(cached)

    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        # Execute Stored Procedure sp_GetStudentPortalData:
        # Returns 2 result sets in 1 single network round-trip:
        #   Result Set 1: Overview Cards (from vw_student_portal_overview)
        #   Result Set 2: Recent 10 Laundry Orders
        cur.callproc("sp_GetStudentPortalData", (clean_id,))
        results = [res.fetchall() for res in cur.stored_results()]

        overview = results[0][0] if results and results[0] else None
        if not overview:
            return jsonify({"success": False, "error": f"Student '{clean_id}' not found."}), 404

        recent_orders = results[1] if len(results) > 1 else []
    finally:
        cur.close()
        conn.close()

    quota = overview.get("quota") or TOTAL_QUOTA_CYCLES
    cycle_used = overview.get("cycle_used") or 0
    cycle_remaining = overview.get("cycle_remaining") or (quota - cycle_used)
    burn_percentage = float(overview.get("burn_percentage") or 0.0)
    monthly_allowance = round(quota / ACADEMIC_YEAR_MONTHS, 2)

    if cycle_remaining <= 0:
        pace_status = "Quota Exhausted"
        pace_color = "terracotta"
    elif cycle_remaining <= 5:
        pace_status = "Critical (Low Quota)"
        pace_color = "terracotta"
    elif burn_percentage > 70:
        pace_status = "Accelerated Burn"
        pace_color = "gold"
    else:
        pace_status = "Optimal Pace"
        pace_color = "sage"

    # Active wash data derived directly from the database VIEW
    clean_active = None
    if overview.get("active_transaction_id"):
        clean_active = {
            "Transaction_ID": overview["active_transaction_id"],
            "Status": overview["active_status"],
            "Total_Weight": float(overview["active_total_weight"]) if overview.get("active_total_weight") is not None else 0.0,
            "Drop_Point_ID": overview["active_drop_point_id"],
            "drop_point_location": overview["active_drop_point_location"],
            "Drop_Off_Date": overview["active_drop_off_date"].isoformat() if hasattr(overview.get("active_drop_off_date"), "isoformat") else overview.get("active_drop_off_date"),
            "Expected_Completion_Date": overview["active_expected_completion_date"].isoformat() if hasattr(overview.get("active_expected_completion_date"), "isoformat") else overview.get("active_expected_completion_date")
        }

    # Sanitize Decimal/Date for JSON serialization
    clean_orders = []
    for r in recent_orders:
        item = {}
        for k, v in r.items():
            if hasattr(v, "isoformat"):
                item[k] = v.isoformat()
            elif hasattr(v, "__float__") and not isinstance(v, (int, float)):
                item[k] = float(v)
            else:
                item[k] = v
        clean_orders.append(item)

    response_data = {
        "success": True,
        "view_source": "vw_student_portal_overview",
        "student": {
            "std_id": overview["std_id"],
            "std_name": overview["std_name"],
            "hostel": overview["hostel"],
            "room": overview["room"],
            "contact": overview["contact"],
            "academic_year": overview["academic_year"],
            "quota": quota,
            "cycle_used": cycle_used,
            "cycle_remaining": cycle_remaining,
            "burn_percentage": burn_percentage,
            "academic_policy": {
                "academic_months": ACADEMIC_YEAR_MONTHS,
                "recommended_monthly_burn": monthly_allowance,
                "cycle_weight_cap_kg": CYCLE_WEIGHT_CAP_KG,
                "pace_status": pace_status,
                "pace_color": pace_color
            }
        },
        "recent_orders": clean_orders,
        "active_order": clean_active,
        "can_submit_new": cycle_remaining > 0
    }
    set_cache(cache_key, response_data)
    return jsonify(response_data)

# --- 1b. Register Student with Registration Number ---
@laundry_bp.route("/students", methods=["POST"])
def register_student():
    data = request.get_json() or {}
    std_id = (data.get("std_id") or "").strip().upper()
    std_name = (data.get("std_name") or "").strip()
    hostel = (data.get("hostel") or "").strip()
    room = str(data.get("room") or "").strip()
    contact = (data.get("contact") or "").strip()
    
    # Auto-detect Academic Year from first 2 digits (e.g. 25 -> 2nd Year, 26 -> 1st Year, 24 -> 3rd Year)
    auto_year = "2nd Year"
    if len(std_id) >= 2 and std_id[:2].isdigit():
        prefix = int(std_id[:2])
        year_map = {26: "1st Year", 25: "2nd Year", 24: "3rd Year", 23: "4th Year"}
        auto_year = year_map.get(prefix, f"Batch 20{prefix}")

    academic_year = (data.get("academic_year") or auto_year).strip()
    quota = int(data.get("quota") or TOTAL_QUOTA_CYCLES)

    if not std_id or not std_name or not hostel or not room:
        return jsonify({"success": False, "error": "Registration Number, Full Name, Hostel, and Room are required."}), 400

    existing = execute_query("SELECT * FROM students WHERE std_id = %s", (std_id,), fetchone=True)
    if existing:
        return jsonify({"success": False, "error": f"Registration Number '{std_id}' is already registered."}), 400

    clean_contact = int(re.sub(r'\D', '', str(contact)) or 0)
    execute_query(
        """
        INSERT INTO students (std_id, std_name, contact, hostel, room, academic_year, quota, cycle_used, cycle_remaining)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 0, %s)
        """,
        (std_id, std_name, clean_contact, hostel, room, academic_year, quota, quota),
        commit=True
    )
    invalidate_cache()
    return jsonify({"success": True, "message": f"Student '{std_name}' ({std_id}) registered with {quota}-cycle quota!"})

# --- 2. Kiosk Drop Point Selection ---
@laundry_bp.route("/kiosks", methods=["GET"])
def get_kiosks():
    cached = get_from_cache("kiosks", ttl_seconds=120)
    if cached is not None:
        return jsonify({"success": True, "kiosks": cached})

    kiosks = execute_query(
        """
        SELECT dp.Drop_Point_ID, dp.Location, dp.Operational_Status,
               v.Vendor_ID, v.Vendor_Name, v.Contact_No
        FROM drop_point dp
        JOIN vendor v ON dp.Vendor_ID = v.Vendor_ID
        ORDER BY dp.Operational_Status ASC, dp.Location ASC
        """,
        fetchall=True
    )
    clean = []
    for r in (kiosks or []):
        item = {}
        for k, v in r.items():
            item[k] = float(v) if hasattr(v, '__float__') and not isinstance(v, (int, float)) else v
        clean.append(item)
    set_cache("kiosks", clean)
    return jsonify({"success": True, "kiosks": clean})

# --- 3. Laundry Items & 6kg Per-Cycle Cap Specs ---
@laundry_bp.route("/items", methods=["GET"])
def get_laundry_items():
    cached = get_from_cache("items", ttl_seconds=120)
    if cached is not None:
        return jsonify(cached)

    items = execute_query(
        "SELECT Item_ID, Item_Name, Category, Standard_Weight FROM laundry_item ORDER BY Category ASC, Item_Name ASC",
        fetchall=True
    )
    clean = []
    for r in (items or []):
        item = {}
        for k, v in r.items():
            item[k] = float(v) if hasattr(v, '__float__') and not isinstance(v, (int, float)) else v
        clean.append(item)
    resp = {
        "success": True,
        "items": clean,
        "cycle_policy": {
            "standard_cap_kg": CYCLE_WEIGHT_CAP_KG,
            "turnaround_days": DEFAULT_TURNAROUND_DAYS
        }
    }
    set_cache("items", resp)
    return jsonify(resp)

# --- 4. New Drop-off Submission (Quota & Weight Calc) ---
@laundry_bp.route("/drop-off", methods=["POST"])
def submit_drop_off():
    data = request.get_json() or {}
    std_id = (data.get("std_id") or "").strip().upper()
    drop_point_id = data.get("drop_point_id")
    items_input = data.get("items", [])
    remarks = data.get("remarks", "")

    if not std_id or not drop_point_id:
        return jsonify({"success": False, "error": "Student ID and Kiosk Drop Point are required."}), 400

    # 1. Verify Student & Quota
    student = execute_query(
        "SELECT * FROM students WHERE std_id = %s",
        (std_id,),
        fetchone=True
    )
    if not student:
        return jsonify({"success": False, "error": f"Student '{std_id}' not found."}), 404

    if (student.get("cycle_remaining") or 0) < 1:
        return jsonify({
            "success": False,
            "error": "Quota exhausted! Student has 0 cycles remaining for this academic year."
        }), 400

    # 2. Verify Kiosk Drop Point & Vendor
    kiosk = execute_query(
        "SELECT * FROM drop_point WHERE Drop_Point_ID = %s",
        (str(drop_point_id),),
        fetchone=True
    )
    if not kiosk:
        return jsonify({"success": False, "error": "Invalid Kiosk Drop Point selected."}), 400

    if kiosk.get("Operational_Status") != "Active":
        return jsonify({"success": False, "error": f"Kiosk '{kiosk.get('Location')}' is currently not operational."}), 400

    vendor_id = kiosk["Vendor_ID"]

    # 3. Calculate 6kg Load Weight
    all_catalog = {
        item["Item_ID"]: float(item["Standard_Weight"])
        for item in execute_query("SELECT Item_ID, Standard_Weight FROM laundry_item", fetchall=True)
    }

    total_weight = 0.0
    clean_items = []
    for it in items_input:
        iid = str(it.get("item_id", "")).strip()
        qty = int(it.get("quantity", 0))
        if qty > 0 and iid in all_catalog:
            line_weight = round(all_catalog[iid] * qty, 2)
            total_weight += line_weight
            clean_items.append((iid, qty))

    if not clean_items:
        return jsonify({"success": False, "error": "Drop-off must contain at least one item."}), 400

    total_weight = round(total_weight, 2)

    # Weight Tier Policy:
    # - Standard target: 6.0 kg, with grace allowance up to 6.20 kg: 1 Cycle
    # - Above 6.20 kg up to 8.00 kg: 2 Cycles
    # - Above 8.00 kg: Rejected (Hard cap for single wash)
    if total_weight > 8.00:
        return jsonify({
            "success": False,
            "error": f"Bag weight ({total_weight} kg) exceeds the maximum allowed single wash limit of 8.0 kg! Please remove some clothes."
        }), 400

    cycles_to_deduct = 2 if total_weight > 6.20 else 1

    if (student.get("cycle_remaining") or 0) < cycles_to_deduct:
        return jsonify({
            "success": False,
            "error": f"This load ({total_weight} kg) requires {cycles_to_deduct} cycles because it crosses 6.2 kg, but you only have {student.get('cycle_remaining', 0)} cycle(s) remaining."
        }), 400

    # 4. Turnaround Date Calculation based on Submission Day:
    # - Mon (0), Tue (1), Wed (2), Thu (3), Sun (6): 2-3 Days Turnaround (3 days delivery)
    # - Fri (4), Sat (5): 3-5 Days Turnaround due to peak weekend load (5 days delivery)
    now = datetime.now()
    weekday = now.weekday()  # Monday is 0, Sunday is 6
    is_weekend_rush = weekday in (4, 5)  # Friday or Saturday
    turnaround_days = 5 if is_weekend_rush else 3
    turnaround_label = "3-5 Days (Fri/Sat Weekend Peak)" if is_weekend_rush else "2-3 Days (Mon-Thu Standard)"

    drop_off_date = now.strftime("%Y-%m-%d")
    expected_completion = (now + timedelta(days=turnaround_days)).strftime("%Y-%m-%d")

    # Generate new Transaction ID
    txn_id = generate_id("laundry_transaction", "Transaction_ID", prefix="TXN")

    # 5. Atomic Multi-Statement Execution
    with DatabaseTransaction() as tx:
        # Create Transaction
        tx.execute(
            """
            INSERT INTO laundry_transaction 
            (Transaction_ID, std_id, Drop_Point_ID, Vendor_ID, Drop_Off_Date, Expected_Completion_Date, Total_Weight, Cycles_Deducted, Status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (txn_id, std_id, str(drop_point_id), str(vendor_id), drop_off_date, expected_completion, total_weight, cycles_to_deduct, "Submitted")
        )

        # Insert Transaction Items
        for iid, qty in clean_items:
            tx.execute(
                "INSERT INTO transaction_item (Transaction_ID, Item_ID, Quantity) VALUES (%s, %s, %s)",
                (txn_id, iid, qty)
            )

        # Deduct Cycle from Student
        tx.execute(
            """
            UPDATE students 
            SET cycle_used = cycle_used + %s,
                cycle_remaining = GREATEST(0, cycle_remaining - %s)
            WHERE std_id = %s
            """,
            (cycles_to_deduct, cycles_to_deduct, std_id)
        )

    # Return Result
    updated_student = execute_query("SELECT cycle_remaining, cycle_used, quota FROM students WHERE std_id = %s", (std_id,), fetchone=True)
    invalidate_cache()

    return jsonify({
        "success": True,
        "message": f"Drop-off #{txn_id} accepted successfully! {cycles_to_deduct} cycle(s) deducted ({total_weight} kg). Expected: {turnaround_label}.",
        "transaction": {
            "transaction_id": txn_id,
            "std_id": std_id,
            "drop_point": kiosk["Location"],
            "total_weight": total_weight,
            "weight_cap_kg": 8.0,
            "is_overweight": total_weight > 8.0,
            "drop_off_date": drop_off_date,
            "expected_completion_date": expected_completion,
            "turnaround_days": turnaround_days,
            "turnaround_label": turnaround_label,
            "cycles_deducted": cycles_to_deduct,
            "status": "Submitted"
        },
        "student_quota": updated_student
    })

# --- 5. Transactions History & Tracker ---
@laundry_bp.route("/transactions", methods=["GET"])
def get_transactions():
    status = request.args.get("status")
    std_id = request.args.get("std_id")
    search = request.args.get("search")

    sql = """
        SELECT t.*, s.std_name, s.hostel, s.room, s.contact,
               dp.Location as drop_point_location, v.Vendor_Name as vendor_name
        FROM laundry_transaction t
        JOIN students s ON t.std_id = s.std_id
        JOIN drop_point dp ON t.Drop_Point_ID = dp.Drop_Point_ID
        JOIN vendor v ON t.Vendor_ID = v.Vendor_ID
        WHERE 1=1
    """
    params = []
    if status and status != "All":
        sql += " AND t.Status = %s"
        params.append(status)
    if std_id:
        sql += " AND t.std_id = %s"
        params.append(std_id.strip().upper())
    if search:
        sql += " AND (t.Transaction_ID LIKE %s OR t.std_id LIKE %s OR s.std_name LIKE %s)"
        pat = f"%{search}%"
        params.extend([pat, pat, pat])

    sql += " ORDER BY t.Drop_Off_Date DESC"
    txns = execute_query(sql, params, fetchall=True)

    return jsonify({"success": True, "transactions": txns or []})

@laundry_bp.route("/transactions/<txn_id>", methods=["GET"])
def get_transaction_detail(txn_id):
    txn = execute_query(
        """
        SELECT t.*, s.std_name, s.hostel, s.room, s.contact as student_contact,
               s.cycle_remaining, s.quota,
               dp.Location as drop_point_location, dp.Operational_Status as drop_point_status,
               v.Vendor_Name as vendor_name, v.Contact_No as vendor_contact
        FROM laundry_transaction t
        JOIN students s ON t.std_id = s.std_id
        JOIN drop_point dp ON t.Drop_Point_ID = dp.Drop_Point_ID
        JOIN vendor v ON t.Vendor_ID = v.Vendor_ID
        WHERE t.Transaction_ID = %s
        """,
        (str(txn_id),),
        fetchone=True
    )
    if not txn:
        return jsonify({"success": False, "error": "Transaction not found."}), 404

    items = execute_query(
        """
        SELECT ti.Quantity, li.Item_ID, li.Item_Name, li.Category, li.Standard_Weight,
               ROUND(ti.Quantity * li.Standard_Weight, 2) as line_weight
        FROM transaction_item ti
        JOIN laundry_item li ON ti.Item_ID = li.Item_ID
        WHERE ti.Transaction_ID = %s
        ORDER BY li.Item_Name ASC
        """,
        (str(txn_id),),
        fetchall=True
    )
    txn["items"] = items or []
    return jsonify({"success": True, "transaction": txn})

# --- 6. Status Updater (Triggers handle completion date & cancellation cycle refunds) ---
@laundry_bp.route("/transactions/<txn_id>/status", methods=["PATCH"])
def update_status(txn_id):
    data = request.get_json() or {}
    new_status = data.get("status")
    valid_statuses = ["Submitted", "In Wash", "Ready for Pickup", "Completed", "Cancelled"]
    if new_status not in valid_statuses:
        return jsonify({"success": False, "error": f"Invalid status: {new_status}"}), 400

    txn = execute_query(
        "SELECT * FROM laundry_transaction WHERE Transaction_ID = %s",
        (str(txn_id),),
        fetchone=True
    )
    if not txn:
        return jsonify({"success": False, "error": "Transaction not found."}), 404

    old_status = txn["Status"]
    if old_status == new_status:
        return jsonify({"success": True, "message": "Status unchanged."})

    # Execute status update. MySQL trigger `trg_before_update_laundry_txn` automatically:
    # 1. Stamps Actual_Completion_Date when moved to 'Ready for Pickup' or 'Completed'
    # 2. Refunds cycle_remaining on students table when moved to 'Cancelled'
    execute_query(
        "UPDATE laundry_transaction SET Status = %s WHERE Transaction_ID = %s",
        (new_status, str(txn_id)),
        commit=True
    )
    invalidate_cache()

    return jsonify({"success": True, "message": f"Transaction #{txn_id} status updated to '{new_status}'."})

# --- 7. Campus Dashboard Overview (Powered by sp_GetHostelDashboardMetrics) ---
@laundry_bp.route("/dashboard", methods=["GET"])
def get_dashboard_metrics():
    cached = get_from_cache("dashboard", ttl_seconds=8)
    if cached is not None:
        return jsonify(cached)

    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.callproc("sp_GetHostelDashboardMetrics")
        rows = []
        for res in cur.stored_results():
            rows.extend(res.fetchall())
        proc_metrics = rows[0] if rows else {}

        cur.execute(
            """
            SELECT t.*, s.std_name, s.hostel, s.room, dp.Location as drop_point_location
            FROM laundry_transaction t
            JOIN students s ON t.std_id = s.std_id
            JOIN drop_point dp ON t.Drop_Point_ID = dp.Drop_Point_ID
            WHERE t.Status NOT IN ('Completed', 'Cancelled')
            ORDER BY t.Drop_Off_Date DESC, t.Transaction_ID DESC
            LIMIT 20
            """
        )
        recent_txns = cur.fetchall() or []
    finally:
        cur.close()
        conn.close()

    total_txns = int(proc_metrics.get("total_transactions") or 0)
    active_loads = int(proc_metrics.get("active_loads") or 0)
    completed_loads = int(proc_metrics.get("completed_loads") or 0)
    total_students = int(proc_metrics.get("total_students") or 0)
    active_kiosks = int(proc_metrics.get("active_kiosks") or 0)
    total_used = int(proc_metrics.get("total_cycles_used") or 0)
    total_quota = int(proc_metrics.get("total_campus_quota") or 1)
    utilization_rate = round((float(total_used) / float(total_quota)) * 100, 1) if total_quota else 0

    clean_txns = []
    for r in recent_txns:
        item = {}
        for k, v in r.items():
            if hasattr(v, "isoformat"):
                item[k] = v.isoformat()
            elif hasattr(v, "__float__") and not isinstance(v, (int, float)):
                item[k] = float(v)
            else:
                item[k] = v
        clean_txns.append(item)

    response_data = {
        "success": True,
        "metrics": {
            "active_loads": active_loads,
            "total_transactions": total_txns,
            "completed_loads": completed_loads,
            "total_students": total_students,
            "active_kiosks": active_kiosks,
            "total_cycles_used": total_used,
            "total_campus_quota": total_quota,
            "utilization_rate": utilization_rate,
            "academic_year_months": ACADEMIC_YEAR_MONTHS,
            "cycle_weight_cap_kg": CYCLE_WEIGHT_CAP_KG,
            "default_turnaround_days": DEFAULT_TURNAROUND_DAYS
        },
        "recent_transactions": clean_txns
    }
    set_cache("dashboard", response_data)
    return jsonify(response_data)


# --- 8. Standalone Annual / Semester Quota Reset ---
@laundry_bp.route("/admin/reset-quota", methods=["POST"])
def reset_annual_quota():
    data = request.get_json() or {}
    new_quota = int(data.get("quota") or TOTAL_QUOTA_CYCLES)
    
    # Standalone parameterized UPDATE query
    execute_query(
        """
        UPDATE students
        SET quota = %s,
            cycle_remaining = %s,
            cycle_used = 0
        """,
        (new_quota, new_quota),
        commit=True
    )
    invalidate_cache()
    return jsonify({
        "success": True,
        "message": f"All student quotas successfully reset to {new_quota} cycles (0 used)."
    })
