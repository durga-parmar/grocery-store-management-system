/**
 * cashierdash.js - Dynamic JavaScript Controller for Cashier Dashboard
 * Connects to Python Backend (MySQL 'project' database) with instant fallback state
 */

// Global API Candidate list
const API_CANDIDATES = [
    window.location.origin && window.location.origin.startsWith("http") ? `${window.location.origin}/api` : "",
    window.location.origin && window.location.origin.startsWith("http") ? `${window.location.origin}/project/api` : "",
    "http://localhost:9007/api",
    "http://localhost:9010/api",
    "http://localhost:9008/api",
    "http://localhost:9009/api",
    "http://localhost:9013/api",
    "http://localhost:9000/api",
    "http://localhost:8000/api",
    "http://localhost:90/api",
    "http://localhost/api"
].filter(Boolean);

let ACTIVE_API_BASE = "http://localhost:9007/api";
let isBackendOnline = false;

// ============================================================
// 1. DEFAULT DATASET (Matches MySQL 'project' schema)
// ============================================================

const DEFAULT_METRICS = {
    todaySales: 55.00,
    todayOrders: 1,
    totalCustomers: 51,
    productsAvailable: 21,
    lowStockProducts: 4,
    completedOrders: 23,
    activity: {
        total: 1,
        completed: 0,
        pending: 1,
        cancelled: 0
    }
};

const DEFAULT_LOW_STOCK_ITEMS = [
    { product_id: 9, product_name: "Salted Butter (500g)", cat_name: "Dairy", stock: 8, status: "low stock" },
    { product_id: 14, product_name: "Green Cabbage", cat_name: "Vegetables", stock: 5, status: "low stock" },
    { product_id: 19, product_name: "Pepsi Black (750ml)", cat_name: "Cold Drinks", stock: 6, status: "low stock" },
    { product_id: 24, product_name: "Salted Pistachios", cat_name: "Dry Fruits", stock: 7, status: "low stock" },
    { product_id: 25, product_name: "Golden Raisins (250g)", cat_name: "Dry Fruits", stock: 0, status: "out of stock" }
];

let currentCashier = {
    id: null,
    full_name: "Cashier",
    username: "cashier",
    email: "",
    role: "Cashier",
    profile_picture: ""
};

// ============================================================
// 2. COOKIE HELPERS & UTILITIES
// ============================================================

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length));
        }
    }
    return null;
}

function clearAllCookies() {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`;
    }
}

function getInitials(name) {
    if (!name || typeof name !== "string") return "CA";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].substring(0, 2).toUpperCase();
    return "CA";
}

function formatCurrency(amount) {
    const num = parseFloat(amount || 0);
    return `₹${num.toFixed(2)}`;
}

function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type === "error" ? "error" : "success"}`;
    const iconClass = type === "error" ? "fa-circle-xmark" : "fa-circle-check";
    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(50px)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Format live date
function renderLiveDate() {
    const el = document.getElementById("liveCurrentDate");
    if (!el) return;
    const now = new Date();
    const options = { weekday: "short", day: "numeric", month: "short", year: "numeric" };
    el.textContent = now.toLocaleDateString("en-US", options);
}

// ============================================================
// 3. API DISCOVERY
// ============================================================

async function discoverBackend() {
    for (const url of API_CANDIDATES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 800);
            const res = await fetch(`${url}/cashier/dashboard?_ping=1`, {
                signal: controller.signal,
                cache: "no-store"
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                ACTIVE_API_BASE = url;
                isBackendOnline = true;
                console.log(`[Dashboard Discovery] Live backend at: ${ACTIVE_API_BASE}`);
                return true;
            }
        } catch (e) {
            // Next
        }
    }
    return false;
}

// ============================================================
// 4. CASHIER PROFILE
// ============================================================

function renderCashierProfile(user) {
    if (!user) return;
    const fullName = user.full_name || user.username || "Cashier User";
    const email = user.email || "";
    const role = user.role || "Cashier";
    const initials = getInitials(fullName);

    if (document.getElementById("welcomeUserName")) document.getElementById("welcomeUserName").textContent = fullName.split(" ")[0];
    if (document.getElementById("headerUserName")) document.getElementById("headerUserName").textContent = fullName;
    if (document.getElementById("headerUserRole")) document.getElementById("headerUserRole").textContent = role;

    const headerAvatar = document.getElementById("headerAvatar");
    if (headerAvatar) {
        if (user.profile_picture && String(user.profile_picture).trim()) {
            headerAvatar.innerHTML = `<img src="${user.profile_picture}" alt="${escapeHtml(fullName)}" onerror="this.parentElement.textContent='${initials}'">`;
        } else {
            headerAvatar.textContent = initials;
        }
    }

    if (document.getElementById("dropdownFullName")) document.getElementById("dropdownFullName").textContent = fullName;
    if (document.getElementById("dropdownEmail")) document.getElementById("dropdownEmail").textContent = email;
    if (document.getElementById("dropdownRole")) document.getElementById("dropdownRole").textContent = role;

    const dropdownAvatar = document.getElementById("dropdownAvatar");
    if (dropdownAvatar) {
        if (user.profile_picture && String(user.profile_picture).trim()) {
            dropdownAvatar.innerHTML = `<img src="${user.profile_picture}" alt="${escapeHtml(fullName)}" onerror="this.parentElement.textContent='${initials}'">`;
        } else {
            dropdownAvatar.textContent = initials;
        }
    }

    const profileLink = document.getElementById("profileLink");
    if (profileLink) {
        profileLink.href = user.id ? `setting.html?id=${user.id}` : `setting.html`;
    }
}

