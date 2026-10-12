"""
reg.py - Robust Python HTTPServer Backend for User Registration
Database: MySQL 'project' | Table: 'registration'
Host: localhost | Port: 9008 | User: root | Password: (blank)
"""

import os
import sys
import json
import re
import mimetypes
from urllib.parse import urlparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import mysql.connector

# Password hashing using bcrypt or hashlib sha256 fallback
try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    import hashlib
    HAS_BCRYPT = False

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'project'
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_db():
    """Establish connection to MySQL database."""
    return mysql.connector.connect(**DB_CONFIG)


def hash_password(password: str) -> str:
    """Hash password securely."""
    if HAS_BCRYPT:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    else:
        import hashlib
        return "sha256$" + hashlib.sha256(password.encode('utf-8')).hexdigest()


def init_db_schema():
    """Ensure database and registration table exist with all required columns and constraints."""
    try:
        # 1. Connect without db to ensure 'project' exists
        conn_init = mysql.connector.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password']
        )
        cursor_init = conn_init.cursor()
        cursor_init.execute("CREATE DATABASE IF NOT EXISTS project CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        cursor_init.close()
        conn_init.close()

        # 2. Connect to project db and create table
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS registration (
                id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(150) NOT NULL,
                username VARCHAR(100) NOT NULL UNIQUE,
                email VARCHAR(150) NOT NULL UNIQUE,
                mobail VARCHAR(20) NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('Admin', 'Cashier') DEFAULT 'Cashier',
                status ENUM('Active', 'Inactive') DEFAULT 'Active',
                address TEXT NULL,
                profile_picture VARCHAR(255) NULL,
                create_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)
        conn.commit()
        cursor.close()
        conn.close()
        print(" [Database] Schema verified and table 'registration' is ready.")
    except Exception as e:
        print(f" [Database Warning] Could not initialize database schema automatically: {e}")


def register_user(data: dict) -> dict:
    """
    Perform strict server-side validation and insert user into MySQL database.
    """
    full_name = str(data.get('fullName') or data.get('full_name', '')).strip()
    username = str(data.get('username', '')).strip()
    password = str(data.get('password', '')).strip()
    confirm_password = str(data.get('confirmPassword') or data.get('confirm_password', '')).strip()
    mobile = str(data.get('mobile') or data.get('mobail', '')).strip()
    email = str(data.get('email', '')).strip()
    role = str(data.get('role', '')).strip()

    # -------------------------------------------------------------
    # 1. SERVER-SIDE STRICT VALIDATION
    # -------------------------------------------------------------

    # Full Name Validation: Required, letters and spaces only
    if not full_name:
        raise ValueError("Full Name is required.")
    if not re.match(r'^[a-zA-Z\s]+$', full_name):
        raise ValueError("Only letters and spaces are allowed in Full Name.")

    # Username Validation: Required, min 4 chars, letters, numbers, and '_' only
    if not username:
        raise ValueError("Username is required.")
    if len(username) < 4:
        raise ValueError("Username must be at least 4 characters long.")
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        raise ValueError("Only letters, numbers, and underscores (_) are allowed in Username.")

    # Password Validation: Required, min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    if not password:
        raise ValueError("Password is required.")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not re.search(r'[A-Z]', password):
        raise ValueError("Password must contain at least 1 uppercase letter.")
    if not re.search(r'[a-z]', password):
        raise ValueError("Password must contain at least 1 lowercase letter.")
    if not re.search(r'[0-9]', password):
        raise ValueError("Password must contain at least 1 number.")
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?~`]', password):
        raise ValueError("Password must contain at least 1 special character.")

    # Confirm Password Validation: Must match Password
    if not confirm_password:
        raise ValueError("Confirm Password is required.")
    if password != confirm_password:
        raise ValueError("Passwords do not match.")

    # Mobile Number Validation: Required, exactly 10 digits, must start with 6-9
    if not mobile:
        raise ValueError("Mobile number is required.")
    if not re.match(r'^[6-9][0-9]{9}$', mobile):
        raise ValueError("Mobile number must be exactly 10 digits and start with 6, 7, 8, or 9.")

    # Email Validation: Required, valid format
    if not email:
        raise ValueError("Email address is required.")
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        raise ValueError("Please provide a valid email address.")

    # Role Validation: Required, only 'Admin' or 'Cashier'
    valid_roles = ['Admin', 'Cashier']
    if not role or role not in valid_roles:
        raise ValueError("Please select a valid role (Admin or Cashier).")

    # -------------------------------------------------------------
    # 2. CHECK FOR DUPLICATE USERNAME & EMAIL (Prepared Statements)
    # -------------------------------------------------------------
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    # Check Username Duplicate
    cursor.execute("SELECT id FROM registration WHERE username = %s LIMIT 1", (username,))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        raise ValueError(f"The username '{username}' is already taken. Please choose another.")

    # Check Email Duplicate
    cursor.execute("SELECT id FROM registration WHERE email = %s LIMIT 1", (email,))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        raise ValueError(f"The email '{email}' is already registered. Please login or use a different email.")

    # -------------------------------------------------------------
    # 3. HASH PASSWORD & INSERT (Prepared Parameterized Query)
    # -------------------------------------------------------------
    hashed_pw = hash_password(password)

    insert_sql = """
        INSERT INTO registration (full_name, username, email, mobail, password, role, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    cursor.execute(insert_sql, (full_name, username, email, mobile, hashed_pw, role, 'Active'))
    conn.commit()
    new_user_id = cursor.lastrowid

    cursor.close()
    conn.close()

    return {
        'id': new_user_id,
        'full_name': full_name,
        'username': username,
        'email': email,
        'mobile': mobile,
        'role': role
    }


class RegistrationServerHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler for User Registration and Static Files."""

    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def send_json(self, data, status_code=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._set_cors_headers()
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Health API
        if path == '/api/health':
            self.send_json({'status': 'ok', 'message': 'Registration API server is running.'})
            return

        # Serve static web files (HTML, CSS, JS, etc.)
        filename = path.lstrip('/') or 'registration.html'
        filepath = os.path.join(BASE_DIR, filename)

        if os.path.isfile(filepath):
            mime_type, _ = mimetypes.guess_type(filepath)
            if not mime_type:
                mime_type = 'text/html'
            self.send_response(200)
            self.send_header('Content-Type', mime_type)
            self._set_cors_headers()
            self.end_headers()
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_json({'status': 'error', 'message': f"File '{filename}' not found."}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8') if length > 0 else '{}'

        try:
            data = json.loads(body)
        except Exception:
            data = {}

        if path in ['/api/register', '/api/users/add', '/api/registration']:
            try:
                user_info = register_user(data)
                self.send_json({
                    'status': 'success',
                    'message': f"User '{user_info['full_name']}' registered successfully! (User ID #{user_info['id']})",
                    'user': user_info
                }, 200)
            except ValueError as ve:
                self.send_json({'status': 'error', 'message': str(ve)}, 400)
            except Exception as e:
                self.send_json({'status': 'error', 'message': f"Database Error: {str(e)}"}, 500)
            return

        self.send_json({'status': 'error', 'message': f"Endpoint '{path}' not found."}, 404)


def run_server(port=9008):
    init_db_schema()
    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, RegistrationServerHandler)
    print("=" * 65)
    print(f" Grocery Store Registration Backend Server Running!")
    print(f" Web UI:  http://localhost:{port}/registration.html")
    print(f" API:     http://localhost:{port}/api/register")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n Server shutting down gracefully.")
        httpd.server_close()


if __name__ == '__main__':
    port = 9008
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run_server(port)