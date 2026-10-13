from http.server import BaseHTTPRequestHandler, HTTPServer

import json

import mysql.connector

from urllib.parse import urlparse, parse_qs

from datetime import datetime, timedelta



# ---------------------------------------------------

# 1. DATABASE CONFIG -- update with your real MySQL credentials

# ---------------------------------------------------

DB_CONFIG = {

    "host": "localhost",

    "user": "root",

    "password": "",   # <-- change this

    "database": "project"      # <-- change this to your DB name

}





def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)


def get_user_profile(user_id=None, username=None, cookies=None):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    user = None

    if user_id:
        clean_id = str(user_id).lstrip('#').strip()
        if clean_id.isdigit():
            cursor.execute("SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture FROM registration WHERE id = %s", (int(clean_id),))
            user = cursor.fetchone()

    if not user and username:
        clean_username = str(username).lstrip('@').strip()
        cursor.execute("SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture FROM registration WHERE username = %s", (clean_username,))
        user = cursor.fetchone()

    if not user and cookies:
        cookie_username = cookies.get("admin_username") or cookies.get("username")
        cookie_id = cookies.get("admin_id") or cookies.get("user_id") or cookies.get("current_user_id")
        cookie_email = cookies.get("admin_email")

        if cookie_username:
            cursor.execute("SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture FROM registration WHERE username = %s", (cookie_username.strip(),))
            user = cursor.fetchone()
        if not user and cookie_id and str(cookie_id).lstrip('#').isdigit():
            cursor.execute("SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture FROM registration WHERE id = %s", (int(str(cookie_id).lstrip('#')),))
            user = cursor.fetchone()
        if not user and cookie_email:
            cursor.execute("SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture FROM registration WHERE email = %s", (cookie_email.strip(),))
            user = cursor.fetchone()

    if not user:
        cursor.execute("""
            SELECT id, full_name, username, email, mobail, address, role, status, create_at, profile_picture 
            FROM registration 
            ORDER BY (CASE WHEN LOWER(role) = 'admin' AND status = 'Active' THEN 0 
                           WHEN LOWER(role) = 'admin' THEN 1 
            LIMIT 1
                           ELSE 2 END), id ASC 
        """)
        user = cursor.fetchone()

    cursor.close()
    conn.close()

    if user:
        if user.get('create_at'):
            user['create_at'] = str(user['create_at'])
        user['mobile'] = user.get('mobail') or ''
        user['name'] = user.get('full_name') or ''
        user['profile_picture'] = user.get('profile_picture') or ''
    return user





def get_dashboard_stats():

    """

    Queries totals from your tables.

    Adjust table/column names to match your actual database schema.

    """

    conn = get_db_connection()

    cursor = conn.cursor()



    # Total Users

    cursor.execute("SELECT COUNT(*) FROM registration")

    total_users = cursor.fetchone()[0]



    # Total Orders

    cursor.execute("SELECT COUNT(*) FROM order_tab")

    total_orders = cursor.fetchone()[0]



    # Total Products

    cursor.execute("SELECT COUNT(*) FROM products_tab")

    total_products = cursor.fetchone()[0]



    # Total Revenue (sum of order amounts)

    cursor.execute("SELECT COALESCE(SUM(total_amount), 0) FROM order_tab")

    total_revenue = cursor.fetchone()[0]



    cursor.close()

    conn.close()



    return {

        "totalUsers": total_users,

        "totalOrders": total_orders,

        "totalProducts": total_products,

        "totalRevenue": int(round(float(total_revenue)))

    }



def get_global_search_results(query):

    conn = get_db_connection()

    cursor = conn.cursor(dictionary=True)

    results = { "products": [], "customers": [], "categories": [], "orders": [] }

    search_param = f"%{query}%"



    # Products

    cursor.execute("SELECT product_id, image, price, stock, status FROM products_tab WHERE image LIKE %s OR product_id LIKE %s", (search_param, search_param))

    results['products'] = cursor.fetchall()

    for row in results['products']:

        row['product_name'] = format_product_name(row['image'])

        if row['price']: row['price'] = float(row['price'])



    # Customers

    cursor.execute("SELECT customer_id, customer_name, email, phone, status FROM customer_tab WHERE customer_name LIKE %s OR email LIKE %s OR phone LIKE %s OR customer_id LIKE %s", (search_param, search_param, search_param, search_param))

    results['customers'] = cursor.fetchall()



    # Categories

    cursor.execute("SELECT cat_id, cat_name, status FROM categories_tab WHERE cat_name LIKE %s OR description LIKE %s", (search_param, search_param))

    results['categories'] = cursor.fetchall()



    # Orders

    cursor.execute("SELECT o.order_id, o.total_amount, o.order_status, c.customer_name FROM order_tab o LEFT JOIN customer_tab c ON o.customer_id = c.customer_id WHERE o.order_id LIKE %s OR c.customer_name LIKE %s", (search_param, search_param))

    orders = cursor.fetchall()

    for o in orders:

        if o['total_amount']: o['total_amount'] = float(o['total_amount'])

    results['orders'] = orders



    cursor.close()

    conn.close()

    return results



