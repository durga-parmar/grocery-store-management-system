"""
user_dash.py - Clean, Robust Python HTTPServer Backend for User Management
Database: MySQL 'project' | Table: 'registration'
Host: localhost | Port: 9007 | User: root | Password: (blank)
"""

import os
import json
import mimetypes
from urllib.parse import parse_qs, urlparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import mysql.connector
import bcrypt

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'project'
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_db():
    return mysql.connector.connect(**DB_CONFIG)


# 1. Fetch Users with Dynamic Filters, Metrics, and Sorting
def get_users(filters=None):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    # 1. Metrics counters
    cursor.execute("SELECT COUNT(*) AS total FROM registration")
    total = cursor.fetchone()['total'] or 0

    cursor.execute("SELECT COUNT(*) AS active FROM registration WHERE status = 'Active'")
    active = cursor.fetchone()['active'] or 0

    cursor.execute("SELECT COUNT(*) AS inactive FROM registration WHERE status = 'Inactive'")
    inactive = cursor.fetchone()['inactive'] or 0

    cursor.execute("SELECT COUNT(*) AS new_today FROM registration WHERE DATE(create_at) = CURDATE()")
    new_today = cursor.fetchone()['new_today'] or 0

    # 2. Base Query
    query = "SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture FROM registration WHERE 1=1"
    params = []

    if filters:
        # Header unified search
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

        # Filter: User ID
        uid = filters.get('id', [''])[0].strip()
        if uid:
            query += " AND (CAST(id AS CHAR) LIKE %s OR id = %s)"
            params.extend([f"%{uid}%", int(uid) if uid.isdigit() else 0])

        # Filter: Customer Name
        name = filters.get('name', [''])[0].strip()
        if name:
            query += " AND (LOWER(full_name) LIKE LOWER(%s) OR LOWER(username) LIKE LOWER(%s))"
            n = f"%{name}%"
            params.extend([n, n])

        # Filter: Status
        status = filters.get('status', [''])[0].strip()
        if status in ['Active', 'Inactive']:
            query += " AND status = %s"
            params.append(status)

        # Dynamic Sorting
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
        'metrics': {
            'totalUsers': total,
            'activeUsers': active,
            'inactiveUsers': inactive,
            'newUsers': new_today
        },
        'users': rows
    }


# 2. Add New User
def add_user(data):
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

    conn = get_db()
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


# 3. Edit Existing User
def edit_user(data):
    uid = data.get('id')
    if not uid:
        raise ValueError("User ID is required for editing.")

    full_name = str(data.get('full_name', '')).strip()
    username = str(data.get('username', '')).strip()
    email = str(data.get('email', '')).strip()
    mobail = str(data.get('mobail') or data.get('mobile', '')).strip()
    address = str(data.get('address', '')).strip()
    role = str(data.get('role', '')).strip() or 'Cashier'
    status = str(data.get('status', '')).strip() or 'Active'
    password = str(data.get('password', '')).strip()

    if not full_name:
        raise ValueError("Full Name cannot be empty.")
    if not username:
        raise ValueError("Username cannot be empty.")
    if not email:
        raise ValueError("Email Address cannot be empty.")
    if not mobail:
        raise ValueError("Mobile Number cannot be empty.")

    conn = get_db()
    cursor = conn.cursor()

    if password:
        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        sql = """
            UPDATE registration
            SET full_name=%s, username=%s, email=%s, mobail=%s, address=%s, role=%s, status=%s, password=%s
            WHERE id=%s
        """
        cursor.execute(sql, (full_name, username, email, mobail, address, role, status, hashed_pw, uid))
    else:
        sql = """
            UPDATE registration
            SET full_name=%s, username=%s, email=%s, mobail=%s, address=%s, role=%s, status=%s
            WHERE id=%s
        """
        cursor.execute(sql, (full_name, username, email, mobail, address, role, status, uid))

    conn.commit()
    cursor.close()
    conn.close()
    return True


# 4. Delete User
def delete_user(uid):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM registration WHERE id = %s", (uid,))
    conn.commit()
    affected = cursor.rowcount
    cursor.close()
    conn.close()
    return affected > 0


