"""
customer.py - Robust Python HTTPServer Backend for Customer Management
Database: MySQL 'project' | Table: 'customer_tab'
Host: localhost | Port: 9007 | User: root | Password: (blank)
"""

import os
import sys
import json
import mimetypes
from urllib.parse import parse_qs, urlparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import mysql.connector
from decimal import Decimal
import datetime

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'project'
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_db():
    return mysql.connector.connect(**DB_CONFIG)


def json_serializer(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


def init_db_schema():
    """Ensure customer_tab table exists with all necessary columns and sample data."""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        # 1. Create table if not exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS customer_tab (
                customer_id INT AUTO_INCREMENT PRIMARY KEY,
                customer_name VARCHAR(150) NOT NULL,
                email VARCHAR(150) NULL,
                phone VARCHAR(50) NULL,
                address TEXT NULL,
                city VARCHAR(100) NULL,
                status ENUM('Active', 'Inactive') DEFAULT 'Active',
                create_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                date DATE NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)
        conn.commit()

        # 2. Check and add any missing columns gracefully
        cursor.execute("SHOW COLUMNS FROM customer_tab")
        existing_cols = [r['Field'].lower() for r in cursor.fetchall()]

        if 'city' not in existing_cols:
            cursor.execute("ALTER TABLE customer_tab ADD COLUMN city VARCHAR(100) NULL AFTER address")
            conn.commit()
            print("[DB] Added 'city' column to 'customer_tab'.")

        if 'status' not in existing_cols:
            cursor.execute("ALTER TABLE customer_tab ADD COLUMN status ENUM('Active', 'Inactive') DEFAULT 'Active' AFTER city")
            conn.commit()
            print("[DB] Added 'status' column to 'customer_tab'.")

        if 'create_at' not in existing_cols and 'created_at' not in existing_cols:
            cursor.execute("ALTER TABLE customer_tab ADD COLUMN create_at DATETIME DEFAULT CURRENT_TIMESTAMP")
            conn.commit()
            print("[DB] Added 'create_at' column to 'customer_tab'.")

        if 'date' not in existing_cols:
            cursor.execute("ALTER TABLE customer_tab ADD COLUMN date DATE NULL")
            conn.commit()

        # 3. Seed initial customer data if table is empty
        cursor.execute("SELECT COUNT(*) AS total FROM customer_tab")
        count_res = cursor.fetchone()
        if count_res and count_res['total'] == 0:
            sample_customers = [
                ('Rahul Sharma', '9876543210', 'rahul.sharma@example.com', '12 MG Road, Navrangpura', 'Ahmedabad', 'Active', '2026-08-01 10:30:00', '2026-08-01'),
                ('Priya Patel', '9823456789', 'priya.patel@example.com', '45 Ring Road, Varachha', 'Surat', 'Active', '2026-08-05 11:15:00', '2026-08-05'),
                ('Amit Kumar', '9712345678', 'amit.kumar@example.com', '88 Alkapuri Society', 'Vadodara', 'Inactive', '2026-08-10 14:20:00', '2026-08-10'),
                ('Sneha Joshi', '9988776655', 'sneha.joshi@example.com', '23 Kalawad Road', 'Rajkot', 'Active', '2026-08-15 09:45:00', '2026-08-15'),
                ('Vikram Singh', '9123456780', 'vikram.singh@example.com', '104 Sector 16', 'Gandhinagar', 'Active', '2026-08-20 16:00:00', '2026-08-20'),
                ('Neha Verma', '9876123450', 'neha.verma@example.com', '56 Ghod Dod Road', 'Surat', 'Active', '2026-08-25 08:30:00', '2026-08-25')
            ]
            cursor.executemany("""
                INSERT INTO customer_tab (customer_name, phone, email, address, city, status, create_at, date)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, sample_customers)
            conn.commit()
            print(f"[DB] Seeded {len(sample_customers)} sample customers into 'customer_tab'.")

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[DB INIT ERROR] {e}")


# ==========================================================
# 1. Fetch Customers with Dynamic Filters, Metrics, and Sorting
# ==========================================================
def get_customers(filters=None):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    # 1. Metrics counters
    cursor.execute("SELECT COUNT(*) AS total FROM customer_tab")
    total = cursor.fetchone()['total'] or 0

    cursor.execute("SELECT COUNT(*) AS active FROM customer_tab WHERE LOWER(status) = 'active'")
    active = cursor.fetchone()['active'] or 0

    cursor.execute("SELECT COUNT(*) AS inactive FROM customer_tab WHERE LOWER(status) = 'inactive'")
    inactive = cursor.fetchone()['inactive'] or 0

    cursor.execute("""
        SELECT COUNT(*) AS new_customers FROM customer_tab 
        WHERE DATE(COALESCE(create_at, date, NOW())) = CURDATE()
           OR (create_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))
    """)
    new_cust_row = cursor.fetchone()
    new_customers = new_cust_row['new_customers'] if new_cust_row else 0

    # 2. Main Query
    query = """
        SELECT 
            customer_id,
            customer_name,
            COALESCE(email, '') AS email,
            COALESCE(phone, '') AS phone,
            COALESCE(address, '') AS address,
            COALESCE(city, '') AS city,
            COALESCE(status, 'Active') AS status,
            COALESCE(create_at, date, '') AS create_at
        FROM customer_tab
        WHERE 1=1
    """
    params = []

    if filters:
        # Header unified search: by Customer ID or Customer Name
        search = filters.get('search', [''])[0].strip()
        if search:
            clean_search = search.lstrip('#').strip()
            if clean_search.isdigit():
                # User is searching by ID (e.g. '1', '#1', '2')
                query += """ AND (
                    customer_id = %s OR 
                    CAST(customer_id AS CHAR) LIKE %s OR 
                    LOWER(customer_name) LIKE LOWER(%s)
                )"""
                params.extend([int(clean_search), f"{clean_search}%", f"%{search}%"])
            else:
                # User is searching by Name (or email / city)
                query += """ AND (
                    LOWER(customer_name) LIKE LOWER(%s) OR 
                    LOWER(COALESCE(email, '')) LIKE LOWER(%s) OR 
                    LOWER(COALESCE(city, '')) LIKE LOWER(%s)
                )"""
                s = f"%{search}%"
                params.extend([s, s, s])

        # Filter Card: Customer ID
        cid = filters.get('id', [''])[0].strip().lstrip('#').strip()
        if cid:
            if cid.isdigit():
                query += " AND (customer_id = %s OR CAST(customer_id AS CHAR) LIKE %s)"
                params.extend([int(cid), f"{cid}%"])
            else:
                query += " AND CAST(customer_id AS CHAR) LIKE %s"
                params.append(f"%{cid}%")

        # Filter Card: Customer Name
        name = filters.get('name', [''])[0].strip()
        if name:
            query += " AND LOWER(customer_name) LIKE LOWER(%s)"
            params.append(f"%{name}%")

        # Filter Card: Status (Active / Inactive)
        status = filters.get('status', [''])[0].strip()
        if status in ['Active', 'Inactive']:
            query += " AND LOWER(status) = LOWER(%s)"
            params.append(status)

        # Dynamic Sorting
        sort = filters.get('sort', ['newest'])[0].strip()
        if sort == 'oldest':
            query += " ORDER BY customer_id ASC"
        elif sort in ['name', 'name_asc']:
            query += " ORDER BY LOWER(customer_name) ASC"
        elif sort == 'name_desc':
            query += " ORDER BY LOWER(customer_name) DESC"
        else:
            query += " ORDER BY customer_id DESC"
    else:
        query += " ORDER BY customer_id DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    for c in rows:
        if c.get('create_at'):
            if isinstance(c['create_at'], (datetime.datetime, datetime.date)):
                c['create_at'] = c['create_at'].strftime('%Y-%m-%d %H:%M:%S')
            else:
                c['create_at'] = str(c['create_at'])
        else:
            c['create_at'] = ''

    cursor.close()
    conn.close()

    return {
        'metrics': {
            'totalCustomers': total,
            'activeCustomers': active,
            'inactiveCustomers': inactive,
            'newCustomers': new_customers
        },
        'customers': rows
    }


# ==========================================================
# 2. Get Single Customer by ID
# ==========================================================
def get_customer_by_id(cid):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT 
            customer_id,
            customer_name,
            COALESCE(email, '') AS email,
            COALESCE(phone, '') AS phone,
            COALESCE(address, '') AS address,
            COALESCE(city, '') AS city,
            COALESCE(status, 'Active') AS status,
            COALESCE(create_at, date, '') AS create_at
        FROM customer_tab
        WHERE customer_id = %s
    """, (cid,))
    customer = cursor.fetchone()
    cursor.close()
    conn.close()

    if customer:
        if customer.get('create_at') and isinstance(customer['create_at'], (datetime.datetime, datetime.date)):
            customer['create_at'] = customer['create_at'].strftime('%Y-%m-%d %H:%M:%S')
        else:
            customer['create_at'] = str(customer.get('create_at') or '')
    return customer