def get_date_filter_condition(filter_type, from_date_str, to_date_str, date_column):

    today = datetime.today().date()

    

    if filter_type == 'today':

        return f"DATE({date_column}) = '{today}'"

    elif filter_type == 'yesterday':

        yesterday = today - timedelta(days=1)

        return f"DATE({date_column}) = '{yesterday}'"

    elif filter_type == 'last7days':

        start_date = today - timedelta(days=7)

        return f"DATE({date_column}) >= '{start_date}'"

    elif filter_type == 'last30days':

        start_date = today - timedelta(days=30)

        return f"DATE({date_column}) >= '{start_date}'"

    elif filter_type == 'thisMonth':

        return f"YEAR({date_column}) = {today.year} AND MONTH({date_column}) = {today.month}"

    elif filter_type == 'thisYear':

        return f"YEAR({date_column}) = {today.year}"

    elif filter_type == 'custom' and from_date_str and to_date_str:

        return f"DATE({date_column}) >= '{from_date_str}' AND DATE({date_column}) <= '{to_date_str}'"

    

    return "1=1"



def format_product_name(img_name):

    if not img_name: return "Unknown"

    return img_name.split('.')[0].capitalize()



def fetch_all_reports(filter_type, from_date, to_date):

    conn = get_db_connection()

    cursor = conn.cursor(dictionary=True)

    

    date_filter = get_date_filter_condition(filter_type, from_date, to_date, 'order_date')

    

    # KPIs

    cursor.execute(f"SELECT SUM(total_amount) as total FROM order_tab WHERE order_status != 'Cancelled' AND {date_filter}")

    total_sales = cursor.fetchone()['total'] or 0

    cursor.execute(f"SELECT COUNT(order_id) as total FROM order_tab WHERE {date_filter}")

    total_orders = cursor.fetchone()['total'] or 0

    cursor.execute("SELECT COUNT(product_id) as total FROM products_tab")

    total_products = cursor.fetchone()['total'] or 0

    cursor.execute("SELECT COUNT(customer_id) as total FROM customer_tab")

    total_customers = cursor.fetchone()['total'] or 0

    

    today_filter = get_date_filter_condition('today', None, None, 'order_date')

    cursor.execute(f"SELECT SUM(total_amount) as total FROM order_tab WHERE order_status != 'Cancelled' AND {today_filter}")

    today_sales = cursor.fetchone()['total'] or 0

    cursor.execute(f"SELECT COUNT(order_id) as total FROM order_tab WHERE {today_filter}")

    today_orders = cursor.fetchone()['total'] or 0

    

    cursor.execute("SELECT COUNT(product_id) as total FROM products_tab WHERE status = 'low stock' OR stock < 10")

    low_stock = cursor.fetchone()['total'] or 0

    cursor.execute(f"SELECT COUNT(order_id) as total FROM order_tab WHERE order_status = 'Cancelled' AND {date_filter}")

    cancelled_orders = cursor.fetchone()['total'] or 0

    

    kpis = {

        "totalSales": total_sales,

        "totalOrders": total_orders,

        "totalProducts": total_products,

        "totalCustomers": total_customers,

        "todaySales": today_sales,

        "todayOrders": today_orders,

        "lowStock": low_stock,

        "cancelledOrders": cancelled_orders

    }



    charts = {}

    

    cursor.execute(f"SELECT c.cat_name as label, SUM(oi.subtotal) as value FROM order_item oi JOIN products_tab p ON oi.product_id = p.product_id JOIN categories_tab c ON p.cat_id = c.cat_id JOIN order_tab o ON oi.order_id = o.order_id WHERE o.order_status != 'Cancelled' AND {date_filter.replace('order_date', 'o.order_date')} GROUP BY c.cat_name")

    charts['salesByCategory'] = cursor.fetchall()

    

    cursor.execute(f"SELECT DATE_FORMAT(order_date, '%b %Y') as label, SUM(total_amount) as value FROM order_tab WHERE order_status != 'Cancelled' AND {date_filter} GROUP BY YEAR(order_date), MONTH(order_date) ORDER BY YEAR(order_date), MONTH(order_date)")

    charts['monthlySales'] = cursor.fetchall()

    

    cursor.execute(f"SELECT DATE_FORMAT(order_date, '%d %b') as label, SUM(total_amount) as value FROM order_tab WHERE order_status != 'Cancelled' AND {date_filter} GROUP BY DATE(order_date) ORDER BY DATE(order_date)")

    charts['dailySales'] = cursor.fetchall()

    

    cursor.execute(f"SELECT p.image as label, SUM(oi.quntity) as value FROM order_item oi JOIN products_tab p ON oi.product_id = p.product_id JOIN order_tab o ON oi.order_id = o.order_id WHERE o.order_status != 'Cancelled' AND {date_filter.replace('order_date', 'o.order_date')} GROUP BY p.product_id ORDER BY value DESC LIMIT 10")

    top_products = cursor.fetchall()

    for row in top_products: row['label'] = format_product_name(row['label'])

    charts['topProducts'] = top_products

    

    cursor.execute(f"SELECT p.image as label, SUM(oi.subtotal) as value FROM order_item oi JOIN products_tab p ON oi.product_id = p.product_id JOIN order_tab o ON oi.order_id = o.order_id WHERE o.order_status != 'Cancelled' AND {date_filter.replace('order_date', 'o.order_date')} GROUP BY p.product_id ORDER BY value DESC LIMIT 15")

    product_revenue = cursor.fetchall()

    for row in product_revenue: row['label'] = format_product_name(row['label'])

    charts['productRevenue'] = product_revenue

    

    cursor.execute(f"SELECT order_status as label, COUNT(order_id) as value FROM order_tab WHERE {date_filter} GROUP BY order_status")

    charts['orderStatus'] = cursor.fetchall()

    

    cursor.execute(f"SELECT payment_method as label, COUNT(order_id) as value FROM order_tab WHERE {date_filter} GROUP BY payment_method")

    charts['paymentMethod'] = cursor.fetchall()

    

    cursor.execute(f"SELECT c.cat_name as label, SUM(oi.quntity) as value FROM order_item oi JOIN products_tab p ON oi.product_id = p.product_id JOIN categories_tab c ON p.cat_id = c.cat_id JOIN order_tab o ON oi.order_id = o.order_id WHERE o.order_status != 'Cancelled' AND {date_filter.replace('order_date', 'o.order_date')} GROUP BY c.cat_name")

    charts['quantityByCategory'] = cursor.fetchall()

    

    cursor.execute(f"SELECT c.customer_name as label, COUNT(o.order_id) as value FROM order_tab o JOIN customer_tab c ON o.customer_id = c.customer_id WHERE {date_filter.replace('order_date', 'o.order_date')} GROUP BY c.customer_id ORDER BY value DESC LIMIT 10")

    charts['topCustomers'] = cursor.fetchall()

    

    cursor.execute("SELECT c.cat_name as label, SUM(p.stock) as value FROM products_tab p JOIN categories_tab c ON p.cat_id = c.cat_id GROUP BY c.cat_name")

    charts['stockByCategory'] = cursor.fetchall()

    

    cursor.execute("SELECT image as label, stock as value FROM products_tab WHERE status = 'low stock' OR stock < 10 ORDER BY stock ASC LIMIT 10")

    low_stock_products = cursor.fetchall()

    for row in low_stock_products: row['label'] = format_product_name(row['label'])

    charts['lowStockProducts'] = low_stock_products

    

    yesterday_filter = get_date_filter_condition('yesterday', None, None, 'order_date')

    cursor.execute(f"SELECT SUM(total_amount) as total FROM order_tab WHERE order_status != 'Cancelled' AND {yesterday_filter}")

    yesterday_sales = cursor.fetchone()['total'] or 0

    charts['salesComparison'] = [

        {"label": "Yesterday", "value": yesterday_sales},

        {"label": "Today", "value": today_sales}

    ]



    for key in kpis:
        if hasattr(kpis[key], 'normalize'): kpis[key] = int(round(float(kpis[key])))
        elif isinstance(kpis[key], float): kpis[key] = int(round(kpis[key]))

    for key in charts:
        for row in charts[key]:
            for k, v in row.items():
                if hasattr(v, 'normalize'): row[k] = int(round(float(v)))
                elif isinstance(v, float): row[k] = int(round(v))

                

    cursor.close()

    conn.close()

    

    return {"kpis": kpis, "charts": charts}





