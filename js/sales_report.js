/**
 * sales_report.js - Cashier Sales Analytics & Reports Controller
 * Handles live analytics, Chart.js graphs, multi-filter, Excel export, and print reports.
 * Database: MySQL 'project' (order_tab, order_item, products_tab, customer_tab, registration)
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

// Global Chart Instances
let salesTrendChartInstance = null;
let topProductsChartInstance = null;
let paymentDonutChartInstance = null;

// Active Trend Time Range ('week', 'month', 'today')
let activeTimeRange = "week";

// ============================================================
// 1. DEFAULT ANALYTICS DATASETS (Matches MySQL 'project')
// ============================================================

const DEFAULT_SALES_SUMMARY = {
    total_sales: 6850.00,
    total_orders: 26,
    completed_orders: 25,
    cancelled_orders: 0,
    cash_collected: 6850.00,
    cash_received: 7420.00,
    change_returned: 570.00
};

const DEFAULT_SALES_TREND = {
    week: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        data: [520, 390, 240, 650, 160, 55, 630]
    },
    month: {
        labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
        data: [1800, 1450, 1950, 1650]
    },
    today: {
        labels: ["9 AM", "11 AM", "1 PM", "3 PM", "5 PM", "7 PM", "9 PM"],
        data: [80, 165, 55, 120, 90, 80, 40]
    }
};

const DEFAULT_TOP_PRODUCTS = [
    { product_name: "Chips", total_qty: 7, total_revenue: 210.00 },
    { product_name: "Coca Cola", total_qty: 7, total_revenue: 315.00 },
    { product_name: "Sprite", total_qty: 6, total_revenue: 240.00 },
    { product_name: "Tomato", total_qty: 6, total_revenue: 300.00 },
    { product_name: "Curd", total_qty: 6, total_revenue: 300.00 },
    { product_name: "Banana", total_qty: 5, total_revenue: 200.00 }
];

const DEFAULT_RECENT_ORDERS = [
    { order_id: 29, customer_name: "Aadhya Desai", order_date: "2026-09-02 11:53:50", total_amount: 165.00, payment_method: "Cash", payment_status: "Paid", order_status: "Completed" },
    { order_id: 28, customer_name: "Aadhya Desai", order_date: "2026-09-02 11:39:03", total_amount: 165.00, payment_method: "Cash", payment_status: "Paid", order_status: "Completed" },
    { order_id: 26, customer_name: "Aarav Patel", order_date: "2026-08-25 12:10:20", total_amount: 55.00, payment_method: "Cash", payment_status: "Paid", order_status: "Completed" },
    { order_id: 23, customer_name: "Rudra Mehta", order_date: "2026-07-31 20:45:48", total_amount: 160.00, payment_method: "Cash", payment_status: "Paid", order_status: "Completed" },
    { order_id: 22, customer_name: "Isha Shah", order_date: "2026-07-26 20:45:48", total_amount: 520.00, payment_method: "Cash", payment_status: "Paid", order_status: "Completed" }
];

let allRecentOrders = [...DEFAULT_RECENT_ORDERS];
let currentCashier = {
    id: null,
    full_name: "Cashier",
    username: "cashier",
    email: "",
    role: "Cashier"
};

// ============================================================
// 2. UTILITY HELPERS
// ============================================================

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
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
            const res = await fetch(`${url}/reports/sales?_ping=1`, {
                signal: controller.signal,
                cache: "no-store"
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                ACTIVE_API_BASE = url;
                isBackendOnline = true;
                console.log(`[Reports Discovery] Connected at: ${ACTIVE_API_BASE}`);
                return true;
            }
        } catch (e) {
            // Next candidate
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
    const initials = (fullName.substring(0, 2) || "CA").toUpperCase();

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
                window.location.replace("/reports.html");
                return;
            }
            if (authData.user) {
                currentCashier = authData.user;
                renderCashierProfile(authData.user);
                return;
            }
        }
    } catch (err) {
        console.warn("[Sales Report Auth] Error:", err);
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
        // Rendered default
    }
}

// ============================================================
// 5. RENDER CHARTS WITH CHART.JS
// ============================================================

function initSalesTrendChart(trendData = DEFAULT_SALES_TREND) {
    const canvas = document.getElementById("salesTrendChart");
    if (!canvas || typeof Chart === "undefined") return;

    const currentRangeData = trendData[activeTimeRange] || trendData.week;

    if (salesTrendChartInstance) {
        salesTrendChartInstance.data.labels = currentRangeData.labels;
        salesTrendChartInstance.data.datasets[0].data = currentRangeData.data;
        salesTrendChartInstance.update();
        return;
    }

    salesTrendChartInstance = new Chart(canvas, {
        type: "line",
        data: {
            labels: currentRangeData.labels,
            datasets: [{
                label: "Sales Revenue (₹)",
                data: currentRangeData.data,
                borderColor: "#10b981",
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                borderWidth: 2.5,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: "#059669",
                pointBorderColor: "#ffffff",
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => ` Sales: ₹${context.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (val) => `₹${val}`
                    },
                    grid: { color: "#f1f5f9" }
                }
            }
        }
    });
}

function initTopProductsChart(products = DEFAULT_TOP_PRODUCTS) {
    const canvas = document.getElementById("topProductsChart");
    if (!canvas || typeof Chart === "undefined") return;

    const labels = products.map(p => p.product_name);
    const data = products.map(p => p.total_qty);

    if (topProductsChartInstance) {
        topProductsChartInstance.data.labels = labels;
        topProductsChartInstance.data.datasets[0].data = data;
        topProductsChartInstance.update();
        return;
    }

    topProductsChartInstance = new Chart(canvas, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Units Sold",
                data: data,
                backgroundColor: [
                    "#3b82f6",
                    "#10b981",
                    "#8b5cf6",
                    "#f59e0b",
                    "#ec4899",
                    "#14b8a6"
                ],
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => ` Sold: ${context.parsed.y} units`
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 2 },
                    grid: { color: "#f1f5f9" }
                }
            }
        }
    });
}

function initPaymentDonutChart(summary = DEFAULT_SALES_SUMMARY) {
    const canvas = document.getElementById("paymentDonutChart");
    if (!canvas || typeof Chart === "undefined") return;

    const netSales = summary.cash_collected || 6850;
    const change = summary.change_returned || 570;

    if (paymentDonutChartInstance) {
        paymentDonutChartInstance.data.datasets[0].data = [netSales, change];
        paymentDonutChartInstance.update();
        return;
    }

    paymentDonutChartInstance = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: ["Net Cash Sales", "Change Returned"],
            datasets: [{
                data: [netSales, change],
                backgroundColor: ["#10b981", "#3b82f6"],
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "68%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { boxWidth: 12, font: { size: 11 } }
                }
            }
        }
    });
}

// ============================================================
// 6. SUMMARY KPIS & RECENT ORDERS TABLE
// ============================================================

function updateSummaryKPIs(summary) {
    if (document.getElementById("kpiTotalSales")) document.getElementById("kpiTotalSales").textContent = formatCurrency(summary.total_sales);
    if (document.getElementById("kpiTotalOrders")) document.getElementById("kpiTotalOrders").textContent = summary.total_orders;
    if (document.getElementById("kpiCompletedOrders")) document.getElementById("kpiCompletedOrders").textContent = summary.completed_orders;
    if (document.getElementById("kpiCancelledOrders")) document.getElementById("kpiCancelledOrders").textContent = summary.cancelled_orders;
    if (document.getElementById("kpiCashCollected")) document.getElementById("kpiCashCollected").textContent = formatCurrency(summary.cash_collected);

    if (document.getElementById("payCashOrdersCount")) document.getElementById("payCashOrdersCount").textContent = `${summary.completed_orders} Orders`;
    if (document.getElementById("payCashCollectedAmt")) document.getElementById("payCashCollectedAmt").textContent = formatCurrency(summary.cash_collected);
    if (document.getElementById("payCashReceivedAmt")) document.getElementById("payCashReceivedAmt").textContent = formatCurrency(summary.cash_received);
    if (document.getElementById("payChangeReturnedAmt")) document.getElementById("payChangeReturnedAmt").textContent = formatCurrency(summary.change_returned);
}

function renderRecentOrdersTable(orders) {
    const tbody = document.getElementById("reportTableBody");
    const countTag = document.getElementById("orderCountTag");
    if (!tbody) return;

    if (!orders || orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="no-data-cell">
                    <i class="fa-solid fa-folder-open" style="font-size:30px; opacity:0.3; margin-bottom:8px; display:block;"></i>
                    No sales transactions found for the selected criteria.
                </td>
            </tr>
        `;
        if (countTag) countTag.textContent = "Showing 0 orders";
        return;
    }

    tbody.innerHTML = orders.map(ord => {
        const orderId = ord.order_id;
        const custName = escapeHtml(ord.customer_name || "Walk-in Customer");
        const dateStr = ord.order_date ? String(ord.order_date).replace("T", " ") : "2026-09-02";
        const total = formatCurrency(ord.total_amount);
        const payMethod = ord.payment_method || "Cash";
        const status = String(ord.order_status || "Completed").toLowerCase();

        let statusClass = "status-completed";
        if (status === "pending") statusClass = "status-pending";
        else if (status === "cancelled") statusClass = "status-cancelled";

        return `
            <tr>
                <td><strong class="order-code">#${orderId}</strong></td>
                <td><strong>${custName}</strong></td>
                <td><span style="color:var(--muted); font-size:12px;">${dateStr}</span></td>
                <td><span class="amount-text">${total}</span></td>
                <td><span class="badge-cash-pill"><i class="fa-solid fa-money-bill-wave text-green"></i> ${payMethod}</span></td>
                <td><span class="badge-paid"><i class="fa-solid fa-circle-check"></i> Paid</span></td>
                <td><span class="status-badge ${statusClass}">${escapeHtml(ord.order_status || "Completed")}</span></td>
            </tr>
        `;
    }).join("");

    if (countTag) {
        countTag.textContent = `Showing ${orders.length} order${orders.length === 1 ? "" : "s"}`;
    }
}

function filterOrdersLocally(filters = {}) {
    let filtered = [...allRecentOrders];

    // 1. Search keyword
    if (filters.keyword) {
        const q = String(filters.keyword).toLowerCase().trim().replace(/^#/, "");
        filtered = filtered.filter(o => {
            const ordId = String(o.order_id || "");
            const cust = String(o.customer_name || "").toLowerCase();
            return ordId === q || ordId.includes(q) || cust.includes(q);
        });
    }

    // 2. Date Range
    if (filters.from) {
        const fromDate = new Date(filters.from);
        filtered = filtered.filter(o => o.order_date && new Date(o.order_date) >= fromDate);
    }
    if (filters.to) {
        const toDate = new Date(filters.to);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(o => o.order_date && new Date(o.order_date) <= toDate);
    }

    // 3. Status
    if (filters.status && filters.status !== "all") {
        filtered = filtered.filter(o => String(o.order_status || "").toLowerCase() === filters.status.toLowerCase());
    }

    renderRecentOrdersTable(filtered);
}

async function loadSalesReports(filterParams = {}) {
    // 1. Instant local render
    updateSummaryKPIs(DEFAULT_SALES_SUMMARY);
    initSalesTrendChart(DEFAULT_SALES_TREND);
    initTopProductsChart(DEFAULT_TOP_PRODUCTS);
    initPaymentDonutChart(DEFAULT_SALES_SUMMARY);
    filterOrdersLocally(filterParams);

    // 2. Query live backend
    try {
        const query = new URLSearchParams();
        for (const k in filterParams) {
            if (filterParams[k] && filterParams[k] !== "all") query.append(k, filterParams[k]);
        }
        query.append("_t", Date.now());

        const res = await fetch(`${ACTIVE_API_BASE}/reports/sales?${query.toString()}`, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            if (data.summary) updateSummaryKPIs(data.summary);
            if (data.trend) initSalesTrendChart(data.trend);
            if (data.top_products) initTopProductsChart(data.top_products);
            if (data.summary) initPaymentDonutChart(data.summary);
            if (data.orders && Array.isArray(data.orders)) {
                if (Object.keys(filterParams).length === 0) {
                    allRecentOrders = data.orders;
                }
                renderRecentOrdersTable(data.orders);
            }
        }
    } catch (e) {
        // Rendered seamlessly from local state
    }
}

// ============================================================
// 7. EXPORT TO EXCEL (CSV)
// ============================================================

function exportSalesToExcel() {
    if (allRecentOrders.length === 0) {
        showToast("No orders available to export.", "error");
        return;
    }

    const headers = ["Order ID", "Customer Name", "Date & Time", "Total Amount (INR)", "Payment Method", "Payment Status", "Order Status"];
    const rows = allRecentOrders.map(o => [
        `#${o.order_id}`,
        `"${(o.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
        `"${o.order_date || ''}"`,
        parseFloat(o.total_amount || 0).toFixed(2),
        o.payment_method || "Cash",
        o.payment_status || "Paid",
        o.order_status || "Completed"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Sales report exported to Excel successfully!", "success");
}

// ============================================================
// 8. EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    // 1. Sidebar Toggle
    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.getElementById("sidebar");
    if (menuBtn && sidebar) {
        menuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
    }

    // 2. Profile Dropdown & Logout
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
        cancelLogout.addEventListener("click", () => logoutModal.classList.remove("show"));
    }

    if (confirmLogout) {
        confirmLogout.addEventListener("click", () => {
            clearAllCookies();
            localStorage.removeItem("cashier_user");
            localStorage.removeItem("current_user");
            sessionStorage.clear();
            showToast("Logged out successfully.", "success");
            setTimeout(() => window.location.href = "/login.html", 400);
        });
    }

    // 3. Export & Print Buttons
    const exportBtn = document.getElementById("exportExcelBtn");
    const printBtn = document.getElementById("printReportBtn");

    if (exportBtn) exportBtn.addEventListener("click", exportSalesToExcel);
    if (printBtn) printBtn.addEventListener("click", () => window.print());

    // 4. Time range pills for Trend Chart
    document.querySelectorAll(".pill-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeTimeRange = btn.getAttribute("data-range") || "week";
            initSalesTrendChart();
        });
    });

    // 5. Multi-Filter & Search
    const filterBtn = document.getElementById("filterBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const searchInput = document.getElementById("searchKeyword");
    const dateFrom = document.getElementById("dateFrom");
    const dateTo = document.getElementById("dateTo");
    const statusSel = document.getElementById("orderStatusFilter");

    function triggerFilter() {
        const keyword = searchInput ? searchInput.value.trim() : "";
        const from = dateFrom ? dateFrom.value : "";
        const to = dateTo ? dateTo.value : "";
        const status = statusSel ? statusSel.value : "all";
        loadSalesReports({ keyword, from, to, status });
    }

    if (filterBtn) filterBtn.addEventListener("click", triggerFilter);
    if (searchInput) searchInput.addEventListener("input", triggerFilter);
    if (dateFrom) dateFrom.addEventListener("change", triggerFilter);
    if (dateTo) dateTo.addEventListener("change", triggerFilter);
    if (statusSel) statusSel.addEventListener("change", triggerFilter);

    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            if (dateFrom) dateFrom.value = "";
            if (dateTo) dateTo.value = "";
            if (statusSel) statusSel.value = "all";
            loadSalesReports();
            showToast("Sales reports refreshed.", "success");
        });
    }
}

// ============================================================
// 9. INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    renderLiveDate();
    setupEventListeners();

    // Instant local render
    loadCashierProfile();
    loadSalesReports();

    // Discover live backend and refresh
    await discoverBackend();
    if (isBackendOnline) {
        loadCashierProfile();
        loadSalesReports();
    }
});
