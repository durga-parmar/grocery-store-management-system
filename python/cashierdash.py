"""
cashierdash.py - Python HTTPServer Backend for Cashier Dashboard
Database: MySQL 'project'
Tables: 'order_tab', 'products_tab', 'customer_tab', 'registration', 'order_item'
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


def get_dashboard_metrics():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # 1. Today's Sales
    cursor.execute("SELECT COALESCE(SUM(total_amount), 0) AS today_sales FROM order_tab WHERE DATE(order_date) = CURDATE()")
    row_sales = cursor.fetchone()
    today_sales = float(row_sales['today_sales'] or 0.0) if row_sales else 0.0

    # 2. Today's Orders
    cursor.execute("SELECT COUNT(*) AS today_orders FROM order_tab WHERE DATE(order_date) = CURDATE()")
    row_today_orders = cursor.fetchone()
    today_orders = row_today_orders['today_orders'] or 0

    # 3. Total Customers
    cursor.execute("SELECT COUNT(*) AS total_cust FROM customer_tab")
    row_cust = cursor.fetchone()
    total_customers = row_cust['total_cust'] or 0

    # 4. Products Available (in stock)
    cursor.execute("SELECT COUNT(*) AS in_stock FROM products_tab WHERE LOWER(status) = 'in stock'")
    row_avail = cursor.fetchone()
    products_avail = row_avail['in_stock'] or 0

    # 5. Low Stock Products
    cursor.execute("SELECT COUNT(*) AS low_stock FROM products_tab WHERE LOWER(status) = 'low stock' OR (stock > 0 AND stock <= 10)")
    row_low = cursor.fetchone()
    low_stock = row_low['low_stock'] or 0

    # 6. Completed Orders
    cursor.execute("SELECT COUNT(*) AS completed FROM order_tab WHERE LOWER(order_status) = 'completed'")
    row_comp = cursor.fetchone()
    completed_orders = row_comp['completed'] or 0

    # 7. Today's Activity Breakdown
    cursor.execute("SELECT COUNT(*) AS completed_today FROM order_tab WHERE DATE(order_date) = CURDATE() AND LOWER(order_status) = 'completed'")
    act_completed = cursor.fetchone()['completed_today'] or 0

    cursor.execute("SELECT COUNT(*) AS pending_today FROM order_tab WHERE DATE(order_date) = CURDATE() AND LOWER(order_status) = 'pending'")
    act_pending = cursor.fetchone()['pending_today'] or 0

    cursor.execute("SELECT COUNT(*) AS cancelled_today FROM order_tab WHERE DATE(order_date) = CURDATE() AND LOWER(order_status) = 'cancelled'")
    act_cancelled = cursor.fetchone()['cancelled_today'] or 0

    # 8. Low Stock Items List
    cursor.execute("""
        SELECT p.product_id, p.product_name, p.stock, p.status, c.cat_name
        FROM products_tab p
        LEFT JOIN categories_tab c ON p.cat_id = c.cat_id
        WHERE LOWER(p.status) IN ('low stock', 'out of stock') OR p.stock <= 10
        ORDER BY p.stock ASC
        LIMIT 5
    """)
    low_stock_items = cursor.fetchall()

    cursor.close()
    conn.close()

    return {
        "status": "success",
        "metrics": {
            "todaySales": today_sales,
            "todayOrders": today_orders,
            "totalCustomers": total_customers,
            "productsAvailable": products_avail,
            "lowStockProducts": low_stock,
            "completedOrders": completed_orders,
            "activity": {
                "total": today_orders,
                "completed": act_completed,
                "pending": act_pending,
                "cancelled": act_cancelled
            }
        },
        "low_stock_items": low_stock_items
    }


class CashierDashboardHandler(BaseHTTPRequestHandler):
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

        # 1. API: Cashier Dashboard Metrics
        if path in ["/api/cashier/dashboard", "/api/dashboard/cashier", "/api/dashboard"]:
            try:
                data = get_dashboard_metrics()
                self._send_json_response(200, data)
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 2. API: Cashier Profile
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

        # 3. Static Files
        req_path = path.lstrip("/")
        if not req_path or req_path == "":
            req_path = "cashierdash.html"

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
            httpd = ServerClass(server_address, CashierDashboardHandler)
            selected_port = port
            break
        except OSError:
            continue

    if not httpd:
        print("ERROR: Could not bind to any port in", preferred_ports, flush=True)
        sys.exit(1)

    print('=' * 60, flush=True)
    print(' Cashier Dashboard Server (MySQL "project")', flush=True)
    print('=' * 60, flush=True)
    print(f'Server Running At:     http://localhost:{selected_port}/', flush=True)
    print(f'Cashier Dashboard:     http://localhost:{selected_port}/cashierdash.html', flush=True)
    print(f'Dashboard API:         http://localhost:{selected_port}/api/cashier/dashboard', flush=True)
    print('=' * 60, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down server...', flush=True)
        httpd.server_close()
        sys.exit(0)


if __name__ == '__main__':
    run_server()