# ---------------------------------------------------

# 2. HTTP REQUEST HANDLER

# ---------------------------------------------------

def get_report_data():

    conn = get_db_connection()

    cursor = conn.cursor(dictionary=True)

    data = {}

    

    # 1. Monthly Sales

    cursor.execute("SELECT DATE_FORMAT(order_date, '%Y-%m') as month, SUM(total_amount) as sales FROM order_tab GROUP BY month ORDER BY month")

    data['monthly_sales'] = cursor.fetchall()

    

    # 2. Sales by Category

    cursor.execute("""

        SELECT c.cat_name, SUM(oi.subtotal) as sales 

        FROM order_item oi 

        JOIN products_tab p ON oi.product_id = p.product_id 

        JOIN categories_tab c ON p.cat_id = c.cat_id 

        GROUP BY c.cat_name

    """)

    data['sales_by_category'] = cursor.fetchall()

    

    # 3. Order Status

    cursor.execute("SELECT order_status, COUNT(*) as count FROM order_tab GROUP BY order_status")

    data['order_status'] = cursor.fetchall()

    

    # 4. Top Selling Products

    cursor.execute("""

        SELECT p.image as product, SUM(oi.quntity) as total_qty 

        FROM order_item oi 

        JOIN products_tab p ON oi.product_id = p.product_id 

        GROUP BY p.product_id 

        ORDER BY total_qty DESC 

        LIMIT 5

    """)

    top_products = cursor.fetchall()

    for row in top_products:

        row['product'] = row['product'].split('.')[0].capitalize() if row['product'] else "Unknown"

    data['top_products'] = top_products

    

    # 5. Stock Report

    cursor.execute("SELECT image as product, stock FROM products_tab ORDER BY stock ASC LIMIT 10")

    stock_report = cursor.fetchall()

    for row in stock_report:

        row['product'] = row['product'].split('.')[0].capitalize() if row['product'] else "Unknown"

    data['stock_report'] = stock_report

    

    for key in data:

        for row in data[key]:

            for k, v in row.items():

                if hasattr(v, 'normalize'): 

                    row[k] = float(v)

    cursor.close()

    conn.close()

    return data



