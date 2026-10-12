"""
order.py - Clean, Robust Python HTTPServer Backend for Order Management
Database: MySQL 'project' | Tables: 'order_tab', 'order_item', 'customer_tab', 'products_tab', 'registration'
Host: localhost | Port: 9009 | User: root | Password: (blank)
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
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


def get_quantity_column(cursor):
    """Check if column is named 'quntity' or 'quantity' in order_item table"""
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = %s AND table_name = 'order_item'
    """, (DB_CONFIG['database'],))
    cols = [r['column_name'].lower() for r in cursor.fetchall()]
    if 'quntity' in cols:
        return 'quntity'
    return 'quantity'


def get_orders(filters=None):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    qty_col = get_quantity_column(cursor)

    # 1. Metrics counters
    cursor.execute("SELECT COUNT(*) AS total FROM order_tab")
    total = cursor.fetchone()['total'] or 0

    cursor.execute("SELECT COUNT(*) AS pending FROM order_tab WHERE LOWER(order_status) = 'pending'")
    pending = cursor.fetchone()['pending'] or 0

    cursor.execute("SELECT COUNT(*) AS completed FROM order_tab WHERE LOWER(order_status) = 'completed'")
    completed = cursor.fetchone()['completed'] or 0

    cursor.execute("SELECT COUNT(*) AS cancelled FROM order_tab WHERE LOWER(order_status) = 'cancelled'")
    cancelled = cursor.fetchone()['cancelled'] or 0

    # 2. Main Query
    query = f"""
        SELECT 
            o.order_id,
            o.customer_id,
            o.total_amount,
            o.payment_method,
            o.payment_status,
            o.order_status,
            o.order_date,
            COALESCE(o.cash_received, o.total_amount) AS cash_received,
            COALESCE(o.change_returned, 0.00) AS change_returned,
            COALESCE(o.cashier_name, r.full_name, 'Cashier') AS cashier_name,
            o.cashier_id,
            COALESCE(c.customer_name, 'Guest Customer') AS customer_name,
            COALESCE(c.phone, '') AS phone,
            COALESCE(c.phone, '') AS customer_phone,
            COALESCE(c.email, '') AS email,
            COALESCE((
                SELECT SUM(oi.`{qty_col}`) 
                FROM order_item oi 
                WHERE oi.order_id = o.order_id
            ), 0) AS total_items
        FROM order_tab o
        LEFT JOIN customer_tab c ON o.customer_id = c.customer_id
        LEFT JOIN registration r ON o.cashier_id = r.id
        WHERE 1=1
    """
    params = []

    if filters:
        # Header Search (Order ID, Customer ID, Customer Name, Mobile)
        search = filters.get('search', [''])[0].strip()
        if search:
            query += """ AND (
                CAST(o.order_id AS CHAR) LIKE %s OR 
                CAST(o.customer_id AS CHAR) LIKE %s OR 
                LOWER(c.customer_name) LIKE LOWER(%s) OR 
                c.phone LIKE %s
            )"""
            s = f"%{search}%"
            params.extend([s, s, s, s])

        # Filter: Order ID
        order_id = filters.get('order_id', [''])[0].strip()
        if order_id:
            query += " AND (CAST(o.order_id AS CHAR) LIKE %s OR o.order_id = %s)"
            params.extend([f"%{order_id}%", int(order_id) if order_id.isdigit() else 0])

        # Filter: Customer
        customer = filters.get('customer', [''])[0].strip()
        if customer:
            query += " AND (LOWER(c.customer_name) LIKE LOWER(%s) OR c.phone LIKE %s)"
            c_val = f"%{customer}%"
            params.extend([c_val, c_val])

        # Filter: Order Status
        status = filters.get('status', [''])[0].strip()
        if status:
            query += " AND LOWER(o.order_status) = LOWER(%s)"
            params.append(status)

        # Filter: Date Range
        from_date = filters.get('from_date', [''])[0].strip()
        if from_date:
            query += " AND DATE(o.order_date) >= %s"
            params.append(from_date)

        to_date = filters.get('to_date', [''])[0].strip()
        if to_date:
            query += " AND DATE(o.order_date) <= %s"
            params.append(to_date)

    query += " ORDER BY o.order_id DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return {
        'metrics': {
            'total': total,
            'pending': pending,
            'completed': completed,
            'cancelled': cancelled
        },
        'orders': rows
    }


