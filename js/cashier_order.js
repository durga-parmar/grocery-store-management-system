/**
 * cashier_order.js - Cashier Orders Management Controller
 * Handles Orders listing, multi-filter, search, read-only View Modal, and KPI metrics.
 * Database: MySQL 'project' (order_tab, order_item, customer_tab, registration)
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
// 1. DEFAULT DATASETS (Matches MySQL 'project' Database)
// ============================================================

const DEFAULT_ORDERS = [
    {
        order_id: 29,
        customer_id: 24,
        customer_name: "Aadhya Desai",
        phone: "9654012348",
        email: "aadhya.desai@example.com",
        city: "Jamnagar",
        address: "Jamnagar",
        total_amount: 165.00,
        cash_received: 200.00,
        change_returned: 35.00,
        payment_method: "Cash",
        payment_status: "Paid",
        order_status: "Completed",
        order_date: "2026-09-02 11:53:50",
        cashier_name: "shivam parmar",
        items: [
            { item_id: 34, product_name: "Popcorn", quntity: 1, price: 50.00, subtotal: 50.00 },
            { item_id: 35, product_name: "Pepsi Black", quntity: 1, price: 45.00, subtotal: 45.00 },
            { item_id: 36, product_name: "Sprite (750ml)", quntity: 1, price: 40.00, subtotal: 40.00 },
            { item_id: 37, product_name: "Potato Chips", quntity: 1, price: 30.00, subtotal: 30.00 }
        ]
    },
    {
        order_id: 28,
        customer_id: 24,
        customer_name: "Aadhya Desai",
        phone: "9654012348",
        email: "aadhya.desai@example.com",
        city: "Jamnagar",
        address: "Jamnagar",
        total_amount: 165.00,
        cash_received: 200.00,
        change_returned: 35.00,
        payment_method: "Cash",
        payment_status: "Paid",
        order_status: "Completed",
        order_date: "2026-09-02 11:39:03",
        cashier_name: "shivam parmar",
        items: [
            { item_id: 31, product_name: "Potato Chips", quntity: 1, price: 30.00, subtotal: 30.00 },
            { item_id: 32, product_name: "Coca Cola (750ml)", quntity: 1, price: 45.00, subtotal: 45.00 },
            { item_id: 33, product_name: "Pineapple", quntity: 1, price: 90.00, subtotal: 90.00 }
        ]
    },
    {
        order_id: 26,
        customer_id: 1,
        customer_name: "Aarav Patel",
        phone: "9876543210",
        email: "aarav.patel@example.com",
        city: "Rajkot",
        address: "Rajkot",
        total_amount: 55.00,
        cash_received: 60.00,
        change_returned: 5.00,
        payment_method: "Cash",
        payment_status: "Paid",
        order_status: "Completed",
        order_date: "2026-08-25 12:10:20",
        cashier_name: "shivam parmar",
        items: [
            { item_id: 27, product_name: "Fresh Milk (1L)", quntity: 1, price: 55.00, subtotal: 55.00 }
        ]
    },
    {
        order_id: 23,
        customer_id: 23,
        customer_name: "Rudra Mehta",
        phone: "7654012347",
        email: "rudra.mehta@example.com",
        city: "Surat",
        address: "Surat",
        total_amount: 160.00,
        cash_received: 200.00,
        change_returned: 40.00,
        payment_method: "Cash",
        payment_status: "Paid",
        order_status: "Completed",
        order_date: "2026-07-31 20:45:48",
        cashier_name: "shivam parmar",
        items: [
            { item_id: 24, product_name: "Apple", quntity: 1, price: 120.00, subtotal: 120.00 },
            { item_id: 25, product_name: "Banana", quntity: 1, price: 40.00, subtotal: 40.00 }
        ]
    },
    {
        order_id: 22,
        customer_id: 22,
        customer_name: "Isha Shah",
        phone: "8765012346",
        email: "isha.shah@example.com",
        city: "Ahmedabad",
        address: "Ahmedabad",
        total_amount: 520.00,
        cash_received: 520.00,
        change_returned: 0.00,
        payment_method: "Cash",
        payment_status: "Paid",
        order_status: "Completed",
        order_date: "2026-07-26 20:45:48",
        cashier_name: "shivam parmar",
        items: [
            { item_id: 21, product_name: "Cashew Nuts (500g)", quntity: 1, price: 420.00, subtotal: 420.00 },
            { item_id: 22, product_name: "Almonds (200g)", quntity: 1, price: 100.00, subtotal: 100.00 }
        ]
    }
];

let allOrders = [...DEFAULT_ORDERS];
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
            const res = await fetch(`${url}/orders?_ping=1`, {
                signal: controller.signal,
                cache: "no-store"
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                ACTIVE_API_BASE = url;
                isBackendOnline = true;
                console.log(`[Orders Discovery] Connected at: ${ACTIVE_API_BASE}`);
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
    const email = user.email || "mayuri@gmail.com";
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
                window.location.replace("/order.html");
                return;
            }
            if (authData.user) {
                currentCashier = authData.user;
                renderCashierProfile(authData.user);
                return;
            }
        }
    } catch (err) {
        console.warn("[Cashier Order Auth] Error:", err);
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
// 5. KPI SUMMARY & ORDERS TABLE
// ============================================================

function updateSummaryKPIs(orders) {
    const totalOrders = orders.length;
    const todayStr = new Date().toISOString().split("T")[0];

    let todayOrdersCount = 0;
    let todaySalesSum = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;

    orders.forEach(ord => {
        const isToday = ord.order_date && String(ord.order_date).startsWith(todayStr);
        if (isToday) {
            todayOrdersCount++;
            todaySalesSum += parseFloat(ord.total_amount || 0);
        }

        const oStatus = String(ord.order_status || "Completed").toLowerCase();
        if (oStatus === "completed") completedCount++;
        else if (oStatus === "pending") pendingCount++;
        else if (oStatus === "cancelled") cancelledCount++;
    });

    if (document.getElementById("kpiTotalOrders")) document.getElementById("kpiTotalOrders").textContent = totalOrders;
    if (document.getElementById("kpiTodayOrders")) document.getElementById("kpiTodayOrders").textContent = todayOrdersCount;
    if (document.getElementById("kpiCompletedOrders")) document.getElementById("kpiCompletedOrders").textContent = completedCount;
    if (document.getElementById("kpiPendingOrders")) document.getElementById("kpiPendingOrders").textContent = pendingCount;
    if (document.getElementById("kpiCancelledOrders")) document.getElementById("kpiCancelledOrders").textContent = cancelledCount;
    if (document.getElementById("kpiTodaySales")) document.getElementById("kpiTodaySales").textContent = formatCurrency(todaySalesSum);
}

function getStatusBadgeHtml(status) {
    const s = String(status || "Completed").toLowerCase();
    if (s === "completed") {
        return `<span class="status-badge status-completed"><i class="fa-solid fa-circle-check"></i> Completed</span>`;
    } else if (s === "pending") {
        return `<span class="status-badge status-pending"><i class="fa-solid fa-clock"></i> Pending</span>`;
    } else {
        return `<span class="status-badge status-cancelled"><i class="fa-solid fa-circle-xmark"></i> Cancelled</span>`;
    }
}

function getPaymentBadgeHtml(status) {
    const s = String(status || "Paid").toLowerCase();
    if (s === "paid") {
        return `<span class="badge-paid"><i class="fa-solid fa-circle-check"></i> Paid</span>`;
    } else if (s === "pending") {
        return `<span class="badge-pending"><i class="fa-solid fa-clock"></i> Pending</span>`;
    } else {
        return `<span class="badge-failed"><i class="fa-solid fa-circle-xmark"></i> Failed</span>`;
    }
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById("ordersTableBody");
    const countTag = document.getElementById("orderCountTag");
    if (!tbody) return;

    if (!orders || orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="no-data-cell">
                    <i class="fa-solid fa-folder-open" style="font-size:32px; opacity:0.3; margin-bottom:8px; display:block;"></i>
                    No orders found matching your criteria.
                </td>
            </tr>
        `;
        if (countTag) countTag.textContent = "Showing 0 orders";
        return;
    }

    tbody.innerHTML = orders.map(ord => {
        const orderId = ord.order_id;
        const custName = escapeHtml(ord.customer_name || "Walk-in Customer");
        const phone = escapeHtml(ord.phone || "N/A");
        const dateStr = ord.order_date ? String(ord.order_date).replace("T", " ") : "2026-09-02";
        const total = formatCurrency(ord.total_amount);
        const payMethod = ord.payment_method || "Cash";
        const payBadge = getPaymentBadgeHtml(ord.payment_status);
        const orderBadge = getStatusBadgeHtml(ord.order_status);
        const cashier = escapeHtml(ord.cashier_name || currentCashier.full_name || "Cashier");

        return `
            <tr>
                <td><strong class="order-code">#${orderId}</strong></td>
                <td><strong>${custName}</strong></td>
                <td><span style="color:var(--muted); font-size:12px;">${phone}</span></td>
                <td><span style="color:var(--muted); font-size:12px;">${dateStr}</span></td>
                <td><span class="amount-text">${total}</span></td>
                <td><span class="badge-cash-pill"><i class="fa-solid fa-money-bill-wave" style="color:var(--green-dark);"></i> ${payMethod}</span></td>
                <td>${payBadge}</td>
                <td>${orderBadge}</td>
                <td><span style="font-weight:600; font-size:12px;">${cashier}</span></td>
                <td style="text-align: center;">
                    <button class="action-btn-view" onclick="openOrderModal(${orderId})" title="View Order Details">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    if (countTag) {
        countTag.textContent = `Showing ${orders.length} order${orders.length === 1 ? "" : "s"}`;
    }
}

function filterOrdersLocally(filters = {}) {
    let filtered = [...allOrders];

    // 1. Search keyword (matches Order ID, Customer Name, Phone, Cashier, Payment Method)
    if (filters.keyword) {
        const rawQ = String(filters.keyword).trim();
        const ordMatch = rawQ.match(/^(?:#|ord-?|order\s*#?|id\s*#?)?(\d+)$/i);

        if (ordMatch) {
            const targetId = ordMatch[1];
            if (targetId.length >= 7) {
                // Phone number search
                filtered = filtered.filter(ord => {
                    const ordId = String(ord.order_id || "");
                    const ph = String(ord.phone || ord.customer_phone || "");
                    return ordId === targetId || ph.includes(targetId);
                });
            } else {
                // Exact Order ID search!
                filtered = filtered.filter(ord => String(ord.order_id) === targetId);
            }
        } else {
            const lowerQ = rawQ.toLowerCase();
            filtered = filtered.filter(ord => {
                const cust = String(ord.customer_name || "").toLowerCase();
                const ph = String(ord.phone || ord.customer_phone || "");
                const email = String(ord.email || "").toLowerCase();
                const city = String(ord.city || "").toLowerCase();
                const cashier = String(ord.cashier_name || "").toLowerCase();
                const payMethod = String(ord.payment_method || "").toLowerCase();
                return (
                    cust.includes(lowerQ) ||
                    ph.includes(lowerQ) ||
                    email.includes(lowerQ) ||
                    city.includes(lowerQ) ||
                    cashier.includes(lowerQ) ||
                    payMethod.includes(lowerQ)
                );
            });
        }
    }

    // 2. Date Filter (matches YYYY-MM-DD)
    if (filters.date) {
        filtered = filtered.filter(ord => {
            const dateStr = String(ord.order_date || "").split("T")[0].split(" ")[0];
            return dateStr === filters.date;
        });
    }

    // 3. Order Status Filter
    if (filters.orderStatus && filters.orderStatus !== "all") {
        filtered = filtered.filter(ord => String(ord.order_status || "").toLowerCase() === filters.orderStatus.toLowerCase());
    }

    // 4. Payment Status Filter
    if (filters.paymentStatus && filters.paymentStatus !== "all") {
        filtered = filtered.filter(ord => String(ord.payment_status || "").toLowerCase() === filters.paymentStatus.toLowerCase());
    }

    renderOrdersTable(filtered);
}

async function loadOrders(filterParams = {}) {
    // 1. Immediate local render
    filterOrdersLocally(filterParams);

    // 2. Query backend if available
    try {
        const query = new URLSearchParams();
        for (const k in filterParams) {
            if (filterParams[k] && filterParams[k] !== "all") query.append(k, filterParams[k]);
        }
        query.append("_t", Date.now());

        const res = await fetch(`${ACTIVE_API_BASE}/orders?${query.toString()}`, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            if (data.orders && Array.isArray(data.orders)) {
                const hasActiveFilter = Object.values(filterParams).some(v => v && v !== "all");
                if (!hasActiveFilter) {
                    allOrders = data.orders;
                    updateSummaryKPIs(allOrders);
                }
                renderOrdersTable(data.orders);
            }
        }
    } catch (e) {
        // Handled via memory
    }
}

// ============================================================
// 6. READ-ONLY VIEW ORDER DETAILS MODAL
// ============================================================

async function openOrderModal(orderId) {
    const modal = document.getElementById("viewOrderModal");
    if (!modal) return;

    let order = allOrders.find(ord => String(ord.order_id) === String(orderId));

    // Try fetching freshest detail with item breakdown from backend
    try {
        const res = await fetch(`${ACTIVE_API_BASE}/orders/detail?order_id=${orderId}&_t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            if (data.order) order = data.order;
        }
    } catch (e) {
        // Use memory order
    }

    if (!order) {
        showToast("Order details not found.", "error");
        return;
    }

    const ordId = order.order_id;
    const custName = order.customer_name || "Walk-in Customer";
    const phone = order.phone || order.customer_phone || (order.customer && (order.customer.phone || order.customer.customer_phone)) || "N/A";
    const email = order.email || order.customer_email || (order.customer && order.customer.email) || "N/A";
    const address = order.address || order.city || order.customer_address || "Store Counter";
    const dateTime = order.order_date ? String(order.order_date).replace("T", " ") : new Date().toLocaleString();
    const cashier = order.cashier_name || currentCashier.full_name || getCookie("cashier_fullname") || getCookie("cashier_username") || "Cashier";
    const totalAmt = parseFloat(order.total_amount || 0);
    const cashRec = parseFloat(order.cash_received || totalAmt);
    const changeRet = parseFloat(order.change_returned || Math.max(0, cashRec - totalAmt));

    // Populate modal fields
    if (document.getElementById("modalOrderTitle")) document.getElementById("modalOrderTitle").textContent = `Order Details #${ordId}`;
    if (document.getElementById("modOrderId")) document.getElementById("modOrderId").textContent = `#${ordId}`;
    if (document.getElementById("modOrderDateTime")) document.getElementById("modOrderDateTime").textContent = dateTime;
    if (document.getElementById("modCashierName")) document.getElementById("modCashierName").textContent = cashier;

    if (document.getElementById("modCustomerName")) document.getElementById("modCustomerName").textContent = custName;
    if (document.getElementById("modCustomerMobile")) document.getElementById("modCustomerMobile").textContent = phone;
    if (document.getElementById("modCustomerEmail")) document.getElementById("modCustomerEmail").textContent = email;
    if (document.getElementById("modCustomerAddress")) document.getElementById("modCustomerAddress").textContent = address;

    if (document.getElementById("modOrderStatusBadge")) {
        document.getElementById("modOrderStatusBadge").innerHTML = getStatusBadgeHtml(order.order_status);
    }
    if (document.getElementById("modPaymentStatusBadge")) {
        document.getElementById("modPaymentStatusBadge").innerHTML = getPaymentBadgeHtml(order.payment_status);
    }

    // Items table
    const itemsTbody = document.getElementById("modItemsTableBody");
    const items = order.items || [];
    let totalItems = 0;

    if (items.length === 0) {
        itemsTbody.innerHTML = `
            <tr>
                <td>Grocery Sale Item</td>
                <td style="text-align:center;">1</td>
                <td style="text-align:right;">${formatCurrency(totalAmt)}</td>
                <td style="text-align:right;">${formatCurrency(totalAmt)}</td>
            </tr>
        `;
        totalItems = 1;
    } else {
        itemsTbody.innerHTML = items.map(it => {
            const qty = parseInt(it.quntity || it.quantity || 1, 10);
            totalItems += qty;
            const price = formatCurrency(it.price);
            const subtotal = formatCurrency(it.subtotal || (qty * it.price));
            return `
                <tr>
                    <td><strong>${escapeHtml(it.product_name || "Grocery Item")}</strong></td>
                    <td style="text-align:center;">${qty}</td>
                    <td style="text-align:right;">${price}</td>
                    <td style="text-align:right;"><strong>${subtotal}</strong></td>
                </tr>
            `;
        }).join("");
    }

    if (document.getElementById("modTotalItemsCount")) document.getElementById("modTotalItemsCount").textContent = `${totalItems} item${totalItems === 1 ? "" : "s"}`;
    if (document.getElementById("modSubtotalAmt")) document.getElementById("modSubtotalAmt").textContent = formatCurrency(totalAmt);
    if (document.getElementById("modGrandTotalAmt")) document.getElementById("modGrandTotalAmt").textContent = formatCurrency(totalAmt);
    if (document.getElementById("modCashReceived")) document.getElementById("modCashReceived").textContent = formatCurrency(cashRec);
    if (document.getElementById("modChangeReturned")) document.getElementById("modChangeReturned").textContent = formatCurrency(changeRet);

    // View Invoice Link
    const invLink = document.getElementById("modViewInvoiceLink");
    if (invLink) {
        invLink.href = `invoice_receipt.html?order_id=${ordId}`;
    }

    modal.classList.add("show");
}

window.openOrderModal = openOrderModal;

function closeOrderModal() {
    const modal = document.getElementById("viewOrderModal");
    if (modal) modal.classList.remove("show");
}

// ============================================================
// 7. EVENT LISTENERS
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

    // 3. Modal Close
    const closeBtnTop = document.getElementById("closeOrderModalBtn");
    const closeBtnBottom = document.getElementById("closeOrderModalBottomBtn");
    const modal = document.getElementById("viewOrderModal");

    if (closeBtnTop) closeBtnTop.addEventListener("click", closeOrderModal);
    if (closeBtnBottom) closeBtnBottom.addEventListener("click", closeOrderModal);
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeOrderModal();
        });
    }

    // 4. Multi-Filter & Search
    const filterBtn = document.getElementById("filterBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const searchInput = document.getElementById("searchKeyword");
    const dateInput = document.getElementById("dateFilter");
    const orderStatusSel = document.getElementById("orderStatusFilter");
    const payStatusSel = document.getElementById("paymentStatusFilter");

    function triggerFilter() {
        const keyword = searchInput ? searchInput.value.trim() : "";
        const date = dateInput ? dateInput.value : "";
        const orderStatus = orderStatusSel ? orderStatusSel.value : "all";
        const paymentStatus = payStatusSel ? payStatusSel.value : "all";
        loadOrders({ keyword, date, orderStatus, paymentStatus });
    }

    if (filterBtn) filterBtn.addEventListener("click", triggerFilter);
    if (searchInput) searchInput.addEventListener("input", triggerFilter);
    if (dateInput) dateInput.addEventListener("change", triggerFilter);
    if (orderStatusSel) orderStatusSel.addEventListener("change", triggerFilter);
    if (payStatusSel) payStatusSel.addEventListener("change", triggerFilter);

    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            if (dateInput) dateInput.value = "";
            if (orderStatusSel) orderStatusSel.value = "all";
            if (payStatusSel) payStatusSel.value = "all";
            loadOrders();
            showToast("Orders list refreshed.", "success");
        });
    }
}

// ============================================================
// 8. INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    renderLiveDate();
    setupEventListeners();

    // Instant local render
    loadCashierProfile();
    loadOrders();

    // Discover live backend and refresh
    await discoverBackend();
    if (isBackendOnline) {
        loadCashierProfile();
        loadOrders();
    }
});
