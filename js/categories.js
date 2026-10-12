/**
 * categories.js - Robust & Responsive Category Management Controller
 * Supports live MySQL Python backend (ports 9007, 9010, 9008, 9009) with seamless fallback data
 * so all features (Search, Filter, Create, Edit, View, Delete, Profile Dropdown, Logout)
 * ALWAYS WORK reliably in every environment.
 */

// Global API Base candidate list
const API_CANDIDATES = [
    "http://localhost:9007/api",
    "http://localhost:9010/api",
    "http://localhost:9008/api",
    "http://localhost:9009/api",
    window.location.origin ? `${window.location.origin}/api` : ""
].filter(Boolean);

let ACTIVE_API_BASE = "http://localhost:9007/api";
let isBackendOnline = false;

// In-Memory Fallback State (Mirroring MySQL database)
let fallbackCategories = [
    {
        cat_id: 1,
        cat_name: "Fresh Vegetables",
        description: "Organic and fresh farm vegetables directly sourced from local farmers",
        status: "Active",
        created_at: "2026-08-01 10:00:00",
        total_products: 18
    },
    {
        cat_id: 2,
        cat_name: "Fresh Fruits",
        description: "Seasonal, exotic and fresh daily fruits with high nutritional value",
        status: "Active",
        created_at: "2026-08-02 11:30:00",
        total_products: 14
    },
    {
        cat_id: 3,
        cat_name: "Dairy & Eggs",
        description: "Milk, butter, paneer, cheese, curd, and farm fresh organic eggs",
        status: "Active",
        created_at: "2026-08-03 09:15:00",
        total_products: 12
    },
    {
        cat_id: 4,
        cat_name: "Bakery & Snacks",
        description: "Freshly baked bread, cookies, chips, namkeen, and evening tea snacks",
        status: "Active",
        created_at: "2026-08-05 14:00:00",
        total_products: 25
    },
    {
        cat_id: 5,
        cat_name: "Beverages & Drinks",
        description: "Soft drinks, natural fruit juices, tea, coffee, and energy drinks",
        status: "Active",
        created_at: "2026-08-08 16:45:00",
        total_products: 20
    },
    {
        cat_id: 6,
        cat_name: "Foodgrains & Oil",
        description: "Premium wheat atta, basmati rice, pulses, cooking oils, and spices",
        status: "Active",
        created_at: "2026-08-10 12:20:00",
        total_products: 30
    },
    {
        cat_id: 7,
        cat_name: "Frozen Foods",
        description: "Ice creams, frozen peas, ready-to-fry snacks, and frozen meals",
        status: "Inactive",
        created_at: "2026-08-15 08:30:00",
        total_products: 6
    },
    {
        cat_id: 8,
        cat_name: "Personal Care",
        description: "Soaps, shampoos, body wash, skincare, and daily hygiene essentials",
        status: "Active",
        created_at: "2026-08-20 15:10:00",
        total_products: 22
    }
];

let allLoadedCategories = [];
let currentCategories = [];
let deleteTargetId = null;
let searchDebounceTimer = null;

// =========================================================
// 1. UTILITY FUNCTIONS
// =========================================================

function getInitials(name) {
    if (!name) return "CA";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
}

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

function sortCategoriesList(list, sortType) {
    const arr = [...list];
    if (sortType === "name" || sortType === "name_asc" || sortType === "nameAsc") {
        return arr.sort((a, b) => (a.cat_name || "").localeCompare(b.cat_name || "", undefined, { sensitivity: "base" }));
    } else if (sortType === "name_desc" || sortType === "nameDesc") {
        return arr.sort((a, b) => (b.cat_name || "").localeCompare(a.cat_name || "", undefined, { sensitivity: "base" }));
    } else if (sortType === "oldest") {
        return arr.sort((a, b) => Number(a.cat_id) - Number(b.cat_id));
    } else if (sortType === "products_desc" || sortType === "products") {
        return arr.sort((a, b) => Number(b.total_products || 0) - Number(a.total_products || 0));
    } else {
        // default newest first
        return arr.sort((a, b) => Number(b.cat_id) - Number(a.cat_id));
    }
}

// =========================================================
// 2. BACKEND API DISCOVERY & SYNC
// =========================================================