# ==========================================================
# 3. Add New Customer
# ==========================================================
def add_customer(data):
    customer_name = str(data.get('customer_name') or data.get('name', '')).strip()
    phone = str(data.get('phone') or data.get('mobile', '')).strip()
    email = str(data.get('email', '')).strip()
    address = str(data.get('address', '')).strip()
    city = str(data.get('city', '')).strip()
    status = str(data.get('status', 'Active')).strip() or 'Active'

    if not customer_name:
        raise ValueError("Customer Name is required.")
    if not phone:
        raise ValueError("Phone / Mobile number is required.")

    conn = get_db()
    cursor = conn.cursor()
    sql = """
        INSERT INTO customer_tab (customer_name, phone, email, address, city, status, create_at, date)
        VALUES (%s, %s, %s, %s, %s, %s, NOW(), CURDATE())
    """
    cursor.execute(sql, (customer_name, phone, email, address, city, status))
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


# ==========================================================
# 4. Edit Existing Customer
# ==========================================================
def edit_customer(data):
    cid = data.get('customer_id') or data.get('id')
    if not cid:
        raise ValueError("Customer ID is required for editing.")

    customer_name = str(data.get('customer_name') or data.get('name', '')).strip()
    phone = str(data.get('phone') or data.get('mobile', '')).strip()
    email = str(data.get('email', '')).strip()
    address = str(data.get('address', '')).strip()
    city = str(data.get('city', '')).strip()
    status = str(data.get('status', '')).strip() or 'Active'

    if not customer_name:
        raise ValueError("Customer Name cannot be empty.")
    if not phone:
        raise ValueError("Phone / Mobile number cannot be empty.")

    conn = get_db()
    cursor = conn.cursor()
    sql = """
        UPDATE customer_tab
        SET customer_name = %s, phone = %s, email = %s, address = %s, city = %s, status = %s
        WHERE customer_id = %s
    """
    cursor.execute(sql, (customer_name, phone, email, address, city, status, cid))
    conn.commit()
    affected = cursor.rowcount
    cursor.close()
    conn.close()
    return affected > 0 or True


