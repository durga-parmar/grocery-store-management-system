"""
cashier_order.py - Cashier Orders Management Python Backend Server
Database: MySQL 'project' via WAMP
Tables: 'order_tab', 'order_item', 'customer_tab', 'products_tab', 'registration'
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


def get_orders_list(filters=None):
    """Fetch completed sales orders from order_tab joined with customer_tab."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT
            o.order_id,
            o.customer_id,
            COALESCE(c.customer_name, 'Walk-in Customer') AS customer_name,
            COALESCE(c.phone, '') AS phone,
            COALESCE(c.phone, '') AS customer_phone,
            c.email,
            c.city,
            c.address,
            o.total_amount,
            o.payment_method,
            o.payment_status,
            o.order_status,
            o.order_date,
            COALESCE(o.cashier_name, r.full_name, 'Cashier') AS cashier_name,
            o.cashier_id
        FROM order_tab o
        LEFT JOIN customer_tab c ON o.customer_id = c.customer_id
        LEFT JOIN registration r ON o.cashier_id = r.id
        WHERE 1=1
    """
    params = []

    keyword_digits = None
    if filters:
        keyword = filters.get("keyword", [""])[0].strip() or filters.get("search", [""])[0].strip()
        if keyword:
            import re
            digits = re.findall(r'\d+', keyword)
            if digits:
                keyword_digits = digits[0]
                query += " AND (o.order_id = %s OR CAST(o.order_id AS CHAR) LIKE %s OR LOWER(c.customer_name) LIKE LOWER(%s) OR LOWER(c.phone) LIKE LOWER(%s))"
                params.extend([int(keyword_digits), f"%{keyword_digits}%", f"%{keyword}%", f"%{keyword}%"])
            else:
                query += " AND (LOWER(c.customer_name) LIKE LOWER(%s) OR LOWER(c.phone) LIKE LOWER(%s))"
                k = f"%{keyword}%"
                params.extend([k, k])

        date_val = filters.get("date", [""])[0].strip()
        if date_val:
            query += " AND DATE(o.order_date) = %s"
            params.append(date_val)

        order_status = filters.get("orderStatus", [""])[0].strip() or filters.get("order_status", [""])[0].strip()
        if order_status and order_status.lower() != "all":
            query += " AND LOWER(o.order_status) = LOWER(%s)"
            params.append(order_status)

        payment_status = filters.get("paymentStatus", [""])[0].strip() or filters.get("payment_status", [""])[0].strip()
        if payment_status and payment_status.lower() != "all":
            query += " AND LOWER(o.payment_status) = LOWER(%s)"
            params.append(payment_status)

    if keyword_digits:
        query += " ORDER BY (CASE WHEN o.order_id = %s THEN 0 WHEN CAST(o.order_id AS CHAR) LIKE %s THEN 1 ELSE 2 END), o.order_id DESC"
        params.extend([int(keyword_digits), f"{keyword_digits}%"])
    else:
        query += " ORDER BY o.order_id DESC"

    cursor.execute(query, params)
    orders = cursor.fetchall()
    cursor.close()
    conn.close()

    for ord in orders:
        ord['total_amount'] = float(ord.get('total_amount') or 0.0)
        ord['cashier_name'] = ord.get('cashier_name') or 'Cashier'

    return orders


def get_order_detail(order_id):
    """Fetch complete single order with customer details and itemized products."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query_order = """
        SELECT
            o.order_id,
            o.customer_id,
            COALESCE(c.customer_name, 'Walk-in Customer') AS customer_name,
            COALESCE(c.phone, '') AS phone,
            COALESCE(c.phone, '') AS customer_phone,
            c.email,
            c.city,
            c.address,
            o.total_amount,
            o.payment_method,
            o.payment_status,
            o.order_status,
            o.order_date,
            COALESCE(o.cash_received, o.total_amount) AS cash_received,
            COALESCE(o.change_returned, 0.00) AS change_returned,
            COALESCE(o.cashier_name, r.full_name, 'Cashier') AS cashier_name,
            o.cashier_id
        FROM order_tab o
        LEFT JOIN customer_tab c ON o.customer_id = c.customer_id
        LEFT JOIN registration r ON o.cashier_id = r.id
        WHERE o.order_id = %s
    """
    cursor.execute(query_order, (order_id,))
    order = cursor.fetchone()

    if not order:
        cursor.close()
        conn.close()
        return None

    order['total_amount'] = float(order.get('total_amount') or 0.0)

    # Fetch order items
    query_items = """
        SELECT
            oi.item_id,
            oi.order_id,
            oi.product_id,
            oi.quntity,
            oi.price,
            oi.subtotal,
            p.product_name,
            c.cat_name
        FROM order_item oi
        LEFT JOIN products_tab p ON oi.product_id = p.product_id
        LEFT JOIN categories_tab c ON p.cat_id = c.cat_id
        WHERE oi.order_id = %s
        ORDER BY oi.item_id ASC
    """
    cursor.execute(query_items, (order_id,))
    items = cursor.fetchall()
    cursor.close()
    conn.close()

    for it in items:
        it['price'] = float(it.get('price') or 0.0)
        it['subtotal'] = float(it.get('subtotal') or 0.0)
        it['product_name'] = it.get('product_name') or 'Grocery Item'

    order['items'] = items
    order['cash_received'] = float(order.get('cash_received') if order.get('cash_received') is not None else order['total_amount'])
    order['change_returned'] = float(order.get('change_returned') if order.get('change_returned') is not None else max(0.0, order['cash_received'] - order['total_amount']))

    return order


def get_orders_summary():
    """Fetch 6 KPI summary counts from order_tab."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT COUNT(*) AS total_orders FROM order_tab")
    total_orders = cursor.fetchone()['total_orders'] or 0

    cursor.execute("SELECT COUNT(*) AS today_orders, COALESCE(SUM(total_amount), 0) AS today_sales FROM order_tab WHERE DATE(order_date) = CURDATE()")
    today_res = cursor.fetchone()
    today_orders = today_res['today_orders'] or 0
    today_sales = float(today_res['today_sales'] or 0.0)

    cursor.execute("SELECT COUNT(*) AS completed_orders FROM order_tab WHERE LOWER(order_status) = 'completed'")
    completed_orders = cursor.fetchone()['completed_orders'] or 0

    cursor.execute("SELECT COUNT(*) AS pending_orders FROM order_tab WHERE LOWER(order_status) = 'pending'")
    pending_orders = cursor.fetchone()['pending_orders'] or 0

    cursor.execute("SELECT COUNT(*) AS cancelled_orders FROM order_tab WHERE LOWER(order_status) = 'cancelled'")
    cancelled_orders = cursor.fetchone()['cancelled_orders'] or 0

    cursor.close()
    conn.close()

    return {
        "total_orders": total_orders,
        "today_orders": today_orders,
        "completed_orders": completed_orders,
        "pending_orders": pending_orders,
        "cancelled_orders": cancelled_orders,
        "today_sales": today_sales
    }


