/**
 * customer.js
 * Clean, Dynamic, and Fully-Featured JavaScript Controller for Customer Dashboard
 */

// Multi-Candidate Ultra-Fast API Discovery
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

let API_BASE = "/api";
let allLoadedCustomers = [];
let currentCustomers = [];
let deleteTargetId = null;
let searchDebounceTimer = null;

async function discoverBackend() {
    try {
        const testPromises = API_CANDIDATES.map(base => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 400);
            return fetch(`${base}/customers?_t=${Date.now()}`, {
                signal: controller.signal,
                cache: "no-store"
            }).then(res => {
                clearTimeout(timeoutId);
                if (res.ok) return base;
                throw new Error("not ok");
            });
        });
        const fastest = await Promise.any(testPromises);
        if (fastest) {
            API_BASE = fastest;
            return API_BASE;
        }
    } catch (e) {
        // Keep default
    }
    return API_BASE;
}

// =========================================================
// 1. UTILITY FUNCTIONS
// =========================================================

/**
 * Generate 2-letter initials from customer name
 */
function getInitials(name) {
    if (!name) return "CU";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
}

/**
 * Toast Notification System
 */
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "fa-circle-check";
    if (type === "error") icon = "fa-circle-xmark";
    if (type === "info") icon = "fa-circle-info";

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

/**
 * Client-Side Sorting Helper
 */
function sortCustomers(list, sortType) {
    const arr = [...list];
    if (sortType === "name" || sortType === "name_asc") {
        return arr.sort((a, b) => (a.customer_name || "").localeCompare(b.customer_name || "", undefined, { sensitivity: "base" }));
    } else if (sortType === "name_desc") {
        return arr.sort((a, b) => (b.customer_name || "").localeCompare(a.customer_name || "", undefined, { sensitivity: "base" }));
    } else if (sortType === "oldest") {
        return arr.sort((a, b) => Number(a.customer_id) - Number(b.customer_id));
    } else {
        // default newest first
        return arr.sort((a, b) => Number(b.customer_id) - Number(a.customer_id));
    }
}


// =========================================================
// 2. FETCH & RENDER CUSTOMERS
// =========================================================

/**
 * Perform instant client-side filter while backend request synchronizes
 */