# ==========================================================
# 5. Delete Customer
# ==========================================================
def delete_customer(cid):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM customer_tab WHERE customer_id = %s", (cid,))
    conn.commit()
    affected = cursor.rowcount
    cursor.close()
    conn.close()
    return affected > 0


# ==========================================================
# HTTP Request Handler
# ==========================================================
class CustomerDashboardHandler(BaseHTTPRequestHandler):

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data, default=json_serializer).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_json({'status': 'ok'})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 1. API: List Customers (Search, Filter, Metrics, Sort)
        if path in ['/api/customers', '/api/customer/list']:
            try:
                result = get_customers(query)
                self.send_json(result, 200)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 500)
            return

        # 2. API: Single Customer by ID
        if path in ['/api/customer', '/api/customer/view']:
            try:
                cid = query.get('id', [None])[0] or query.get('customer_id', [None])[0]
                if not cid:
                    self.send_json({'status': 'error', 'message': 'Customer ID is required'}, 400)
                    return
                customer = get_customer_by_id(cid)
                if customer:
                    self.send_json({'status': 'success', 'customer': customer}, 200)
                else:
                    self.send_json({'status': 'error', 'message': 'Customer not found'}, 404)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 500)
            return

        # 3. API: Current Admin / User Profile for Header Dropdown
        if path in ['/api/users/profile', '/api/user/profile', '/api/profile', '/api/user']:
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
                cookie_email = cookies.get("admin_email")

                conn = get_db()
                cursor = conn.cursor(dictionary=True)
                user = None

                if uid:
                    cursor.execute("SELECT id, full_name, username, email, role, status, profile_picture FROM registration WHERE id = %s", (str(uid).lstrip('#'),))
                    user = cursor.fetchone()
                elif uname:
                    cursor.execute("SELECT id, full_name, username, email, role, status, profile_picture FROM registration WHERE username = %s", (uname,))
                    user = cursor.fetchone()
                elif cookie_user:
                    cursor.execute("SELECT id, full_name, username, email, role, status, profile_picture FROM registration WHERE username = %s", (cookie_user,))
                    user = cursor.fetchone()
                elif cookie_id and str(cookie_id).lstrip('#').isdigit():
                    cursor.execute("SELECT id, full_name, username, email, role, status, profile_picture FROM registration WHERE id = %s", (int(str(cookie_id).lstrip('#')),))
                    user = cursor.fetchone()
                elif cookie_email:
                    cursor.execute("SELECT id, full_name, username, email, role, status, profile_picture FROM registration WHERE email = %s", (cookie_email,))
                    user = cursor.fetchone()

                if not user:
                    cursor.execute("""
                        SELECT id, full_name, username, email, role, status, profile_picture 
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
                    user['profile_picture'] = user.get('profile_picture') or ''
                    self.send_json({'status': 'success', 'user': user, 'profile': user}, 200)
                else:
                    self.send_json({'status': 'error', 'message': 'User not found'}, 404)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 500)
            return

        # 4. Static Files Serving
        filename = path.lstrip('/') or 'customer.html'
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
            self.send_json({'status': 'error', 'message': f'File {filename} not found'}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8') if length > 0 else '{}'
        try:
            data = json.loads(body)
        except Exception:
            data = {}

        # 1. Add Customer
        if path in ['/api/customers/add', '/api/customer/add', '/api/customers/create']:
            try:
                new_id = add_customer(data)
                self.send_json({
                    'status': 'success',
                    'message': f"Customer '{data.get('customer_name') or data.get('name')}' created successfully (ID #{new_id}).",
                    'customer_id': new_id,
                    'id': new_id
                }, 200)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 400)
            return

        # 2. Edit Customer
        if path in ['/api/customers/edit', '/api/customer/edit', '/api/customers/update']:
            try:
                edit_customer(data)
                self.send_json({
                    'status': 'success',
                    'message': f"Customer details updated successfully."
                }, 200)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 400)
            return

        # 3. Delete Customer
        if path in ['/api/customers/delete', '/api/customer/delete']:
            try:
                cid = data.get('customer_id') or data.get('id')
                if not cid:
                    self.send_json({'status': 'error', 'message': 'Missing customer ID'}, 400)
                    return
                ok = delete_customer(cid)
                if ok:
                    self.send_json({'status': 'success', 'message': f'Customer #{cid} deleted successfully.'}, 200)
                else:
                    self.send_json({'status': 'error', 'message': 'Customer not found or already deleted'}, 404)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 500)
            return

        self.send_json({'status': 'error', 'message': 'Endpoint not found'}, 404)


def run_server(port=9007):
    init_db_schema()
    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, CustomerDashboardHandler)
    print('=' * 60)
    print(' Customer Management System - Backend Server')
    print('=' * 60)
    print(f'Server Running At:  http://localhost:{port}/')
    print(f'Customer Dashboard: http://localhost:{port}/customer.html')
    print(f'API Endpoint:       http://localhost:{port}/api/customers')
    print('=' * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down customer backend server...')
        httpd.server_close()
        sys.exit(0)


if __name__ == '__main__':
    port_to_use = 9007
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port_to_use = int(sys.argv[1])
    run_server(port=port_to_use)