def get_order_by_id(order_id):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    qty_col = get_quantity_column(cursor)

    query = """
        SELECT 
            o.order_id,
            o.customer_id,
            o.total_amount,
            o.payment_method,
            o.payment_status,
            o.order_status,
            o.order_date,
            COALESCE(o.cash_received, o.total_amount) AS cash_received,
            COALESCE(o.change_returned, 0.00) AS change_returned,
            COALESCE(o.cashier_name, r.full_name, 'Cashier') AS cashier_name,
            o.cashier_id,
            c.customer_name,
            c.phone,
            c.phone AS customer_phone,
            c.email,
            c.address,
            c.city
        FROM order_tab o
        LEFT JOIN customer_tab c ON o.customer_id = c.customer_id
        LEFT JOIN registration r ON o.cashier_id = r.id
        WHERE o.order_id = %s
    """
    cursor.execute(query, (order_id,))
    order = cursor.fetchone()

    if not order:
        cursor.close()
        conn.close()
        return None

    # Fetch order items
    item_query = f"""
        SELECT 
            oi.item_id,
            oi.product_id,
            COALESCE(p.product_name, CONCAT('Product #', oi.product_id)) AS product_name,
            p.image,
            oi.`{qty_col}` AS quantity,
            oi.price,
            oi.subtotal
        FROM order_item oi
        LEFT JOIN products_tab p ON oi.product_id = p.product_id
        WHERE oi.order_id = %s
    """
    cursor.execute(item_query, (order_id,))
    items = cursor.fetchall()
    order['items'] = items

    cursor.close()
    conn.close()
    return order


def get_customers_list():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT customer_id, customer_name, phone, email, address, city FROM customer_tab ORDER BY customer_name ASC")
    customers = cursor.fetchall()
    cursor.close()
    conn.close()
    return customers


def create_customer(data):
    conn = get_db()
    cursor = conn.cursor()
    name = data.get('customer_name', '').strip()
    phone = data.get('phone', '').strip()
    email = data.get('email', '').strip()
    address = data.get('address', '').strip()
    city = data.get('city', '').strip()

    query = """
        INSERT INTO customer_tab (customer_name, phone, email, address, city, status, create_at, date)
        VALUES (%s, %s, %s, %s, %s, 'Active', NOW(), CURDATE())
    """
    cursor.execute(query, (name, phone, email, address, city))
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


def get_products_list():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT product_id, COALESCE(product_name, CONCAT('Product #', product_id)) AS product_name, price, stock, status FROM products_tab ORDER BY product_id ASC")
    products = cursor.fetchall()
    cursor.close()
    conn.close()
    return products


def create_order(data):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    qty_col = get_quantity_column(cursor)

    customer_id = data.get('customer_id')
    payment_method = data.get('payment_method', 'Cash')
    payment_status = data.get('payment_status', 'Pending')
    order_status = data.get('order_status', 'Pending')
    items = data.get('items', [])

    # Calculate total amount
    total_amount = Decimal('0.00')
    processed_items = []
    for item in items:
        pid = int(item.get('product_id'))
        qty = int(item.get('quantity', 1))
        price = Decimal(str(item.get('price', 0.0)))
        subtotal = price * qty
        total_amount += subtotal
        processed_items.append({
            'product_id': pid,
            'quantity': qty,
            'price': price,
            'subtotal': subtotal
        })

    # If total amount explicitly passed
    if data.get('total_amount'):
        try:
            total_amount = Decimal(str(data.get('total_amount')))
        except Exception:
            pass

    # Insert into order_tab
    order_sql = """
        INSERT INTO order_tab (customer_id, total_amount, payment_method, payment_status, order_status, order_date)
        VALUES (%s, %s, %s, %s, %s, NOW())
    """
    cursor.execute(order_sql, (customer_id, total_amount, payment_method, payment_status, order_status))
    conn.commit()
    new_order_id = cursor.lastrowid

    # Insert order items
    item_sql = f"""
        INSERT INTO order_item (order_id, product_id, `{qty_col}`, price, subtotal)
        VALUES (%s, %s, %s, %s, %s)
    """
    for it in processed_items:
        cursor.execute(item_sql, (new_order_id, it['product_id'], it['quantity'], it['price'], it['subtotal']))
    conn.commit()

    cursor.close()
    conn.close()
    return new_order_id


def update_order(order_id, data):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    qty_col = get_quantity_column(cursor)

    customer_id = data.get('customer_id')
    payment_method = data.get('payment_method', 'Cash')
    payment_status = data.get('payment_status', 'Pending')
    order_status = data.get('order_status', 'Pending')
    items = data.get('items', None)

    total_amount = None
    if items is not None:
        total_amount = Decimal('0.00')
        processed_items = []
        for item in items:
            pid = int(item.get('product_id'))
            qty = int(item.get('quantity', 1))
            price = Decimal(str(item.get('price', 0.0)))
            subtotal = price * qty
            total_amount += subtotal
            processed_items.append({
                'product_id': pid,
                'quantity': qty,
                'price': price,
                'subtotal': subtotal
            })

    if data.get('total_amount'):
        try:
            total_amount = Decimal(str(data.get('total_amount')))
        except Exception:
            pass

    if total_amount is not None:
        update_sql = """
            UPDATE order_tab
            SET customer_id = %s, total_amount = %s, payment_method = %s, payment_status = %s, order_status = %s
            WHERE order_id = %s
        """
        cursor.execute(update_sql, (customer_id, total_amount, payment_method, payment_status, order_status, order_id))
    else:
        update_sql = """
            UPDATE order_tab
            SET customer_id = %s, payment_method = %s, payment_status = %s, order_status = %s
            WHERE order_id = %s
        """
        cursor.execute(update_sql, (customer_id, payment_method, payment_status, order_status, order_id))
    conn.commit()

    # If new items list provided, replace old items
    if items is not None:
        cursor.execute("DELETE FROM order_item WHERE order_id = %s", (order_id,))
        item_sql = f"""
            INSERT INTO order_item (order_id, product_id, `{qty_col}`, price, subtotal)
            VALUES (%s, %s, %s, %s, %s)
        """
        for it in processed_items:
            cursor.execute(item_sql, (order_id, it['product_id'], it['quantity'], it['price'], it['subtotal']))
        conn.commit()

    cursor.close()
    conn.close()
    return True


