/**
 * order.js - Dynamic JavaScript Controller for Order Management
 * Connects to live Python/MySQL backend with real-time dynamic search, filtering,
 * full Order CRUD (with items, customer, products, status), view details,
 * profile dropdown, and logout confirmation.
 */

// API Base URL Candidates
const API_CANDIDATES = [
    "http://localhost:9007/api",
    "http://localhost:9010/api",
    "http://localhost:9008/api",
    "http://localhost:9009/api",
    window.location.origin ? `${window.location.origin}/api` : ""
].filter(Boolean);

let ACTIVE_API_BASE = "http://localhost:9007/api";
let isBackendOnline = false;

// In-Memory Fallback State (Mirroring MySQL project database)
let fallbackCustomers = [
    { customer_id: 1, customer_name: "Rahul Sharma", phone: "9876543210", email: "rahul@example.com", address: "123 MG Road", city: "Mumbai" },
    { customer_id: 2, customer_name: "Priya Patel", phone: "9823456781", email: "priya@example.com", address: "45 Navrangpura", city: "Ahmedabad" },
    { customer_id: 3, customer_name: "Amit Verma", phone: "9811223344", email: "amit@example.com", address: "78 Park Street", city: "Kolkata" },
    { customer_id: 4, customer_name: "Sneha Gupta", phone: "9845098450", email: "sneha@example.com", address: "12 Indiranagar", city: "Bangalore" }
];

let fallbackProducts = [
    { product_id: 1, product_name: "Fresh Banana", price: 40.00, stock: 100 },
    { product_id: 2, product_name: "Red Apple", price: 120.00, stock: 80 },
    { product_id: 3, product_name: "Alphonso Mango", price: 100.00, stock: 70 },
    { product_id: 4, product_name: "Sweet Orange", price: 80.00, stock: 90 },
    { product_id: 5, product_name: "Ripe Pineapple", price: 90.00, stock: 60 }
];

let fallbackOrders = [
    {
        order_id: 1,
        customer_id: 1,
        customer_name: "Rahul Sharma",
        phone: "9876543210",
        email: "rahul@example.com",
        address: "123 MG Road, Mumbai",
        total_amount: 200.00,
        payment_method: "Cash",
        payment_status: "Paid",
        order_status: "Completed",
        order_date: "2026-02-21 20:45:48",
        total_items: 5,
        items: [
            { item_id: 1, product_id: 1, product_name: "Fresh Banana", quantity: 5, price: 40.00, subtotal: 200.00 }
        ]
    },
    {
        order_id: 2,
        customer_id: 2,
        customer_name: "Priya Patel",
        phone: "9823456781",
        email: "priya@example.com",
        address: "45 Navrangpura, Ahmedabad",
        total_amount: 350.00,
        payment_method: "UPI",
        payment_status: "Paid",
        order_status: "Completed",
        order_date: "2026-03-03 20:45:48",
        total_items: 3,
        items: [
            { item_id: 2, product_id: 2, product_name: "Red Apple", quantity: 3, price: 120.00, subtotal: 360.00 }
        ]
    },
    {
        order_id: 3,
        customer_id: 3,
        customer_name: "Amit Verma",
        phone: "9811223344",
        email: "amit@example.com",
        address: "78 Park Street, Kolkata",
        total_amount: 180.00,
        payment_method: "Card",
        payment_status: "Pending",
        order_status: "Pending",
        order_date: "2026-03-13 20:45:48",
        total_items: 2,
        items: [
            { item_id: 3, product_id: 3, product_name: "Alphonso Mango", quantity: 2, price: 100.00, subtotal: 200.00 }
        ]
    }
];

let allOrders = [];
let customerList = [];
let productList = [];
let currentOrderItems = [];
let selectedDeleteId = null;
let currentViewingOrder = null;
let searchDebounceTimer = null;