function performInstantSearch(query) {
    if (!allLoadedCustomers || allLoadedCustomers.length === 0) return;
    const q = query.trim();
    if (!q) {
        currentCustomers = [...allLoadedCustomers];
        renderCustomerTable(currentCustomers);
        updateResultCount(currentCustomers.length);
        return;
    }

    const cleanQ = q.replace(/^#/, "").trim();
    const isNum = /^\d+$/.test(cleanQ);

    const filtered = allLoadedCustomers.filter(c => {
        if (isNum) {
            // Check exact customer_id or prefix
            const cidStr = String(c.customer_id);
            if (cidStr === cleanQ || cidStr.startsWith(cleanQ)) return true;
        }
        // Check customer_name (case-insensitive)
        const name = (c.customer_name || "").toLowerCase();
        if (name.includes(q.toLowerCase())) return true;

        return false;
    });

    currentCustomers = filtered;
    renderCustomerTable(currentCustomers);
    updateResultCount(currentCustomers.length);
}

function updateResultCount(count) {
    const resultTextEl = document.getElementById("customerResultText");
    if (resultTextEl) {
        resultTextEl.textContent = `Showing ${count} customer${count === 1 ? "" : "s"}`;
    }
}

/**
 * Fetch Customers dynamically from database via Backend API
 */
async function fetchCustomers(isLiveTyping = false) {
    const tbody = document.getElementById("customerTableBody");
    const headerSearch = document.getElementById("headerSearch") ? document.getElementById("headerSearch").value.trim() : "";
    const customerId = document.getElementById("customerId") ? document.getElementById("customerId").value.trim() : "";
    const customerName = document.getElementById("customerName") ? document.getElementById("customerName").value.trim() : "";
    const customerStatus = document.getElementById("customerStatus") ? document.getElementById("customerStatus").value : "";
    const sortBy = document.getElementById("sortBy") ? document.getElementById("sortBy").value : "newest";

    const params = new URLSearchParams();
    if (headerSearch) params.append("search", headerSearch);
    if (customerId) params.append("id", customerId);
    if (customerName) params.append("name", customerName);
    if (customerStatus) params.append("status", customerStatus);
    if (sortBy) params.append("sort", sortBy);

    if (!isLiveTyping && (!currentCustomers || currentCustomers.length === 0)) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; padding: 40px;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: #20c866;"></i>
                    <p style="margin-top: 10px; color: #64748b;">Loading customer records from database...</p>
                </td>
            </tr>
        `;
    }

    try {
        let response = await fetch(`${API_BASE}/customers?${params.toString()}&_t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) {
            await discoverBackend();
            response = await fetch(`${API_BASE}/customers?${params.toString()}&_t=${Date.now()}`, { cache: "no-store" });
        }
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const fetched = data.customers || [];
        currentCustomers = sortCustomers(fetched, sortBy);

        if (!headerSearch && !customerId && !customerName && !customerStatus) {
            allLoadedCustomers = [...currentCustomers];
        }

        // Update Statistics Metrics
        if (data.metrics) {
            if (document.getElementById("totalCustomers")) {
                document.getElementById("totalCustomers").textContent = data.metrics.totalCustomers ?? 0;
            }
            if (document.getElementById("activeCustomers")) {
                document.getElementById("activeCustomers").textContent = data.metrics.activeCustomers ?? 0;
            }
            if (document.getElementById("inactiveCustomers")) {
                document.getElementById("inactiveCustomers").textContent = data.metrics.inactiveCustomers ?? 0;
            }
            if (document.getElementById("newCustomers")) {
                document.getElementById("newCustomers").textContent = data.metrics.newCustomers ?? 0;
            }
        }

        // Update Results Count Text
        updateResultCount(currentCustomers.length);

        // Render Table Data
        renderCustomerTable(currentCustomers);

    } catch (error) {
        console.error("Fetch customers error:", error);
        if (!isLiveTyping) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: #ef4444;">
                        <i class="fa-solid fa-circle-exclamation" style="font-size: 28px;"></i>
                        <p style="margin-top: 10px; font-weight: 600;">Unable to connect to database backend.</p>
                        <small style="color: #64748b;">Make sure Python backend or Apache is running.</small>
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Render Customer Data Table
 */
function renderCustomerTable(customers) {
    const tbody = document.getElementById("customerTableBody");

    if (!customers || customers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <i class="fa-solid fa-user-slash"></i>
                        <h4 style="font-size: 16px; color: #334b68; margin-bottom: 4px;">No customers found</h4>
                        <p style="font-size: 13px;">No customer records matched your query or filter criteria.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    customers.forEach(customer => {
        const tr = document.createElement("tr");

        const statusClass = customer.status === "Active" ? "badge-active" : "badge-inactive";
        const dateDisplay = customer.create_at ? customer.create_at.split(" ")[0] : "-";
        const cityDisplay = customer.city && customer.city.trim() ? customer.city : "-";
        const emailDisplay = customer.email && customer.email.trim() ? customer.email : "-";
        const phoneDisplay = customer.phone && customer.phone.trim() ? customer.phone : "-";

        tr.innerHTML = `
            <td class="checkbox-column">
                <input type="checkbox" class="customer-row-cb" value="${customer.customer_id}">
            </td>
            <td><strong>#${customer.customer_id}</strong></td>
            <td><strong>${customer.customer_name}</strong></td>
            <td>${emailDisplay}</td>
            <td>${phoneDisplay}</td>
            <td>${cityDisplay}</td>
            <td>
                <span class="status-badge ${statusClass}">
                    <i class="fa-solid fa-circle" style="font-size: 6px;"></i> ${customer.status}
                </span>
            </td>
            <td>${dateDisplay}</td>
            <td style="text-align: center;">
                <div class="action-buttons-group">
                    <!-- 1. View (Read-Only) -->
                    <button type="button" class="action-btn view-btn" data-id="${customer.customer_id}" title="View Customer Details">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <!-- 2. Edit -->
                    <button type="button" class="action-btn edit-btn" data-id="${customer.customer_id}" title="Edit Customer Details">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <!-- 3. Delete -->
                    <button type="button" class="action-btn delete-btn" data-id="${customer.customer_id}" title="Delete Customer">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Attach Event Listeners to Action Buttons
    tbody.querySelectorAll(".view-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const cid = btn.getAttribute("data-id");
            const cust = currentCustomers.find(c => String(c.customer_id) === String(cid));
            if (cust) openViewModal(cust);
        });
    });

    tbody.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const cid = btn.getAttribute("data-id");
            const cust = currentCustomers.find(c => String(c.customer_id) === String(cid));
            if (cust) openEditModal(cust);
        });
    });

    tbody.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const cid = btn.getAttribute("data-id");
            const cust = currentCustomers.find(c => String(c.customer_id) === String(cid));
            if (cust) openDeleteModal(cust);
        });
    });
}


// =========================================================
// 3. ACTION OPTION 1: VIEW (STRICTLY READ-ONLY)
// =========================================================

/**
 * Open Strictly Read-Only View Modal
 */
function openViewModal(customer) {
    const modal = document.getElementById("viewCustomerModal");
    if (!modal) return;

    const initials = getInitials(customer.customer_name);
    const avatarEl = document.getElementById("viewAvatar");
    if (avatarEl) avatarEl.innerHTML = `<span>${initials}</span>`;

    document.getElementById("viewCustomerName").textContent = customer.customer_name || "-";
    document.getElementById("viewCustomerIdBadge").textContent = `ID: #${customer.customer_id}`;

    const statusPill = document.getElementById("viewStatusPill");
    if (statusPill) {
        statusPill.textContent = customer.status || "Active";
        statusPill.className = `status-pill ${customer.status === "Active" ? "status-active" : "status-inactive"}`;
    }

    document.getElementById("viewCustomerId").textContent = `#${customer.customer_id}`;
    document.getElementById("viewCustomerFullName").textContent = customer.customer_name || "-";
    document.getElementById("viewCustomerEmail").textContent = customer.email || "Not Provided";
    document.getElementById("viewCustomerPhone").textContent = customer.phone || "Not Provided";
    document.getElementById("viewCustomerCity").textContent = customer.city || "Not Provided";
    document.getElementById("viewCustomerAddress").textContent = customer.address || "Not Provided";
    document.getElementById("viewCustomerStatusText").textContent = customer.status || "Active";
    document.getElementById("viewCustomerJoinDate").textContent = customer.create_at || "-";

    modal.classList.add("show");
}

function closeViewModal() {
    const modal = document.getElementById("viewCustomerModal");
    if (modal) modal.classList.remove("show");
}


// =========================================================
// 4. ACTION OPTION 2: CREATE & EDIT CUSTOMER
// =========================================================

/**
 * Open Create Customer Modal
 */
function openCreateModal() {
    const form = document.getElementById("customerForm");
    if (form) form.reset();

    document.getElementById("formCustomerId").value = "";
    document.getElementById("formModalTitle").innerHTML = `<i class="fa-solid fa-user-plus"></i> <span>Create Customer</span>`;
    document.getElementById("saveBtnText").textContent = "Save Customer";
    document.getElementById("formCustomerStatus").value = "Active";

    const feedback = document.getElementById("formFeedbackBanner");
    if (feedback) {
        feedback.style.display = "none";
        feedback.textContent = "";
    }

    const modal = document.getElementById("customerFormModal");
    if (modal) modal.classList.add("show");
}

/**
 * Open Edit Customer Modal
 */
function openEditModal(customer) {
    const form = document.getElementById("customerForm");
    if (form) form.reset();

    document.getElementById("formCustomerId").value = customer.customer_id;
    document.getElementById("formCustomerName").value = customer.customer_name || "";
    document.getElementById("formCustomerPhone").value = customer.phone || "";
    document.getElementById("formCustomerEmail").value = customer.email || "";
    document.getElementById("formCustomerCity").value = customer.city || "";
    document.getElementById("formCustomerAddress").value = customer.address || "";
    document.getElementById("formCustomerStatus").value = customer.status || "Active";

    document.getElementById("formModalTitle").innerHTML = `<i class="fa-solid fa-user-pen"></i> <span>Edit Customer #${customer.customer_id}</span>`;
    document.getElementById("saveBtnText").textContent = "Update Customer";

    const feedback = document.getElementById("formFeedbackBanner");
    if (feedback) {
        feedback.style.display = "none";
        feedback.textContent = "";
    }

    const modal = document.getElementById("customerFormModal");
    if (modal) modal.classList.add("show");
}

function closeCustomerFormModal() {
    const modal = document.getElementById("customerFormModal");
    if (modal) modal.classList.remove("show");
    const form = document.getElementById("customerForm");
    if (form) form.reset();
}


// =========================================================
// 5. ACTION OPTION 3: DELETE CUSTOMER
// =========================================================

/**
 * Open Delete Confirmation Modal
 */
function openDeleteModal(customer) {
    deleteTargetId = customer.customer_id;

    document.getElementById("deleteCustomerName").textContent = customer.customer_name;
    document.getElementById("deleteCustomerDetails").textContent = `ID: #${customer.customer_id} | Phone: ${customer.phone || 'N/A'}`;

    const modal = document.getElementById("deleteConfirmModal");
    if (modal) modal.classList.add("show");
}

function closeDeleteModal() {
    const modal = document.getElementById("deleteConfirmModal");
    if (modal) modal.classList.remove("show");
    deleteTargetId = null;
}


// =========================================================
// 6. LOGOUT CONFIRMATION DIALOG
// =========================================================

function openLogoutModal() {
    const modal = document.getElementById("logoutConfirmModal");
    if (modal) modal.classList.add("show");
}

function closeLogoutModal() {
    const modal = document.getElementById("logoutConfirmModal");
    if (modal) modal.classList.remove("show");
}


// =========================================================
// 7. USER PROFILE HEADER DATA
// =========================================================

async function fetchUserProfile() {
    try {
        const res = await fetch(`${API_BASE}/users/profile?_t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            const u = data.user || data.profile;
            if (u) {
                const fullName = u.full_name || "Admin User";
                const role = u.role || "Administrator";
                const email = u.email || "admin@grocerystore.com";
                const status = u.status || "Active";
                const initials = getInitials(fullName);
                const hasPhoto = Boolean(u.profile_picture && String(u.profile_picture).trim());

                if (document.getElementById("headerUserName")) {
                    document.getElementById("headerUserName").textContent = fullName;
                }
                if (document.getElementById("headerUserRole")) {
                    document.getElementById("headerUserRole").textContent = role;
                }
                if (document.getElementById("dropdownFullName")) {
                    document.getElementById("dropdownFullName").textContent = fullName;
                }
                if (document.getElementById("dropdownEmail")) {
                    document.getElementById("dropdownEmail").textContent = email;
                }
                if (document.getElementById("dropdownStatus")) {
                    document.getElementById("dropdownStatus").textContent = status;
                }

                const headerAvatar = document.getElementById("headerAvatarCircle");
                if (headerAvatar) {
                    if (hasPhoto) {
                        headerAvatar.innerHTML = `<img src="${u.profile_picture}" alt="${fullName}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                        headerAvatar.style.background = "transparent";
                    } else {
                        headerAvatar.innerHTML = `<span>${initials}</span>`;
                        headerAvatar.style.background = "linear-gradient(135deg, #10b981, #059669)";
                        headerAvatar.style.color = "#ffffff";
                        headerAvatar.style.display = "flex";
                        headerAvatar.style.alignItems = "center";
                        headerAvatar.style.justifyContent = "center";
                        headerAvatar.style.fontWeight = "700";
                        headerAvatar.style.fontSize = "13px";
                    }
                }

                const dropdownAvatar = document.getElementById("dropdownAvatar");
                if (dropdownAvatar) {
                    if (hasPhoto) {
                        dropdownAvatar.innerHTML = `<img src="${u.profile_picture}" alt="${fullName}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                        dropdownAvatar.style.background = "transparent";
                    } else {
                        dropdownAvatar.innerHTML = `<span>${initials}</span>`;
                        dropdownAvatar.style.background = "linear-gradient(135deg, #10b981, #059669)";
                        dropdownAvatar.style.color = "#ffffff";
                        dropdownAvatar.style.display = "flex";
                        dropdownAvatar.style.alignItems = "center";
                        dropdownAvatar.style.justifyContent = "center";
                        dropdownAvatar.style.fontWeight = "700";
                        dropdownAvatar.style.fontSize = "14px";
                    }
                }
            }
        }
    } catch (e) {
        // Fallback already in HTML
    }
}


// =========================================================
// 8. EVENT INITIALIZATION
// =========================================================

document.addEventListener("DOMContentLoaded", () => {

    // 1. Concurrent Instant Loading (0ms Latency)
    fetchUserProfile();
    fetchCustomers();
    discoverBackend().then(() => {
        // Silent background sync
    });

    // 2. Header Search Bar
    const headerSearch = document.getElementById("headerSearch");
    const headerSearchBtn = document.getElementById("headerSearchBtn");

    function handleHeaderSearch(isTyping = false) {
        // Clear filter card inputs to prevent conflicting filters
        if (document.getElementById("customerId")) document.getElementById("customerId").value = "";
        if (document.getElementById("customerName")) document.getElementById("customerName").value = "";

        const query = headerSearch ? headerSearch.value.trim() : "";
        performInstantSearch(query);

        fetchCustomers(isTyping);
    }

    if (headerSearch) {
        headerSearch.addEventListener("input", () => {
            const query = headerSearch.value.trim();
            performInstantSearch(query);

            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => handleHeaderSearch(true), 250);
        });

        headerSearch.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                clearTimeout(searchDebounceTimer);
                handleHeaderSearch(false);
            }
        });
    }

    if (headerSearchBtn) {
        headerSearchBtn.addEventListener("click", () => {
            clearTimeout(searchDebounceTimer);
            handleHeaderSearch(false);
        });
    }

    // 3. Filter Card Inputs
    const customerIdInput = document.getElementById("customerId");
    const customerNameInput = document.getElementById("customerName");
    const customerStatusSelect = document.getElementById("customerStatus");
    const sortBySelect = document.getElementById("sortBy");
    const filterBtn = document.getElementById("filterBtn");
    const clearFilterBtn = document.getElementById("clearFilterBtn");
    const refreshCustomerBtn = document.getElementById("refreshCustomerBtn");

    function handleFilterCard(isTyping = false) {
        if (document.getElementById("headerSearch")) document.getElementById("headerSearch").value = "";
        fetchCustomers(isTyping);
    }

    if (customerIdInput) {
        customerIdInput.addEventListener("input", () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => handleFilterCard(true), 250);
        });
        customerIdInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                clearTimeout(searchDebounceTimer);
                handleFilterCard(false);
            }
        });
    }

    if (customerNameInput) {
        customerNameInput.addEventListener("input", () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => handleFilterCard(true), 250);
        });
        customerNameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                clearTimeout(searchDebounceTimer);
                handleFilterCard(false);
            }
        });
    }

    if (customerStatusSelect) {
        customerStatusSelect.addEventListener("change", () => handleFilterCard(false));
    }

    if (sortBySelect) {
        sortBySelect.addEventListener("change", () => {
            const val = sortBySelect.value;
            if (currentCustomers && currentCustomers.length > 0) {
                currentCustomers = sortCustomers(currentCustomers, val);
                renderCustomerTable(currentCustomers);
            }
            handleFilterCard(false);
        });
    }

    if (filterBtn) {
        filterBtn.addEventListener("click", () => {
            clearTimeout(searchDebounceTimer);
            handleFilterCard(false);
        });
    }

    if (clearFilterBtn) {
        clearFilterBtn.addEventListener("click", () => {
            clearTimeout(searchDebounceTimer);
            if (document.getElementById("headerSearch")) document.getElementById("headerSearch").value = "";
            if (document.getElementById("customerId")) document.getElementById("customerId").value = "";
            if (document.getElementById("customerName")) document.getElementById("customerName").value = "";
            if (document.getElementById("customerStatus")) document.getElementById("customerStatus").value = "";
            if (document.getElementById("sortBy")) document.getElementById("sortBy").value = "newest";
            fetchCustomers(false);
            showToast("Filters reset successfully.", "info");
        });
    }

    if (refreshCustomerBtn) {
        refreshCustomerBtn.addEventListener("click", () => {
            fetchCustomers(false);
            showToast("Customer list refreshed.", "info");
        });
    }

    // 4. Create / Edit Form Submission
    const addCustomerBtn = document.getElementById("addCustomerBtn");
    if (addCustomerBtn) addCustomerBtn.addEventListener("click", openCreateModal);

    const closeFormModalBtn = document.getElementById("closeFormModalBtn");
    const cancelFormBtn = document.getElementById("cancelFormBtn");
    if (closeFormModalBtn) closeFormModalBtn.addEventListener("click", closeCustomerFormModal);
    if (cancelFormBtn) cancelFormBtn.addEventListener("click", closeCustomerFormModal);

    const customerForm = document.getElementById("customerForm");
    if (customerForm) {
        customerForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const cid = document.getElementById("formCustomerId").value;
            const mode = cid ? "edit" : "add";
            const feedback = document.getElementById("formFeedbackBanner");

            const nameVal = document.getElementById("formCustomerName").value.trim();
            const phoneVal = document.getElementById("formCustomerPhone").value.trim();
            const emailVal = document.getElementById("formCustomerEmail").value.trim();
            const cityVal = document.getElementById("formCustomerCity").value.trim();
            const addressVal = document.getElementById("formCustomerAddress").value.trim();
            const statusVal = document.getElementById("formCustomerStatus").value;

            if (!nameVal) {
                feedback.textContent = "Customer Name is required.";
                feedback.className = "form-feedback-banner error";
                return;
            }
            if (!phoneVal) {
                feedback.textContent = "Phone / Mobile number is required.";
                feedback.className = "form-feedback-banner error";
                return;
            }

            const payload = {
                customer_name: nameVal,
                phone: phoneVal,
                email: emailVal,
                city: cityVal,
                address: addressVal,
                status: statusVal
            };
            if (cid) payload.customer_id = cid;

            try {
                const res = await fetch(`${API_BASE}/customers/${mode}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                if (res.ok && result.status === "success") {
                    showToast(result.message, "success");
                    closeCustomerFormModal();
                    fetchCustomers(false);
                } else {
                    feedback.textContent = result.message || "Failed to save customer data.";
                    feedback.className = "form-feedback-banner error";
                }
            } catch (err) {
                console.error("Save customer error:", err);
                feedback.textContent = "Server error occurred while saving.";
                feedback.className = "form-feedback-banner error";
            }
        });
    }

    // 5. View Modal Close
    const closeViewModalBtn = document.getElementById("closeViewModalBtn");
    const closeViewBtn = document.getElementById("closeViewBtn");
    if (closeViewModalBtn) closeViewModalBtn.addEventListener("click", closeViewModal);
    if (closeViewBtn) closeViewBtn.addEventListener("click", closeViewModal);

    // 6. Delete Confirmation Actions
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener("click", closeDeleteModal);

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", async () => {
            if (!deleteTargetId) return;
            try {
                const res = await fetch(`${API_BASE}/customers/delete`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ customer_id: deleteTargetId })
                });
                const result = await res.json();

                if (res.ok && result.status === "success") {
                    showToast(result.message, "success");
                    closeDeleteModal();
                    fetchCustomers(false);
                } else {
                    showToast(result.message || "Failed to delete customer.", "error");
                }
            } catch (err) {
                console.error("Delete customer error:", err);
                showToast("Server error during deletion.", "error");
            }
        });
    }

    // 7. Profile Dropdown & Logout
    const profileTrigger = document.getElementById("profileTrigger");
    const profileDropdownWrapper = document.getElementById("profileDropdownWrapper");
    const logoutOptionBtn = document.getElementById("logoutOptionBtn");
    const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
    const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");

    if (profileTrigger && profileDropdownWrapper) {
        profileTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            profileDropdownWrapper.classList.toggle("open");
        });

        document.addEventListener("click", (e) => {
            if (!profileDropdownWrapper.contains(e.target)) {
                profileDropdownWrapper.classList.remove("open");
            }
        });
    }

    if (logoutOptionBtn) {
        logoutOptionBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (profileDropdownWrapper) profileDropdownWrapper.classList.remove("open");
            openLogoutModal();
        });
    }

    if (cancelLogoutBtn) {
        cancelLogoutBtn.addEventListener("click", closeLogoutModal);
    }

    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener("click", () => {
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
        });
    }

    // 8. Select All Checkbox
    const selectAllCb = document.getElementById("selectAll");
    if (selectAllCb) {
        selectAllCb.addEventListener("change", (e) => {
            document.querySelectorAll(".customer-row-cb").forEach(cb => {
                cb.checked = e.target.checked;
            });
        });
    }

    // 9. Mobile Sidebar Toggle
    const menuToggleBtn = document.getElementById("menuToggleBtn");
    const sidebar = document.getElementById("sidebar");
    if (menuToggleBtn && sidebar) {
        menuToggleBtn.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });
    }

    // Close modals on clicking backdrop
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                overlay.classList.remove("show");
            }
        });
    });
});
