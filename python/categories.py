"""
categories.py - Robust Python HTTPServer Backend for Category Management
Database: MySQL 'project' | Tables: 'categories_tab', 'products_tab', 'registration'
Host: localhost | Port: 9007 (or fallback 9010) | User: root | Password: (blank)
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
    """Ensure categories_tab and products_tab exist with all required columns and sample data."""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        # 1. Create categories_tab if not exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categories_tab (
                cat_id INT AUTO_INCREMENT PRIMARY KEY,
                cat_name VARCHAR(150) NOT NULL,
                description TEXT NULL,
                status ENUM('Active', 'Inactive') DEFAULT 'Active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)
        conn.commit()

        # 2. Check and add any missing columns gracefully
        cursor.execute("SHOW COLUMNS FROM categories_tab")
        existing_cols = [r['Field'].lower() for r in cursor.fetchall()]

        if 'description' not in existing_cols:
            cursor.execute("ALTER TABLE categories_tab ADD COLUMN description TEXT NULL AFTER cat_name")
            conn.commit()

        if 'status' not in existing_cols:
            cursor.execute("ALTER TABLE categories_tab ADD COLUMN status ENUM('Active', 'Inactive') DEFAULT 'Active' AFTER description")
            conn.commit()

        if 'created_at' not in existing_cols and 'create_at' not in existing_cols:
            cursor.execute("ALTER TABLE categories_tab ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
            conn.commit()

        # 3. Seed initial categories if table is empty
        cursor.execute("SELECT COUNT(*) AS total FROM categories_tab")
        count_res = cursor.fetchone()
        if count_res and count_res['total'] == 0:
            sample_categories = [
                ('Fresh Vegetables', 'Organic and fresh farm vegetables', 'Active', '2026-08-01 10:00:00'),
                ('Fresh Fruits', 'Seasonal, exotic and fresh daily fruits', 'Active', '2026-08-02 11:30:00'),
                ('Dairy & Eggs', 'Milk, butter, paneer, cheese, and farm fresh eggs', 'Active', '2026-08-03 09:15:00'),
                ('Bakery & Snacks', 'Bread, cookies, chips, and evening tea snacks', 'Active', '2026-08-05 14:00:00'),
                ('Beverages & Drinks', 'Soft drinks, fruit juices, tea, coffee, and energy drinks', 'Active', '2026-08-08 16:45:00'),
                ('Foodgrains & Oil', 'Atta, rice, dal, cooking oils, and spices', 'Active', '2026-08-10 12:20:00'),
                ('Frozen Foods', 'Ice creams, frozen peas, ready-to-eat meals', 'Inactive', '2026-08-15 08:30:00'),
                ('Personal Care', 'Soaps, shampoos, skincare, and hygiene essentials', 'Active', '2026-08-20 15:10:00')
            ]
            cursor.executemany("""
                INSERT INTO categories_tab (cat_name, description, status, created_at)
                VALUES (%s, %s, %s, %s)
            """, sample_categories)
            conn.commit()

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[DB INIT NOTICE] {e}")


# ==========================================================
# 1. Fetch Categories with Dynamic Filters, Metrics, and Sorting
# ==========================================================
def get_categories(filters=None):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    # 1. Metrics counters
    cursor.execute("SELECT COUNT(*) AS total FROM categories_tab")
    total = cursor.fetchone()['total'] or 0

    cursor.execute("SELECT COUNT(*) AS active FROM categories_tab WHERE LOWER(status) = 'active'")
    active = cursor.fetchone()['active'] or 0

    cursor.execute("SELECT COUNT(*) AS inactive FROM categories_tab WHERE LOWER(status) = 'inactive'")
    inactive = cursor.fetchone()['inactive'] or 0

    cursor.execute("""
        SELECT COUNT(*) AS new_categories FROM categories_tab 
        WHERE DATE(COALESCE(created_at, NOW())) = CURDATE()
           OR (created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))
    """)
    new_cat_row = cursor.fetchone()
    new_categories = new_cat_row['new_categories'] if new_cat_row else 0

    # 2. Main Query with live count of linked products if products_tab exists
    query = """
        SELECT 
            c.cat_id,
            c.cat_name,
            COALESCE(c.description, '') AS description,
            COALESCE(c.status, 'Active') AS status,
            COALESCE(c.created_at, '') AS created_at,
            COALESCE((SELECT COUNT(*) FROM products_tab p WHERE p.cat_id = c.cat_id), 0) AS total_products
        FROM categories_tab c
        WHERE 1=1
    """
    params = []

    if filters:
        # Header unified search: by Category ID or Category Name
        search = filters.get('search', [''])[0].strip()
        if search:
            clean_search = search.lstrip('#').strip()
            if clean_search.isdigit():
                query += """ AND (
                    c.cat_id = %s OR 
                    CAST(c.cat_id AS CHAR) LIKE %s OR 
                    LOWER(c.cat_name) LIKE LOWER(%s)
                )"""
                params.extend([int(clean_search), f"{clean_search}%", f"%{search}%"])
            else:
                query += """ AND (
                    LOWER(c.cat_name) LIKE LOWER(%s) OR 
                    LOWER(COALESCE(c.description, '')) LIKE LOWER(%s)
                )"""
                s = f"%{search}%"
                params.extend([s, s])

        # Filter Card: Category ID
        cid = filters.get('id', [''])[0].strip().lstrip('#').strip()
        if cid:
            if cid.isdigit():
                query += " AND (c.cat_id = %s OR CAST(c.cat_id AS CHAR) LIKE %s)"
                params.extend([int(cid), f"{cid}%"])
            else:
                query += " AND CAST(c.cat_id AS CHAR) LIKE %s"
                params.append(f"%{cid}%")

        # Filter Card: Category Name
        name = filters.get('name', [''])[0].strip()
        if name:
            query += " AND LOWER(c.cat_name) LIKE LOWER(%s)"
            params.append(f"%{name}%")

        # Filter Card: Status (Active / Inactive)
        status = filters.get('status', [''])[0].strip()
        if status in ['Active', 'Inactive']:
            query += " AND LOWER(c.status) = LOWER(%s)"
            params.append(status)

        # Dynamic Sorting
        sort = filters.get('sort', ['newest'])[0].strip()
        if sort == 'oldest':
            query += " ORDER BY c.cat_id ASC"
        elif sort in ['name', 'name_asc', 'nameAsc']:
            query += " ORDER BY LOWER(c.cat_name) ASC"
        elif sort in ['name_desc', 'nameDesc']:
            query += " ORDER BY LOWER(c.cat_name) DESC"
        elif sort in ['products', 'products_desc']:
            query += " ORDER BY total_products DESC"
        else:
            query += " ORDER BY c.cat_id DESC"
    else:
        query += " ORDER BY c.cat_id DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    for r in rows:
        if r.get('created_at'):
            if isinstance(r['created_at'], (datetime.datetime, datetime.date)):
                r['created_at'] = r['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            else:
                r['created_at'] = str(r['created_at'])
        else:
            r['created_at'] = ''

    cursor.close()
    conn.close()

    return {
        'metrics': {
            'totalCategories': total,
            'activeCategories': active,
            'inactiveCategories': inactive,
            'newCategories': new_categories
        },
        'categories': rows
    }


# ==========================================================
# 2. Fetch Single Category by ID
# ==========================================================
def get_category_by_id(cid):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT 
            c.cat_id,
            c.cat_name,
            COALESCE(c.description, '') AS description,
            COALESCE(c.status, 'Active') AS status,
            COALESCE(c.created_at, '') AS created_at,
            COALESCE((SELECT COUNT(*) FROM products_tab p WHERE p.cat_id = c.cat_id), 0) AS total_products
        FROM categories_tab c
        WHERE c.cat_id = %s
    """
    cursor.execute(query, (cid,))
    category = cursor.fetchone()
    cursor.close()
    conn.close()

    if category:
        if category.get('created_at') and isinstance(category['created_at'], (datetime.datetime, datetime.date)):
            category['created_at'] = category['created_at'].strftime('%Y-%m-%d %H:%M:%S')
        else:
            category['created_at'] = str(category.get('created_at') or '')
    return category


