import os
from pathlib import Path
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import pooling, Error as MySQLError

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

MYSQL_HOST = os.getenv("MYSQL_HOST")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", 3306))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DB = os.getenv("MYSQL_DB", "laundry")

# Initialize Connection Pool
pool = None
try:
    pool = pooling.MySQLConnectionPool(
        pool_name="campus_laundry_pool",
        pool_size=5,
        pool_reset_session=True,
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        autocommit=False
    )
    print(f"[MySQL Pool] Initialized successfully for '{MYSQL_DB}' on {MYSQL_HOST}:{MYSQL_PORT}")
except MySQLError as err:
    print(f"[MySQL Pool Error] Could not initialize pool: {err}")

def get_connection():
    """Fetches a connection from the pool."""
    global pool
    if pool is None:
        return mysql.connector.connect(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DB,
            autocommit=False
        )
    return pool.get_connection()

def execute_query(sql, params=None, fetchone=False, fetchall=False, commit=False):
    """
    Executes a parameterized SQL query safely against MySQL.
    Uses dictionary=True cursor to return results as Python dicts.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    result = None
    try:
        cursor.execute(sql, params or ())
        if commit:
            conn.commit()
            result = cursor.lastrowid or cursor.rowcount
        elif fetchone:
            result = cursor.fetchone()
        elif fetchall:
            result = cursor.fetchall()
        return result
    except MySQLError as err:
        if commit:
            conn.rollback()
        raise err
    finally:
        cursor.close()
        conn.close()

def execute_procedure(proc_name, params=None):
    """
    Executes a MySQL Stored Procedure and returns the result set rows.
    Properly consumes stored_results() so pooled connection session reset cleanly.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    rows = []
    try:
        cursor.callproc(proc_name, params or ())
        for res in cursor.stored_results():
            rows.extend(res.fetchall())
        return rows
    except MySQLError as err:
        raise err
    finally:
        cursor.close()
        conn.close()

class DatabaseTransaction:
    """
    Context manager for atomic multi-statement operations.
    Usage:
        with DatabaseTransaction() as tx:
            tx.execute(sql1, params1)
            tx.execute(sql2, params2)
    """
    def __init__(self):
        self.conn = get_connection()
        self.cursor = self.conn.cursor(dictionary=True)

    def __enter__(self):
        return self

    def execute(self, sql, params=None):
        self.cursor.execute(sql, params or ())
        return self.cursor.lastrowid or self.cursor.rowcount

    def fetchone(self, sql, params=None):
        self.cursor.execute(sql, params or ())
        return self.cursor.fetchone()

    def fetchall(self, sql, params=None):
        self.cursor.execute(sql, params or ())
        return self.cursor.fetchall()

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type is not None:
                self.conn.rollback()
                return False
            else:
                self.conn.commit()
                return True
        finally:
            self.cursor.close()
            self.conn.close()
