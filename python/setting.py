"""
setting.py - Robust Python HTTPServer Backend for Settings & User Profile Management
Database: MySQL 'project' | Tables: 'registration', 'settings_tab'
Host: localhost | Port: 9007 (fallback 9010, 9008, 9009) | User: root | Password: (blank)
"""

import os
import sys
import json
import mimetypes
from urllib.parse import parse_qs, urlparse, unquote
from http.server import BaseHTTPRequestHandler, HTTPServer
import mysql.connector
from mysql.connector import Error as MySQLError
import bcrypt
import datetime
from decimal import Decimal

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "project"
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)


def json_serializer(obj):
    """JSON serializer for datetime, date, and decimal objects"""
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


def parse_cookies_dict(cookie_header):
    """Parse HTTP Cookie header into a dictionary"""
    cookies = {}
    if not cookie_header:
        return cookies
    for item in cookie_header.split(";"):
        item = item.strip()
        if "=" in item:
            k, v = item.split("=", 1)
            cookies[k.strip()] = unquote(v.strip())
    return cookies


def init_db_schema():
    """Ensure registration and settings_tab exist with proper columns and default entries."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. Ensure registration table has address & profile_picture
        cursor.execute("SHOW COLUMNS FROM registration LIKE 'address'")
        if not cursor.fetchall():
            cursor.execute("ALTER TABLE registration ADD COLUMN address TEXT NULL AFTER email")
            conn.commit()

        cursor.execute("SHOW COLUMNS FROM registration LIKE 'profile_picture'")
        if not cursor.fetchall():
            cursor.execute("ALTER TABLE registration ADD COLUMN profile_picture VARCHAR(255) NULL AFTER create_at")
            conn.commit()

        # 2. Ensure settings_tab table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings_tab (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(50) NOT NULL UNIQUE,
                setting_value TEXT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)
        conn.commit()

        # Ensure default setting rows exist if table is empty
        cursor.execute("SELECT COUNT(*) as count FROM settings_tab")
        count_row = cursor.fetchone()
        if count_row and count_row['count'] == 0:
            defaults = [
                ('store_name', 'GroceryHub'),
                ('store_address', '68,MG ROAD, RAJKOT, GUJRAT'),
                ('store_phone', '9876543212'),
                ('store_email', 'groceryhub@example.com'),
                ('currency', 'INR'),
                ('invoice_currency', 'INR'),
                ('date_format', 'DD/MM/YYYY'),
                ('notifications', 'true'),
                ('theme', 'light')
            ]
            cursor.executemany("INSERT INTO settings_tab (setting_key, setting_value) VALUES (%s, %s)", defaults)
            conn.commit()

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[DB Init Notice] {e}")


def get_single_user(user_id=None, username=None, email=None, cookies=None):
    """
    Fetch single user profile from MySQL 'registration' table dynamically.
    Priority order:
    1. Explicit user_id
    2. Explicit username
    3. Explicit email
    4. Cookies (admin_username, username, admin_id, user_id, admin_email)
    5. Active Admin account from registration table
    6. First account in registration table
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    user = None

    if user_id:
        clean_id = str(user_id).lstrip('#').strip()
        if clean_id.isdigit():
            cursor.execute("""
                SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture 
                FROM registration WHERE id = %s
            """, (int(clean_id),))
            user = cursor.fetchone()

    if not user and username:
        clean_username = str(username).lstrip('@').strip()
        cursor.execute("""
            SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture 
            FROM registration WHERE username = %s
        """, (clean_username,))
        user = cursor.fetchone()

    if not user and email:
        cursor.execute("""
            SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture 
            FROM registration WHERE email = %s
        """, (str(email).strip(),))
        user = cursor.fetchone()

    if not user and cookies:
        # Check cookies set during login (admin_username, username, admin_email, etc.)
        cookie_username = cookies.get("admin_username") or cookies.get("username")
        cookie_id = cookies.get("admin_id") or cookies.get("user_id") or cookies.get("current_user_id")
        cookie_email = cookies.get("admin_email")

        if cookie_username:
            cursor.execute("""
                SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture 
                FROM registration WHERE username = %s
            """, (cookie_username.strip(),))
            user = cursor.fetchone()

        if not user and cookie_id and str(cookie_id).lstrip('#').isdigit():
            cursor.execute("""
                SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture 
                FROM registration WHERE id = %s
            """, (int(str(cookie_id).lstrip('#')),))
            user = cursor.fetchone()

        if not user and cookie_email:
            cursor.execute("""
                SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture 
                FROM registration WHERE email = %s
            """, (cookie_email.strip(),))
            user = cursor.fetchone()

    if not user:
        # Fallback to active Admin user in registration
        cursor.execute("""
            SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture 
            FROM registration 
            ORDER BY (CASE WHEN LOWER(role) = 'admin' AND status = 'Active' THEN 0 
                           WHEN LOWER(role) = 'admin' THEN 1 
                           ELSE 2 END), id ASC 
            LIMIT 1
        """)
        user = cursor.fetchone()

    cursor.close()
    conn.close()

    if user:
        if user.get('create_at'):
            if isinstance(user['create_at'], (datetime.datetime, datetime.date)):
                user['create_at'] = user['create_at'].strftime('%Y-%m-%d %H:%M:%S')
            else:
                user['create_at'] = str(user['create_at'])
        else:
            user['create_at'] = ""
        user['mobile'] = user.get('mobail') or ''
        user['address'] = user.get('address') or ''
        user['profile_picture'] = user.get('profile_picture') or ''

    return user


