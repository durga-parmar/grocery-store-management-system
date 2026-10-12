"""
customer.py - Cashier Customer Management Python Backend Server
Database: MySQL 'project' via WAMP
Tables: 'customer_tab', 'order_tab', 'registration'
Host: 0.0.0.0 | Port: 9007 (fallback 9010, 9008, 9009, 9013, 9000, 8000)
"""

import os
import sys
import json
import mimetypes
from urllib.parse import parse_qs, urlparse, unquote
from http.server import BaseHTTPRequestHandler, HTTPServer
import mysql.connector
from mysql.connector import Error as MySQLError
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
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


def parse_cookies_dict(cookie_header):
    cookies = {}
    if not cookie_header:
        return cookies
    for item in cookie_header.split(";"):
        item = item.strip()
        if "=" in item:
            k, v = item.split("=", 1)
            cookies[k.strip()] = unquote(v.strip())
    return cookies


def get_current_user(user_id=None, username=None, cookies=None):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    user = None

    if user_id and str(user_id).lstrip('#').isdigit():
        cursor.execute("SELECT id, full_name, username, email, mobail, role, status, profile_picture FROM registration WHERE id = %s", (int(str(user_id).lstrip('#')),))
        user = cursor.fetchone()

    if not user and username:
        cursor.execute("SELECT id, full_name, username, email, mobail, role, status, profile_picture FROM registration WHERE username = %s", (str(username).strip(),))
        user = cursor.fetchone()

    if not user and cookies:
        c_user = cookies.get("cashier_username") or cookies.get("username")
        c_id = cookies.get("cashier_id") or cookies.get("user_id")
        if c_id and str(c_id).lstrip('#').isdigit():
            cursor.execute("SELECT id, full_name, username, email, mobail, role, status, profile_picture FROM registration WHERE id = %s", (int(str(c_id).lstrip('#')),))
            user = cursor.fetchone()
        elif c_user:
            cursor.execute("SELECT id, full_name, username, email, mobail, role, status, profile_picture FROM registration WHERE username = %s", (c_user.strip(),))
            user = cursor.fetchone()

    if not user:
        cursor.execute("""
            SELECT id, full_name, username, email, mobail, role, status, profile_picture
            FROM registration
            ORDER BY (CASE WHEN LOWER(role) = 'cashier' AND status = 'Active' THEN 0
                           WHEN LOWER(role) = 'cashier' THEN 1
                           ELSE 2 END), id ASC
            LIMIT 1
        """)
        user = cursor.fetchone()

    cursor.close()
    conn.close()

    if user:
        user['mobile'] = user.get('mobail') or ''
        user['profile_picture'] = user.get('profile_picture') or ''

    return user


def get_customers_list_with_metrics(filters=None):
    """Fetch customers joined with orders summary from customer_tab and order_tab."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT
            c.customer_id,
            c.customer_name,
            c.phone,
            c.email,
            c.city,
            c.address,
            c.status,
            c.create_at,
            COUNT(o.order_id) AS total_orders,
            COALESCE(SUM(o.total_amount), 0) AS total_purchase
        FROM customer_tab c
        LEFT JOIN order_tab o ON c.customer_id = o.customer_id
        WHERE 1=1
    """
    params = []

    if filters:
        keyword = filters.get("keyword", [""])[0].strip() or filters.get("search", [""])[0].strip()
        if keyword:
            clean_kw = keyword.lstrip("#")
            if clean_kw.isdigit():
                query += " AND (c.customer_id = %s OR CAST(c.customer_id AS CHAR) = %s)"
                params.extend([int(clean_kw), clean_kw])
            else:
                query += " AND (LOWER(c.customer_name) LIKE LOWER(%s) OR LOWER(c.phone) LIKE LOWER(%s) OR LOWER(c.email) LIKE LOWER(%s))"
                k = f"%{keyword}%"
                params.extend([k, k, k])

        status = filters.get("status", [""])[0].strip()
        if status and status.lower() != "all":
            query += " AND LOWER(c.status) = LOWER(%s)"
            params.append(status)

    query += " GROUP BY c.customer_id ORDER BY c.customer_id DESC"

    cursor.execute(query, params)
    customers = cursor.fetchall()
    cursor.close()
    conn.close()

    for c in customers:
        c['total_purchase'] = float(c.get('total_purchase') or 0.0)
        c['total_orders'] = int(c.get('total_orders') or 0)

    return customers


def get_customer_detail(customer_id):
    """Fetch single customer detail with total orders."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT
            c.customer_id,
            c.customer_name,
            c.phone,
            c.email,
            c.city,
            c.address,
            c.status,
            c.create_at,
            COUNT(o.order_id) AS total_orders,
            COALESCE(SUM(o.total_amount), 0) AS total_purchase
        FROM customer_tab c
        LEFT JOIN order_tab o ON c.customer_id = o.customer_id
        WHERE c.customer_id = %s
        GROUP BY c.customer_id
    """
    cursor.execute(query, (customer_id,))
    customer = cursor.fetchone()
    cursor.close()
    conn.close()

    if customer:
        customer['total_purchase'] = float(customer.get('total_purchase') or 0.0)
        customer['total_orders'] = int(customer.get('total_orders') or 0)

    return customer


