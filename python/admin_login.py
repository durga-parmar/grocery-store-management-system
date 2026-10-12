#!/usr/bin/env python3

from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, unquote, quote
import mysql.connector
import json
import os

try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "project"
}


def get_db():
    return mysql.connector.connect(**DB_CONFIG)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    try:
        if HAS_BCRYPT and hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        elif hashed_password.startswith("sha256$"):
            import hashlib
            expected = "sha256$" + hashlib.sha256(plain_password.encode('utf-8')).hexdigest()
            return expected == hashed_password
        else:
            return plain_password == hashed_password
    except Exception:
        return False


class AdminLoginHandler(BaseHTTPRequestHandler):

    def _set_cors_headers(self):
        origin = self.headers.get("Origin")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
        else:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Cookie, Accept, Origin")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        clean_path = self.path.split('?')[0].lstrip('/')
        if not clean_path or clean_path == "admin_login":
            clean_path = "admin_login.html"

        content_types = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg"
        }
        _, ext = os.path.splitext(clean_path)
        content_type = content_types.get(ext.lower(), "text/html")

        if os.path.exists(clean_path) and os.path.isfile(clean_path):
            try:
                with open(clean_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(content)
                return
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())
                return
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Page Not Found")

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length).decode("utf-8", errors="ignore") if content_length > 0 else ""
        content_type = self.headers.get("Content-Type", "")

        username = ""
        password = ""

        if "application/json" in content_type:
            try:
                payload = json.loads(post_data)
                username = str(payload.get("username") or payload.get("email") or "").strip()
                password = str(payload.get("password") or "").strip()
            except Exception:
                pass
        else:
            data = parse_qs(post_data)
            username = str(data.get("username", [""])[0] or data.get("email", [""])[0]).strip()
            password = str(data.get("password", [""])[0]).strip()

        if not username or not password:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "message": "Please enter username/email and password."}).encode())
            return

        try:
            conn = get_db()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("""
                SELECT id, username, full_name, email, mobail, address, password, role, status, profile_picture 
                FROM registration 
                WHERE username = %s OR full_name = %s OR email = %s
                LIMIT 1
            """, (username, username, username))
            user = cursor.fetchone()
            cursor.close()
            conn.close()

            if not user:
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "Invalid username or password."}).encode())
                return

            if not verify_password(password, user['password']):
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "Invalid username or password."}).encode())
                return

            if str(user.get('status', 'Active')).lower() != 'active':
                self.send_response(403)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "Admin account is Inactive. Please contact support."}).encode())
                return

            actual_role = str(user.get('role', 'Admin')).strip()
            if actual_role.lower() != 'admin':
                self.send_response(403)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": f"Access Denied: This account is registered as a {actual_role}. Please login via Cashier Login."}).encode())
                return

            uid = str(user['id'])
            uname = user.get('username') or username
            fname = user.get('full_name') or uname
            uemail = user.get('email') or ''
            umobile = user.get('mobail') or ''

            cookie_headers = [
                f"admin_username={uname}; Path=/",
                f"username={uname}; Path=/",
                f"admin_fullname={quote(fname)}; Path=/",
                f"admin_role=Admin; Path=/",
                f"role=Admin; Path=/",
                f"admin_email={uemail}; Path=/",
                f"admin_mobile={umobile}; Path=/",
                f"admin_id={uid}; Path=/",
                f"user_id={uid}; Path=/"
            ]

            resp_data = {
                "success": True,
                "status": "Success",
                "message": "Admin Login Successful!",
                "role": "Admin",
                "redirect": "/admin_dash.html",
                "user": {
                    "id": user['id'],
                    "username": uname,
                    "full_name": fname,
                    "email": uemail,
                    "role": "Admin"
                }
            }
            body = json.dumps(resp_data).encode('utf-8')

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            for c in cookie_headers:
                self.send_header("Set-Cookie", c)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "message": f"Server error: {str(e)}"}).encode())


if __name__ == "__main__":
    port = 9000
    server = HTTPServer(("0.0.0.0", port), AdminLoginHandler)
    print(f"[*] Admin Login Server Running at: http://localhost:{port}/admin_login.html")
    server.serve_forever()