/**
 * invoice_receipt.js - Cashier Invoices & Receipts Management Controller
 * Handles Invoice listing, search, date filtering, View Modal, and Print/Save-as-PDF.
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
// 1. DEFAULT DATASETS (Matches MySQL 'project' Schema)
// ============================================================

const DEFAULT_INVOICES = [
    {
        order_id: 29,
        invoice_no: "INV-2026-029",
        customer_id: 24,
        customer_name: "Aadhya Desai",
        phone: "9654012348",
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
        invoice_no: "INV-2026-028",
        customer_id: 24,
        customer_name: "Aadhya Desai",
        phone: "9654012348",
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
        invoice_no: "INV-2026-026",
        customer_id: 1,
        customer_name: "Aarav Patel",
        phone: "9876543210",
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
        invoice_no: "INV-2026-023",
        customer_id: 23,
        customer_name: "Rudra Mehta",
        phone: "7654012347",
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
    }
];

let allInvoices = [...DEFAULT_INVOICES];
let currentSelectedInvoice = null;
let currentCashier = {
    id: null,
    full_name: "Cashier",
    username: "cashier",
    email: "",
    role: "Cashier"
};

// ============================================================
// 2. UTILITY FUNCTIONS & COOKIE HELPERS
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
            const res = await fetch(`${url}/invoices?_ping=1`, {
                signal: controller.signal,
                cache: "no-store"
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                ACTIVE_API_BASE = url;
                isBackendOnline = true;
                console.log(`[Invoice Discovery] Connected at: ${ACTIVE_API_BASE}`);
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
        // Rendered default
    }
}

// ============================================================
// 5. INVOICES LIST & FILTERING
// ============================================================

function updateSummaryCounters(invoices) {
    const totalCount = invoices.length;
    const totalSum = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);

    const todayStr = new Date().toISOString().split("T")[0];
    const todayCount = invoices.filter(inv => inv.order_date && String(inv.order_date).startsWith(todayStr)).length;

    if (document.getElementById("totalInvoicesCount")) document.getElementById("totalInvoicesCount").textContent = totalCount;
    if (document.getElementById("totalRevenueSum")) document.getElementById("totalRevenueSum").textContent = formatCurrency(totalSum);
    if (document.getElementById("todayInvoicesCount")) document.getElementById("todayInvoicesCount").textContent = todayCount;
}

function renderInvoicesTable(invoices) {
    const tbody = document.getElementById("invoicesTableBody");
    const countTag = document.getElementById("invoiceCountTag");
    if (!tbody) return;

    if (!invoices || invoices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="no-data-cell">
                    <i class="fa-solid fa-file-circle-xmark" style="font-size:32px; opacity:0.3; margin-bottom:8px; display:block;"></i>
                    No invoices found matching your criteria.
                </td>
            </tr>
        `;
        if (countTag) countTag.textContent = "Showing 0 invoices";
        return;
    }

    tbody.innerHTML = invoices.map(inv => {
        const orderId = inv.order_id;
        const invNo = inv.invoice_no || `INV-2026-${String(orderId).padStart(3, '0')}`;
        const custName = escapeHtml(inv.customer_name || "Walk-in Customer");
        const dateStr = inv.order_date ? String(inv.order_date).replace("T", " ") : "2026-09-02";
        const total = formatCurrency(inv.total_amount);
        const cashier = escapeHtml(inv.cashier_name || currentCashier.full_name || "Cashier");

        return `
            <tr>
                <td><span class="inv-code">${invNo}</span></td>
                <td><strong class="order-code">#${orderId}</strong></td>
                <td><strong>${custName}</strong></td>
                <td><span style="color:var(--muted); font-size:12px;">${dateStr}</span></td>
                <td><span class="amount-text">${total}</span></td>
                <td><span class="badge-cash-pill"><i class="fa-solid fa-money-bill-wave" style="color:var(--green-dark);"></i> Cash</span></td>
                <td><span class="badge-paid"><i class="fa-solid fa-circle-check"></i> Paid</span></td>
                <td><span style="font-weight:600; font-size:12px;">${cashier}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn-view" onclick="openInvoiceModal(${orderId})" title="View Invoice">
                            <i class="fa-solid fa-eye"></i> View
                        </button>
                        <button class="action-btn-print" onclick="printInvoiceDirect(${orderId})" title="Print Receipt">
                            <i class="fa-solid fa-print"></i> Print
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    if (countTag) {
        countTag.textContent = `Showing ${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`;
    }
}

function filterInvoicesLocally(filters = {}) {
    let filtered = [...allInvoices];

    // 1. Search keyword (matches Invoice No, Order ID, Customer Name)
    if (filters.keyword) {
        const q = String(filters.keyword).toLowerCase().trim().replace(/^#/, "");
        filtered = filtered.filter(inv => {
            const invNo = String(inv.invoice_no || "").toLowerCase();
            const ordId = String(inv.order_id || "");
            const cust = String(inv.customer_name || "").toLowerCase();
            return invNo.includes(q) || ordId === q || cust.includes(q);
        });
    }

    // 2. Date Range
    if (filters.from) {
        const fromDate = new Date(filters.from);
        filtered = filtered.filter(inv => inv.order_date && new Date(inv.order_date) >= fromDate);
    }
    if (filters.to) {
        const toDate = new Date(filters.to);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(inv => inv.order_date && new Date(inv.order_date) <= toDate);
    }

    renderInvoicesTable(filtered);
}

async function loadInvoices(filterParams = {}) {
    // 1. Render immediately from local memory
    filterInvoicesLocally(filterParams);
    updateSummaryCounters(allInvoices);

    // 2. Fetch live data from backend
    try {
        const query = new URLSearchParams();
        for (const k in filterParams) {
            if (filterParams[k]) query.append(k, filterParams[k]);
        }
        query.append("_t", Date.now());

        const res = await fetch(`${ACTIVE_API_BASE}/invoices?${query.toString()}`, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            if (data.invoices && Array.isArray(data.invoices)) {
                if (Object.keys(filterParams).length === 0) {
                    allInvoices = data.invoices;
                }
                renderInvoicesTable(data.invoices);
                updateSummaryCounters(data.invoices);
            }
        }
    } catch (e) {
        // Handled with memory state
    }
}

// ============================================================
// 6. VIEW & PRINT INVOICE MODAL
// ============================================================

async function openInvoiceModal(orderId) {
    const modal = document.getElementById("invoiceModal");
    if (!modal) return;

    let invoice = allInvoices.find(inv => String(inv.order_id) === String(orderId));

    // Try fetching freshest detail with item breakdown from backend
    try {
        const res = await fetch(`${ACTIVE_API_BASE}/invoices/detail?order_id=${orderId}&_t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            if (data.invoice) invoice = data.invoice;
        }
    } catch (e) {
        // Use memory invoice
    }

    if (!invoice) {
        showToast("Invoice details not found.", "error");
        return;
    }

    currentSelectedInvoice = invoice;

    const invNo = invoice.invoice_no || `INV-2026-${String(invoice.order_id).padStart(3, '0')}`;
    const custName = invoice.customer_name || "Walk-in Customer";
    const phone = invoice.phone || invoice.customer_phone || (invoice.customer && (invoice.customer.phone || invoice.customer.customer_phone)) || "N/A";
    const city = invoice.city || invoice.customer_city || (invoice.customer && invoice.customer.city) || "Store Counter";
    const dateTime = invoice.order_date ? String(invoice.order_date).replace("T", " ") : new Date().toLocaleString();
    const cashier = invoice.cashier_name || currentCashier.full_name || getCookie("cashier_fullname") || getCookie("cashier_username") || "Cashier";

    const totalAmt = parseFloat(invoice.total_amount || 0);
    const cashRec = parseFloat(invoice.cash_received || totalAmt);
    const changeRet = parseFloat(invoice.change_returned || Math.max(0, cashRec - totalAmt));

    // Populate dynamic store details from database
    const storeName = invoice.store_name || (invoice.store && invoice.store.name) || "GroceryHub";
    const storeAddress = invoice.store_address || (invoice.store && invoice.store.address) || "68,MG ROAD, RAJKOT, GUJRAT";
    const storePhone = invoice.store_phone || (invoice.store && invoice.store.phone) || "9876543212";
    const storeGst = invoice.store_gst || (invoice.store && invoice.store.gst) || "GST12345";

    if (document.getElementById("rcptStoreName")) document.getElementById("rcptStoreName").textContent = storeName;
    if (document.getElementById("rcptStoreAddress")) document.getElementById("rcptStoreAddress").textContent = `${storeAddress} | Phone: ${storePhone}`;
    if (document.getElementById("rcptStoreGst")) document.getElementById("rcptStoreGst").textContent = `GSTIN: ${storeGst}`;

    // Populate modal fields
    if (document.getElementById("modalInvoiceTitle")) document.getElementById("modalInvoiceTitle").textContent = `Sales Invoice ${invNo}`;
    if (document.getElementById("rcptInvoiceNo")) document.getElementById("rcptInvoiceNo").textContent = invNo;
    if (document.getElementById("rcptOrderId")) document.getElementById("rcptOrderId").textContent = `#${invoice.order_id}`;
    if (document.getElementById("rcptDateTime")) document.getElementById("rcptDateTime").textContent = dateTime;
    if (document.getElementById("rcptCashierName")) document.getElementById("rcptCashierName").textContent = cashier;

    if (document.getElementById("rcptCustomerName")) document.getElementById("rcptCustomerName").textContent = custName;
    if (document.getElementById("rcptCustomerPhone")) document.getElementById("rcptCustomerPhone").textContent = phone;
    if (document.getElementById("rcptCustomerCity")) document.getElementById("rcptCustomerCity").textContent = city;

    // Items table
    const itemsTbody = document.getElementById("rcptItemsTableBody");
    const items = invoice.items || [];
    let totalItems = 0;

    if (items.length === 0) {
        itemsTbody.innerHTML = `
            <tr>
                <td>Grocery Sale Items</td>
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
                    <td><strong>${escapeHtml(it.product_name || "Item")}</strong></td>
                    <td style="text-align:center;">${qty}</td>
                    <td style="text-align:right;">${price}</td>
                    <td style="text-align:right;"><strong>${subtotal}</strong></td>
                </tr>
            `;
        }).join("");
    }

    if (document.getElementById("rcptTotalItemsCount")) document.getElementById("rcptTotalItemsCount").textContent = `${totalItems} item${totalItems === 1 ? "" : "s"}`;
    if (document.getElementById("rcptSubtotalAmt")) document.getElementById("rcptSubtotalAmt").textContent = formatCurrency(totalAmt);
    if (document.getElementById("rcptGrandTotalAmt")) document.getElementById("rcptGrandTotalAmt").textContent = formatCurrency(totalAmt);
    if (document.getElementById("rcptCashReceived")) document.getElementById("rcptCashReceived").textContent = formatCurrency(cashRec);
    if (document.getElementById("rcptChangeReturned")) document.getElementById("rcptChangeReturned").textContent = formatCurrency(changeRet);
    if (document.getElementById("rcptPrintStamp")) document.getElementById("rcptPrintStamp").textContent = `Generated on ${new Date().toLocaleString()} | Cashier POS`;

    modal.classList.add("show");
}

window.openInvoiceModal = openInvoiceModal;

function closeInvoiceModal() {
    const modal = document.getElementById("invoiceModal");
    if (modal) modal.classList.remove("show");
}

function printInvoiceDirect(orderId) {
    openInvoiceModal(orderId);
    setTimeout(() => {
        window.print();
    }, 300);
}

window.printInvoiceDirect = printInvoiceDirect;

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

    // 3. Close Modal Events
    const closeBtn = document.getElementById("closeInvoiceBtn");
    const modal = document.getElementById("invoiceModal");
    if (closeBtn) closeBtn.addEventListener("click", closeInvoiceModal);
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeInvoiceModal();
        });
    }

    // 4. Print Button Event
    const printBtn = document.getElementById("printInvoiceBtn");
    if (printBtn) {
        printBtn.addEventListener("click", () => {
            window.print();
        });
    }

    // 5. Search & Date Filter
    const filterBtn = document.getElementById("filterBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const searchInput = document.getElementById("searchKeyword");

    if (filterBtn) {
        filterBtn.addEventListener("click", () => {
            const keyword = searchInput ? searchInput.value.trim() : "";
            const from = document.getElementById("dateFrom") ? document.getElementById("dateFrom").value : "";
            const to = document.getElementById("dateTo") ? document.getElementById("dateTo").value : "";
            loadInvoices({ keyword, from, to });
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const keyword = searchInput.value.trim();
            const from = document.getElementById("dateFrom") ? document.getElementById("dateFrom").value : "";
            const to = document.getElementById("dateTo") ? document.getElementById("dateTo").value : "";
            loadInvoices({ keyword, from, to });
        });
        searchInput.addEventListener("keyup", (e) => {
            if (e.key === "Enter" && filterBtn) filterBtn.click();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            if (document.getElementById("dateFrom")) document.getElementById("dateFrom").value = "";
            if (document.getElementById("dateTo")) document.getElementById("dateTo").value = "";
            loadInvoices();
            showToast("Invoices list refreshed.", "success");
        });
    }
}

// ============================================================
// 8. INITIALIZATION & URL PARAMETER HANDLING
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    renderLiveDate();
    setupEventListeners();

    // Instant local render
    loadCashierProfile();
    loadInvoices();

    // Discover live backend and refresh
    await discoverBackend();
    if (isBackendOnline) {
        loadCashierProfile();
        loadInvoices();
    }

    // Check if ?order_id=... is passed from POS page (to auto-open receipt)
    const urlParams = new URLSearchParams(window.location.search);
    const orderIdParam = urlParams.get("order_id") || urlParams.get("id");
    if (orderIdParam) {
        setTimeout(() => {
            openInvoiceModal(orderIdParam);
        }, 300);
    }
});
