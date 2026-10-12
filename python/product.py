"""
product.py - Clean, Robust Python HTTPServer Backend for Product Management
Database: MySQL 'project' | Tables: 'products_tab', 'categories_tab', 'registration'
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
import base64

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'project'
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)


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
    """Ensure table columns exist and add product_name if not already present."""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        # Check if product_name exists in products_tab
        cursor.execute("SHOW COLUMNS FROM products_tab LIKE 'product_name'")
        col = cursor.fetchone()
        if not col:
            cursor.execute("ALTER TABLE products_tab ADD COLUMN product_name VARCHAR(150) NULL AFTER cat_id")
            conn.commit()
            print("[DB] Added 'product_name' column to 'products_tab' table.")

            # Backfill existing products with reasonable names based on image or ID
            cursor.execute("SELECT product_id, image FROM products_tab")
            rows = cursor.fetchall()
            for r in rows:
                img = r.get('image', '') or ''
                name = img.rsplit('.', 1)[0].replace('-', ' ').replace('_', ' ').title() if img else f"Product #{r['product_id']}"
                cursor.execute("UPDATE products_tab SET product_name = %s WHERE product_id = %s", (name, r['product_id']))
            conn.commit()
            print("[DB] Backfilled product names for existing records.")

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[DB INIT ERROR] {e}")


# ==========================================================
# 1. Fetch Products with Dynamic Filters, Metrics, and Sorting
# ==========================================================
def get_products(filters=None):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    # 1. Metrics counters
    cursor.execute("SELECT COUNT(*) AS total FROM products_tab")
    total = cursor.fetchone()['total'] or 0

    cursor.execute("SELECT COUNT(*) AS in_stock FROM products_tab WHERE LOWER(status) = 'in stock' OR stock > 10")
    in_stock = cursor.fetchone()['in_stock'] or 0

    cursor.execute("SELECT COUNT(*) AS low_stock FROM products_tab WHERE LOWER(status) = 'low stock' OR (stock > 0 AND stock <= 10)")
    low_stock = cursor.fetchone()['low_stock'] or 0

    cursor.execute("SELECT COUNT(*) AS out_stock FROM products_tab WHERE LOWER(status) = 'out of stock' OR stock = 0")
    out_stock = cursor.fetchone()['out_stock'] or 0

    # 2. Base Query with category join
    query = """
        SELECT 
            p.product_id,
            COALESCE(p.product_name, CONCAT('Product #', p.product_id)) AS product_name,
            p.cat_id,
            COALESCE(c.cat_name, 'Uncategorized') AS cat_name,
            p.image,
            p.price,
            p.stock,
            p.status,
            p.created_at
        FROM products_tab p
        LEFT JOIN categories_tab c ON p.cat_id = c.cat_id
        WHERE 1=1
    """
    params = []

    if filters:
        # Header unified search
        search = filters.get('search', [''])[0].strip()
        if search:
            query += """ AND (
                CAST(p.product_id AS CHAR) LIKE %s OR 
                LOWER(p.product_name) LIKE LOWER(%s) OR 
                LOWER(c.cat_name) LIKE LOWER(%s)
            )"""
            s = f"%{search}%"
            params.extend([s, s, s])

        # Filter: Product ID
        pid = filters.get('id', [''])[0].strip()
        if pid:
            query += " AND (CAST(p.product_id AS CHAR) LIKE %s OR p.product_id = %s)"
            params.extend([f"%{pid}%", int(pid) if pid.isdigit() else 0])

        # Filter: Product Name
        name = filters.get('name', [''])[0].strip()
        if name:
            query += " AND LOWER(p.product_name) LIKE LOWER(%s)"
            params.append(f"%{name}%")

        # Filter: Category (ID or Name)
        cat = filters.get('category', [''])[0].strip()
        if cat:
            if cat.isdigit():
                query += " AND p.cat_id = %s"
                params.append(int(cat))
            else:
                query += " AND LOWER(c.cat_name) = LOWER(%s)"
                params.append(cat)

        # Filter: Status
        status = filters.get('status', [''])[0].strip()
        if status:
            if status.lower() in ['in stock', 'instock', 'active']:
                query += " AND (LOWER(p.status) = 'in stock' OR p.stock > 10)"
            elif status.lower() in ['low stock', 'lowstock']:
                query += " AND (LOWER(p.status) = 'low stock' OR (p.stock > 0 AND p.stock <= 10))"
            elif status.lower() in ['out of stock', 'outofstock', 'inactive']:
                query += " AND (LOWER(p.status) = 'out of stock' OR p.stock = 0)"
            else:
                query += " AND LOWER(p.status) = LOWER(%s)"
                params.append(status)

        # Filter: Date Range
        from_date = filters.get('from_date', [''])[0].strip()
        if from_date:
            query += " AND DATE(p.created_at) >= %s"
            params.append(from_date)

        to_date = filters.get('to_date', [''])[0].strip()
        if to_date:
            query += " AND DATE(p.created_at) <= %s"
            params.append(to_date)

        # Dynamic Sorting
        sort = filters.get('sort', ['newest'])[0].strip()
        if sort == 'oldest':
            query += " ORDER BY p.product_id ASC"
        elif sort == 'name_asc':
            query += " ORDER BY LOWER(p.product_name) ASC"
        elif sort == 'name_desc':
            query += " ORDER BY LOWER(p.product_name) DESC"
        elif sort == 'price_asc':
            query += " ORDER BY p.price ASC"
        elif sort == 'price_desc':
            query += " ORDER BY p.price DESC"
        else:
            query += " ORDER BY p.product_id DESC"
    else:
        query += " ORDER BY p.product_id DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return {
        'metrics': {
            'total': total,
            'inStock': in_stock,
            'lowStock': low_stock,
            'outOfStock': out_stock
        },
        'products': rows
    }


# ==========================================================
# 2. Fetch Single Product
# ==========================================================
def get_product_by_id(product_id):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT 
            p.product_id,
            COALESCE(p.product_name, CONCAT('Product #', p.product_id)) AS product_name,
            p.cat_id,
            COALESCE(c.cat_name, 'Uncategorized') AS cat_name,
            p.image,
            p.price,
            p.stock,
            p.status,
            p.created_at
        FROM products_tab p
        LEFT JOIN categories_tab c ON p.cat_id = c.cat_id
        WHERE p.product_id = %s
    """
    cursor.execute(query, (product_id,))
    product = cursor.fetchone()
    cursor.close()
    conn.close()
    return product