def delete_order(order_id):
    conn = get_db()
    cursor = conn.cursor()
    # Delete child items first
    cursor.execute("DELETE FROM order_item WHERE order_id = %s", (order_id,))
    # Delete parent order
    cursor.execute("DELETE FROM order_tab WHERE order_id = %s", (order_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return True


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


class OrderManagementHandler(BaseHTTPRequestHandler):

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

        # 1. API: List orders with search and filters
        if path == '/api/orders':
            try:
                res = get_orders(query)
                self._send_json(200, {'success': True, **res})
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        # 2. API: Single order details /api/orders/<id>
        if path.startswith('/api/orders/'):
            parts = path.strip('/').split('/')
            if len(parts) == 3 and parts[2].isdigit():
                oid = int(parts[2])
                try:
                    order = get_order_by_id(oid)
                    if order:
                        self._send_json(200, {'success': True, 'order': order})
                    else:
                        self._send_json(404, {'success': False, 'error': 'Order not found'})
                except Exception as e:
                    self._send_json(500, {'success': False, 'error': str(e)})
                return

        # 3. API: Customers list
        if path == '/api/customers':
            try:
                customers = get_customers_list()
                self._send_json(200, {'success': True, 'customers': customers})
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        # 4. API: Products list
        if path == '/api/products':
            try:
                products = get_products_list()
                self._send_json(200, {'success': True, 'products': products})
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        # 5. API: User profile
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

        # 6. Static files
        clean_path = path.lstrip('/') or 'order.html'
        file_path = os.path.join(BASE_DIR, clean_path)

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

        # 1. API: Create Order
        if path in ['/api/orders', '/api/orders/create']:
            try:
                new_id = create_order(data)
                self._send_json(201, {'success': True, 'message': 'Order created successfully', 'order_id': new_id})
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        # 2. API: Create Customer
        if path in ['/api/customers', '/api/customers/create']:
            try:
                new_id = create_customer(data)
                self._send_json(201, {
                    'success': True, 
                    'message': 'Customer added successfully', 
                    'customer_id': new_id,
                    'customer': {
                        'customer_id': new_id,
                        'customer_name': data.get('customer_name'),
                        'phone': data.get('phone'),
                        'email': data.get('email'),
                        'address': data.get('address'),
                        'city': data.get('city')
                    }
                })
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        # 2. API: Update Order via POST
        if path == '/api/orders/update':
            try:
                oid = data.get('order_id')
                if not oid:
                    self._send_json(400, {'success': False, 'error': 'Order ID is required'})
                    return
                update_order(oid, data)
                self._send_json(200, {'success': True, 'message': 'Order updated successfully'})
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        # 3. API: Delete Order via POST
        if path == '/api/orders/delete':
            try:
                oid = data.get('order_id')
                if not oid:
                    self._send_json(400, {'success': False, 'error': 'Order ID is required'})
                    return
                delete_order(oid)
                self._send_json(200, {'success': True, 'message': 'Order deleted successfully'})
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        self.send_error(404, "Endpoint not found")

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/orders/'):
            parts = path.strip('/').split('/')
            if len(parts) == 3 and parts[2].isdigit():
                oid = int(parts[2])
                content_length = int(self.headers.get('Content-Length', 0))
                put_body = self.rfile.read(content_length)
                try:
                    data = json.loads(put_body.decode('utf-8')) if put_body else {}
                    update_order(oid, data)
                    self._send_json(200, {'success': True, 'message': 'Order updated successfully'})
                except Exception as e:
                    self._send_json(500, {'success': False, 'error': str(e)})
                return

        self.send_error(404, "Endpoint not found")

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/orders/'):
            parts = path.strip('/').split('/')
            if len(parts) == 3 and parts[2].isdigit():
                oid = int(parts[2])
                try:
                    delete_order(oid)
                    self._send_json(200, {'success': True, 'message': 'Order deleted successfully'})
                except Exception as e:
                    self._send_json(500, {'success': False, 'error': str(e)})
                return

        self.send_error(404, "Endpoint not found")


def run(port=9009):
    server_address = ('', port)
    try:
        httpd = HTTPServer(server_address, OrderManagementHandler)
        print(f"============================================================")
        print(f" [ORDER SERVER] Running at http://localhost:{port}/order.html")
        print(f" [API ENDPOINTS] http://localhost:{port}/api/orders")
        print(f"============================================================")
        httpd.serve_forever()
    except OSError as e:
        if "address already in use" in str(e).lower() or e.errno == 10048:
            print(f"[PORT IN USE] Port {port} in use. Trying port 9010...")
            run(port=9010)
        else:
            raise e


if __name__ == '__main__':
    port = 9009
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run(port)