class RequestHandler(BaseHTTPRequestHandler):



    def _set_headers(self, status=200):

        self.send_response(status)

        self.send_header("Content-Type", "application/json")

        self.send_header("Access-Control-Allow-Origin", "*")

        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")

        self.send_header("Access-Control-Allow-Headers", "Content-Type")

        self.end_headers()



    def do_OPTIONS(self):

        self._set_headers()



    def do_GET(self):
        parsed_url = urlparse(self.path)
        req_path = parsed_url.path

        if req_path in ["/api/users/profile", "/api/user/profile", "/api/profile", "/api/user"]:
            try:
                query_params = parse_qs(parsed_url.query)
                user_id = query_params.get('id', [None])[0]
                username = query_params.get('username', [None])[0]
                cookie_header = self.headers.get("Cookie", "")
                cookies = {}
                for item in cookie_header.split(";"):
                    if "=" in item:
                        k, v = item.strip().split("=", 1)
                        cookies[k.strip()] = v.strip()
                user = get_user_profile(user_id=user_id, username=username, cookies=cookies)
                self._set_headers(200)
                self.wfile.write(json.dumps({"status": "success", "user": user, "profile": user}).encode())
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return

        if self.path == "/api/dashboard-stats":

            try:

                data = get_dashboard_stats()

                self._set_headers(200)

                self.wfile.write(json.dumps(data).encode())

            except Exception as e:

                self._set_headers(500)

                self.wfile.write(json.dumps({"error": str(e)}).encode())

        elif self.path == "/api/report-data":

            try:

                data = get_report_data()

                self._set_headers(200)

                self.wfile.write(json.dumps(data).encode())

            except Exception as e:

                self._set_headers(500)

                self.wfile.write(json.dumps({"error": str(e)}).encode())

        elif self.path.startswith("/api/global-search"):

            parsed_url = urlparse(self.path)

            query_params = parse_qs(parsed_url.query)

            q = query_params.get('q', [''])[0].strip()

            if not q:

                self._set_headers(200)

                self.wfile.write(json.dumps({"products":[], "customers":[], "categories":[], "orders":[]}).encode())

                return

            try:

                data = get_global_search_results(q)

                self._set_headers(200)

                self.wfile.write(json.dumps(data).encode())

            except Exception as e:

                self._set_headers(500)

                self.wfile.write(json.dumps({"error": str(e)}).encode())

        elif self.path.startswith("/api/reports/all") or self.path.startswith("/api/reports"):

            parsed_url = urlparse(self.path)

            query_params = parse_qs(parsed_url.query)

            filter_type = query_params.get('filter', ['today'])[0]

            from_date = query_params.get('from', [None])[0]

            to_date = query_params.get('to', [None])[0]

            try:

                data = fetch_all_reports(filter_type, from_date, to_date)

                self._set_headers(200)

                self.wfile.write(json.dumps({"success": True, "data": data}).encode())

            except Exception as e:

                self._set_headers(500)

                self.wfile.write(json.dumps({"success": False, "message": str(e)}).encode())

        else:

            self._set_headers(404)

            self.wfile.write(json.dumps({"error": "Not found"}).encode())





# ---------------------------------------------------

# 3. START SERVER

# ---------------------------------------------------

if __name__ == "__main__":

    port = 9013

    server = HTTPServer(("localhost", port), RequestHandler)

    print(f"Server running at http://localhost:{port}")

    print(f"Dashboard API: http://localhost:{port}/api/dashboard-stats")

    server.serve_forever()