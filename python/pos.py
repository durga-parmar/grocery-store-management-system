"""
pos.py - Cashier Point of Sale (POS) & New Sale Python Backend Server
Database: MySQL 'project' via WAMP
Tables: 'order_tab', 'order_item', 'products_tab', 'customer_tab', 'registration'
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


def get_customers_list():
    """Fetch active customers from customer_tab."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT customer_id, customer_name, phone, email, city, address, status
        FROM customer_tab
        ORDER BY customer_name ASC
    """)
    customers = cursor.fetchall()
    cursor.close()
    conn.close()
    return customers


def get_products_list(query_params=None):
    """Fetch products joined with categories."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT
            p.product_id,
            p.cat_id,
            p.product_name,
            p.image,
            p.price,
            p.stock,
            p.status,
            p.created_at,
            c.cat_name
        FROM products_tab p
        LEFT JOIN categories_tab c ON p.cat_id = c.cat_id
        WHERE 1=1
    """
    params = []
    cursor.execute(query, params)
    products = cursor.fetchall()
    cursor.close()
    conn.close()

    for p in products:
        p['price'] = float(p.get('price') or 0.0)
        p['stock'] = int(p.get('stock') or 0)
        p['cat_name'] = p.get('cat_name') or 'General'

    return products


def process_pos_sale(data, cookies=None):
    """
    Execute transactional POS sale:
    1. Insert into order_tab (Cash, Paid, Completed, cash_received, change_returned, cashier_name, cashier_id)
    2. Insert each item into order_item (quntity, price, subtotal)
    3. Decrement stock in products_tab and update status (in stock / low stock / Out of stock)
    4. Full rollback on any error
    """
    customer_id = data.get("customer_id")
    total_amount = float(data.get("total_amount") or 0.0)
    cash_received = float(data.get("cash_received") or 0.0)
    cashier_id = data.get("cashier_id")
    cashier_name = data.get("cashier_name")

    if not cashier_name and cookies:
        c_user = get_current_user(cookies=cookies)
        if c_user:
            cashier_name = c_user.get("full_name") or c_user.get("username")
            cashier_id = c_user.get("id")
    if not cashier_name:
        cashier_name = "Cashier"

    items = data.get("items", [])

    if not items or len(items) == 0:
        return {"status": "error", "message": "Sale cart is empty. Please add items."}

    if cash_received < total_amount:
        return {"status": "error", "message": f"Insufficient cash received. Grand total is ₹{total_amount:.2f}."}

    change_amount = cash_received - total_amount

    conn = get_db_connection()
    conn.autocommit = False
    cursor = conn.cursor(dictionary=True)

    try:
        # 1. Insert into order_tab with actual cash_received, change_returned, cashier_name, and cashier_id
        order_sql = """
            INSERT INTO order_tab (customer_id, total_amount, payment_method, payment_status, order_status, order_date, cash_received, change_returned, cashier_name, cashier_id)
            VALUES (%s, %s, 'Cash', 'Paid', 'Completed', NOW(), %s, %s, %s, %s)
        """
        cursor.execute(order_sql, (customer_id, Decimal(str(total_amount)), Decimal(str(cash_received)), Decimal(str(change_amount)), cashier_name, cashier_id))
        order_id = cursor.lastrowid

        # 2. Process each item & update stock
        for item in items:
            pid = int(item["product_id"])
            qty = int(item["quntity"])
            price = Decimal(str(item["price"]))
            subtotal = Decimal(str(item["subtotal"]))

            # Fetch current stock with lock
            cursor.execute("SELECT stock, product_name FROM products_tab WHERE product_id = %s FOR UPDATE", (pid,))
            prod = cursor.fetchone()

            if not prod:
                raise Exception(f"Product ID #{pid} not found in database.")

            current_stock = int(prod["stock"] or 0)
            if current_stock < qty:
                raise Exception(f"Insufficient stock for '{prod['product_name']}'. Only {current_stock} remaining.")

            new_stock = current_stock - qty
            if new_stock <= 0:
                new_status = 'Out of stock'
            elif new_stock <= 10:
                new_status = 'low stock'
            else:
                new_status = 'in stock'

            # Update stock in products_tab
            cursor.execute("UPDATE products_tab SET stock = %s, status = %s WHERE product_id = %s", (new_stock, new_status, pid))

            # Insert into order_item (note: column name is 'quntity')
            item_sql = """
                INSERT INTO order_item (order_id, product_id, quntity, price, subtotal)
                VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(item_sql, (order_id, pid, qty, price, subtotal))

        # Commit transaction
        conn.commit()
        cursor.close()
        conn.close()

        return {
            "status": "success",
            "message": "Sale completed and recorded successfully.",
            "order_id": order_id,
            "total_amount": total_amount,
            "cash_received": cash_received,
            "change_returned": change_amount
        }

    except Exception as err:
        conn.rollback()
        cursor.close()
        conn.close()
        return {"status": "error", "message": str(err)}


class POSHandler(BaseHTTPRequestHandler):
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
        if path in ["/api/customers", "/api/customer", "/api/customers/"]:
            try:
                customers = get_customers_list()
                self._send_json_response(200, {"status": "success", "customers": customers})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 2. API: Products List
        if path in ["/api/cashier/products", "/api/products", "/api/products/"]:
            try:
                products = get_products_list(query)
                self._send_json_response(200, {"status": "success", "products": products})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 3. API: User Profile
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

        # 4. Static Files
        req_path = path.lstrip("/")
        if not req_path or req_path == "":
            req_path = "pos.html"

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

        # 1. API: Complete POS Sale
        if path in ["/api/pos/complete", "/api/sales/complete", "/api/order/complete"]:
            try:
                cookies = parse_cookies_dict(self.headers.get("Cookie"))
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length).decode("utf-8")
                data = json.loads(body) if body else {}

                result = process_pos_sale(data, cookies=cookies)
                status_code = 200 if result.get("status") == "success" else 400
                self._send_json_response(status_code, result)
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        self._send_json_response(404, {"status": "error", "message": f"POST endpoint '{path}' not found."})


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
            httpd = ServerClass(server_address, POSHandler)
            selected_port = port
            break
        except OSError:
            continue

    if not httpd:
        print("ERROR: Could not bind to any port in", preferred_ports, flush=True)
        sys.exit(1)

    print('=' * 60, flush=True)
    print(' Cashier POS Server (MySQL "project")', flush=True)
    print('=' * 60, flush=True)
    print(f'Server Running At:     http://localhost:{selected_port}/', flush=True)
    print(f'Cashier POS Page:      http://localhost:{selected_port}/pos.html', flush=True)
    print(f'Complete Sale API:     http://localhost:{selected_port}/api/pos/complete', flush=True)
    print('=' * 60, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down server...', flush=True)
        httpd.server_close()
        sys.exit(0)


if __name__ == '__main__':
    run_server()