async function loadCashierProfile() {
    try {
        const authRes = await fetch(`/api/auth/verify?_t=${Date.now()}`, { cache: "no-store" });
        if (authRes.ok) {
            const authData = await authRes.json();
            if (authData.role && authData.role.toLowerCase() === 'admin') {
                // Prevent Admin from staying on Cashier dashboard
                window.location.replace("/admin_dash.html");
                return;
            }
            if (authData.user) {
                currentCashier = authData.user;
                renderCashierProfile(authData.user);
                return;
            }
        }
    } catch (err) {
        console.warn("[Auth Verify] Error:", err);
    }

    const queryParams = new URLSearchParams(window.location.search);
    const userId = queryParams.get("user_id") || queryParams.get("id") || getCookie("cashier_id") || getCookie("user_id");
    const username = queryParams.get("username") || getCookie("cashier_username") || getCookie("username");
    const cookieFullName = getCookie("cashier_fullname") || getCookie("admin_fullname");
    const cookieEmail = getCookie("cashier_email") || getCookie("admin_email");

    if (userId) currentCashier.id = parseInt(userId, 10);
    if (username) currentCashier.username = username;
    if (cookieFullName) currentCashier.full_name = cookieFullName;
    if (cookieEmail) currentCashier.email = cookieEmail;

    renderCashierProfile(currentCashier);

    try {
        let fetchUrl = `${ACTIVE_API_BASE}/user/profile?_t=${Date.now()}`;
        if (userId) fetchUrl += `&id=${encodeURIComponent(userId)}`;
        else if (username) fetchUrl += `&username=${encodeURIComponent(username)}`;

        const res = await fetch(fetchUrl, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            const user = data.user || data.profile;
            if (user) {
                currentCashier = user;
                renderCashierProfile(user);
            }
        }
    } catch (e) {
        // Rendered from initial state
    }
}

// ============================================================
// 5. DASHBOARD CARDS & SECTIONS RENDERING
// ============================================================

function renderDashboardMetrics(metrics) {
    if (!metrics) return;

    if (document.getElementById("statTodaySales")) {
        document.getElementById("statTodaySales").textContent = formatCurrency(metrics.todaySales);
    }
    if (document.getElementById("statTodayOrders")) {
        document.getElementById("statTodayOrders").textContent = metrics.todayOrders || 0;
    }
    if (document.getElementById("statTotalCustomers")) {
        document.getElementById("statTotalCustomers").textContent = metrics.totalCustomers || 0;
    }
    if (document.getElementById("statProductsAvailable")) {
        document.getElementById("statProductsAvailable").textContent = metrics.productsAvailable || 0;
    }
    if (document.getElementById("statLowStockProducts")) {
        document.getElementById("statLowStockProducts").textContent = metrics.lowStockProducts || 0;
    }
    if (document.getElementById("statCompletedOrders")) {
        document.getElementById("statCompletedOrders").textContent = metrics.completedOrders || 0;
    }

    // Today's Activity Breakdown
    if (metrics.activity) {
        if (document.getElementById("actTotalOrders")) document.getElementById("actTotalOrders").textContent = metrics.activity.total || 0;
        if (document.getElementById("actCompletedOrders")) document.getElementById("actCompletedOrders").textContent = metrics.activity.completed || 0;
        if (document.getElementById("actPendingOrders")) document.getElementById("actPendingOrders").textContent = metrics.activity.pending || 0;
        if (document.getElementById("actCancelledOrders")) document.getElementById("actCancelledOrders").textContent = metrics.activity.cancelled || 0;
    }
}

function renderLowStockTable(items) {
    const tbody = document.getElementById("lowStockTableBody");
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="loading-cell" style="color:var(--green-dark);">
                    <i class="fa-solid fa-circle-check"></i> All products have sufficient inventory stock!
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = items.slice(0, 10).map(item => {
        const name = escapeHtml(item.product_name);
        const stock = parseInt(item.stock || 0, 10);
        const isOut = stock <= 0 || String(item.status).toLowerCase() === "out of stock";
        const badgeClass = isOut ? "badge-out" : "badge-low";
        const badgeText = isOut ? "Out of Stock" : "Low Stock";

        return `
            <tr>
                <td><strong>${name}</strong></td>
                <td><span style="font-weight:600;">${stock} units</span></td>
                <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
            </tr>
        `;
    }).join("");
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return "Just now";
    try {
        const d = new Date(String(dateStr).replace(/-/g, "/"));
        const now = new Date();
        const diffMs = now - d;
        if (isNaN(diffMs) || diffMs < 0) return "Just now";
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return "Just now";
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
        const diffDays = Math.floor(diffHr / 24);
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } catch (e) {
        return "Recent";
    }
}

