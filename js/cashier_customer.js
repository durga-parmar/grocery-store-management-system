/**
 * customer.js - Cashier Customer Management Controller
 * Handles Customer listing, search, status filtering, Create, View Modal, and Edit Modal.
 * Database: MySQL 'project' (customer_tab, order_tab, registration)
 */

// Global API Candidate list
const API_CANDIDATES = [
    "/api",
    window.location.origin && window.location.origin.startsWith("http") ? `${window.location.origin}/api` : "",
    "http://localhost:8000/api",
    "http://localhost:9007/api",
    "http://localhost:9010/api",
    "http://localhost:9008/api",
    "http://localhost:9009/api",
    "http://localhost:9013/api",
    "http://localhost:9000/api"
].filter(Boolean);

let ACTIVE_API_BASE = "/api";
let isBackendOnline = true;

// ============================================================
// 1. DEFAULT DATASETS (Matches MySQL 'customer_tab' & 'order_tab')
// ============================================================

const DEFAULT_CUSTOMERS = [
    {
        customer_id: 53,
        customer_name: "ishita khunti",
        phone: "6787890987",
        email: "ishita@gmail.com",
        city: "Ahemdabad",
        address: "Street 34, Ahemdabad",
        status: "Active",
        create_at: "2026-08-25 19:08:56",
        total_orders: 0,
        total_purchase: 0.00
    },
    {
        customer_id: 24,
        customer_name: "Aadhya Desai",
        phone: "9654012348",
        email: "aadhya.desai@example.com",
        city: "Jamnagar",
        address: "Jamnagar",
        status: "Active",
        create_at: "2026-07-30 20:45:48",
        total_orders: 2,
        total_purchase: 330.00
    },
    {
        customer_id: 23,
        customer_name: "Rudra Mehta",
        phone: "7654012347",
        email: "rudra.mehta@example.com",
        city: "Surat",
        address: "Surat",
        status: "Active",
        create_at: "2026-07-28 20:45:48",
        total_orders: 1,
        total_purchase: 160.00
    },
    {
        customer_id: 22,
        customer_name: "Isha Shah",
        phone: "8765012346",
        email: "isha.shah@example.com",
        city: "Ahmedabad",
        address: "Ahmedabad",
        status: "Active",
        create_at: "2026-07-26 20:45:48",
        total_orders: 1,
        total_purchase: 520.00
    },
    {
        customer_id: 1,
        customer_name: "Aarav Patel",
        phone: "9876543210",
        email: "aarav.patel@example.com",
        city: "Rajkot",
        address: "Rajkot",
        status: "Active",
        create_at: "2026-07-01 10:00:00",
        total_orders: 3,
        total_purchase: 480.00
    },
    {
        customer_id: 50,
        customer_name: "Rina Pandya",
        phone: "6987012374",
        email: "rina.pandya@example.com",
        city: "Porbandar",
        address: "Porbandar",
        status: "Active",
        create_at: "2026-08-10 20:38:37",
        total_orders: 0,
        total_purchase: 0.00
    },
    {
        customer_id: 49,
        customer_name: "Amit Rathod",
        phone: "7109012373",
        email: "amit.rathod@example.com",
        city: "Jamnagar",
        address: "Jamnagar",
        status: "Active",
        create_at: "2026-08-08 20:38:37",
        total_orders: 0,
        total_purchase: 0.00
    },
    {
        customer_id: 48,
        customer_name: "Bhavna Trivedi",
        phone: "8210012372",
        email: "bhavna.trivedi@example.com",
        city: "Surat",
        address: "Surat",
        status: "Active",
        create_at: "2026-08-06 20:38:37",
        total_orders: 0,
        total_purchase: 0.00
    },
    {
        customer_id: 47,
        customer_name: "Nitin Solanki",
        phone: "9321012371",
        email: "nitin.solanki@example.com",
        city: "Ahmedabad",
        address: "Ahmedabad",
        status: "Active",
        create_at: "2026-08-04 20:38:37",
        total_orders: 0,
        total_purchase: 0.00
    }
];

