import http.server
import socketserver
import json
import mysql.connector
import bcrypt
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "project"
}

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings_tab (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_key VARCHAR(50) UNIQUE NOT NULL,
            setting_value TEXT
        )
    """)
    conn.commit()
    
    # Insert default settings if empty
    cursor.execute("SELECT COUNT(*) as count FROM settings_tab")
    count = cursor.fetchone()[0]
    if count == 0:
        defaults = [
            ("store_name", "Super Market"),
            ("store_address", "123 Main St"),
            ("store_phone", "9876543210"),
            ("store_email", "store@example.com"),
            ("store_gst", "GST12345"),
            ("invoice_prefix", "INV-"),
            ("invoice_gst", "5"),
            ("invoice_currency", "₹ INR"),
            ("notif_low_stock", "ON"),
            ("notif_new_order", "ON"),
            ("notif_system", "ON"),
            ("pref_currency", "₹ INR"),
            ("pref_date_format", "DD-MM-YYYY"),
            ("pref_theme", "Light")
        ]
        cursor.executemany("INSERT INTO settings_tab (setting_key, setting_value) VALUES (%s, %s)", defaults)
        conn.commit()
    cursor.close()
    conn.close()

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

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
    
    return "1=1" # default no filter

def format_product_name(img_name):
    if not img_name: return "Unknown"
    return img_name.split('.')[0].capitalize()

def fetch_all_reports(filter_type, from_date, to_date):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    date_filter = get_date_filter_condition(filter_type, from_date, to_date, 'order_date')
    
    # ---------------- KPIs ----------------
    # 1. Total Sales (Excluding cancelled orders)
    cursor.execute(f"SELECT SUM(total_amount) as total FROM order_tab WHERE order_status != 'Cancelled' AND {date_filter}")
    total_sales = cursor.fetchone()['total'] or 0
    
    # 2. Total Orders
    cursor.execute(f"SELECT COUNT(order_id) as total FROM order_tab WHERE {date_filter}")
    total_orders = cursor.fetchone()['total'] or 0
    
    # 3. Total Products
    cursor.execute("SELECT COUNT(product_id) as total FROM products_tab")
    total_products = cursor.fetchone()['total'] or 0
    
    # 4. Total Customers
    cursor.execute("SELECT COUNT(customer_id) as total FROM customer_tab")
    total_customers = cursor.fetchone()['total'] or 0
    
    # 5. Today's Sales
    today_filter = get_date_filter_condition('today', None, None, 'order_date')
    cursor.execute(f"SELECT SUM(total_amount) as total FROM order_tab WHERE order_status != 'Cancelled' AND {today_filter}")
    today_sales = cursor.fetchone()['total'] or 0
    
    # 6. Today's Orders
    cursor.execute(f"SELECT COUNT(order_id) as total FROM order_tab WHERE {today_filter}")
    today_orders = cursor.fetchone()['total'] or 0
    
    # 7. Low Stock Products (using status='low stock' or stock < 10 as fallback)
    cursor.execute("SELECT COUNT(product_id) as total FROM products_tab WHERE status = 'low stock' OR stock < 10")
    low_stock = cursor.fetchone()['total'] or 0
    
    # 8. Cancelled Orders
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

    # ---------------- CHARTS ----------------
    # 1 & 2. Sales by Category & Sales Distribution
    cursor.execute(f"""
        SELECT c.cat_name as label, SUM(oi.subtotal) as value 
        FROM order_item oi 
        JOIN products_tab p ON oi.product_id = p.product_id 
        JOIN categories_tab c ON p.cat_id = c.cat_id 
        JOIN order_tab o ON oi.order_id = o.order_id
        WHERE o.order_status != 'Cancelled' AND {date_filter.replace('order_date', 'o.order_date')}
        GROUP BY c.cat_name
    """)
    charts['salesByCategory'] = cursor.fetchall()
    
    # 3. Monthly Sales Trend
    cursor.execute(f"""
        SELECT DATE_FORMAT(order_date, '%b %Y') as label, SUM(total_amount) as value 
        FROM order_tab 
        WHERE order_status != 'Cancelled' AND {date_filter}
        GROUP BY YEAR(order_date), MONTH(order_date) 
        ORDER BY YEAR(order_date), MONTH(order_date)
    """)
    charts['monthlySales'] = cursor.fetchall()
    
    # 4. Daily Sales Trend
    cursor.execute(f"""
        SELECT DATE_FORMAT(order_date, '%d %b') as label, SUM(total_amount) as value 
        FROM order_tab 
        WHERE order_status != 'Cancelled' AND {date_filter}
        GROUP BY DATE(order_date) 
        ORDER BY DATE(order_date)
    """)
    charts['dailySales'] = cursor.fetchall()
    
    # 5. Top 10 Best-Selling Products
    cursor.execute(f"""
        SELECT p.image as label, SUM(oi.quntity) as value 
        FROM order_item oi 
        JOIN products_tab p ON oi.product_id = p.product_id 
        JOIN order_tab o ON oi.order_id = o.order_id
        WHERE o.order_status != 'Cancelled' AND {date_filter.replace('order_date', 'o.order_date')}
        GROUP BY p.product_id 
        ORDER BY value DESC 
        LIMIT 10
    """)
    top_products = cursor.fetchall()
    for row in top_products: row['label'] = format_product_name(row['label'])
    charts['topProducts'] = top_products
    
    # 6. Product-wise Revenue
    cursor.execute(f"""
        SELECT p.image as label, SUM(oi.subtotal) as value 
        FROM order_item oi 
        JOIN products_tab p ON oi.product_id = p.product_id 
        JOIN order_tab o ON oi.order_id = o.order_id
        WHERE o.order_status != 'Cancelled' AND {date_filter.replace('order_date', 'o.order_date')}
        GROUP BY p.product_id 
        ORDER BY value DESC
        LIMIT 15
    """)
    product_revenue = cursor.fetchall()
    for row in product_revenue: row['label'] = format_product_name(row['label'])
    charts['productRevenue'] = product_revenue
    
    # 7. Order Status Distribution
    cursor.execute(f"SELECT order_status as label, COUNT(order_id) as value FROM order_tab WHERE {date_filter} GROUP BY order_status")
    charts['orderStatus'] = cursor.fetchall()
    
    # 8. Payment Method Distribution
    cursor.execute(f"SELECT payment_method as label, COUNT(order_id) as value FROM order_tab WHERE {date_filter} GROUP BY payment_method")
    charts['paymentMethod'] = cursor.fetchall()
    
    # 9. Quantity Sold by Category
    cursor.execute(f"""
        SELECT c.cat_name as label, SUM(oi.quntity) as value 
        FROM order_item oi 
        JOIN products_tab p ON oi.product_id = p.product_id 
        JOIN categories_tab c ON p.cat_id = c.cat_id 
        JOIN order_tab o ON oi.order_id = o.order_id
        WHERE o.order_status != 'Cancelled' AND {date_filter.replace('order_date', 'o.order_date')}
        GROUP BY c.cat_name
    """)
    charts['quantityByCategory'] = cursor.fetchall()
    
    # 10. Top 10 Customers
    cursor.execute(f"""
        SELECT c.customer_name as label, COUNT(o.order_id) as value 
        FROM order_tab o
        JOIN customer_tab c ON o.customer_id = c.customer_id
        WHERE {date_filter.replace('order_date', 'o.order_date')}
        GROUP BY c.customer_id 
        ORDER BY value DESC 
        LIMIT 10
    """)
    charts['topCustomers'] = cursor.fetchall()
    
    # 11. Stock by Category
    cursor.execute("""
        SELECT c.cat_name as label, SUM(p.stock) as value 
        FROM products_tab p 
        JOIN categories_tab c ON p.cat_id = c.cat_id 
        GROUP BY c.cat_name
    """)
    charts['stockByCategory'] = cursor.fetchall()
    
    # 12. Low Stock Products
    cursor.execute("""
        SELECT image as label, stock as value 
        FROM products_tab 
        WHERE status = 'low stock' OR stock < 10
        ORDER BY stock ASC 
        LIMIT 10
    """)
    low_stock_products = cursor.fetchall()
    for row in low_stock_products: row['label'] = format_product_name(row['label'])
    charts['lowStockProducts'] = low_stock_products
    
    # 13. Today's Sales vs Yesterday's Sales
    yesterday_filter = get_date_filter_condition('yesterday', None, None, 'order_date')
    cursor.execute(f"SELECT SUM(total_amount) as total FROM order_tab WHERE order_status != 'Cancelled' AND {yesterday_filter}")
    yesterday_sales = cursor.fetchone()['total'] or 0
    charts['salesComparison'] = [
        {"label": "Yesterday", "value": yesterday_sales},
        {"label": "Today", "value": today_sales}
    ]

    # Convert Decimals/floats to int for JSON
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


class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def _set_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def end_headers(self):
        pass

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        
        if parsed_url.path == '/api/settings':
            try:
                conn = get_db_connection()
                cursor = conn.cursor(dictionary=True)
                
                # Fetch Admin (Assuming ID 1 for now)
                cursor.execute("SELECT id, name, email, mobile FROM registration WHERE role='Admin' LIMIT 1")
                admin = cursor.fetchone()
                if not admin:
                    # Fallback to any user if no admin found
                    cursor.execute("SELECT id, name, email, mobile FROM registration LIMIT 1")
                    admin = cursor.fetchone()
                
                cursor.execute("SELECT setting_key, setting_value FROM settings_tab")
                settings_rows = cursor.fetchall()
                settings = {row['setting_key']: row['setting_value'] for row in settings_rows}
                
                cursor.close()
                conn.close()
                
                data = {
                    "admin": admin or {},
                    "store": {
                        "name": settings.get("store_name", ""),
                        "address": settings.get("store_address", ""),
                        "phone": settings.get("store_phone", ""),
                        "email": settings.get("store_email", ""),
                        "gst": settings.get("store_gst", "")
                    },
                    "invoice": {
                        "prefix": settings.get("invoice_prefix", "INV-"),
                        "gst": settings.get("invoice_gst", "5"),
                        "currency": settings.get("invoice_currency", "₹ INR")
                    },
                    "notifications": {
                        "lowStock": settings.get("notif_low_stock", "ON"),
                        "newOrder": settings.get("notif_new_order", "ON"),
                        "system": settings.get("notif_system", "ON")
                    },
                    "preferences": {
                        "currency": settings.get("pref_currency", "₹ INR"),
                        "dateFormat": settings.get("pref_date_format", "DD-MM-YYYY"),
                        "theme": settings.get("pref_theme", "Light")
                    }
                }
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self._set_headers()
                self.wfile.write(json.dumps({"success": True, "data": data}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self._set_headers()
                self.wfile.write(json.dumps({"success": False, "message": str(e)}).encode())
                
        elif parsed_url.path.startswith('/api/reports/all'):
            query_params = parse_qs(parsed_url.query)
            filter_type = query_params.get('filter', ['today'])[0]
            from_date = query_params.get('from', [None])[0]
            to_date = query_params.get('to', [None])[0]
            
            try:
                data = fetch_all_reports(filter_type, from_date, to_date)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self._set_headers()
                self.wfile.write(json.dumps({"success": True, "data": data}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self._set_headers()
                self.wfile.write(json.dumps({"success": False, "message": str(e)}).encode())
        else:
            self.send_header('Access-Control-Allow-Origin', '*')
            super().end_headers()
            super().do_GET()

    def do_POST(self):
        parsed_url = urlparse(self.path)
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            payload = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_response(400)
            self._set_headers()
            self.wfile.write(json.dumps({"success": False, "message": "Invalid JSON"}).encode())
            return
            
        conn = get_db_connection()
        cursor = conn.cursor()
        success = False
        message = ""
        
        try:
            if parsed_url.path == '/api/settings/profile':
                cursor.execute("UPDATE registration SET name=%s, email=%s, mobile=%s WHERE role='Admin' LIMIT 1", 
                               (payload.get('name'), payload.get('email'), payload.get('mobile')))
                # If no rows affected because no admin, try to update user ID 1
                if cursor.rowcount == 0:
                    cursor.execute("UPDATE registration SET name=%s, email=%s, mobile=%s LIMIT 1", 
                                   (payload.get('name'), payload.get('email'), payload.get('mobile')))
                conn.commit()
                success = True
                
            elif parsed_url.path == '/api/settings/store':
                updates = [
                    ("store_name", payload.get('name')),
                    ("store_address", payload.get('address')),
                    ("store_phone", payload.get('phone')),
                    ("store_email", payload.get('email')),
                    ("store_gst", payload.get('gst'))
                ]
                cursor.executemany("INSERT INTO settings_tab (setting_key, setting_value) VALUES (%s, %s) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", updates)
                conn.commit()
                success = True
                
            elif parsed_url.path == '/api/settings/invoice':
                updates = [
                    ("invoice_prefix", payload.get('prefix')),
                    ("invoice_gst", payload.get('gst')),
                    ("invoice_currency", payload.get('currency'))
                ]
                cursor.executemany("INSERT INTO settings_tab (setting_key, setting_value) VALUES (%s, %s) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", updates)
                conn.commit()
                success = True
                
            elif parsed_url.path == '/api/settings/notifications':
                updates = [
                    ("notif_low_stock", payload.get('lowStock')),
                    ("notif_new_order", payload.get('newOrder')),
                    ("notif_system", payload.get('system'))
                ]
                cursor.executemany("INSERT INTO settings_tab (setting_key, setting_value) VALUES (%s, %s) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", updates)
                conn.commit()
                success = True
                
            elif parsed_url.path == '/api/settings/preferences':
                updates = [
                    ("pref_currency", payload.get('currency')),
                    ("pref_date_format", payload.get('dateFormat')),
                    ("pref_theme", payload.get('theme'))
                ]
                cursor.executemany("INSERT INTO settings_tab (setting_key, setting_value) VALUES (%s, %s) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", updates)
                conn.commit()
                success = True
                
            elif parsed_url.path == '/api/settings/password':
                current = payload.get('current')
                new_pass = payload.get('newPass')
                
                cursor.execute("SELECT id, password FROM registration WHERE role='Admin' LIMIT 1")
                admin = cursor.fetchone()
                if not admin:
                    cursor.execute("SELECT id, password FROM registration LIMIT 1")
                    admin = cursor.fetchone()
                    
                if not admin:
                    success = False
                    message = "Admin user not found"
                else:
                    stored_hash = admin[1].encode('utf-8')
                    if bcrypt.checkpw(current.encode('utf-8'), stored_hash):
                        new_hash = bcrypt.hashpw(new_pass.encode('utf-8'), bcrypt.gensalt())
                        cursor.execute("UPDATE registration SET password=%s WHERE id=%s", (new_hash.decode('utf-8'), admin[0]))
                        conn.commit()
                        success = True
                    else:
                        success = False
                        message = "Incorrect current password"
        except Exception as e:
            success = False
            message = str(e)
        finally:
            cursor.close()
            conn.close()
            
        self.send_response(200 if success else 400)
        self.send_header('Content-type', 'application/json')
        self._set_headers()
        self.wfile.write(json.dumps({"success": success, "message": message}).encode())

# if __name__ == '__main__':
#     # Initialize Settings DB
#     try:
#         init_db()
#         print("Settings Database initialized successfully.")
#     except Exception as e:
#         print(f"Error initializing DB: {e}")

#     PORT = 9013
#     handler = RequestHandler
#     with socketserver.TCPServer(("", PORT), handler) as httpd:
#         print("==================================================")
#         print("Reports & Analytics Server Started")
#         print(f"http://localhost:{PORT}/reports.html")
#         print(f"Settings API available at http://localhost:{PORT}/api/settings")
#         print("==================================================")
#         httpd.serve_forever()

if __name__ == '__main__':
    # Initialize Settings DB
    try:
        init_db()
        print("Settings Database initialized successfully.")
    except Exception as e:
        print(f"Error initializing DB: {e}")

    PORT = 9013
    handler = RequestHandler

    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    with ReusableTCPServer(("", PORT), handler) as httpd:
        print("==================================================")
        print("Reports & Analytics Server Started")
        print(f"http://localhost:{PORT}/reports.html")
        print(f"Settings API available at http://localhost:{PORT}/api/settings")
        print("==================================================")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
