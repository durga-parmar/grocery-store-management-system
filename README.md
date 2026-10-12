# 🛒 Grocery Store Management System

[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![MySQL](https://img.shields.io/badge/MySQL-5.7%20%7C%208.0-orange.svg?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26.svg?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6.svg?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E.svg?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5-7952B3.svg?logo=bootstrap&logoColor=white)](https://getbootstrap.com/)

A full-stack, responsive **Grocery Store Management System** built with **Python**, **MySQL**, and modern frontend web technologies. The system provides an end-to-end retail store workflow, featuring role-based dashboards for **Store Administrators** and **Cashiers**, high-speed **Point-of-Sale (POS)** checkout, automated customer receipt generation, comprehensive inventory tracking, and visual sales analytics.

---

## 📌 Table of Contents
- [Key Features](#key-features)
- [Technologies Used](#technologies-used)
- [Demo Credentials](#default-demo-credentials)
- [Installation & Setup](#installation-setup)
- [Database Configuration](#database-configuration)
- [Running the Application](#running-the-application)
- [Project Directory Layout](#project-directory-layout)
- [Author & Acknowledgments](#author-acknowledgments)

---

<a id="key-features"></a>
## 🚀 Key Features

### 👑 Admin Management Dashboard
- **Store Analytics & KPIs:** Live revenue stats, total orders, top-selling categories, and customer metrics.
- **Inventory & Catalog Control:** Add, update, categorized browsing, stock adjustment, and low-inventory threshold alerts.
- **User & Staff Management:** Create and manage Cashier accounts, role assignments, and status toggles.
- **Sales & Revenue Reports:** Date-range filtering, transaction history breakdowns, and exportable financial summaries.
- **Store Settings:** Customize store branding, contact info, tax/GST rates, invoice prefixes, and currency formatting.

### 💳 Cashier & POS Terminal
- **Rapid Point-of-Sale (POS):** Fast item lookup by name, category, or barcode with real-time price and subtotal calculations.
- **Cart & Order Processing:** Add/remove items, adjust quantities, calculate discounts, GST/tax, and change return amounts.
- **Automated Billing & Invoices:** Generates customer receipts and invoices on checkout, saved directly to the billing directory.
- **Customer Directory:** Register new customers, update profiles, and link order history to customer records.

### 🔐 Security & Reliability
- **Password Hashing:** Industry-standard **Bcrypt** cryptographic password hashing with SHA-256 fallback support.
- **Session Management:** Secure cookie-based authentication with role verification for protected routes.
- **Configurable Environment:** Database configuration easily managed via environment variables or local development defaults.

---

<a id="technologies-used"></a>
## 🛠️ Technologies Used

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Backend** | Python 3.8+ | Native `http.server` with multithreaded request handling and custom REST endpoints |
| **Database** | MySQL / MariaDB | Relational database schema with normalized tables, foreign keys, and indexes |
| **Database Driver** | `mysql-connector-python` | Python MySQL driver supporting connection pooling |
| **Security** | `bcrypt` | Blowfish cipher implementation for cryptographic password hashing |
| **Frontend** | HTML5, CSS3, Vanilla JS | Clean, responsive UI with no heavy frontend build steps required |
| **Styling & Icons**| Bootstrap 5 & FontAwesome | Responsive grid, modern card design, modal dialogues, and icon sets |

---

<a id="default-demo-credentials"></a>
## 🔑 Demo Credentials

The pre-populated database includes demo accounts for testing all modules:

| Role | Username | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin** | `durga_parmar123` | `Durga@123` | Full Access: Dashboard, Inventory, Users, Settings, Reports |
| **Cashier** | `shivam_216` | `Shivam@123` | POS Terminal, Order Processing, Customer Directory, Billing |
| **Cashier** | `mahek_123` | `Mahek@123` | POS Terminal, Order Processing, Customer Directory, Billing |

---

<a id="installation-setup"></a>
## ⚙️ Installation & Setup

### Prerequisites
1. **Python 3.8 or higher** installed ([Download Python](https://www.python.org/downloads/))
2. **MySQL Server** (via [XAMPP](https://www.apachefriends.org/), [WAMP](https://www.wampserver.com/), or standalone MySQL)
3. **Git** installed on your system ([Download Git](https://git-scm.com/))

### 1. Clone the Repository
```bash
git clone https://github.com/durga-parmar/grocery-store-management-system.git
cd grocery-store-management-system
```

### 2. Set Up a Virtual Environment (Recommended)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Required Dependencies
```bash
pip install -r requirements.txt
```

---

<a id="database-configuration"></a>
## 🗄️ Database Configuration

### 1. Start MySQL Service
Ensure your local MySQL service is running (e.g., start MySQL in your XAMPP or WAMP Control Panel).

### 2. Import Database Schema
Import the pre-configured database schema and sample catalog using either method:

#### Option A: Using phpMyAdmin (Web UI)
1. Open [http://localhost/phpmyadmin](http://localhost/phpmyadmin) in your web browser.
2. Click **New** and create a database named `project`.
3. Select the `project` database and click the **Import** tab.
4. Choose the file `Database/project.sql` from this repository and click **Go**.

#### Option B: Using MySQL Command Line
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS project;"
mysql -u root -p project < Database/project.sql
```

### 3. Configure Database Connection (Optional)
By default, the application connects to MySQL on `localhost` with user `root` and an empty password (standard for local XAMPP/WAMP setups).

If your MySQL setup uses a custom password or port, copy `.env.example` to `.env` or set environment variables:
```bash
# Windows PowerShell
$env:DB_HOST="localhost"
$env:DB_USER="root"
$env:DB_PASSWORD="your_mysql_password"
$env:DB_NAME="project"
```

---

<a id="running-the-application"></a>
## ▶️ Running the Application

Start the application server with a single command:
```bash
python server.py
```

Once started:
- The server initializes database connections and automatically launches your default web browser.
- Navigate to **`http://localhost:8000/home.html`** to browse the store portal.
- Log in using the credentials listed in the [Demo Credentials](#default-demo-credentials) table above.

---

<a id="project-directory-layout"></a>
## 📂 Project Directory Layout

```text
grocery-store-management-system/
├── Database/
│   └── project.sql               # Complete MySQL schema & sample catalog data
├── css/                          # CSS stylesheets (admin, cashier, POS, reports, home)
├── html/                         # HTML templates (admin_dash, pos, order, customer, etc.)
├── js/                           # Frontend JavaScript logic & asynchronous API calls
├── images/                       # UI design assets and product catalog pictures
├── uploads/                      # Uploaded product images (fruits, vegetables, dairy, etc.)
├── python/                       # Modular Python controller scripts
├── save_billing/                 # Storage directory for runtime generated invoice receipts
│   └── .gitkeep
├── server.py                     # Unified multithreaded backend server & API routing
├── requirements.txt              # Minimal project dependencies (mysql-connector-python, bcrypt)
├── .env.example                  # Environment configuration template
├── .gitignore                    # Git rules excluding caches, local env, and runtime files
└── README.md                     # Comprehensive project documentation
```

---

<a id="author-acknowledgments"></a>
## 👤 Author & Acknowledgments

* **Developer:** [Durga Parmar](https://github.com/durga-parmar)
* **GitHub Repository:** [grocery-store-management-system](https://github.com/durga-parmar/grocery-store-management-system)