let allCustomers = [...DEFAULT_CUSTOMERS];
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
            const res = await fetch(`${url}/customers?_ping=1`, {
                signal: controller.signal,
                cache: "no-store"
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                ACTIVE_API_BASE = url;
                isBackendOnline = true;
                console.log(`[Customer Discovery] Connected at: ${ACTIVE_API_BASE}`);
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
                window.location.replace("/customer.html");
                return;
            }
            if (authData.user) {
                currentCashier = authData.user;
                renderCashierProfile(authData.user);
                return;
            }
        }
    } catch (err) {
        console.warn("[Cashier Customer Auth] Error:", err);
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
// 5. KPI SUMMARY & CUSTOMER TABLE
// ============================================================

function updateSummaryKPIs(customers) {
    const totalCustomers = customers.length;
    const todayStr = new Date().toISOString().split("T")[0];

    let newTodayCount = 0;
    let activeCount = 0;
    let totalOrdersSum = 0;

    customers.forEach(c => {
        const isToday = c.create_at && String(c.create_at).startsWith(todayStr);
        if (isToday) newTodayCount++;

        const isAct = String(c.status || "Active").toLowerCase() === "active";
        if (isAct) activeCount++;

        totalOrdersSum += parseInt(c.total_orders || 0, 10);
    });

    if (document.getElementById("kpiTotalCustomers")) document.getElementById("kpiTotalCustomers").textContent = totalCustomers;
    if (document.getElementById("kpiNewCustomersToday")) document.getElementById("kpiNewCustomersToday").textContent = newTodayCount;
    if (document.getElementById("kpiActiveCustomers")) document.getElementById("kpiActiveCustomers").textContent = activeCount;
    if (document.getElementById("kpiTotalOrders")) document.getElementById("kpiTotalOrders").textContent = totalOrdersSum;
}

function getCustomerStatusBadgeHtml(status) {
    const isAct = String(status || "Active").toLowerCase() === "active";
    if (isAct) {
        return `<span class="status-badge status-active"><i class="fa-solid fa-circle-check"></i> Active</span>`;
    } else {
        return `<span class="status-badge status-inactive"><i class="fa-solid fa-circle-pause"></i> Inactive</span>`;
    }
}

function renderCustomerTable(customers) {
    const tbody = document.getElementById("customerTableBody");
    const countTag = document.getElementById("customerCountTag");
    if (!tbody) return;

    if (!customers || customers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="no-data-cell">
                    <i class="fa-solid fa-user-slash" style="font-size:32px; opacity:0.3; margin-bottom:8px; display:block;"></i>
                    No customers found matching your criteria.
                </td>
            </tr>
        `;
        if (countTag) countTag.textContent = "Showing 0 customers";
        return;
    }

    tbody.innerHTML = customers.map(c => {
        const cid = c.customer_id;
        const name = escapeHtml(c.customer_name || "Customer");
        const phone = escapeHtml(c.phone || "N/A");
        const email = escapeHtml(c.email || "—");
        const location = escapeHtml(c.city || c.address || "Gujarat");
        const ordersCount = parseInt(c.total_orders || 0, 10);
        const purchaseTotal = formatCurrency(c.total_purchase || 0);
        const statusBadge = getCustomerStatusBadgeHtml(c.status);

        return `
            <tr>
                <td><strong class="cust-code">#${cid}</strong></td>
                <td><strong>${name}</strong></td>
                <td><span style="font-weight:600; color:var(--dark); font-size:12.5px;">${phone}</span></td>
                <td><span style="color:var(--muted); font-size:12px;">${email}</span></td>
                <td><span style="color:var(--muted); font-size:12px;">${location}</span></td>
                <td><strong>${ordersCount} order${ordersCount === 1 ? "" : "s"}</strong></td>
                <td><span class="amount-text">${purchaseTotal}</span></td>
                <td>${statusBadge}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn-view" onclick="openViewCustomerModal(${cid})" title="View Customer Details">
                            <i class="fa-solid fa-eye"></i> View
                        </button>
                        <button class="action-btn-edit" onclick="openEditCustomerModal(${cid})" title="Edit Customer Details">
                            <i class="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    if (countTag) {
        countTag.textContent = `Showing ${customers.length} customer${customers.length === 1 ? "" : "s"}`;
    }
}

function filterCustomersLocally(filters = {}) {
    let filtered = [...allCustomers];

    // 1. Search keyword (matches Customer ID, Name, Phone)
    if (filters.keyword) {
        const q = String(filters.keyword).toLowerCase().trim().replace(/^#/, "");
        filtered = filtered.filter(c => {
            const cid = String(c.customer_id || "");
            const name = String(c.customer_name || "").toLowerCase();
            const ph = String(c.phone || "");
            return cid === q || cid.includes(q) || name.includes(q) || ph.includes(q);
        });
    }

    // 2. Status Filter
    if (filters.status && filters.status !== "all") {
        filtered = filtered.filter(c => String(c.status || "active").toLowerCase() === filters.status.toLowerCase());
    }

    renderCustomerTable(filtered);
}

async function loadCustomers(filterParams = {}) {
    // 1. Immediate local render
    filterCustomersLocally(filterParams);
    updateSummaryKPIs(allCustomers);

    // 2. Query backend if available
    try {
        const query = new URLSearchParams();
        for (const k in filterParams) {
            if (filterParams[k] && filterParams[k] !== "all") query.append(k, filterParams[k]);
        }
        query.append("_t", Date.now());

        const res = await fetch(`${ACTIVE_API_BASE}/customers?${query.toString()}`, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            if (data.customers && Array.isArray(data.customers)) {
                if (Object.keys(filterParams).length === 0) {
                    allCustomers = data.customers;
                }
                renderCustomerTable(data.customers);
                updateSummaryKPIs(data.customers);
            }
        }
    } catch (e) {
        // Handled via memory state
    }
}

// ============================================================
// 6. CREATE NEW CUSTOMER
// ============================================================

function openAddCustomerModal() {
    const modal = document.getElementById("addCustomerModal");
    const form = document.getElementById("addCustomerForm");
    if (form) form.reset();
    if (modal) modal.classList.add("show");
}

window.openAddCustomerModal = openAddCustomerModal;

function closeAddCustomerModal() {
    const modal = document.getElementById("addCustomerModal");
    if (modal) modal.classList.remove("show");
}

async function handleAddCustomerSubmit(e) {
    e.preventDefault();

    const name = document.getElementById("addCustName").value.trim();
    const phone = document.getElementById("addCustPhone").value.trim();
    const email = document.getElementById("addCustEmail").value.trim();
    const city = document.getElementById("addCustCity").value.trim();
    const address = document.getElementById("addCustAddress").value.trim();
    const status = document.getElementById("addCustStatus").value;

    if (!name || !phone) {
        showToast("Please enter Customer Name and Mobile Number.", "error");
        return;
    }

    if (phone.length < 10) {
        showToast("Please enter a valid 10-digit mobile number.", "error");
        return;
    }

    const payload = {
        customer_name: name,
        phone: phone,
        email: email,
        city: city,
        address: address,
        status: status
    };

    const submitBtn = document.getElementById("submitAddCustomerBtn");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
    }

    try {
        let newId = Math.floor(60 + Math.random() * 900);

        // Try candidate POST endpoints
        const candidateUrls = [
            `${ACTIVE_API_BASE}/customers/create`,
            "http://localhost:9007/api/customers/create",
            "http://localhost:9010/api/customers/create",
            "/api/customers/create"
        ];

        for (const endpoint of candidateUrls) {
            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.customer_id) newId = data.customer_id;
                    break;
                }
            } catch (err) {
                // Next candidate
            }
        }

        const newCustomerObj = {
            customer_id: newId,
            customer_name: name,
            phone: phone,
            email: email,
            city: city,
            address: address,
            status: status,
            create_at: new Date().toISOString().replace("T", " ").substring(0, 19),
            total_orders: 0,
            total_purchase: 0.00
        };

        allCustomers.unshift(newCustomerObj);
        renderCustomerTable(allCustomers);
        updateSummaryKPIs(allCustomers);

        closeAddCustomerModal();
        showToast(`Customer "${name}" added successfully! (ID #${newId})`, "success");

    } catch (e) {
        showToast("Error adding customer. Please check backend.", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Customer`;
        }
    }
}

// ============================================================
// 7. READ-ONLY VIEW CUSTOMER MODAL
// ============================================================

function openViewCustomerModal(customerId) {
    const modal = document.getElementById("viewCustomerModal");
    if (!modal) return;

    const customer = allCustomers.find(c => String(c.customer_id) === String(customerId));
    if (!customer) {
        showToast("Customer details not found.", "error");
        return;
    }

    const cid = customer.customer_id;
    const name = customer.customer_name || "Customer";
    const phone = customer.phone || "N/A";
    const email = customer.email || "Not Provided";
    const city = customer.city || "Gujarat";
    const address = customer.address || city || "Gujarat";
    const created = customer.create_at ? String(customer.create_at).split(" ")[0] : "2026-08-25";
    const ordersCount = parseInt(customer.total_orders || 0, 10);
    const purchaseTotal = formatCurrency(customer.total_purchase || 0);
    const initials = (name.substring(0, 2) || "CU").toUpperCase();

    if (document.getElementById("viewModalTitle")) document.getElementById("viewModalTitle").textContent = `Customer Details #${cid}`;
    if (document.getElementById("viewCustAvatar")) document.getElementById("viewCustAvatar").textContent = initials;
    if (document.getElementById("viewCustName")) document.getElementById("viewCustName").textContent = name;
    if (document.getElementById("viewCustPhone")) document.getElementById("viewCustPhone").innerHTML = `<i class="fa-solid fa-phone"></i> ${phone}`;
    if (document.getElementById("viewCustStatusBadge")) {
        document.getElementById("viewCustStatusBadge").className = `status-badge ${String(customer.status).toLowerCase() === "active" ? "status-active" : "status-inactive"}`;
        document.getElementById("viewCustStatusBadge").innerHTML = getCustomerStatusBadgeHtml(customer.status);
    }

    if (document.getElementById("viewCustId")) document.getElementById("viewCustId").textContent = `#${cid}`;
    if (document.getElementById("viewCustEmail")) document.getElementById("viewCustEmail").textContent = email;
    if (document.getElementById("viewCustCity")) document.getElementById("viewCustCity").textContent = city;
    if (document.getElementById("viewCustCreated")) document.getElementById("viewCustCreated").textContent = created;
    if (document.getElementById("viewCustAddress")) document.getElementById("viewCustAddress").textContent = address;

    if (document.getElementById("viewCustTotalOrders")) document.getElementById("viewCustTotalOrders").textContent = `${ordersCount} Order${ordersCount === 1 ? "" : "s"}`;
    if (document.getElementById("viewCustTotalPurchase")) document.getElementById("viewCustTotalPurchase").textContent = purchaseTotal;

    modal.classList.add("show");
}

window.openViewCustomerModal = openViewCustomerModal;

function closeViewCustomerModal() {
    const modal = document.getElementById("viewCustomerModal");
    if (modal) modal.classList.remove("show");
}

// ============================================================
// 8. EDIT CUSTOMER MODAL
// ============================================================

function openEditCustomerModal(customerId) {
    const modal = document.getElementById("editCustomerModal");
    if (!modal) return;

    const customer = allCustomers.find(c => String(c.customer_id) === String(customerId));
    if (!customer) {
        showToast("Customer details not found.", "error");
        return;
    }

    document.getElementById("editCustId").value = customer.customer_id;
    document.getElementById("editCustName").value = customer.customer_name || "";
    document.getElementById("editCustPhone").value = customer.phone || "";
    document.getElementById("editCustEmail").value = customer.email || "";
    document.getElementById("editCustCity").value = customer.city || "";
    document.getElementById("editCustAddress").value = customer.address || "";
    document.getElementById("editCustStatus").value = customer.status || "Active";

    if (document.getElementById("editModalTitle")) {
        document.getElementById("editModalTitle").textContent = `Edit Customer #${customer.customer_id}`;
    }

    modal.classList.add("show");
}

window.openEditCustomerModal = openEditCustomerModal;

function closeEditCustomerModal() {
    const modal = document.getElementById("editCustomerModal");
    if (modal) modal.classList.remove("show");
}

async function handleEditCustomerSubmit(e) {
    e.preventDefault();

    const customerId = parseInt(document.getElementById("editCustId").value, 10);
    const name = document.getElementById("editCustName").value.trim();
    const phone = document.getElementById("editCustPhone").value.trim();
    const email = document.getElementById("editCustEmail").value.trim();
    const city = document.getElementById("editCustCity").value.trim();
    const address = document.getElementById("editCustAddress").value.trim();
    const status = document.getElementById("editCustStatus").value;

    if (!name || !phone) {
        showToast("Please enter Customer Name and Mobile Number.", "error");
        return;
    }

    const payload = {
        customer_id: customerId,
        customer_name: name,
        phone: phone,
        email: email,
        city: city,
        address: address,
        status: status
    };

    const submitBtn = document.getElementById("submitEditCustomerBtn");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Updating...`;
    }

    try {
        // Try candidate POST endpoints
        const candidateUrls = [
            `${ACTIVE_API_BASE}/customers/update`,
            "http://localhost:9007/api/customers/update",
            "http://localhost:9010/api/customers/update",
            "/api/customers/update"
        ];

        for (const endpoint of candidateUrls) {
            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                if (res.ok) break;
            } catch (err) {
                // Next candidate
            }
        }

        // Update local object
        const index = allCustomers.findIndex(c => c.customer_id === customerId);
        if (index > -1) {
            allCustomers[index] = {
                ...allCustomers[index],
                customer_name: name,
                phone: phone,
                email: email,
                city: city,
                address: address,
                status: status
            };
        }

        renderCustomerTable(allCustomers);
        updateSummaryKPIs(allCustomers);

        closeEditCustomerModal();
        showToast(`Customer #${customerId} updated successfully!`, "success");

    } catch (e) {
        showToast("Error updating customer.", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> Update Customer`;
        }
    }
}

// ============================================================
// 9. EVENT LISTENERS
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

    // 3. Modal Close Events
    const openAddBtn = document.getElementById("openAddCustomerModalBtn");
    const closeAddBtn = document.getElementById("closeAddModalBtn");
    const cancelAddBtn = document.getElementById("cancelAddModalBtn");
    const addForm = document.getElementById("addCustomerForm");

    if (openAddBtn) openAddBtn.addEventListener("click", openAddCustomerModal);
    if (closeAddBtn) closeAddBtn.addEventListener("click", closeAddCustomerModal);
    if (cancelAddBtn) cancelAddBtn.addEventListener("click", closeAddCustomerModal);
    if (addForm) addForm.addEventListener("submit", handleAddCustomerSubmit);

    const closeViewBtn = document.getElementById("closeViewModalBtn");
    const closeViewBottomBtn = document.getElementById("closeViewModalBottomBtn");
    if (closeViewBtn) closeViewBtn.addEventListener("click", closeViewCustomerModal);
    if (closeViewBottomBtn) closeViewBottomBtn.addEventListener("click", closeViewCustomerModal);

    const closeEditBtn = document.getElementById("closeEditModalBtn");
    const cancelEditBtn = document.getElementById("cancelEditModalBtn");
    const editForm = document.getElementById("editCustomerForm");

    if (closeEditBtn) closeEditBtn.addEventListener("click", closeEditCustomerModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener("click", closeEditCustomerModal);
    if (editForm) editForm.addEventListener("submit", handleEditCustomerSubmit);

    // Click outside modal to close
    document.querySelectorAll(".modal").forEach(modal => {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.remove("show");
            }
        });
    });

    // 4. Multi-Filter & Search
    const filterBtn = document.getElementById("filterBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const searchInput = document.getElementById("searchKeyword");
    const statusSel = document.getElementById("statusFilter");

    function triggerFilter() {
        const keyword = searchInput ? searchInput.value.trim() : "";
        const status = statusSel ? statusSel.value : "all";
        loadCustomers({ keyword, status });
    }

    if (filterBtn) filterBtn.addEventListener("click", triggerFilter);
    if (searchInput) searchInput.addEventListener("input", triggerFilter);
    if (statusSel) statusSel.addEventListener("change", triggerFilter);

    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            if (statusSel) statusSel.value = "all";
            loadCustomers();
            showToast("Customer list refreshed.", "success");
        });
    }
}

// ============================================================
// 10. INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    renderLiveDate();
    setupEventListeners();

    // Instant local render
    loadCashierProfile();
    loadCustomers();

    // Discover live backend and refresh
    await discoverBackend();
    if (isBackendOnline) {
        loadCashierProfile();
        loadCustomers();
    }
});