function renderRecentActivity(orders) {
    const list = document.getElementById("recentActivityList");
    if (!list) return;

    if (!orders || orders.length === 0) {
        list.innerHTML = `
            <div style="padding: 24px; text-align: center; color: var(--muted); font-size: 13px;">
                <i class="fa-solid fa-clock-rotate-left" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                No recent activity recorded yet.
            </div>
        `;
        return;
    }

    const icons = [
        { cls: "blue", icon: "fa-cart-plus" },
        { cls: "green", icon: "fa-file-invoice-dollar" },
        { cls: "purple", icon: "fa-receipt" },
        { cls: "blue", icon: "fa-cash-register" },
        { cls: "green", icon: "fa-circle-check" },
        { cls: "purple", icon: "fa-bag-shopping" }
    ];

    list.innerHTML = orders.slice(0, 6).map((ord, idx) => {
        const oid = ord.order_id;
        const cust = escapeHtml(ord.customer_name || "Walk-in Customer");
        const amt = parseFloat(ord.total_amount || 0).toFixed(2);
        const method = escapeHtml(ord.payment_method || "Cash");
        const timeAgo = formatTimeAgo(ord.order_date);
        const iconInfo = icons[idx % icons.length];

        return `
            <div class="timeline-item">
                <div class="timeline-icon ${iconInfo.cls}"><i class="fa-solid ${iconInfo.icon}"></i></div>
                <div class="timeline-content">
                    <strong>New Order #${oid} Placed</strong>
                    <p>Amount: ₹${amt} via ${method} • ${cust}</p>
                    <small>${timeAgo}</small>
                </div>
            </div>
        `;
    }).join("");
}

async function loadDashboardData() {
    // 1. Instant render from local defaults
    renderDashboardMetrics(DEFAULT_METRICS);
    renderLowStockTable(DEFAULT_LOW_STOCK_ITEMS);

    // 2. Query live backend
    try {
        const res = await fetch(`${ACTIVE_API_BASE}/cashier/dashboard?_t=${Date.now()}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
        });

        if (res.ok) {
            const data = await res.json();
            if (data.metrics) {
                renderDashboardMetrics(data.metrics);
            }
            if (data.low_stock_items && Array.isArray(data.low_stock_items)) {
                renderLowStockTable(data.low_stock_items);
            }
            if (data.recent_orders && Array.isArray(data.recent_orders)) {
                renderRecentActivity(data.recent_orders);
            }
        }
    } catch (e) {
        // Rendered from initial state
    }
}

// Expose globally for real-time live reload on new orders
window.loadDashboardData = loadDashboardData;

// ============================================================
// 6. EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    // Sidebar toggle for mobile
    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.getElementById("sidebar");
    if (menuBtn && sidebar) {
        menuBtn.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });
    }

    // Profile Dropdown
    const profileTrigger = document.getElementById("profileTrigger");
    const profileMenu = document.getElementById("profileMenu");
    if (profileTrigger && profileMenu) {
        profileTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle("show");
        });

        document.addEventListener("click", (e) => {
            if (!profileMenu.contains(e.target) && !profileTrigger.contains(e.target)) {
                profileMenu.classList.remove("show");
            }
        });
    }

    // Logout Modal
    const logoutBtn = document.getElementById("logoutBtn");
    const logoutModal = document.getElementById("logoutModal");
    const cancelLogout = document.getElementById("cancelLogout");
    const confirmLogout = document.getElementById("confirmLogout");

    if (logoutBtn && logoutModal) {
        logoutBtn.addEventListener("click", () => {
            if (profileMenu) profileMenu.classList.remove("show");
            logoutModal.classList.add("show");
        });
    }

    if (cancelLogout && logoutModal) {
        cancelLogout.addEventListener("click", () => {
            logoutModal.classList.remove("show");
        });
    }

    if (confirmLogout) {
        confirmLogout.addEventListener("click", () => {
            clearAllCookies();
            localStorage.removeItem("cashier_user");
            localStorage.removeItem("current_user");
            sessionStorage.clear();
            showToast("Logged out successfully. Redirecting...", "success");
            setTimeout(() => {
                window.location.href = "/login.html";
            }, 500);
        });
    }
}

// ============================================================
// 7. INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    renderLiveDate();
    setupEventListeners();

    // Instant local rendering
    loadCashierProfile();
    loadDashboardData();

    // Live backend discovery & refresh
    await discoverBackend();
    if (isBackendOnline) {
        loadCashierProfile();
        loadDashboardData();
    }
});