// ==========================================================
// 1. Toast Notifications
// ==========================================================
function showToast(message, type = "success") {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "order-toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `order-toast toast-${type}`;

    let iconClass = "fa-circle-check";
    if (type === "error") iconClass = "fa-circle-xmark";
    else if (type === "info") iconClass = "fa-circle-info";

    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ==========================================================
// 2. Fetch Customers & Products for Dropdowns
// ==========================================================
async function loadCustomers(selectedId = null) {
    let loaded = false;
    for (const base of API_CANDIDATES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);
            const res = await fetch(`${base}/customers`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                if (data && data.customers && data.customers.length > 0) {
                    customerList = data.customers;
                    ACTIVE_API_BASE = base;
                    isBackendOnline = true;
                    loaded = true;
                    break;
                }
            }
        } catch (e) {}
    }
    if (!loaded) customerList = fallbackCustomers;

    const select = document.getElementById("orderCustomer");
    if (select) {
        select.innerHTML = `<option value="">Select Customer</option>`;
        customerList.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.customer_id;
            opt.textContent = `${c.customer_name} (${c.phone || c.email || 'ID #' + c.customer_id})`;
            select.appendChild(opt);
        });
        if (selectedId) {
            select.value = String(selectedId);
        }
    }
}

async function loadProducts() {
    let loaded = false;
    for (const base of API_CANDIDATES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);
            const res = await fetch(`${base}/products`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                if (data && data.products && data.products.length > 0) {
                    productList = data.products;
                    ACTIVE_API_BASE = base;
                    isBackendOnline = true;
                    loaded = true;
                    break;
                }
            }
        } catch (e) {}
    }
    if (!loaded) productList = fallbackProducts;

    const select = document.getElementById("orderProductSelect");
    if (select) {
        select.innerHTML = `<option value="">Select Product</option>`;
        productList.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.product_id;
            opt.dataset.price = p.price;
            opt.textContent = `${p.product_name} - ₹${parseFloat(p.price || 0).toFixed(2)}`;
            select.appendChild(opt);
        });
    }
}

// Auto update price input when product changes
function handleProductSelectChange() {
    const select = document.getElementById("orderProductSelect");
    const priceInput = document.getElementById("orderProductPrice");
    if (!select || !priceInput) return;

    const selectedOpt = select.options[select.selectedIndex];
    if (selectedOpt && selectedOpt.dataset.price) {
        priceInput.value = parseFloat(selectedOpt.dataset.price).toFixed(2);
    } else {
        priceInput.value = "";
    }
}