# HTTP Request Handler
class SimpleDashboardHandler(BaseHTTPRequestHandler):

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_json({'status': 'ok'})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 1. API: List Users
        if path == '/api/users':
            try:
                result = get_users(query)
                self.send_json(result, 200)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 500)
            return

        # 2. API: Single User Profile
        if path in ['/api/users/profile', '/api/user/profile', '/api/user', '/api/profile']:
            try:
                uid = query.get('id', [None])[0]
                uname = query.get('username', [None])[0]
                cookie_header = self.headers.get("Cookie", "")
                cookies = {}
                for item in cookie_header.split(";"):
                    if "=" in item:
                        k, v = item.strip().split("=", 1)
                        cookies[k.strip()] = v.strip()

                cookie_user = cookies.get("admin_username") or cookies.get("username")
                cookie_id = cookies.get("admin_id") or cookies.get("user_id") or cookies.get("current_user_id")

                conn = get_db()
                cursor = conn.cursor(dictionary=True)
                user = None

                if uid:
                    cursor.execute("SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture FROM registration WHERE id = %s", (str(uid).lstrip('#'),))
                    user = cursor.fetchone()
                elif uname:
                    cursor.execute("SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture FROM registration WHERE username = %s", (uname,))
                    user = cursor.fetchone()
                elif cookie_user:
                    cursor.execute("SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture FROM registration WHERE username = %s", (cookie_user,))
                    user = cursor.fetchone()
                elif cookie_id and str(cookie_id).lstrip('#').isdigit():
                    cursor.execute("SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture FROM registration WHERE id = %s", (int(str(cookie_id).lstrip('#')),))
                    user = cursor.fetchone()

                if not user:
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
                    user['create_at'] = str(user['create_at']) if user.get('create_at') else ''
                    user['mobile'] = user.get('mobail') or ''
                    user['address'] = user.get('address') or ''
                    user['profile_picture'] = user.get('profile_picture') or ''
                    self.send_json({'status': 'success', 'user': user, 'profile': user}, 200)
                else:
                    self.send_json({'status': 'error', 'message': 'User not found'}, 404)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 500)
            return

        # 3. API: Settings
        if path == '/api/settings':
            self.send_json({
                'store': {'name': 'Grocery Store', 'address': '123 Market Street', 'phone': '9876543210', 'email': 'info@grocerystore.com'},
                'system': {'currency': 'INR', 'dateFormat': 'DD/MM/YYYY', 'notifications': True},
                'appearance': {'theme': 'light'}
            })
            return

        # 4. Static Files
        filename = path.lstrip('/') or 'user_dash.html'
        filepath = os.path.join(BASE_DIR, filename)

        if os.path.isfile(filepath):
            mime_type, _ = mimetypes.guess_type(filepath)
            if not mime_type:
                mime_type = 'text/html'
            self.send_response(200)
            self.send_header('Content-Type', mime_type)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_json({'status': 'error', 'message': 'File not found'}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8') if length > 0 else '{}'
        try:
            data = json.loads(body)
        except Exception:
            data = {}

        if path == '/api/users/add':
            try:
                new_id = add_user(data)
                self.send_json({'status': 'success', 'message': f"User '{data.get('full_name')}' added successfully (ID #{new_id}).", 'id': new_id}, 200)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 400)
            return

        if path in ['/api/users/edit', '/api/settings/profile']:
            try:
                edit_user(data)
                self.send_json({'status': 'success', 'message': f"User '{data.get('full_name')}' updated successfully."}, 200)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 400)
            return

        if path == '/api/users/delete':
            try:
                uid = data.get('id')
                if not uid:
                    self.send_json({'status': 'error', 'message': 'Missing user ID'}, 400)
                    return
                ok = delete_user(uid)
                if ok:
                    self.send_json({'status': 'success', 'message': f'User #{uid} deleted successfully.'}, 200)
                else:
                    self.send_json({'status': 'error', 'message': 'User not found'}, 404)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 500)
            return

        self.send_json({'status': 'error', 'message': 'Endpoint not found'}, 404)


if __name__ == '__main__':
    port = 9007
    server = HTTPServer(('0.0.0.0', port), SimpleDashboardHandler)
    print(f"User Dashboard Server running at: http://localhost:{port}/user_dash.html")
    server.serve_forever()