def create_customer(data):
    """Insert a new customer into customer_tab."""
    name = data.get("customer_name", "").strip()
    phone = data.get("phone", "").strip()
    email = data.get("email", "").strip()
    city = data.get("city", "").strip()
    address = data.get("address", "").strip()
    status = data.get("status", "Active").strip()

    if not name or not phone:
        raise ValueError("Customer Name and Phone number are required.")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Check if phone already exists
    cursor.execute("SELECT customer_id FROM customer_tab WHERE phone = %s", (phone,))
    existing = cursor.fetchone()
    if existing:
        cursor.close()
        conn.close()
        raise ValueError(f"Customer with phone '{phone}' already exists (ID #{existing['customer_id']}).")

    insert_sql = """
        INSERT INTO customer_tab (customer_name, email, address, phone, city, status, create_at, date)
        VALUES (%s, %s, %s, %s, %s, %s, NOW(), CURDATE())
    """
    cursor.execute(insert_sql, (name, email, address, phone, city, status))
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()

    return new_id


def update_customer(data):
    """Update customer details in customer_tab."""
    customer_id = data.get("customer_id")
    if not customer_id:
        raise ValueError("Missing customer_id for update.")

    name = data.get("customer_name", "").strip()
    phone = data.get("phone", "").strip()
    email = data.get("email", "").strip()
    city = data.get("city", "").strip()
    address = data.get("address", "").strip()
    status = data.get("status", "Active").strip()

    if not name or not phone:
        raise ValueError("Customer Name and Phone number are required.")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    update_sql = """
        UPDATE customer_tab
        SET customer_name = %s, phone = %s, email = %s, city = %s, address = %s, status = %s
        WHERE customer_id = %s
    """
    cursor.execute(update_sql, (name, phone, email, city, address, status, customer_id))
    conn.commit()
    cursor.close()
    conn.close()
    return True