// ==========================================================
// 3. User Profile in Header
// ==========================================================
async function loadUserProfile() {
    let userData = null;
    for (const base of API_CANDIDATES) {
        try {
            const res = await fetch(`${base}/users/profile?_t=${Date.now()}`, { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                const user = data.user || data.profile;
                if (user && (user.full_name || user.username)) {
                    userData = user;
                    ACTIVE_API_BASE = base;
                    break;
                }
            }
        } catch (e) {}
    }

    if (userData) {
        updateProfileUI(userData);
    }
}

function updateProfileUI(user) {
    const fullName = user.full_name || "Admin User";
    const email = user.email || "admin@grocerystore.com";
    const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || "AD";
    const hasPhoto = Boolean(user.profile_picture && String(user.profile_picture).trim());

    const nameEl = document.getElementById("dropdownUserName");
    const emailEl = document.getElementById("dropdownUserEmail");
    const triggerEl = document.getElementById("profileTrigger");

    if (nameEl) nameEl.textContent = fullName;
    if (emailEl) emailEl.textContent = email;

    if (triggerEl) {
        if (hasPhoto) {
            triggerEl.innerHTML = `<img src="${user.profile_picture}" alt="${fullName}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            triggerEl.style.background = "transparent";
            triggerEl.style.padding = "0";
            triggerEl.style.overflow = "hidden";
        } else {
            triggerEl.innerHTML = `<span>${initials}</span>`;
            triggerEl.style.background = "linear-gradient(135deg, #10b981, #059669)";
            triggerEl.style.color = "#ffffff";
            triggerEl.style.display = "flex";
            triggerEl.style.alignItems = "center";
            triggerEl.style.justifyContent = "center";
            triggerEl.style.fontWeight = "700";
            triggerEl.style.fontSize = "13px";
        }
    }
}

// ==========================================================
// 4. Update Statistics Cards
// ==========================================================
function updateStatistics(metrics) {
    if (document.getElementById("totalOrders")) document.getElementById("totalOrders").textContent = metrics.total || 0;
    if (document.getElementById("headerTotal")) document.getElementById("headerTotal").textContent = metrics.total || 0;
    if (document.getElementById("pendingOrders")) document.getElementById("pendingOrders").textContent = metrics.pending || 0;
    if (document.getElementById("completedOrders")) document.getElementById("completedOrders").textContent = metrics.completed || 0;
    if (document.getElementById("cancelledOrders")) document.getElementById("cancelledOrders").textContent = metrics.cancelled || 0;
}

function calculateLocalMetrics(list) {
    let total = list.length;
    let pending = 0;
    let completed = 0;
    let cancelled = 0;

    list.forEach(o => {
        const st = (o.order_status || "").toLowerCase();
        if (st === "pending" || st === "processing") pending++;
        else if (st === "completed") completed++;
        else if (st === "cancelled") cancelled++;
    });

    updateStatistics({ total, pending, completed, cancelled });
}

// ==========================================================
// 5. Fetch & Filter Orders
// ==========================================================
async function loadOrders() {
    const headerSearch = document.getElementById("headerSearch")?.value.trim() || "";
    const searchOrder = document.getElementById("searchOrder")?.value.trim() || "";
    const searchCustomer = document.getElementById("searchCustomer")?.value.trim() || "";
    const filterStatus = document.getElementById("filterStatus")?.value.trim() || "";
    const fromDate = document.getElementById("fromDate")?.value.trim() || "";
    const toDate = document.getElementById("toDate")?.value.trim() || "";

    const params = new URLSearchParams();
    if (headerSearch) params.append("search", headerSearch);
    if (searchOrder) params.append("order_id", searchOrder);
    if (searchCustomer) params.append("customer", searchCustomer);
    if (filterStatus) params.append("status", filterStatus);
    if (fromDate) params.append("from_date", fromDate);
    if (toDate) params.append("to_date", toDate);

    let backendSuccess = false;

    for (const base of API_CANDIDATES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const res = await fetch(`${base}/orders?${params.toString()}`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.orders)) {
                    allOrders = data.orders;
                    ACTIVE_API_BASE = base;
                    isBackendOnline = true;
                    backendSuccess = true;

                    if (data.metrics) {
                        updateStatistics(data.metrics);
                    } else {
                        calculateLocalMetrics(allOrders);
                    }
                    break;
                }
            }
        } catch (e) {}
    }

    if (!backendSuccess) {
        // Fallback filtering on local database
        let filtered = [...fallbackOrders];

        // 1. Header Search
        if (headerSearch) {
            const term = headerSearch.toLowerCase();
            filtered = filtered.filter(o => 
                String(o.order_id).includes(term) ||
                String(o.customer_id || '').includes(term) ||
                (o.customer_name || '').toLowerCase().includes(term) ||
                (o.phone || '').includes(term)
            );
        }

        // 2. Filter Order ID
        if (searchOrder) {
            filtered = filtered.filter(o => String(o.order_id).includes(searchOrder));
        }

        // 3. Filter Customer
        if (searchCustomer) {
            const cTerm = searchCustomer.toLowerCase();
            filtered = filtered.filter(o => 
                (o.customer_name || '').toLowerCase().includes(cTerm) ||
                (o.phone || '').includes(cTerm)
            );
        }

        // 4. Filter Status
        if (filterStatus) {
            filtered = filtered.filter(o => (o.order_status || '').toLowerCase() === filterStatus.toLowerCase());
        }

        // 5. Date Range
        if (fromDate) {
            filtered = filtered.filter(o => (o.order_date || '').substring(0, 10) >= fromDate);
        }
        if (toDate) {
            filtered = filtered.filter(o => (o.order_date || '').substring(0, 10) <= toDate);
        }

        allOrders = filtered;
        calculateLocalMetrics(fallbackOrders);
    }

    renderOrdersTable(allOrders);
}

// ==========================================================
// 6. Render Orders Table
// ==========================================================
function renderOrdersTable(orders) {
    const tbody = document.getElementById("orderTableBody");
    if (!tbody) return;

    if (!orders || orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-5">
                    <div class="empty-state">
                        <i class="fa-solid fa-cart-shopping empty-icon"></i>
                        <h4>No Orders Found</h4>
                        <p>No matching orders found for your search or filter criteria.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    orders.forEach(o => {
        const tr = document.createElement("tr");

        // Status badge class
        let statusBadge = "status-pending";
        const st = (o.order_status || "").toLowerCase();
        if (st === "completed") statusBadge = "status-completed";
        else if (st === "cancelled") statusBadge = "status-cancelled";
        else if (st === "processing") statusBadge = "status-processing";

        // Payment badge class
        let paymentBadge = "payment-pending";
        const pay = (o.payment_status || "").toLowerCase();
        if (pay === "paid") paymentBadge = "payment-paid";
        else if (pay.includes("partial")) paymentBadge = "payment-partial";

        // Date format
        let dateStr = o.order_date ? o.order_date.substring(0, 10) : "N/A";

        tr.innerHTML = `
            <td>
                <input type="checkbox" class="order-checkbox" value="${o.order_id}">
            </td>
            <td><strong>#ORD-${o.order_id}</strong></td>
            <td>
                <div style="font-weight: 600; color: #111827;">${escapeHtml(o.customer_name || 'Guest Customer')}</div>
                <small style="color: #64748b; font-size: 11px;">ID: #${o.customer_id || 'N/A'}</small>
            </td>
            <td>${escapeHtml(o.phone || 'N/A')}</td>
            <td><span class="badge bg-light text-dark">${o.total_items || o.items?.length || 1} items</span></td>
            <td><strong style="color: #16a34a;">₹${parseFloat(o.total_amount || 0).toFixed(2)}</strong></td>
            <td>
                <span class="status-badge ${statusBadge}">${escapeHtml(o.order_status || 'Pending')}</span>
            </td>
            <td>${dateStr}</td>
            <td>
                <div class="action-buttons">
                    <button type="button" class="action-btn view-btn" onclick="window.openViewModal(${o.order_id})" title="View Details">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="action-btn edit-btn" onclick="window.openEditModal(${o.order_id})" title="Edit Order">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" class="action-btn delete-btn" onclick="window.openDeleteModal(${o.order_id})" title="Delete Order">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================================
// 7. View Order Details Modal
// ==========================================================
window.openViewModal = async function(orderId) {
    let order = allOrders.find(o => o.order_id == orderId) || fallbackOrders.find(o => o.order_id == orderId);
    
    // Attempt to fetch fresh order details with items from API
    if (isBackendOnline) {
        try {
            const res = await fetch(`${ACTIVE_API_BASE}/orders/${orderId}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.order) {
                    order = data.order;
                }
            }
        } catch (e) {}
    }

    if (!order) return;
    currentViewingOrder = order;

    const content = document.getElementById("viewModalContent");
    if (!content) return;

    let itemsHtml = "";
    const items = order.items || [];

    if (items.length > 0) {
        items.forEach(it => {
            const price = parseFloat(it.price || 0).toFixed(2);
            const subtotal = parseFloat(it.subtotal || (it.price * it.quantity) || 0).toFixed(2);
            itemsHtml += `
                <tr>
                    <td><strong>${escapeHtml(it.product_name || 'Product #' + it.product_id)}</strong></td>
                    <td>₹${price}</td>
                    <td>${it.quantity}</td>
                    <td><strong>₹${subtotal}</strong></td>
                </tr>
            `;
        });
    } else {
        itemsHtml = `<tr><td colspan="4" class="text-center text-muted">No items recorded.</td></tr>`;
    }

    // Status badge class
    let statusClass = "status-pending";
    const st = (order.order_status || "").toLowerCase();
    if (st === "completed") statusClass = "status-completed";
    else if (st === "cancelled") statusClass = "status-cancelled";
    else if (st === "processing") statusClass = "status-processing";

    content.innerHTML = `
        <div class="order-detail-header">
            <div class="order-meta">
                <h4>Order #ORD-${order.order_id}</h4>
                <span>Placed on ${order.order_date || 'N/A'}</span>
            </div>
            <div>
                <span class="status-badge ${statusClass}">${escapeHtml(order.order_status || 'Pending')}</span>
            </div>
        </div>

        <div class="customer-info-box">
            <h6><i class="fa-solid fa-user"></i> Customer Information</h6>
            <p><strong>Name:</strong> ${escapeHtml(order.customer_name || 'Guest Customer')} (ID: #${order.customer_id || 'N/A'})</p>
            <p><strong>Phone:</strong> ${escapeHtml(order.phone || order.customer_phone || 'N/A')} | <strong>Email:</strong> ${escapeHtml(order.email || 'N/A')}</p>
            <p><strong>Address:</strong> ${escapeHtml(order.address || 'N/A')}</p>
        </div>

        <h6 style="font-size: 13px; font-weight: 700; margin-bottom: 8px; color: #1e293b;">Ordered Products</h6>
        <table class="view-products-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <span style="font-size: 12px; color: #64748b; display: block;">Payment: <strong>${escapeHtml(order.payment_method || 'Cash')}</strong> (${escapeHtml(order.payment_status || 'Pending')})</span>
                <span style="font-size: 12px; color: #64748b; display: block; margin-top: 2px;">Cashier: <strong>${escapeHtml(order.cashier_name || 'Cashier')}</strong></span>
            </div>
            <div style="text-align: right;">
                <span style="font-size: 12px; color: #64748b; display: block;">Total Amount</span>
                <strong style="font-size: 18px; color: #16a34a;">₹${parseFloat(order.total_amount || 0).toFixed(2)}</strong>
            </div>
        </div>
    `;

    document.getElementById("viewOrderModal").classList.add("show");
};

window.closeViewModal = function() {
    document.getElementById("viewOrderModal").classList.remove("show");
};

// ==========================================================
// 8. Create / Edit Order Modal & Items Builder
// ==========================================================
window.openCreateModal = function() {
    document.getElementById("modalTitle").textContent = "Create Order";
    document.getElementById("orderId").value = "";
    document.getElementById("orderCustomer").value = "";
    document.getElementById("orderPaymentMethod").value = "Cash";
    document.getElementById("orderPaymentStatus").value = "Pending";
    document.getElementById("orderStatusInput").value = "Pending";
    document.getElementById("orderDateInput").value = new Date().toISOString().substring(0, 10);
    
    currentOrderItems = [];
    renderSelectedItems();
    document.getElementById("orderModal").classList.add("show");
};

window.openEditModal = async function(orderId) {
    window.closeViewModal();
    let order = allOrders.find(o => o.order_id == orderId) || fallbackOrders.find(o => o.order_id == orderId);

    if (isBackendOnline) {
        try {
            const res = await fetch(`${ACTIVE_API_BASE}/orders/${orderId}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.order) order = data.order;
            }
        } catch (e) {}
    }

    if (!order) return;

    document.getElementById("modalTitle").textContent = `Edit Order #ORD-${order.order_id}`;
    document.getElementById("orderId").value = order.order_id;
    document.getElementById("orderCustomer").value = order.customer_id || "";
    document.getElementById("orderPaymentMethod").value = order.payment_method || "Cash";
    document.getElementById("orderPaymentStatus").value = order.payment_status || "Pending";
    document.getElementById("orderStatusInput").value = order.order_status || "Pending";
    document.getElementById("orderDateInput").value = order.order_date ? order.order_date.substring(0, 10) : "";

    currentOrderItems = (order.items && order.items.length > 0) ? [...order.items] : [
        {
            product_id: 1,
            product_name: "Order Items Package",
            price: parseFloat(order.total_amount || 0),
            quantity: 1,
            subtotal: parseFloat(order.total_amount || 0)
        }
    ];

    renderSelectedItems();
    document.getElementById("orderModal").classList.add("show");
};

window.closeOrderModal = function() {
    document.getElementById("orderModal").classList.remove("show");
};

// Add Item to currentOrderItems array
function addItemToOrder() {
    const productSelect = document.getElementById("orderProductSelect");
    const priceInput = document.getElementById("orderProductPrice");
    const qtyInput = document.getElementById("orderQuantityInput");

    const productId = productSelect.value;
    const price = parseFloat(priceInput.value);
    const qty = parseInt(qtyInput.value);

    if (!productId || isNaN(price) || isNaN(qty) || qty <= 0) {
        showToast("Please select a product, price, and valid quantity", "error");
        return;
    }

    const prodObj = productList.find(p => String(p.product_id) === String(productId));
    const prodName = prodObj ? prodObj.product_name : `Product #${productId}`;

    // Check if already in currentOrderItems
    const existing = currentOrderItems.find(it => String(it.product_id) === String(productId));
    if (existing) {
        existing.quantity += qty;
        existing.price = price;
        existing.subtotal = existing.quantity * existing.price;
    } else {
        currentOrderItems.push({
            product_id: parseInt(productId),
            product_name: prodName,
            price: price,
            quantity: qty,
            subtotal: price * qty
        });
    }

    // Reset item inputs
    productSelect.value = "";
    priceInput.value = "";
    qtyInput.value = "1";

    renderSelectedItems();
}

window.removeItemFromOrder = function(index) {
    currentOrderItems.splice(index, 1);
    renderSelectedItems();
};

function renderSelectedItems() {
    const tbody = document.getElementById("selectedItemsBody");
    const totalSpan = document.getElementById("orderTotalSpan");
    if (!tbody || !totalSpan) return;

    if (currentOrderItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No products added yet.</td></tr>`;
        totalSpan.textContent = "₹0.00";
        return;
    }

    tbody.innerHTML = "";
    let grandTotal = 0;

    currentOrderItems.forEach((it, idx) => {
        const sub = it.price * it.quantity;
        grandTotal += sub;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${escapeHtml(it.product_name)}</strong></td>
            <td>₹${parseFloat(it.price).toFixed(2)}</td>
            <td>${it.quantity}</td>
            <td>₹${sub.toFixed(2)}</td>
            <td>
                <button type="button" class="btn-remove-item" onclick="window.removeItemFromOrder(${idx})" title="Remove item">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    totalSpan.textContent = `₹${grandTotal.toFixed(2)}`;
}

// Form Submit (Create / Update Order)
async function handleOrderFormSubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById("saveBtn");
    const originalText = saveBtn.innerHTML;

    const id = document.getElementById("orderId").value;
    const customerId = document.getElementById("orderCustomer").value;
    const paymentMethod = document.getElementById("orderPaymentMethod").value;
    const paymentStatus = document.getElementById("orderPaymentStatus").value;
    const orderStatus = document.getElementById("orderStatusInput").value;
    const orderDate = document.getElementById("orderDateInput").value;

    if (!customerId) {
        showToast("Please select a customer", "error");
        return;
    }

    if (currentOrderItems.length === 0) {
        showToast("Please add at least one product to the order", "error");
        return;
    }

    let totalAmount = currentOrderItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);

    const payload = {
        order_id: id ? parseInt(id) : undefined,
        customer_id: parseInt(customerId),
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        order_status: orderStatus,
        total_amount: totalAmount,
        order_date: orderDate || new Date().toISOString().substring(0, 10),
        items: currentOrderItems
    };

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

    // 1. API Call
    let savedViaApi = false;
    if (isBackendOnline) {
        try {
            const url = id ? `${ACTIVE_API_BASE}/orders/update` : `${ACTIVE_API_BASE}/orders`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                savedViaApi = true;
            }
        } catch (err) {}
    }

    // 2. Local State Sync
    const custObj = customerList.find(c => String(c.customer_id) === String(customerId));
    const custName = custObj ? custObj.customer_name : "Customer";
    const custPhone = custObj ? custObj.phone : "";
    const custEmail = custObj ? custObj.email : "";
    const custAddress = custObj ? custObj.address : "";

    if (id) {
        const target = fallbackOrders.find(o => o.order_id == id);
        if (target) {
            target.customer_id = parseInt(customerId);
            target.customer_name = custName;
            target.phone = custPhone;
            target.email = custEmail;
            target.address = custAddress;
            target.payment_method = paymentMethod;
            target.payment_status = paymentStatus;
            target.order_status = orderStatus;
            target.total_amount = totalAmount;
            target.items = [...currentOrderItems];
            target.total_items = currentOrderItems.reduce((acc, i) => acc + i.quantity, 0);
        }
        showToast("Order updated successfully!", "success");
    } else {
        const newOrderId = fallbackOrders.length > 0 ? Math.max(...fallbackOrders.map(o => o.order_id)) + 1 : 1;
        fallbackOrders.unshift({
            order_id: newOrderId,
            customer_id: parseInt(customerId),
            customer_name: custName,
            phone: custPhone,
            email: custEmail,
            address: custAddress,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            order_status: orderStatus,
            total_amount: totalAmount,
            order_date: new Date().toISOString().replace('T', ' ').substring(0, 19),
            total_items: currentOrderItems.reduce((acc, i) => acc + i.quantity, 0),
            items: [...currentOrderItems]
        });
        showToast("Order created successfully!", "success");
    }

    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;
    window.closeOrderModal();
    loadOrders();
}

// ==========================================================
// 9. Delete Order Modal
// ==========================================================
window.openDeleteModal = function(orderId) {
    selectedDeleteId = orderId;
    const text = document.getElementById("deleteModalText");
    if (text) {
        text.textContent = `Are you sure you want to delete Order #ORD-${orderId} and all its item records? This cannot be undone.`;
    }
    document.getElementById("deleteOrderModal").classList.add("show");
};

window.closeDeleteModal = function() {
    selectedDeleteId = null;
    document.getElementById("deleteOrderModal").classList.remove("show");
};

async function confirmDeleteOrder() {
    if (!selectedDeleteId) return;
    const btn = document.getElementById("confirmDeleteBtn");
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Deleting...`;

    if (isBackendOnline) {
        try {
            await fetch(`${ACTIVE_API_BASE}/orders/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order_id: selectedDeleteId })
            });
        } catch (e) {}
    }

    fallbackOrders = fallbackOrders.filter(o => o.order_id != selectedDeleteId);
    showToast("Order deleted successfully", "success");

    btn.disabled = false;
    btn.innerHTML = originalText;
    window.closeDeleteModal();
    loadOrders();
}