def edit_user(data, cookies=None):
    """Update user profile in MySQL 'registration' table."""
    user_id = data.get('id')
    username = data.get('username')

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    target_user = None
    if user_id:
        clean_id = int(str(user_id).lstrip('#').strip())
        cursor.execute("SELECT id FROM registration WHERE id = %s", (clean_id,))
        target_user = cursor.fetchone()
    elif username:
        cursor.execute("SELECT id FROM registration WHERE username = %s", (str(username).strip(),))
        target_user = cursor.fetchone()

    if not target_user and cookies:
        cookie_user = get_single_user(cookies=cookies)
        if cookie_user:
            target_user = {'id': cookie_user['id']}

    if not target_user:
        cursor.execute("SELECT id FROM registration WHERE LOWER(role) = 'admin' LIMIT 1")
        target_user = cursor.fetchone()

    if not target_user:
        cursor.close()
        conn.close()
        raise ValueError("Could not find user in 'registration' table to update.")

    target_id = target_user['id']

    full_name = str(data.get('full_name', '')).strip()
    new_username = str(data.get('username', '')).strip()
    email = str(data.get('email', '')).strip()
    mobail = str(data.get('mobail') or data.get('mobile', '')).strip()
    role = str(data.get('role', '')).strip()
    status = str(data.get('status', '')).strip()
    address = str(data.get('address', '')).strip()
    profile_picture = data.get('profile_picture')
    password = data.get('password')

    updates = [
        "full_name = %s",
        "username = %s",
        "email = %s",
        "mobail = %s",
        "address = %s",
    ]
    values = [full_name, new_username, email, mobail, address]

    if role:
        updates.append("role = %s")
        values.append(role)

    if status in ['Active', 'Inactive']:
        updates.append("status = %s")
        values.append(status)

    if profile_picture is not None:
        updates.append("profile_picture = %s")
        values.append(str(profile_picture).strip())

    if password and str(password).strip():
        hashed_pw = bcrypt.hashpw(str(password).strip().encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        updates.append("password = %s")
        values.append(hashed_pw)

    values.append(target_id)
    query = f"UPDATE registration SET {', '.join(updates)} WHERE id = %s"

    cursor.execute(query, tuple(values))
    conn.commit()
    cursor.close()
    conn.close()
    return target_id


def load_settings():
    """Load settings dynamically from MySQL 'settings_tab' table."""
    settings = {
        "store": {
            "name": "GroceryHub",
            "address": "68,MG ROAD, RAJKOT, GUJRAT",
            "phone": "9876543212",
            "email": "groceryhub@example.com"
        },
        "system": {
            "currency": "INR",
            "dateFormat": "DD/MM/YYYY",
            "notifications": True
        },
        "appearance": {
            "theme": "light"
        }
    }
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT setting_key, setting_value FROM settings_tab")
        rows = cursor.fetchall()
        db_map = {r['setting_key']: r['setting_value'] for r in rows if r.get('setting_key')}

        if "store_name" in db_map and db_map["store_name"]:
            settings["store"]["name"] = db_map["store_name"]
        if "store_address" in db_map and db_map["store_address"]:
            settings["store"]["address"] = db_map["store_address"]
        if "store_phone" in db_map and db_map["store_phone"]:
            settings["store"]["phone"] = db_map["store_phone"]
        if "store_email" in db_map and db_map["store_email"]:
            settings["store"]["email"] = db_map["store_email"]

        # Currency handling (checks currency and invoice_currency)
        curr_val = db_map.get("currency") or db_map.get("invoice_currency")
        if curr_val:
            if "EUR" in curr_val or "€" in curr_val:
                settings["system"]["currency"] = "EUR"
            elif "USD" in curr_val or "$" in curr_val:
                settings["system"]["currency"] = "USD"
            elif "GBP" in curr_val or "£" in curr_val:
                settings["system"]["currency"] = "GBP"
            else:
                settings["system"]["currency"] = "INR"

        if "date_format" in db_map and db_map["date_format"]:
            settings["system"]["dateFormat"] = db_map["date_format"]
        if "notifications" in db_map and db_map["notifications"] is not None:
            settings["system"]["notifications"] = str(db_map["notifications"]).lower() in ("true", "1", "yes", "on")
        if "theme" in db_map and db_map["theme"]:
            settings["appearance"]["theme"] = db_map["theme"]

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[Settings Load Notice] {e}")

    return settings


def set_setting_val(cursor, key, val):
    """Update setting_value for setting_key in settings_tab or insert if missing."""
    cursor.execute("SELECT id FROM settings_tab WHERE setting_key = %s", (key,))
    rows = cursor.fetchall()
    if rows:
        cursor.execute("UPDATE settings_tab SET setting_value = %s WHERE setting_key = %s", (str(val), key))
    else:
        cursor.execute("INSERT INTO settings_tab (setting_key, setting_value) VALUES (%s, %s)", (key, str(val)))


def save_store_settings(store_data):
    """Save store settings into settings_tab table."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    name = store_data.get('name') or store_data.get('store_name', '')
    address = store_data.get('address') or store_data.get('store_address', '')
    phone = store_data.get('phone') or store_data.get('store_phone', '')
    email = store_data.get('email') or store_data.get('store_email', '')

    set_setting_val(cursor, "store_name", name)
    set_setting_val(cursor, "store_address", address)
    set_setting_val(cursor, "store_phone", phone)
    set_setting_val(cursor, "store_email", email)

    conn.commit()
    cursor.close()
    conn.close()


def save_system_settings(system_data):
    """Save system settings into settings_tab table."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    if "currency" in system_data:
        curr = system_data["currency"]
        set_setting_val(cursor, "currency", curr)
        set_setting_val(cursor, "invoice_currency", curr)

    if "dateFormat" in system_data or "date_format" in system_data:
        df = system_data.get("dateFormat") or system_data.get("date_format")
        set_setting_val(cursor, "date_format", df)

    if "notifications" in system_data:
        notif = "true" if system_data["notifications"] else "false"
        set_setting_val(cursor, "notifications", notif)

    conn.commit()
    cursor.close()
    conn.close()


def save_theme_setting(theme_val):
    """Save theme setting into settings_tab table."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    set_setting_val(cursor, "theme", theme_val)
    conn.commit()
    cursor.close()
    conn.close()


def get_users_list(filters=None):
    """Fetch users list with dynamic filters, metrics, and sorting for User Dashboard."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT COUNT(*) AS total FROM registration")
    total = cursor.fetchone()['total'] or 0

    cursor.execute("SELECT COUNT(*) AS active FROM registration WHERE status = 'Active'")
    active = cursor.fetchone()['active'] or 0

    cursor.execute("SELECT COUNT(*) AS inactive FROM registration WHERE status = 'Inactive'")
    inactive = cursor.fetchone()['inactive'] or 0

    cursor.execute("SELECT COUNT(*) AS new_today FROM registration WHERE DATE(create_at) = CURDATE()")
    new_today = cursor.fetchone()['new_today'] or 0

    query = "SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture FROM registration WHERE 1=1"
    params = []

    if filters:
        search = filters.get('search', [''])[0].strip()
        if search:
            query += """ AND (
                CAST(id AS CHAR) LIKE %s OR 
                LOWER(full_name) LIKE LOWER(%s) OR 
                LOWER(username) LIKE LOWER(%s) OR 
                LOWER(email) LIKE LOWER(%s) OR 
                mobail LIKE %s
            )"""
            s = f"%{search}%"
            params.extend([s, s, s, s, s])

        uid = filters.get('id', [''])[0].strip()
        if uid:
            query += " AND (CAST(id AS CHAR) LIKE %s OR id = %s)"
            params.extend([f"%{uid}%", int(uid) if uid.isdigit() else 0])

        name = filters.get('name', [''])[0].strip()
        if name:
            query += " AND (LOWER(full_name) LIKE LOWER(%s) OR LOWER(username) LIKE LOWER(%s))"
            n = f"%{name}%"
            params.extend([n, n])

        status = filters.get('status', [''])[0].strip()
        if status in ['Active', 'Inactive']:
            query += " AND status = %s"
            params.append(status)

        sort = filters.get('sort', ['newest'])[0].strip()
        if sort == 'oldest':
            query += " ORDER BY id ASC"
        elif sort == 'name_asc':
            query += " ORDER BY LOWER(full_name) ASC"
        elif sort == 'name_desc':
            query += " ORDER BY LOWER(full_name) DESC"
        else:
            query += " ORDER BY id DESC"
    else:
        query += " ORDER BY id DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    for u in rows:
        u['create_at'] = str(u['create_at']) if u.get('create_at') else ''
        u['mobile'] = u.pop('mobail', '') or ''
        u['address'] = u.get('address') or ''
        u['profile_picture'] = u.get('profile_picture') or ''

    cursor.close()
    conn.close()

    return {
        'status': 'success',
        'metrics': {
            'totalUsers': total,
            'activeUsers': active,
            'inactiveUsers': inactive,
            'newUsers': new_today
        },
        'users': rows
    }