# ==========================================================
# 3. Fetch Categories
# ==========================================================
def get_categories():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT cat_id, cat_name, status FROM categories_tab ORDER BY cat_name ASC")
    categories = cursor.fetchall()
    cursor.close()
    conn.close()
    return categories


# ==========================================================
# 4. Create Product
# ==========================================================
def create_product(data):
    conn = get_db()
    cursor = conn.cursor()

    product_name = data.get('product_name', '').strip()
    cat_id = data.get('cat_id')
    price = float(data.get('price', 0.0))
    stock = int(data.get('stock', 0))
    status = data.get('status', 'in stock').strip()
    image = data.get('image', '').strip() or 'product-default.jpg'

    # Auto-adjust status if stock is 0 or low
    if not status:
        if stock == 0:
            status = 'Out of stock'
        elif stock <= 10:
            status = 'low stock'
        else:
            status = 'in stock'

    query = """
        INSERT INTO products_tab (cat_id, product_name, image, price, stock, status, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, NOW())
    """
    cursor.execute(query, (cat_id, product_name, image, price, stock, status))
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


# ==========================================================
# 5. Update Product
# ==========================================================
def update_product(product_id, data):
    conn = get_db()
    cursor = conn.cursor()

    product_name = data.get('product_name', '').strip()
    cat_id = data.get('cat_id')
    price = float(data.get('price', 0.0))
    stock = int(data.get('stock', 0))
    status = data.get('status', 'in stock').strip()
    image = data.get('image', None)

    if image:
        query = """
            UPDATE products_tab
            SET cat_id = %s, product_name = %s, image = %s, price = %s, stock = %s, status = %s
            WHERE product_id = %s
        """
        cursor.execute(query, (cat_id, product_name, image, price, stock, status, product_id))
    else:
        query = """
            UPDATE products_tab
            SET cat_id = %s, product_name = %s, price = %s, stock = %s, status = %s
            WHERE product_id = %s
        """
        cursor.execute(query, (cat_id, product_name, price, stock, status, product_id))

    conn.commit()
    cursor.close()
    conn.close()
    return True