def get_customer_kpis():
    """Fetch 4 customer summary counts."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT COUNT(*) AS total_customers FROM customer_tab")
    total_customers = cursor.fetchone()['total_customers'] or 0

    cursor.execute("SELECT COUNT(*) AS today_customers FROM customer_tab WHERE DATE(create_at) = CURDATE() OR date = CURDATE()")
    today_customers = cursor.fetchone()['today_customers'] or 0

    cursor.execute("SELECT COUNT(*) AS active_customers FROM customer_tab WHERE LOWER(status) = 'active'")
    active_customers = cursor.fetchone()['active_customers'] or 0

    cursor.execute("SELECT COUNT(*) AS total_orders FROM order_tab")
    total_orders = cursor.fetchone()['total_orders'] or 0

    cursor.close()
    conn.close()

    return {
        "total_customers": total_customers,
        "today_customers": today_customers,
        "active_customers": active_customers,
        "total_orders": total_orders
    }


class CustomerHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send_json_response(self, status, data):
        body = json.dumps(data, default=json_serializer).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def _send_raw_response(self, status, content, mime_type="text/html; charset=utf-8"):
        if isinstance(content, str):
            content = content.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(content)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie")
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        cookie_header = self.headers.get("Cookie", "")
        cookies = parse_cookies_dict(cookie_header)

        # 1. API: Customers List
        if path in ["/api/customers", "/api/cashier/customers", "/api/customers/list"]:
            try:
                customers = get_customers_list_with_metrics(query)
                self._send_json_response(200, {"status": "success", "customers": customers})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 2. API: Single Customer Detail
        if path in ["/api/customers/detail", "/api/customer/detail"]:
            try:
                cid = query.get("id", [None])[0] or query.get("customer_id", [None])[0]
                if not cid:
                    self._send_json_response(400, {"status": "error", "message": "Missing customer id"})
                    return
                clean_id = str(cid).lstrip("#")
                cust = get_customer_detail(int(clean_id))
                if cust:
                    self._send_json_response(200, {"status": "success", "customer": cust})
                else:
                    self._send_json_response(404, {"status": "error", "message": "Customer not found"})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 3. API: Customers Summary KPIs
        if path in ["/api/customers/summary", "/api/cashier/customers/summary"]:
            try:
                summary = get_customer_kpis()
                self._send_json_response(200, {"status": "success", "summary": summary})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 4. API: User Profile
        if path in ["/api/user/profile", "/api/users/profile", "/api/cashier/profile"]:
            try:
                user_id = query.get("id", [None])[0]
                username = query.get("username", [None])[0]
                user = get_current_user(user_id=user_id, username=username, cookies=cookies)
                if user:
                    self._send_json_response(200, {"status": "success", "user": user})
                else:
                    self._send_json_response(404, {"status": "error", "message": "User not found"})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 5. Static Files
        req_path = path.lstrip("/")
        if not req_path or req_path == "":
            req_path = "customer.html"

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
                self._send_raw_response(200, content, mime_type)
            except Exception as e:
                self._send_raw_response(500, f"Error reading file: {e}", "text/plain; charset=utf-8")
        else:
            self._send_json_response(404, {"status": "error", "message": f"Resource '{path}' not found."})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else ""

        payload = {}
        if post_data:
            try:
                payload = json.loads(post_data)
            except Exception:
                payload = {k: v[0] for k, v in parse_qs(post_data).items()}

        # 1. Create Customer
        if path in ["/api/customers/create", "/api/customer/create", "/api/customers/add"]:
            try:
                new_id = create_customer(payload)
                self._send_json_response(200, {
                    "status": "success",
                    "message": f"Customer created successfully with ID #{new_id}",
                    "customer_id": new_id
                })
            except ValueError as ve:
                self._send_json_response(400, {"status": "error", "message": str(ve)})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": f"Database error: {str(e)}"})
            return

        # 2. Update Customer
        if path in ["/api/customers/update", "/api/customer/update", "/api/customers/edit"]:
            try:
                update_customer(payload)
                self._send_json_response(200, {
                    "status": "success",
                    "message": f"Customer #{payload.get('customer_id')} updated successfully."
                })
            except ValueError as ve:
                self._send_json_response(400, {"status": "error", "message": str(ve)})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": f"Database error: {str(e)}"})
            return

        # 3. Complete Sale / POS
        if path in ["/api/pos/complete", "/api/sales/complete", "/api/orders/create", "/api/pos/sale", "/api/order/complete"]:
            try:
                customer_id = payload.get("customer_id")
                total_amount = float(payload.get("total_amount") or 0.0)
                items = payload.get("items", [])

                conn = get_db_connection()
                conn.autocommit = False
                cursor = conn.cursor(dictionary=True)

                # 1. Insert order
                cursor.execute("""
                    INSERT INTO order_tab (customer_id, total_amount, payment_method, payment_status, order_status, order_date)
                    VALUES (%s, %s, 'Cash', 'Paid', 'Completed', NOW())
                """, (customer_id, Decimal(str(total_amount))))
                order_id = cursor.lastrowid

                # 2. Items & Stock
                for it in items:
                    pid = int(it["product_id"])
                    qty = int(it["quntity"])
                    price = Decimal(str(it["price"]))
                    subtotal = Decimal(str(it["subtotal"]))

                    cursor.execute("SELECT stock, product_name FROM products_tab WHERE product_id = %s FOR UPDATE", (pid,))
                    prod = cursor.fetchone()
                    if prod:
                        current_stock = int(prod["stock"] or 0)
                        new_stock = max(0, current_stock - qty)
                        new_status = 'Out of stock' if new_stock <= 0 else ('low stock' if new_stock <= 10 else 'in stock')
                        cursor.execute("UPDATE products_tab SET stock = %s, status = %s WHERE product_id = %s", (new_stock, new_status, pid))

                    cursor.execute("""
                        INSERT INTO order_item (order_id, product_id, quntity, price, subtotal)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (order_id, pid, qty, price, subtotal))

                conn.commit()
                cursor.close()
                conn.close()

                self._send_json_response(200, {
                    "status": "success",
                    "message": f"Sale completed successfully. Order #{order_id} created.",
                    "order_id": order_id
                })
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": f"Sale processing error: {str(e)}"})
            return

        self._send_json_response(404, {"status": "error", "message": "Endpoint not found"})


def run_server(preferred_ports=[9007, 9010, 9008, 9009, 9013, 9000, 8000]):
    try:
        from http.server import ThreadingHTTPServer as ServerClass
    except ImportError:
        from http.server import HTTPServer as ServerClass

    httpd = None
    selected_port = None

    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        preferred_ports = [int(sys.argv[1])] + preferred_ports

    for port in preferred_ports:
        try:
            ServerClass.allow_reuse_address = True
            server_address = ('0.0.0.0', port)
            httpd = ServerClass(server_address, CustomerHandler)
            selected_port = port
            break
        except OSError:
            continue

    if not httpd:
        print("ERROR: Could not bind to any port in", preferred_ports, flush=True)
        sys.exit(1)

    print('=' * 60, flush=True)
    print(' Cashier Customer Server (MySQL "project")', flush=True)
    print('=' * 60, flush=True)
    print(f'Server Running At:     http://localhost:{selected_port}/', flush=True)
    print(f'Customer Page:         http://localhost:{selected_port}/customer.html', flush=True)
    print(f'Customer API:          http://localhost:{selected_port}/api/customers', flush=True)
    print('=' * 60, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down server...', flush=True)
        httpd.server_close()
        sys.exit(0)


if __name__ == '__main__':
    run_server()