def add_user_record(data):
    """Add a new user into registration table."""
    full_name = str(data.get('full_name', '')).strip()
    username = str(data.get('username', '')).strip()
    email = str(data.get('email', '')).strip()
    mobail = str(data.get('mobail') or data.get('mobile', '')).strip()
    address = str(data.get('address', '')).strip()
    password = str(data.get('password', '')).strip()
    role = str(data.get('role', 'Cashier')).strip()
    status = str(data.get('status', 'Active')).strip()

    if not full_name:
        raise ValueError("Full Name is required.")
    if not username:
        raise ValueError("Username is required.")
    if not email:
        raise ValueError("Email Address is required.")
    if not mobail:
        raise ValueError("Mobile Number is required.")
    if not password:
        raise ValueError("Password is required.")

    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    conn = get_db_connection()
    cursor = conn.cursor()
    sql = """
        INSERT INTO registration (full_name, username, email, mobail, address, password, role, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    cursor.execute(sql, (full_name, username, email, mobail, address, hashed_pw, role, status))
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


def delete_user_record(uid):
    """Delete user from registration table by id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM registration WHERE id = %s", (uid,))
    conn.commit()
    affected = cursor.rowcount
    cursor.close()
    conn.close()
    return affected > 0


class UnifiedDashboardHandler(BaseHTTPRequestHandler):

    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Cookie")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        cookie_header = self.headers.get("Cookie", "")
        cookies = parse_cookies_dict(cookie_header)

        # 1. API: Single User Profile from registration table
        if path in ["/api/users/profile", "/api/user/profile", "/api/user", "/api/user/", "/api/profile", "/api/users/me", "/api/user/me", "/demo/api/users/profile", "/demo/api/user/profile"]:
            try:
                user_id = query.get("id", [None])[0]
                username = query.get("username", [None])[0]
                email = query.get("email", [None])[0]
                user = get_single_user(user_id=user_id, username=username, email=email, cookies=cookies)
                if user:
                    self._set_headers(200)
                    self.wfile.write(json.dumps({"status": "success", "user": user, "profile": user}, default=json_serializer).encode("utf-8"))
                else:
                    self._set_headers(404)
                    self.wfile.write(json.dumps({"status": "error", "message": "User not found in 'registration' table."}).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        # 2. API: List of all users for User Dashboard
        if path in ["/api/users", "/api/users/", "/demo/api/users", "/demo/api/users/"]:
            try:
                users_data = get_users_list(query)
                self._set_headers(200)
                self.wfile.write(json.dumps(users_data, default=json_serializer).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        # 3. API: Settings from settings_tab
        if path in ["/api/settings", "/api/settings/", "/demo/api/settings"]:
            try:
                settings_data = load_settings()
                self._set_headers(200)
                self.wfile.write(json.dumps(settings_data, default=json_serializer).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        # 3. Static Files Serving
        req_path = path.lstrip("/")
        if req_path.startswith("demo/"):
            req_path = req_path[5:]
        if not req_path or req_path == "":
            req_path = "setting.html"

        file_path = os.path.join(BASE_DIR, req_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = "application/octet-stream"
            if mime_type.startswith("text/") or mime_type in ["application/javascript", "application/json"]:
                mime_type += "; charset=utf-8"

            try:
                with open(file_path, "rb") as f:
                    content = f.read()
                self._set_headers(200, mime_type)
                self.wfile.write(content)
            except Exception as e:
                self._set_headers(500, "text/plain")
                self.wfile.write(f"Error reading file: {e}".encode("utf-8"))
        else:
            self._set_headers(404, "application/json")
            self.wfile.write(json.dumps({"status": "error", "message": f"Resource '{path}' not found."}).encode("utf-8"))

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        cookie_header = self.headers.get("Cookie", "")
        cookies = parse_cookies_dict(cookie_header)

        content_length = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"

        try:
            payload = json.loads(post_body) if post_body.strip() else {}
        except Exception:
            payload = {}

        # 1. Add New User into 'registration' table
        if path in ["/api/users/add", "/demo/api/users/add"]:
            try:
                new_id = add_user_record(payload)
                self._set_headers(200)
                self.wfile.write(json.dumps({
                    "status": "success",
                    "message": f"User '{payload.get('full_name')}' added successfully (ID #{new_id}).",
                    "id": new_id
                }).encode("utf-8"))
            except ValueError as ve:
                self._set_headers(400)
                self.wfile.write(json.dumps({"status": "error", "message": str(ve)}).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        # 2. Delete User from 'registration' table
        if path in ["/api/users/delete", "/demo/api/users/delete"]:
            try:
                uid = payload.get("id")
                if not uid:
                    self._set_headers(400)
                    self.wfile.write(json.dumps({"status": "error", "message": "Missing user ID"}).encode("utf-8"))
                    return
                ok = delete_user_record(uid)
                if ok:
                    self._set_headers(200)
                    self.wfile.write(json.dumps({"status": "success", "message": f"User #{uid} deleted successfully."}).encode("utf-8"))
                else:
                    self._set_headers(404)
                    self.wfile.write(json.dumps({"status": "error", "message": "User not found."}).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        # 3. Update Profile in 'registration' table
        if path in ["/api/users/edit", "/api/users/update", "/api/settings/profile", "/api/profile/update", "/demo/api/settings/profile", "/demo/api/users/edit"]:
            try:
                saved_id = edit_user(payload, cookies=cookies)
                user_info = get_single_user(user_id=saved_id)
                self._set_headers(200)
                self.wfile.write(json.dumps({
                    "status": "success",
                    "message": f"User profile for '{user_info.get('full_name') or user_info.get('username')}' updated successfully in 'registration' table.",
                    "user": user_info,
                    "profile": user_info
                }, default=json_serializer).encode("utf-8"))
            except ValueError as ve:
                self._set_headers(400)
                self.wfile.write(json.dumps({"status": "error", "message": str(ve)}).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"status": "error", "message": f"Database error: {str(e)}"}).encode("utf-8"))
            return

        # 2. Save Store Settings in 'settings_tab'
        if path in ["/api/settings/store", "/api/settings/save", "/demo/api/settings/store"]:
            try:
                save_store_settings(payload)
                self._set_headers(200)
                self.wfile.write(json.dumps({"status": "success", "message": "Store Information saved successfully in 'settings_tab'."}).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        # 3. Save System Settings in 'settings_tab'
        if path in ["/api/settings/system", "/demo/api/settings/system"]:
            try:
                save_system_settings(payload)
                self._set_headers(200)
                self.wfile.write(json.dumps({"status": "success", "message": "System Settings saved successfully in 'settings_tab'."}).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        # 4. Save Appearance / Theme in 'settings_tab'
        if path in ["/api/settings/theme", "/api/settings/appearance", "/demo/api/settings/theme"]:
            try:
                theme = payload.get("theme", "light")
                save_theme_setting(theme)
                self._set_headers(200)
                self.wfile.write(json.dumps({"status": "success", "message": "Appearance theme saved successfully in 'settings_tab'.", "theme": theme}).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        self._set_headers(404)
        self.wfile.write(json.dumps({"status": "error", "message": f"Endpoint '{path}' not found."}).encode("utf-8"))


def run_server(preferred_ports=[9007, 9010, 9008, 9009, 9013, 9000]):
    init_db_schema()
    httpd = None
    selected_port = None

    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        preferred_ports = [int(sys.argv[1])] + preferred_ports

    for port in preferred_ports:
        try:
            server_address = ('0.0.0.0', port)
            httpd = HTTPServer(server_address, UnifiedDashboardHandler)
            selected_port = port
            break
        except OSError:
            continue

    if not httpd:
        print("ERROR: Could not bind to any port in", preferred_ports)
        sys.exit(1)

    print('=' * 60)
    print(' Settings & User Profile Server (MySQL "project")')
    print(' Tables: "registration" (Profile), "settings_tab" (Settings)')
    print('=' * 60)
    print(f'Server Running At:  http://localhost:{selected_port}/')
    print(f'Settings Dashboard: http://localhost:{selected_port}/setting.html')
    print(f'API Endpoint:       http://localhost:{selected_port}/api/settings')
    print('=' * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down server...')
        httpd.server_close()
        sys.exit(0)


if __name__ == '__main__':
    run_server()
