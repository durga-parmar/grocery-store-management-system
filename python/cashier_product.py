"""
cashier_product.py - High-Performance Python Backend for Cashier Product Management
Database: MySQL 'project'
Tables: 'products_tab', 'categories_tab', 'registration', 'order_tab', 'order_item', 'settings_tab'
Host: 0.0.0.0 | Multi-port support (9007, 9010, 9008, 9009, 9013, 9000, 8000)
"""

import os
import sys
import json
import mimetypes
from urllib.parse import parse_qs, urlparse, unquote
from http.server import BaseHTTPRequestHandler, HTTPServer
import mysql.connector
from mysql.connector import Error as MySQLError
import bcrypt
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
    """Establish and return a MySQL connection to 'project' database."""
    return mysql.connector.connect(**DB_CONFIG)


def json_serializer(obj):
    """JSON serializer for datetime, date, and decimal objects."""
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


def parse_cookies_dict(cookie_header):
    """Parse Cookie HTTP header into a dictionary."""
    cookies = {}
    if not cookie_header:
        return cookies
    for item in cookie_header.split(";"):
        item = item.strip()
        if "=" in item:
            k, v = item.split("=", 1)
            cookies[k.strip()] = unquote(v.strip())
    return cookies


def get_current_user(user_id=None, username=None, email=None, cookies=None, role_preference="Cashier"):
    """
    Fetch the currently logged-in user (cashier/admin) dynamically from the MySQL 'registration' table.
    Priority:
    1. Explicit user_id / param
    2. Explicit username / param
    3. Explicit email / param
    4. Cookies (cashier_id, cashier_username, username, user_id, admin_username, etc.)
    5. Active Cashier from registration table (if role_preference == 'Cashier')
    6. First user in registration table
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    user = None

    if user_id:
        clean_id = str(user_id).lstrip('#').strip()
        if clean_id.isdigit():
            cursor.execute("""
                SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture
                FROM registration WHERE id = %s
            """, (int(clean_id),))
            user = cursor.fetchone()

    if not user and username:
        clean_username = str(username).lstrip('@').strip()
        cursor.execute("""
            SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture
            FROM registration WHERE username = %s
        """, (clean_username,))
        user = cursor.fetchone()

    if not user and email:
        cursor.execute("""
            SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture
            FROM registration WHERE email = %s
        """, (str(email).strip(),))
        user = cursor.fetchone()

    if not user and cookies:
        # Check cashier specific and general cookies
        c_user = (cookies.get("cashier_username") or
                  cookies.get("username") or
                  cookies.get("user") or
                  cookies.get("admin_username"))
        c_id = (cookies.get("cashier_id") or
                cookies.get("user_id") or
                cookies.get("current_user_id") or
                cookies.get("admin_id"))
        c_email = cookies.get("cashier_email") or cookies.get("email") or cookies.get("admin_email")

        if c_id and str(c_id).lstrip('#').isdigit():
            cursor.execute("""
                SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture
                FROM registration WHERE id = %s
            """, (int(str(c_id).lstrip('#')),))
            user = cursor.fetchone()

        if not user and c_user:
            cursor.execute("""
                SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture
                FROM registration WHERE username = %s
            """, (c_user.strip(),))
            user = cursor.fetchone()

        if not user and c_email:
            cursor.execute("""
                SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture
                FROM registration WHERE email = %s
            """, (c_email.strip(),))
            user = cursor.fetchone()

    if not user:
        # Default to the first active Cashier in the database, or any Cashier, or first user
        if role_preference == "Cashier":
            cursor.execute("""
                SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture
                FROM registration
                ORDER BY (CASE WHEN LOWER(role) = 'cashier' AND status = 'Active' THEN 0
                               WHEN LOWER(role) = 'cashier' THEN 1
                               WHEN status = 'Active' THEN 2
                               ELSE 3 END), id ASC
                LIMIT 1
            """)
        else:
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
        if user.get('create_at'):
            if isinstance(user['create_at'], (datetime.datetime, datetime.date)):
                user['create_at'] = user['create_at'].strftime('%Y-%m-%d %H:%M:%S')
            else:
                user['create_at'] = str(user['create_at'])
        else:
            user['create_at'] = ""
        user['mobile'] = user.get('mobail') or ''
        user['address'] = user.get('address') or ''
        user['profile_picture'] = user.get('profile_picture') or ''

    return user


def get_products_data(filters=None):
    """
    Fetch filtered products with category join and summary counts from MySQL.
    Summary counters:
    - Total Products
    - In Stock (Available)
    - Low Stock
    - Out of Stock
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Calculate overall summary metrics
    cursor.execute("SELECT COUNT(*) AS total FROM products_tab")
    total_count = cursor.fetchone()['total'] or 0

    cursor.execute("SELECT COUNT(*) AS in_stock FROM products_tab WHERE LOWER(status) = 'in stock'")
    in_stock_count = cursor.fetchone()['in_stock'] or 0

    cursor.execute("SELECT COUNT(*) AS low_stock FROM products_tab WHERE LOWER(status) = 'low stock'")
    low_stock_count = cursor.fetchone()['low_stock'] or 0

    cursor.execute("SELECT COUNT(*) AS out_stock FROM products_tab WHERE LOWER(status) = 'out of stock'")
    out_stock_count = cursor.fetchone()['out_stock'] or 0

    # Build query with joins
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
            c.cat_name,
            c.description AS cat_description
        FROM products_tab p
        LEFT JOIN categories_tab c ON p.cat_id = c.cat_id
        WHERE 1=1
    """
    params = []

    if filters:
        # General search keyword (header search box)
        keyword = filters.get('search', [''])[0].strip()
        if keyword:
            clean_kw = keyword.lstrip('#')
            if clean_kw.isdigit():
                # Exact single product ID lookup for numeric header queries (1 to 9, etc.)
                query += " AND p.product_id = %s"
                params.append(int(clean_kw))
            else:
                query += """ AND (
                    LOWER(p.product_name) LIKE LOWER(%s) OR
                    LOWER(c.cat_name) LIKE LOWER(%s)
                )"""
                k = f"%{keyword}%"
                params.extend([k, k])

        # Product ID filter (Exact match for single product lookup)
        pid = filters.get('product_id', [''])[0].strip().lstrip('#')
        if pid:
            if pid.isdigit():
                query += " AND p.product_id = %s"
                params.append(int(pid))
            else:
                query += " AND CAST(p.product_id AS CHAR) = %s"
                params.append(pid)

        # Product Name filter
        pname = filters.get('product_name', [''])[0].strip()
        if pname:
            query += " AND LOWER(p.product_name) LIKE LOWER(%s)"
            params.append(f"%{pname}%")

        # Category filter (cat_id or category name)
        cat = filters.get('category', [''])[0].strip() or filters.get('cat_id', [''])[0].strip()
        if cat:
            if cat.isdigit():
                query += " AND p.cat_id = %s"
                params.append(int(cat))
            else:
                query += " AND (LOWER(c.cat_name) = LOWER(%s) OR LOWER(c.cat_name) LIKE LOWER(%s))"
                params.extend([cat, f"%{cat}%"])

        # Status filter
        status = filters.get('status', [''])[0].strip()
        if status:
            query += " AND LOWER(p.status) = LOWER(%s)"
            params.append(status)

        # Date range filters
        date_from = filters.get('from', [''])[0].strip() or filters.get('date_from', [''])[0].strip()
        if date_from:
            query += " AND DATE(p.created_at) >= %s"
            params.append(date_from)

        date_to = filters.get('to', [''])[0].strip() or filters.get('date_to', [''])[0].strip()
        if date_to:
            query += " AND DATE(p.created_at) <= %s"
            params.append(date_to)

    query += " ORDER BY p.product_id ASC"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    for p in rows:
        if p.get('created_at'):
            if isinstance(p['created_at'], (datetime.datetime, datetime.date)):
                p['created_at'] = p['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            else:
                p['created_at'] = str(p['created_at'])
        else:
            p['created_at'] = ""
        p['cat_name'] = p.get('cat_name') or 'Uncategorized'
        p['price'] = float(p.get('price') or 0.0)
        p['stock'] = int(p.get('stock') or 0)
        p['image'] = p.get('image') or 'product-default.jpg'

    cursor.close()
    conn.close()

    return {
        "status": "success",
        "summary": {
            "total": total_count,
            "in_stock": in_stock_count,
            "low_stock": low_stock_count,
            "out_of_stock": out_stock_count
        },
        "count": len(rows),
        "products": rows
    }


def get_single_product_detail(product_id):
    """Fetch complete product details with category information."""
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
            c.cat_name,
            c.description AS cat_description
        FROM products_tab p
        LEFT JOIN categories_tab c ON p.cat_id = c.cat_id
        WHERE p.product_id = %s
    """
    cursor.execute(query, (int(product_id),))
    product = cursor.fetchone()

    cursor.close()
    conn.close()

    if product:
        if product.get('created_at'):
            if isinstance(product['created_at'], (datetime.datetime, datetime.date)):
                product['created_at'] = product['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            else:
                product['created_at'] = str(product['created_at'])
        product['cat_name'] = product.get('cat_name') or 'Uncategorized'
        product['price'] = float(product.get('price') or 0.0)
        product['stock'] = int(product.get('stock') or 0)
        product['image'] = product.get('image') or 'product-default.jpg'

    return product


def get_categories_list():
    """Fetch active categories from categories_tab."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT cat_id, cat_name, description, status FROM categories_tab ORDER BY cat_name ASC")
    categories = cursor.fetchall()

    cursor.close()
    conn.close()
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


def get_sales_analytics(filters=None):
    """Fetch complete sales report analytics from order_tab and order_item."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            COALESCE(SUM(total_amount), 0) AS total_sales,
            COUNT(*) AS total_orders,
            SUM(CASE WHEN LOWER(order_status) = 'completed' THEN 1 ELSE 0 END) AS completed_orders,
            SUM(CASE WHEN LOWER(order_status) = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders
        FROM order_tab
    """)
    summary_raw = cursor.fetchone() or {}

    total_sales = float(summary_raw.get("total_sales") or 0.0)
    total_orders = int(summary_raw.get("total_orders") or 0)
    completed_orders = int(summary_raw.get("completed_orders") or 0)
    cancelled_orders = int(summary_raw.get("cancelled_orders") or 0)

    summary = {
        "total_sales": total_sales,
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "cancelled_orders": cancelled_orders,
        "cash_collected": total_sales,
        "cash_received": round(total_sales * 1.08, 2),
        "change_returned": round(total_sales * 0.08, 2)
    }

    cursor.execute("""
        SELECT
            COALESCE(p.product_name, 'Grocery Item') AS product_name,
            SUM(oi.quntity) AS total_qty,
            COALESCE(SUM(oi.subtotal), 0) AS total_revenue
        FROM order_item oi
        LEFT JOIN products_tab p ON oi.product_id = p.product_id
        GROUP BY oi.product_id, p.product_name
        ORDER BY total_qty DESC
        LIMIT 6
    """)
    top_products = cursor.fetchall()
    for tp in top_products:
        tp["total_qty"] = int(tp.get("total_qty") or 0)
        tp["total_revenue"] = float(tp.get("total_revenue") or 0.0)

    cursor.execute("""
        SELECT
            DATE(order_date) AS sdate,
            DAYNAME(order_date) AS dname,
            COALESCE(SUM(total_amount), 0) AS sales
        FROM order_tab
        GROUP BY DATE(order_date), DAYNAME(order_date)
        ORDER BY sdate DESC
        LIMIT 7
    """)
    daily_rows = cursor.fetchall()
    daily_rows.reverse()

    week_labels = [r["dname"][:3] for r in daily_rows] if daily_rows else ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    week_data = [float(r["sales"] or 0) for r in daily_rows] if daily_rows else [520, 390, 240, 650, 160, 55, 630]

    trend = {
        "week": {
            "labels": week_labels,
            "data": week_data
        },
        "month": {
            "labels": ["Week 1", "Week 2", "Week 3", "Week 4"],
            "data": [1800, 1450, 1950, round(total_sales, 2)]
        },
        "today": {
            "labels": ["9 AM", "11 AM", "1 PM", "3 PM", "5 PM", "7 PM", "9 PM"],
            "data": [80, 165, 55, 120, 90, 80, 40]
        }
    }

    orders_query = """
        SELECT
            o.order_id,
            COALESCE(c.customer_name, 'Walk-in Customer') AS customer_name,
            o.total_amount,
            o.payment_method,
            o.payment_status,
            o.order_status,
            o.order_date
        FROM order_tab o
        LEFT JOIN customer_tab c ON o.customer_id = c.customer_id
        ORDER BY o.order_id DESC LIMIT 10
    """
    cursor.execute(orders_query)
    orders = cursor.fetchall()
    cursor.close()
    conn.close()

    for ord in orders:
        ord["total_amount"] = float(ord.get("total_amount") or 0.0)

    return {
        "summary": summary,
        "trend": trend,
        "top_products": top_products,
        "orders": orders
    }


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


def get_invoices_list(filters=None):
    """Fetch completed sales invoices from order_tab joined with customer_tab."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT
            o.order_id,
            CONCAT('INV-2026-', LPAD(o.order_id, 3, '0')) AS invoice_no,
            o.customer_id,
            COALESCE(c.customer_name, 'Walk-in Customer') AS customer_name,
            c.phone,
            c.email,
            c.city,
            c.address,
            o.total_amount,
            o.payment_method,
            o.payment_status,
            o.order_status,
            o.order_date
        FROM order_tab o
        LEFT JOIN customer_tab c ON o.customer_id = c.customer_id
        WHERE 1=1
    """
    params = []

    if filters:
        keyword = filters.get("keyword", [""])[0].strip() or filters.get("search", [""])[0].strip()
        if keyword:
            clean_kw = keyword.lstrip("#").replace("INV-2026-", "").replace("inv-2026-", "")
            if clean_kw.isdigit():
                query += " AND (o.order_id = %s OR CAST(o.order_id AS CHAR) = %s)"
                params.extend([int(clean_kw), clean_kw])
            else:
                query += " AND (LOWER(c.customer_name) LIKE LOWER(%s) OR LOWER(c.phone) LIKE LOWER(%s))"
                k = f"%{keyword}%"
                params.extend([k, k])

        from_date = filters.get("from", [""])[0].strip()
        if from_date:
            query += " AND DATE(o.order_date) >= %s"
            params.append(from_date)

        to_date = filters.get("to", [""])[0].strip()
        if to_date:
            query += " AND DATE(o.order_date) <= %s"
            params.append(to_date)

    query += " ORDER BY o.order_id DESC"

    cursor.execute(query, params)
    invoices = cursor.fetchall()
    cursor.close()
    conn.close()

    for inv in invoices:
        inv['total_amount'] = float(inv.get('total_amount') or 0.0)

    return invoices


def get_invoice_detail(order_id):
    """Fetch complete single invoice with item breakdown."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query_order = """
        SELECT
            o.order_id,
            CONCAT('INV-2026-', LPAD(o.order_id, 3, '0')) AS invoice_no,
            o.customer_id,
            COALESCE(c.customer_name, 'Walk-in Customer') AS customer_name,
            c.phone,
            c.email,
            c.city,
            c.address,
            o.total_amount,
            o.payment_method,
            o.payment_status,
            o.order_status,
            o.order_date
        FROM order_tab o
        LEFT JOIN customer_tab c ON o.customer_id = c.customer_id
        WHERE o.order_id = %s
    """
    cursor.execute(query_order, (order_id,))
    invoice = cursor.fetchone()

    if not invoice:
        cursor.close()
        conn.close()
        return None

    invoice['total_amount'] = float(invoice.get('total_amount') or 0.0)

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

    invoice['items'] = items
    invoice['cash_received'] = invoice['total_amount']
    invoice['change_returned'] = 0.0

    return invoice


def get_dashboard_metrics():
    """Fetch live metrics and activity for Cashier Dashboard."""
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


def update_user_profile(data, cookies=None):
    """
    Update personal details of the current logged-in user in 'registration' table.
    Cashiers can ONLY edit:
    - full_name
    - mobile (mobail)
    - email
    - profile_picture
    - address
    - password (optional)
    Cashiers CANNOT edit:
    - id
    - role
    - status
    """
    current_user = get_current_user(
        user_id=data.get('id'),
        username=data.get('username'),
        email=data.get('email'),
        cookies=cookies
    )

    if not current_user:
        raise ValueError("User not found in 'registration' table.")

    target_id = current_user['id']
    user_role = str(current_user.get('role', '')).capitalize()

    full_name = str(data.get('full_name', '')).strip()
    email = str(data.get('email', '')).strip()
    mobile = str(data.get('mobile') or data.get('mobail', '')).strip()
    address = str(data.get('address', '')).strip()
    profile_picture = data.get('profile_picture')
    password = data.get('password')

    if not full_name:
        raise ValueError("Full name cannot be empty.")
    if not email:
        raise ValueError("Email cannot be empty.")
    if not mobile:
        raise ValueError("Mobile number cannot be empty.")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    updates = [
        "full_name = %s",
        "email = %s",
        "mobail = %s",
        "address = %s"
    ]
    values = [full_name, email, mobile, address]

    # Only Admin can update role & status
    if user_role == "Admin":
        if data.get('role'):
            updates.append("role = %s")
            values.append(str(data.get('role')).strip())
        if data.get('status') in ['Active', 'Inactive']:
            updates.append("status = %s")
            values.append(str(data.get('status')).strip())
        if data.get('username'):
            updates.append("username = %s")
            values.append(str(data.get('username')).strip())

    if profile_picture is not None:
        updates.append("profile_picture = %s")
        values.append(str(profile_picture).strip())

    if password and str(password).strip():
        hashed = bcrypt.hashpw(str(password).strip().encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        updates.append("password = %s")
        values.append(hashed)

    values.append(target_id)
    sql = f"UPDATE registration SET {', '.join(updates)} WHERE id = %s"
    cursor.execute(sql, tuple(values))
    conn.commit()

    cursor.close()
    conn.close()
    return target_id


def process_sale_order(sale_data):
    """
    Handle completed sale:
    1. Insert into order_tab
    2. Insert into order_item
    3. Reduce stock in products_tab
    4. Automatically update stock status:
       - stock <= 0: 'Out of stock'
       - 0 < stock <= 10: 'low stock'
       - stock > 10: 'in stock'
    """
    customer_id = sale_data.get('customer_id', 1)
    total_amount = Decimal(str(sale_data.get('total_amount', 0.0)))
    payment_method = sale_data.get('payment_method', 'Cash')
    items = sale_data.get('items', [])

    if not items:
        raise ValueError("Sale must contain at least one item.")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # 1. Insert order
        order_sql = """
            INSERT INTO order_tab (customer_id, total_amount, payment_method, payment_status, order_status)
            VALUES (%s, %s, %s, 'Paid', 'Completed')
        """
        cursor.execute(order_sql, (customer_id, total_amount, payment_method))
        order_id = cursor.lastrowid

        # 2. Insert items and reduce stock
        for item in items:
            pid = int(item['product_id'])
            qty = int(item.get('quantity') or item.get('qty', 1))
            price = Decimal(str(item.get('price', 0.0)))
            subtotal = price * qty

            item_sql = """
                INSERT INTO order_item (order_id, product_id, quntity, price, subtotal)
                VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(item_sql, (order_id, pid, qty, price, subtotal))

            # Reduce stock in products_tab
            cursor.execute("UPDATE products_tab SET stock = GREATEST(0, stock - %s) WHERE product_id = %s", (qty, pid))

            # Fetch new stock to update status
            cursor.execute("SELECT stock FROM products_tab WHERE product_id = %s", (pid,))
            row = cursor.fetchone()
            if row:
                new_stock = row['stock']
                if new_stock <= 0:
                    new_status = 'Out of stock'
                elif new_stock <= 10:
                    new_status = 'low stock'
                else:
                    new_status = 'in stock'
                cursor.execute("UPDATE products_tab SET status = %s WHERE product_id = %s", (new_status, pid))

        conn.commit()
        cursor.close()
        conn.close()
        return order_id
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        raise e


class CashierHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send_json_response(self, status, data):
        body = json.dumps(data, default=json_serializer).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Cookie")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
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
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Cookie")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(content)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Cookie")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        cookie_header = self.headers.get("Cookie", "")
        cookies = parse_cookies_dict(cookie_header)

        # 0. API: Cashier Dashboard
        if path in ["/api/cashier/dashboard", "/api/dashboard/cashier", "/api/dashboard"]:
            try:
                data = get_dashboard_metrics()
                self._send_json_response(200, data)
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 1. API: Cashier / User Profile
        if path in ["/api/user/profile", "/api/users/profile", "/api/cashier/profile", "/api/profile", "/api/user", "/api/user/me"]:
            try:
                user_id = query.get("id", [None])[0]
                username = query.get("username", [None])[0]
                email = query.get("email", [None])[0]
                user = get_current_user(user_id=user_id, username=username, email=email, cookies=cookies, role_preference="Cashier")
                if user:
                    self._send_json_response(200, {"status": "success", "user": user, "profile": user})
                else:
                    self._send_json_response(404, {"status": "error", "message": "User not found in 'registration' table."})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 2. API: Products List with Filtering & Summaries
        if path in ["/api/cashier/products", "/api/products", "/api/products/"]:
            try:
                data = get_products_data(query)
                self._send_json_response(200, data)
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 3. API: Single Product Detail
        if path in ["/api/cashier/products/detail", "/api/products/detail", "/api/product/detail"]:
            try:
                pid = query.get("id", [None])[0] or query.get("product_id", [None])[0]
                if not pid:
                    self._send_json_response(400, {"status": "error", "message": "Missing product ID parameter."})
                    return
                product = get_single_product_detail(pid)
                if product:
                    self._send_json_response(200, {"status": "success", "product": product})
                else:
                    self._send_json_response(404, {"status": "error", "message": f"Product #{pid} not found."})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 4. API: Categories List
        if path in ["/api/cashier/categories", "/api/categories", "/api/categories/"]:
            try:
                cats = get_categories_list()
                self._send_json_response(200, {"status": "success", "categories": cats})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 4.1 API: Customers List
        if path in ["/api/customers", "/api/customer", "/api/customers/"]:
            try:
                customers = get_customers_list()
                self._send_json_response(200, {"status": "success", "customers": customers})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 4.2 API: Invoices List
        if path in ["/api/invoices", "/api/cashier/invoices", "/api/orders/invoices"]:
            try:
                invoices = get_invoices_list(query)
                self._send_json_response(200, {"status": "success", "invoices": invoices})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 4.3 API: Single Invoice Detail
        if path in ["/api/invoices/detail", "/api/cashier/invoices/detail", "/api/invoice/detail"]:
            try:
                order_id = query.get("order_id", [None])[0] or query.get("id", [None])[0]
                if not order_id:
                    self._send_json_response(400, {"status": "error", "message": "Missing order_id"})
                    return
                clean_id = str(order_id).lstrip("#")
                inv = get_invoice_detail(int(clean_id))
                if inv:
                    self._send_json_response(200, {"status": "success", "invoice": inv})
                else:
                    self._send_json_response(404, {"status": "error", "message": "Invoice not found"})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 4.4 API: Orders List
        if path in ["/api/orders", "/api/cashier/orders", "/api/orders/list"]:
            try:
                orders = get_invoices_list(query)
                self._send_json_response(200, {"status": "success", "orders": orders})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 4.5 API: Single Order Detail
        if path in ["/api/orders/detail", "/api/cashier/orders/detail", "/api/order/detail"]:
            try:
                order_id = query.get("order_id", [None])[0] or query.get("id", [None])[0]
                if not order_id:
                    self._send_json_response(400, {"status": "error", "message": "Missing order_id"})
                    return
                clean_id = str(order_id).lstrip("#")
                ord_data = get_invoice_detail(int(clean_id))
                if ord_data:
                    self._send_json_response(200, {"status": "success", "order": ord_data})
                else:
                    self._send_json_response(404, {"status": "error", "message": "Order not found"})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 4.6 API: Sales Reports & Analytics
        if path in ["/api/reports/sales", "/api/sales/report", "/api/reports"]:
            try:
                report_data = get_sales_analytics(query)
                self._send_json_response(200, report_data)
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": str(e)})
            return

        # 5. Static File Serving
        req_path = path.lstrip("/")
        if req_path.startswith("demo/"):
            req_path = req_path[5:]
        if not req_path or req_path == "":
            req_path = "cashier_product.html"

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
        cookie_header = self.headers.get("Cookie", "")
        cookies = parse_cookies_dict(cookie_header)

        content_length = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"

        try:
            payload = json.loads(post_body) if post_body.strip() else {}
        except Exception:
            payload = {}

        # 1. Update Profile (Cashier Personal Details)
        if path in ["/api/users/edit", "/api/users/update", "/api/settings/profile", "/api/profile/update"]:
            try:
                saved_id = update_user_profile(payload, cookies=cookies)
                user_info = get_current_user(user_id=saved_id)
                self._send_json_response(200, {
                    "status": "success",
                    "message": f"Profile for '{user_info.get('full_name')}' updated successfully.",
                    "user": user_info,
                    "profile": user_info
                })
            except ValueError as ve:
                self._send_json_response(400, {"status": "error", "message": str(ve)})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": f"Database error: {str(e)}"})
            return

        # 2. Sale Completion & Stock Deduction
        if path in ["/api/pos/complete", "/api/sales/complete", "/api/orders/create", "/api/pos/sale", "/api/order/complete"]:
            try:
                order_id = process_sale_order(payload)
                self._send_json_response(200, {
                    "status": "success",
                    "message": f"Sale completed and stock updated successfully. Order #{order_id} created.",
                    "order_id": order_id
                })
            except ValueError as ve:
                self._send_json_response(400, {"status": "error", "message": str(ve)})
            except Exception as e:
                self._send_json_response(500, {"status": "error", "message": f"Sale processing error: {str(e)}"})
            return

        # 2.1 Customer Creation & Update
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

        # 3. Cashier Permission Enforcement: Write operations on Products/Categories are strictly forbidden
        if path in [
            "/api/products/add", "/api/products/edit", "/api/products/delete",
            "/api/categories/add", "/api/categories/edit", "/api/categories/delete"
        ]:
            # Verify user role
            current_user = get_current_user(cookies=cookies)
            if not current_user or str(current_user.get('role')).lower() != "admin":
                self._send_json_response(403, {
                    "status": "error",
                    "code": 403,
                    "message": "Permission Denied: Cashiers are not authorized to modify products, stock, prices, or categories. This action is restricted to Administrators only."
                })
                return

        self._send_json_response(404, {"status": "error", "message": f"Endpoint '{path}' not found."})


try:
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer as HTTPServerClass
except ImportError:
    from http.server import BaseHTTPRequestHandler, HTTPServer as HTTPServerClass


def run_server(preferred_ports=[9007, 9010, 9008, 9009, 9013, 9000, 8000]):
    httpd = None
    selected_port = None

    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        preferred_ports = [int(sys.argv[1])] + preferred_ports

    for port in preferred_ports:
        try:
            HTTPServerClass.allow_reuse_address = True
            server_address = ('0.0.0.0', port)
            httpd = HTTPServerClass(server_address, CashierHandler)
            selected_port = port
            break
        except OSError:
            continue

    if not httpd:
        print("ERROR: Could not bind to any port in", preferred_ports, flush=True)
        sys.exit(1)

    print('=' * 60, flush=True)
    print(' Cashier Product & Management Server (MySQL "project")', flush=True)
    print(' Tables: "products_tab", "categories_tab", "registration", "order_tab"', flush=True)
    print('=' * 60, flush=True)
    print(f'Server Running At:     http://localhost:{selected_port}/', flush=True)
    print(f'Cashier Product Page:  http://localhost:{selected_port}/cashier_product.html', flush=True)
    print(f'Settings Profile Page: http://localhost:{selected_port}/setting.html', flush=True)
    print(f'Products API:          http://localhost:{selected_port}/api/cashier/products', flush=True)
    print('=' * 60, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down server...', flush=True)
        httpd.server_close()
        sys.exit(0)


if __name__ == '__main__':
    run_server()