# ==========================================================
# 6. Delete Product
# ==========================================================
def delete_product(product_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM products_tab WHERE product_id = %s", (product_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return True


# ==========================================================
# 7. Get Current User Profile for Header
# ==========================================================
def get_user_profile(user_id=None, username=None, cookies=None):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    user = None

    if user_id:
        clean_id = str(user_id).lstrip('#').strip()
        if clean_id.isdigit():
            cursor.execute("SELECT id, full_name, username, email, role, status, profile_picture FROM registration WHERE id = %s", (int(clean_id),))
            user = cursor.fetchone()

    if not user and username:
        clean_username = str(username).lstrip('@').strip()
        cursor.execute("SELECT id, full_name, username, email, role, status, profile_picture FROM registration WHERE username = %s", (clean_username,))
        user = cursor.fetchone()

    if not user and cookies:
        cookie_username = cookies.get("admin_username") or cookies.get("username")
        cookie_id = cookies.get("admin_id") or cookies.get("user_id") or cookies.get("current_user_id")
        cookie_email = cookies.get("admin_email")

        if cookie_username:
            cursor.execute("SELECT id, full_name, username, email, role, status, profile_picture FROM registration WHERE username = %s", (cookie_username.strip(),))
            user = cursor.fetchone()
        if not user and cookie_id and str(cookie_id).lstrip('#').isdigit():
            cursor.execute("SELECT id, full_name, username, email, role, status, profile_picture FROM registration WHERE id = %s", (int(str(cookie_id).lstrip('#')),))
            user = cursor.fetchone()
        if not user and cookie_email:
            cursor.execute("SELECT id, full_name, username, email, role, status, profile_picture FROM registration WHERE email = %s", (cookie_email.strip(),))
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
    return user


# ==========================================================
# HTTP Request Handler
# ==========================================================
class ProductManagementHandler(BaseHTTPRequestHandler):

    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, default=json_serializer).encode('utf-8'))

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 1. API: List products with metrics and search filters
        if path == '/api/products':
            try:
                res = get_products(query)
                self._send_json(200, res)
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        # 2. API: Get single product /api/products/<id>
        if path.startswith('/api/products/'):
            parts = path.strip('/').split('/')
            if len(parts) == 3 and parts[2].isdigit():
                pid = int(parts[2])
                try:
                    product = get_product_by_id(pid)
                    if product:
                        self._send_json(200, {'success': True, 'product': product})
                    else:
                        self._send_json(404, {'success': False, 'error': 'Product not found'})
                except Exception as e:
                    self._send_json(500, {'success': False, 'error': str(e)})
                return

        # 3. API: List categories
        if path == '/api/categories':
            try:
                categories = get_categories()
                self._send_json(200, {'success': True, 'categories': categories})
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        # 4. API: Current User Profile
        if path in ['/api/user/profile', '/api/users/profile', '/api/profile', '/api/user']:
            try:
                user_id = query.get('id', [None])[0]
                username = query.get('username', [None])[0]
                cookie_header = self.headers.get("Cookie", "")
                cookies = {}
                for item in cookie_header.split(";"):
                    if "=" in item:
                        k, v = item.strip().split("=", 1)
                        cookies[k.strip()] = v.strip()
                profile = get_user_profile(user_id=user_id, username=username, cookies=cookies)
                self._send_json(200, {'success': True, 'status': 'success', 'user': profile, 'profile': profile})
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        # 5. Static File Serving
        clean_path = path.lstrip('/') or 'product.html'
        file_path = os.path.join(BASE_DIR, clean_path)

        # Security check against directory traversal
        if not os.path.abspath(file_path).startswith(BASE_DIR):
            self.send_error(403, "Forbidden")
            return

        if os.path.exists(file_path) and os.path.isfile(file_path):
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = 'application/octet-stream'
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', mime_type)
            self.end_headers()
            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, "File Not Found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_length)

        try:
            data = json.loads(post_body.decode('utf-8')) if post_body else {}
        except Exception:
            data = {}

        # Handle base64 image save if provided
        image_base64 = data.get('image_base64')
        image_filename = data.get('image_filename')
        if image_base64 and image_filename:
            try:
                if ',' in image_base64:
                    image_base64 = image_base64.split(',', 1)[1]
                safe_name = f"prod_{int(datetime.datetime.now().timestamp())}_{image_filename}"
                out_path = os.path.join(UPLOAD_DIR, safe_name)
                with open(out_path, 'wb') as f:
                    f.write(base64.b64decode(image_base64))
                data['image'] = f"uploads/{safe_name}"
            except Exception as e:
                print(f"[IMAGE UPLOAD ERROR] {e}")

        # 1. API: Create Product
        if path == '/api/products' or path == '/api/products/create':
            try:
                new_id = create_product(data)
                self._send_json(201, {'success': True, 'message': 'Product created successfully', 'product_id': new_id})
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        # 2. API: Update Product via POST /api/products/update
        if path == '/api/products/update':
            try:
                pid = data.get('product_id')
                if not pid:
                    self._send_json(400, {'success': False, 'error': 'Product ID is required'})
                    return
                update_product(pid, data)
                self._send_json(200, {'success': True, 'message': 'Product updated successfully'})
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        # 3. API: Delete Product via POST /api/products/delete
        if path == '/api/products/delete':
            try:
                pid = data.get('product_id')
                if not pid:
                    self._send_json(400, {'success': False, 'error': 'Product ID is required'})
                    return
                delete_product(pid)
                self._send_json(200, {'success': True, 'message': 'Product deleted successfully'})
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        self.send_error(404, "Endpoint not found")

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/products/'):
            parts = path.strip('/').split('/')
            if len(parts) == 3 and parts[2].isdigit():
                pid = int(parts[2])
                content_length = int(self.headers.get('Content-Length', 0))
                put_body = self.rfile.read(content_length)
                try:
                    data = json.loads(put_body.decode('utf-8')) if put_body else {}
                    update_product(pid, data)
                    self._send_json(200, {'success': True, 'message': 'Product updated successfully'})
                except Exception as e:
                    self._send_json(500, {'success': False, 'error': str(e)})
                return

        self.send_error(404, "Endpoint not found")

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/products/'):
            parts = path.strip('/').split('/')
            if len(parts) == 3 and parts[2].isdigit():
                pid = int(parts[2])
                try:
                    delete_product(pid)
                    self._send_json(200, {'success': True, 'message': 'Product deleted successfully'})
                except Exception as e:
                    self._send_json(500, {'success': False, 'error': str(e)})
                return

        self.send_error(404, "Endpoint not found")


def run(port=9007):
    init_db_schema()
    server_address = ('', port)
    try:
        httpd = HTTPServer(server_address, ProductManagementHandler)
        print(f"============================================================")
        print(f" [PRODUCT SERVER] Running at http://localhost:{port}/product.html")
        print(f" [API ENDPOINTS]  http://localhost:{port}/api/products")
        print(f"============================================================")
        httpd.serve_forever()
    except OSError as e:
        if "address already in use" in str(e).lower() or e.errno == 10048:
            print(f"[PORT IN USE] Port {port} is currently in use. Trying port 9008...")
            run(port=9008)
        else:
            raise e


if __name__ == '__main__':
    port = 9007
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run(port)