class OrdersHandler(BaseHTTPRequestHandler):
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

        # 1. API: Orders List
        if path in ["/api/orders", "/api/cashier/orders", "/api/orders/list"]:
            try:
                orders = get_orders_list(query)
                self._send_json_response(200, {"status": "success", "orders": orders})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 2. API: Single Order Detail
        if path in ["/api/orders/detail", "/api/cashier/orders/detail", "/api/order/detail"]:
            try:
                order_id = query.get("order_id", [None])[0] or query.get("id", [None])[0]
                if not order_id:
                    self._send_json_response(400, {"status": "error", "message": "Missing order_id"})
                    return
                clean_id = str(order_id).lstrip("#")
                ord_data = get_order_detail(int(clean_id))
                if ord_data:
                    self._send_json_response(200, {"status": "success", "order": ord_data})
                else:
                    self._send_json_response(404, {"status": "error", "message": "Order not found"})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 3. API: Orders Summary KPIs
        if path in ["/api/orders/summary", "/api/cashier/orders/summary"]:
            try:
                summary = get_orders_summary()
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
            req_path = "cashier_order.html"

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
            httpd = ServerClass(server_address, OrdersHandler)
            selected_port = port
            break
        except OSError:
            continue

    if not httpd:
        print("ERROR: Could not bind to any port in", preferred_ports, flush=True)
        sys.exit(1)

    print('=' * 60, flush=True)
    print(' Cashier Orders Server (MySQL "project")', flush=True)
    print('=' * 60, flush=True)
    print(f'Server Running At:     http://localhost:{selected_port}/', flush=True)
    print(f'Orders Page:           http://localhost:{selected_port}/cashier_order.html', flush=True)
    print(f'Orders API:            http://localhost:{selected_port}/api/orders', flush=True)
    print('=' * 60, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down server...', flush=True)
        httpd.server_close()
        sys.exit(0)


if __name__ == '__main__':
    run_server()