// ==========================================================
// 10. Quick Add Customer Modal
// ==========================================================
window.openCustomerModal = function() {
    const form = document.getElementById("quickCustomerForm");
    if (form) form.reset();
    document.getElementById("customerModal").classList.add("show");
};

window.closeCustomerModal = function() {
    document.getElementById("customerModal").classList.remove("show");
};

async function handleQuickCustomerSubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById("saveCustomerBtn");
    const originalText = saveBtn.innerHTML;

    const name = document.getElementById("newCustomerName").value.trim();
    const phone = document.getElementById("newCustomerPhone").value.trim();
    const email = document.getElementById("newCustomerEmail").value.trim();
    const city = document.getElementById("newCustomerCity").value.trim();
    const address = document.getElementById("newCustomerAddress").value.trim();

    if (!name || !phone) {
        showToast("Please enter customer name and phone number", "error");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

    let newCustomerId = null;
    if (isBackendOnline) {
        try {
            const res = await fetch(`${ACTIVE_API_BASE}/customers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customer_name: name,
                    phone: phone,
                    email: email,
                    city: city,
                    address: address
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                newCustomerId = data.customer_id;
            }
        } catch (err) {}
    }

    if (!newCustomerId) {
        newCustomerId = fallbackCustomers.length > 0 ? Math.max(...fallbackCustomers.map(c => c.customer_id)) + 1 : 1;
        fallbackCustomers.push({
            customer_id: newCustomerId,
            customer_name: name,
            phone: phone,
            email: email,
            city: city,
            address: address
        });
    }

    showToast(`Customer "${name}" added successfully!`, "success");
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;
    window.closeCustomerModal();

    // Reload customers dropdown and immediately pre-select the newly added customer!
    await loadCustomers(newCustomerId);
}

// ==========================================================
// 11. Profile Dropdown & Logout Modal
// ==========================================================
function toggleProfileMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById("profileDropdownMenu");
    if (menu) menu.classList.toggle("show");
}

function closeProfileMenu() {
    const menu = document.getElementById("profileDropdownMenu");
    if (menu) menu.classList.remove("show");
}

function openLogoutConfirmation() {
    closeProfileMenu();
    document.getElementById("logoutModal").classList.add("show");
}

function closeLogoutConfirmation() {
    document.getElementById("logoutModal").classList.remove("show");
}

function confirmLogoutAction() {
    localStorage.clear();
    sessionStorage.clear();
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`;
        document.cookie = `${name}=; Path=/demo; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`;
    }
    window.location.href = "/login.html";
}

// ==========================================================
// 12. Initialization & Event Handlers
// ==========================================================
document.addEventListener("DOMContentLoaded", function () {
    // 1. Initial Data Load
    loadCustomers();
    loadProducts();
    loadUserProfile();
    loadOrders();

    // 2. Sidebar Toggle
    const sidebarToggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("sidebar");
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener("click", () => {
            sidebar.classList.toggle("show");
        });
    }

    // 3. User Profile Dropdown
    const profileTrigger = document.getElementById("profileTrigger");
    if (profileTrigger) {
        profileTrigger.addEventListener("click", toggleProfileMenu);
    }

    document.addEventListener("click", (e) => {
        const wrapper = document.querySelector(".profile-dropdown-wrapper");
        if (wrapper && !wrapper.contains(e.target)) {
            closeProfileMenu();
        }
    });

    const logoutOption = document.getElementById("logoutOption");
    if (logoutOption) logoutOption.addEventListener("click", openLogoutConfirmation);

    const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
    if (cancelLogoutBtn) cancelLogoutBtn.addEventListener("click", closeLogoutConfirmation);

    const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
    if (confirmLogoutBtn) confirmLogoutBtn.addEventListener("click", confirmLogoutAction);

    // 4. Header & Filter Search Inputs with Debounce
    const headerSearch = document.getElementById("headerSearch");
    const searchOrder = document.getElementById("searchOrder");
    const searchCustomer = document.getElementById("searchCustomer");
    const filterStatus = document.getElementById("filterStatus");
    const fromDate = document.getElementById("fromDate");
    const toDate = document.getElementById("toDate");
    const filterBtn = document.getElementById("filterBtn");

    function debouncedSearch() {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(loadOrders, 250);
    }

    if (headerSearch) {
        headerSearch.addEventListener("input", debouncedSearch);
        headerSearch.addEventListener("keydown", (e) => { if (e.key === "Enter") loadOrders(); });
    }
    if (searchOrder) searchOrder.addEventListener("input", debouncedSearch);
    if (searchCustomer) searchCustomer.addEventListener("input", debouncedSearch);
    if (filterStatus) filterStatus.addEventListener("change", loadOrders);
    if (fromDate) fromDate.addEventListener("change", loadOrders);
    if (toDate) toDate.addEventListener("change", loadOrders);
    if (filterBtn) filterBtn.addEventListener("click", loadOrders);

    // 5. Create Order Trigger
    const createOrderBtn = document.getElementById("createOrderBtn");
    if (createOrderBtn) createOrderBtn.addEventListener("click", window.openCreateModal);

    // 6. Quick Add Customer Trigger & Handlers
    const quickAddCustomerBtn = document.getElementById("quickAddCustomerBtn");
    if (quickAddCustomerBtn) quickAddCustomerBtn.addEventListener("click", window.openCustomerModal);

    const closeCustomerModal = document.getElementById("closeCustomerModal");
    const cancelCustomerBtn = document.getElementById("cancelCustomerBtn");
    if (closeCustomerModal) closeCustomerModal.addEventListener("click", window.closeCustomerModal);
    if (cancelCustomerBtn) cancelCustomerBtn.addEventListener("click", window.closeCustomerModal);

    const quickCustomerForm = document.getElementById("quickCustomerForm");
    if (quickCustomerForm) quickCustomerForm.addEventListener("submit", handleQuickCustomerSubmit);

    // 7. Close Modal Triggers
    const closeModal = document.getElementById("closeModal");
    const cancelBtn = document.getElementById("cancelBtn");
    if (closeModal) closeModal.addEventListener("click", window.closeOrderModal);
    if (cancelBtn) cancelBtn.addEventListener("click", window.closeOrderModal);

    const closeViewModal = document.getElementById("closeViewModal");
    const closeViewBtn = document.getElementById("closeViewBtn");
    if (closeViewModal) closeViewModal.addEventListener("click", window.closeViewModal);
    if (closeViewBtn) closeViewBtn.addEventListener("click", window.closeViewModal);

    const editFromViewBtn = document.getElementById("editFromViewBtn");
    if (editFromViewBtn) {
        editFromViewBtn.addEventListener("click", () => {
            if (currentViewingOrder) {
                window.openEditModal(currentViewingOrder.order_id);
            }
        });
    }

    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener("click", window.closeDeleteModal);
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener("click", confirmDeleteOrder);

    // 8. Item Builder Handlers
    const productSelect = document.getElementById("orderProductSelect");
    if (productSelect) productSelect.addEventListener("change", handleProductSelectChange);

    const addItemBtn = document.getElementById("addItemBtn");
    if (addItemBtn) addItemBtn.addEventListener("click", addItemToOrder);

    // 9. Order Form Submit
    const orderForm = document.getElementById("orderForm");
    if (orderForm) orderForm.addEventListener("submit", handleOrderFormSubmit);

    // 10. Select All Checkbox
    const selectAll = document.getElementById("selectAll");
    if (selectAll) {
        selectAll.addEventListener("change", function () {
            const checks = document.querySelectorAll(".order-checkbox");
            checks.forEach(c => c.checked = this.checked);
        });
    }

    // 11. Close Modals on Backdrop Click
    window.addEventListener("click", (e) => {
        if (e.target.classList.contains("order-custom-modal")) {
            e.target.classList.remove("show");
        }
    });
});