# ==========================================================
# 3. Create Category
# ==========================================================
def add_category(data):
    cat_name = str(data.get('cat_name') or data.get('name', '')).strip()
    description = str(data.get('description', '')).strip()
    status = str(data.get('status', 'Active')).strip() or 'Active'

    if not cat_name:
        raise ValueError("Category Name is required.")

    conn = get_db()
    cursor = conn.cursor()
    sql = """
        INSERT INTO categories_tab (cat_name, description, status, created_at)
        VALUES (%s, %s, %s, NOW())
    """
    cursor.execute(sql, (cat_name, description, status))
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


# ==========================================================
# 4. Edit Category
# ==========================================================
def edit_category(data):
    cid = data.get('cat_id') or data.get('id')
    if not cid:
        raise ValueError("Category ID is required for editing.")

    cat_name = str(data.get('cat_name') or data.get('name', '')).strip()
    description = str(data.get('description', '')).strip()
    status = str(data.get('status', '')).strip() or 'Active'

    if not cat_name:
        raise ValueError("Category Name cannot be empty.")

    conn = get_db()
    cursor = conn.cursor()
    sql = """
        UPDATE categories_tab
        SET cat_name = %s, description = %s, status = %s
        WHERE cat_id = %s
    """
    cursor.execute(sql, (cat_name, description, status, cid))
    conn.commit()
    affected = cursor.rowcount
    cursor.close()
    conn.close()
    return affected > 0 or True