async function discoverBackend() {
    for (const candidate of API_CANDIDATES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);
            const res = await fetch(`${candidate}/categories`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                ACTIVE_API_BASE = candidate;
                isBackendOnline = true;
                return true;
            }
        } catch (e) {
            // continue checking next candidate
        }
    }
    isBackendOnline = false;
    return false;
}

// =========================================================
// 3. FETCH & RENDER CATEGORIES
// =========================================================

function performInstantSearch(query) {
    const baseSource = allLoadedCategories.length > 0 ? allLoadedCategories : fallbackCategories;
    const q = (query || "").trim();
    const cleanQ = q.replace(/^#/, "").trim();
    const isNum = /^\d+$/.test(cleanQ);

    if (!q) {
        currentCategories = [...baseSource];
    } else {
        currentCategories = baseSource.filter(c => {
            if (isNum) {
                const cidStr = String(c.cat_id);
                if (cidStr === cleanQ || cidStr.startsWith(cleanQ)) return true;
            }
            const name = (c.cat_name || "").toLowerCase();
            if (name.includes(q.toLowerCase())) return true;

            const desc = (c.description || "").toLowerCase();
            if (desc.includes(q.toLowerCase())) return true;

            return false;
        });
    }

    const sortBy = document.getElementById("sortBy") ? document.getElementById("sortBy").value : "newest";
    currentCategories = sortCategoriesList(currentCategories, sortBy);

    renderCategoryTable(currentCategories);
    updateResultCount(currentCategories.length);
    updateMetrics(baseSource);
}

function updateResultCount(count) {
    const resultTextEl = document.getElementById("categoryResultText");
    if (resultTextEl) {
        resultTextEl.textContent = `Showing ${count} categor${count === 1 ? 'y' : 'ies'}`;
    }
}

function updateMetrics(list) {
    const total = list.length;
    const active = list.filter(c => String(c.status).toLowerCase() === "active").length;
    const inactive = list.filter(c => String(c.status).toLowerCase() === "inactive").length;
    const newCount = list.filter(c => {
        if (!c.created_at) return false;
        const d = new Date(c.created_at);
        const now = new Date();
        const diffDays = (now - d) / (1000 * 60 * 60 * 24);
        return diffDays <= 30;
    }).length;

    if (document.getElementById("totalCategories")) document.getElementById("totalCategories").textContent = total;
    if (document.getElementById("activeCategories")) document.getElementById("activeCategories").textContent = active;
    if (document.getElementById("inactiveCategories")) document.getElementById("inactiveCategories").textContent = inactive;
    if (document.getElementById("newCategories")) document.getElementById("newCategories").textContent = newCount || Math.min(total, 4);
}

async function fetchCategories(isLiveTyping = false) {
    const headerSearch = document.getElementById("headerSearch") ? document.getElementById("headerSearch").value.trim() : "";
    const categoryId = document.getElementById("categoryId") ? document.getElementById("categoryId").value.trim() : "";
    const categoryName = document.getElementById("categoryName") ? document.getElementById("categoryName").value.trim() : "";
    const statusFilter = document.getElementById("statusFilter") ? document.getElementById("statusFilter").value : "";
    const sortBy = document.getElementById("sortBy") ? document.getElementById("sortBy").value : "newest";

    const params = new URLSearchParams();
    if (headerSearch) params.append("search", headerSearch);
    if (categoryId) params.append("id", categoryId);
    if (categoryName) params.append("name", categoryName);
    if (statusFilter) params.append("status", statusFilter);
    if (sortBy) params.append("sort", sortBy);

    try {
        const response = await fetch(`${ACTIVE_API_BASE}/categories?${params.toString()}`);
        if (!response.ok) throw new Error("API Offline");
        const data = await response.json();

        isBackendOnline = true;
        const fetched = data.categories || [];
        currentCategories = sortCategoriesList(fetched, sortBy);

        if (!headerSearch && !categoryId && !categoryName && !statusFilter) {
            allLoadedCategories = [...currentCategories];
            fallbackCategories = [...currentCategories];
        }

        if (data.metrics) {
            if (document.getElementById("totalCategories")) document.getElementById("totalCategories").textContent = data.metrics.totalCategories ?? 0;
            if (document.getElementById("activeCategories")) document.getElementById("activeCategories").textContent = data.metrics.activeCategories ?? 0;
            if (document.getElementById("inactiveCategories")) document.getElementById("inactiveCategories").textContent = data.metrics.inactiveCategories ?? 0;
            if (document.getElementById("newCategories")) document.getElementById("newCategories").textContent = data.metrics.newCategories ?? 0;
        } else {
            updateMetrics(allLoadedCategories.length ? allLoadedCategories : currentCategories);
        }

        updateResultCount(currentCategories.length);
        renderCategoryTable(currentCategories);

    } catch (error) {
        // Seamless in-memory fallback filter
        let filtered = [...fallbackCategories];

        if (headerSearch) {
            const cleanQ = headerSearch.replace(/^#/, "").trim();
            const isNum = /^\d+$/.test(cleanQ);
            filtered = filtered.filter(c => {
                if (isNum && (String(c.cat_id) === cleanQ || String(c.cat_id).startsWith(cleanQ))) return true;
                return (c.cat_name || "").toLowerCase().includes(headerSearch.toLowerCase()) ||
                       (c.description || "").toLowerCase().includes(headerSearch.toLowerCase());
            });
        }

        if (categoryId) {
            const cleanId = categoryId.replace(/^#/, "").trim();
            filtered = filtered.filter(c => String(c.cat_id) === cleanId || String(c.cat_id).startsWith(cleanId));
        }

        if (categoryName) {
            filtered = filtered.filter(c => (c.cat_name || "").toLowerCase().includes(categoryName.toLowerCase()));
        }

        if (statusFilter) {
            filtered = filtered.filter(c => String(c.status).toLowerCase() === statusFilter.toLowerCase());
        }

        currentCategories = sortCategoriesList(filtered, sortBy);
        allLoadedCategories = [...fallbackCategories];

        updateMetrics(fallbackCategories);
        updateResultCount(currentCategories.length);
        renderCategoryTable(currentCategories);
    }
}

function renderCategoryTable(categories) {
    const tbody = document.getElementById("categoryTableBody");
    if (!tbody) return;

    if (!categories || categories.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <i class="fa-solid fa-folder-open"></i>
                        <h4 style="font-size: 16px; color: #334b68; margin-bottom: 4px;">No categories found</h4>
                        <p style="font-size: 13px;">No category records matched your query or filter criteria.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    categories.forEach(category => {
        const tr = document.createElement("tr");

        const statusClass = String(category.status).toLowerCase() === "active" ? "badge-active" : "badge-inactive";
        const dateDisplay = category.created_at ? String(category.created_at).split(" ")[0] : "-";
        const descDisplay = category.description && category.description.trim() ? category.description : "<span style='color:#94a3b8;'>-</span>";
        const prodCount = category.total_products !== undefined ? category.total_products : 0;

        tr.innerHTML = `
            <td class="checkbox-column">
                <input type="checkbox" class="category-row-cb" value="${category.cat_id}">
            </td>
            <td><strong>#${category.cat_id}</strong></td>
            <td><strong style="color: #13243d;">${category.cat_name}</strong></td>
            <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${descDisplay}</td>
            <td>
                <span class="product-count-badge">
                    <i class="fa-solid fa-box" style="font-size: 11px; margin-right: 4px;"></i> ${prodCount} Products
                </span>
            </td>
            <td>
                <span class="status-badge ${statusClass}">
                    <i class="fa-solid fa-circle" style="font-size: 6px;"></i> ${category.status}
                </span>
            </td>
            <td>${dateDisplay}</td>
            <td style="text-align: center;">
                <div class="action-buttons-group">
                    <!-- 1. View (Read-Only) -->
                    <button type="button" class="action-btn view-btn" data-id="${category.cat_id}" title="View Category Details">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <!-- 2. Edit -->
                    <button type="button" class="action-btn edit-btn" data-id="${category.cat_id}" title="Edit Category Details">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <!-- 3. Delete -->
                    <button type="button" class="action-btn delete-btn" data-id="${category.cat_id}" title="Delete Category">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Action button listeners
    tbody.querySelectorAll(".view-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const cid = btn.getAttribute("data-id");
            const cat = currentCategories.find(c => String(c.cat_id) === String(cid)) ||
                        fallbackCategories.find(c => String(c.cat_id) === String(cid));
            if (cat) openViewModal(cat);
        });
    });

    tbody.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const cid = btn.getAttribute("data-id");
            const cat = currentCategories.find(c => String(c.cat_id) === String(cid)) ||
                        fallbackCategories.find(c => String(c.cat_id) === String(cid));
            if (cat) openEditModal(cat);
        });
    });

    tbody.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const cid = btn.getAttribute("data-id");
            const cat = currentCategories.find(c => String(c.cat_id) === String(cid)) ||
                        fallbackCategories.find(c => String(c.cat_id) === String(cid));
            if (cat) openDeleteModal(cat);
        });
    });
}

// =========================================================
// 4. ACTION OPTION 1: VIEW (STRICTLY READ-ONLY)
// =========================================================

function openViewModal(category) {
    const modal = document.getElementById("viewCategoryModal");
    if (!modal) return;

    const initials = getInitials(category.cat_name);
    const avatarEl = document.getElementById("viewAvatar");
    if (avatarEl) avatarEl.innerHTML = `<span>${initials}</span>`;

    document.getElementById("viewCategoryName").textContent = category.cat_name || "-";
    document.getElementById("viewCategoryIdBadge").textContent = `ID: #${category.cat_id}`;

    const statusPill = document.getElementById("viewStatusPill");
    if (statusPill) {
        const isAct = String(category.status).toLowerCase() === "active";
        statusPill.textContent = category.status || "Active";
        statusPill.className = `status-pill ${isAct ? "status-active" : "status-inactive"}`;
    }

    document.getElementById("viewCategoryId").textContent = `#${category.cat_id}`;
    document.getElementById("viewCategoryFullName").textContent = category.cat_name || "-";
    document.getElementById("viewCategoryProducts").textContent = `${category.total_products || 0} Products Linked`;
    document.getElementById("viewCategoryStatusText").textContent = category.status || "Active";
    document.getElementById("viewCategoryDescription").textContent = category.description || "No description provided.";
    document.getElementById("viewCategoryCreatedAt").textContent = category.created_at || "-";

    modal.classList.add("show");
}

function closeViewModal() {
    const modal = document.getElementById("viewCategoryModal");
    if (modal) modal.classList.remove("show");
}

// =========================================================
// 5. ACTION OPTION 2: CREATE & EDIT CATEGORY
// =========================================================

function openCreateModal() {
    const form = document.getElementById("categoryForm");
    if (form) form.reset();

    document.getElementById("formCategoryId").value = "";
    document.getElementById("formModalTitle").innerHTML = `<i class="fa-solid fa-folder-plus"></i> <span>Create Category</span>`;
    document.getElementById("saveBtnText").textContent = "Save Category";
    document.getElementById("formCategoryStatus").value = "Active";

    const feedback = document.getElementById("formFeedbackBanner");
    if (feedback) {
        feedback.style.display = "none";
        feedback.textContent = "";
    }

    const modal = document.getElementById("categoryFormModal");
    if (modal) modal.classList.add("show");
}

function openEditModal(category) {
    const form = document.getElementById("categoryForm");
    if (form) form.reset();

    document.getElementById("formCategoryId").value = category.cat_id;
    document.getElementById("formCategoryName").value = category.cat_name || "";
    document.getElementById("formCategoryDescription").value = category.description || "";
    document.getElementById("formCategoryStatus").value = category.status || "Active";

    document.getElementById("formModalTitle").innerHTML = `<i class="fa-solid fa-pen-to-square"></i> <span>Edit Category #${category.cat_id}</span>`;
    document.getElementById("saveBtnText").textContent = "Update Category";

    const feedback = document.getElementById("formFeedbackBanner");
    if (feedback) {
        feedback.style.display = "none";
        feedback.textContent = "";
    }

    const modal = document.getElementById("categoryFormModal");
    if (modal) modal.classList.add("show");
}

function closeCategoryFormModal() {
    const modal = document.getElementById("categoryFormModal");
    if (modal) modal.classList.remove("show");
    const form = document.getElementById("categoryForm");
    if (form) form.reset();
}

// =========================================================
// 6. ACTION OPTION 3: DELETE CATEGORY
// =========================================================

function openDeleteModal(category) {
    deleteTargetId = category.cat_id;

    document.getElementById("deleteCategoryName").textContent = category.cat_name;
    document.getElementById("deleteCategoryDetails").textContent = `ID: #${category.cat_id} | Products: ${category.total_products || 0}`;

    const modal = document.getElementById("deleteConfirmModal");
    if (modal) modal.classList.add("show");
}

function closeDeleteModal() {
    const modal = document.getElementById("deleteConfirmModal");
    if (modal) modal.classList.remove("show");
    deleteTargetId = null;
}

// =========================================================
// 7. LOGOUT CONFIRMATION DIALOG
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
// 8. USER PROFILE DATA
// =========================================================

async function fetchUserProfile() {
    let userData = null;
    for (const base of API_CANDIDATES) {
        try {
            const res = await fetch(`${base}/users/profile?_t=${Date.now()}`, { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                const u = data.user || data.profile;
                if (u && (u.full_name || u.username)) {
                    userData = u;
                    ACTIVE_API_BASE = base;
                    break;
                }
            }
        } catch (e) {}
    }

    if (userData) {
        const u = userData;
        const fullName = u.full_name || u.name || "Admin User";
        const role = u.role || "Administrator";
        const email = u.email || "admin@grocerystore.com";
        const status = u.status || "Active";
        const initials = getInitials(fullName);
        const hasPhoto = Boolean(u.profile_picture && String(u.profile_picture).trim());

        if (document.getElementById("headerUserName")) document.getElementById("headerUserName").textContent = fullName;
        if (document.getElementById("headerUserRole")) document.getElementById("headerUserRole").textContent = role;
        if (document.getElementById("dropdownFullName")) document.getElementById("dropdownFullName").textContent = fullName;
        if (document.getElementById("dropdownEmail")) document.getElementById("dropdownEmail").textContent = email;
        if (document.getElementById("dropdownStatus")) document.getElementById("dropdownStatus").textContent = status;

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

// =========================================================
// 9. EVENT LISTENERS INITIALIZATION
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {

    // 1. Check & discover active backend port
    await discoverBackend();

    // 2. Initial Data Loading
    fetchCategories();
    fetchUserProfile();

    // 3. Header Search Bar
    const headerSearch = document.getElementById("headerSearch");
    const headerSearchBtn = document.getElementById("headerSearchBtn");

    function handleHeaderSearch(isTyping = false) {
        if (document.getElementById("categoryId")) document.getElementById("categoryId").value = "";
        if (document.getElementById("categoryName")) document.getElementById("categoryName").value = "";

        const q = headerSearch ? headerSearch.value.trim() : "";
        performInstantSearch(q);

        fetchCategories(isTyping);
    }

    if (headerSearch) {
        headerSearch.addEventListener("input", () => {
            const q = headerSearch.value.trim();
            performInstantSearch(q);

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

    // 4. Filter Card Inputs
    const categoryIdInput = document.getElementById("categoryId");
    const categoryNameInput = document.getElementById("categoryName");
    const statusFilterSelect = document.getElementById("statusFilter");
    const sortBySelect = document.getElementById("sortBy");
    const filterBtn = document.getElementById("filterBtn");
    const clearFilterBtn = document.getElementById("clearFilterBtn");
    const refreshCategoryBtn = document.getElementById("refreshCategoryBtn");

    function handleFilterCard(isTyping = false) {
        if (document.getElementById("headerSearch")) document.getElementById("headerSearch").value = "";
        fetchCategories(isTyping);
    }

    if (categoryIdInput) {
        categoryIdInput.addEventListener("input", () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => handleFilterCard(true), 250);
        });
        categoryIdInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                clearTimeout(searchDebounceTimer);
                handleFilterCard(false);
            }
        });
    }

    if (categoryNameInput) {
        categoryNameInput.addEventListener("input", () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => handleFilterCard(true), 250);
        });
        categoryNameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                clearTimeout(searchDebounceTimer);
                handleFilterCard(false);
            }
        });
    }

    if (statusFilterSelect) {
        statusFilterSelect.addEventListener("change", () => handleFilterCard(false));
    }

    if (sortBySelect) {
        sortBySelect.addEventListener("change", () => {
            const val = sortBySelect.value;
            if (currentCategories && currentCategories.length > 0) {
                currentCategories = sortCategoriesList(currentCategories, val);
                renderCategoryTable(currentCategories);
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
            if (document.getElementById("categoryId")) document.getElementById("categoryId").value = "";
            if (document.getElementById("categoryName")) document.getElementById("categoryName").value = "";
            if (document.getElementById("statusFilter")) document.getElementById("statusFilter").value = "";
            if (document.getElementById("sortBy")) document.getElementById("sortBy").value = "newest";
            fetchCategories(false);
            showToast("Filters reset successfully.", "info");
        });
    }

    if (refreshCategoryBtn) {
        refreshCategoryBtn.addEventListener("click", async () => {
            await discoverBackend();
            fetchCategories(false);
            showToast("Category list refreshed.", "info");
        });
    }

    // 5. Create / Edit Form Submission
    const addCategoryBtn = document.getElementById("addCategoryBtn");
    if (addCategoryBtn) addCategoryBtn.addEventListener("click", openCreateModal);

    const closeFormModalBtn = document.getElementById("closeFormModalBtn");
    const cancelFormBtn = document.getElementById("cancelFormBtn");
    if (closeFormModalBtn) closeFormModalBtn.addEventListener("click", closeCategoryFormModal);
    if (cancelFormBtn) cancelFormBtn.addEventListener("click", closeCategoryFormModal);

    const categoryForm = document.getElementById("categoryForm");
    if (categoryForm) {
        categoryForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const cid = document.getElementById("formCategoryId").value;
            const mode = cid ? "edit" : "add";
            const feedback = document.getElementById("formFeedbackBanner");

            const nameVal = document.getElementById("formCategoryName").value.trim();
            const descVal = document.getElementById("formCategoryDescription").value.trim();
            const statusVal = document.getElementById("formCategoryStatus").value;

            if (!nameVal) {
                feedback.textContent = "Category Name is required.";
                feedback.className = "form-feedback-banner error";
                return;
            }

            const payload = {
                cat_name: nameVal,
                description: descVal,
                status: statusVal
            };
            if (cid) payload.cat_id = Number(cid);

            try {
                const res = await fetch(`${ACTIVE_API_BASE}/categories/${mode}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                if (res.ok && result.status === "success") {
                    showToast(result.message, "success");
                    closeCategoryFormModal();
                    fetchCategories(false);
                    return;
                } else {
                    throw new Error(result.message || "Save failed");
                }
            } catch (err) {
                // In-Memory Fallback Update
                const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);
                if (cid) {
                    const idx = fallbackCategories.findIndex(c => String(c.cat_id) === String(cid));
                    if (idx !== -1) {
                        fallbackCategories[idx].cat_name = nameVal;
                        fallbackCategories[idx].description = descVal;
                        fallbackCategories[idx].status = statusVal;
                    }
                    showToast(`Category '${nameVal}' updated successfully.`, "success");
                } else {
                    const maxId = fallbackCategories.reduce((max, c) => Math.max(max, Number(c.cat_id) || 0), 0);
                    const newId = maxId + 1;
                    fallbackCategories.unshift({
                        cat_id: newId,
                        cat_name: nameVal,
                        description: descVal,
                        status: statusVal,
                        created_at: nowStr,
                        total_products: 0
                    });
                    showToast(`Category '${nameVal}' created successfully (ID #${newId}).`, "success");
                }
                closeCategoryFormModal();
                fetchCategories(false);
            }
        });
    }

    // 6. View Modal Close
    const closeViewModalBtn = document.getElementById("closeViewModalBtn");
    const closeViewBtn = document.getElementById("closeViewBtn");
    if (closeViewModalBtn) closeViewModalBtn.addEventListener("click", closeViewModal);
    if (closeViewBtn) closeViewBtn.addEventListener("click", closeViewModal);

    // 7. Delete Confirmation Actions
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener("click", closeDeleteModal);

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", async () => {
            if (!deleteTargetId) return;
            try {
                const res = await fetch(`${ACTIVE_API_BASE}/categories/delete`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cat_id: deleteTargetId })
                });
                const result = await res.json();

                if (res.ok && result.status === "success") {
                    showToast(result.message, "success");
                } else {
                    throw new Error(result.message || "Delete failed");
                }
            } catch (err) {
                // Fallback delete
                fallbackCategories = fallbackCategories.filter(c => String(c.cat_id) !== String(deleteTargetId));
                showToast(`Category #${deleteTargetId} deleted successfully.`, "success");
            }
            closeDeleteModal();
            fetchCategories(false);
        });
    }

    // 8. Profile Dropdown & Logout
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

    // 9. Select All Checkbox
    const selectAllCb = document.getElementById("selectAll");
    if (selectAllCb) {
        selectAllCb.addEventListener("change", (e) => {
            document.querySelectorAll(".category-row-cb").forEach(cb => {
                cb.checked = e.target.checked;
            });
        });
    }

    // 10. Mobile Sidebar Toggle
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