# ==========================================================
# 5. Delete Category
# ==========================================================
def delete_category(cid):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM categories_tab WHERE cat_id = %s", (cid,))
    conn.commit()
    affected = cursor.rowcount
    cursor.close()
    conn.close()
    return affected > 0


# ==========================================================
# HTTP Request Handler
# ==========================================================
class CategoryDashboardHandler(BaseHTTPRequestHandler):

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.end_headers()
        self.wfile.write(json.dumps(data, default=json_serializer).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_json({'status': 'ok'})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 1. API: List Categories (Search, Filter, Metrics, Sort)
        if path in ['/api/categories', '/api/category/list']:
            try:
                result = get_categories(query)
                self.send_json(result, 200)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 500)
            return

        # 2. API: Single Category by ID
        if path in ['/api/category', '/api/category/view']:
            try:
                cid = query.get('id', [None])[0] or query.get('cat_id', [None])[0]
                if not cid:
                    self.send_json({'status': 'error', 'message': 'Category ID is required'}, 400)
                    return
                category = get_category_by_id(cid)
                if category:
                    self.send_json({'status': 'success', 'category': category}, 200)
                else:
                    self.send_json({'status': 'error', 'message': 'Category not found'}, 404)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 500)
            return

        # 3. API: User Profile for Header Dropdown
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
        filename = path.lstrip('/') or 'categories.html'
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

        # 1. Add Category
        if path in ['/api/categories/add', '/api/category/add', '/api/categories/create']:
            try:
                new_id = add_category(data)
                self.send_json({
                    'status': 'success',
                    'message': f"Category '{data.get('cat_name') or data.get('name')}' created successfully (ID #{new_id}).",
                    'cat_id': new_id,
                    'id': new_id
                }, 200)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 400)
            return

        # 2. Edit Category
        if path in ['/api/categories/edit', '/api/category/edit', '/api/categories/update']:
            try:
                edit_category(data)
                self.send_json({
                    'status': 'success',
                    'message': f"Category details updated successfully."
                }, 200)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 400)
            return

        # 3. Delete Category
        if path in ['/api/categories/delete', '/api/category/delete']:
            try:
                cid = data.get('cat_id') or data.get('id')
                if not cid:
                    self.send_json({'status': 'error', 'message': 'Missing category ID'}, 400)
                    return
                ok = delete_category(cid)
                if ok:
                    self.send_json({'status': 'success', 'message': f'Category #{cid} deleted successfully.'}, 200)
                else:
                    self.send_json({'status': 'error', 'message': 'Category not found or already deleted'}, 404)
            except Exception as e:
                self.send_json({'status': 'error', 'message': str(e)}, 500)
            return

        self.send_json({'status': 'error', 'message': 'Endpoint not found'}, 404)


def run_server(preferred_ports=[9007, 9010, 9008, 9009]):
    init_db_schema()
    httpd = None
    selected_port = None

    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        preferred_ports = [int(sys.argv[1])] + preferred_ports

    for port in preferred_ports:
        try:
            server_address = ('0.0.0.0', port)
            httpd = HTTPServer(server_address, CategoryDashboardHandler)
            selected_port = port
            break
        except OSError:
            continue

    if not httpd:
        print("ERROR: Could not bind to any port in", preferred_ports)
        sys.exit(1)

    print('=' * 60)
    print(' Category Management System - Backend Server')
    print('=' * 60)
    print(f'Server Running At:    http://localhost:{selected_port}/')
    print(f'Categories Dashboard: http://localhost:{selected_port}/categories.html')
    print(f'API Endpoint:         http://localhost:{selected_port}/api/categories')
    print('=' * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down category backend server...')
        httpd.server_close()
        sys.exit(0)


if __name__ == '__main__':
    run_server()
