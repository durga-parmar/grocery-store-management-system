/**
 * user_dash.js
 * Clean, Powerful & Instant Responsive JavaScript Controller for User Dashboard
 */

// 0. Multi-Candidate Automatic API Discovery
const API_CANDIDATES = [
    window.location.origin && window.location.origin.startsWith("http") ? `${window.location.origin}/api` : "",
    window.location.origin && window.location.origin.startsWith("http") ? `${window.location.origin}/demo/api` : "",
    "http://localhost:9007/api",
    "http://localhost:9010/api",
    "http://localhost:9008/api",
    "http://localhost:9009/api",
    "http://localhost:9013/api",
    "http://localhost:9000/api",
    "http://localhost:90/api",
    "http://localhost:90/demo/api",
    "http://localhost/demo/api",
    "http://localhost/api"
].filter(Boolean);

let API_BASE = API_CANDIDATES[0] || "http://localhost:9007/api";
let currentUsers = [];
let deleteTargetId = null;
let searchDebounceTimer = null;

async function discoverBackend() {
    for (const base of API_CANDIDATES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);
            const res = await fetch(`${base}/users?_t=${Date.now()}`, {
                signal: controller.signal,
                cache: "no-store"
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                API_BASE = base;
                console.log(`[User Dashboard] Connected to backend API at: ${API_BASE}`);
                return API_BASE;
            }
        } catch (e) {
            // Try next candidate
        }
    }
    return API_BASE;
}

// 1. Generate Name Initials
function getInitials(name) {
    if (!name) return "US";
    const p = name.trim().split(/\s+/);
    if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
    return p[0].substring(0, 2).toUpperCase();
}

// 2. Generate Avatar Color
function getAvatarColor(name) {
    const colors = ["#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4", "#6366f1"];
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

// 3. Toast Notifications
function showToast(msg, type = "success") {
    const box = document.getElementById("toastContainer");
    if (!box) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icon = type === "error" ? "fa-circle-xmark" : (type === "info" ? "fa-circle-info" : "fa-circle-check");
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><div class="toast-content">${msg}</div>`;
    box.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 4. Sort Users Array (Client-Side & Hybrid)
function sortUsersList(list, sortType) {
    const arr = [...list];
    if (sortType === "name_asc") {
        return arr.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", undefined, { sensitivity: "base" }));
    } else if (sortType === "name_desc") {
        return arr.sort((a, b) => (b.full_name || "").localeCompare(a.full_name || "", undefined, { sensitivity: "base" }));
    } else if (sortType === "oldest") {
        return arr.sort((a, b) => Number(a.id) - Number(b.id));
    } else {
        // default newest (highest id first)
        return arr.sort((a, b) => Number(b.id) - Number(a.id));
    }
}

// 5. Fetch Users from Backend MySQL API
async function fetchUsers() {
    const tbody = document.getElementById("userTableBody");
    const headerSearch = document.getElementById("headerSearch") ? document.getElementById("headerSearch").value.trim() : "";
    const searchId = document.getElementById("searchId") ? document.getElementById("searchId").value.trim() : "";
    const searchName = document.getElementById("searchName") ? document.getElementById("searchName").value.trim() : "";
    const selectStatus = document.getElementById("selectStatus") ? document.getElementById("selectStatus").value : "";
    const selectSort = document.getElementById("selectSort") ? document.getElementById("selectSort").value : "newest";

    const params = new URLSearchParams();
    if (headerSearch) params.append("search", headerSearch);
    if (searchId) params.append("id", searchId);
    if (searchName) params.append("name", searchName);
    if (selectStatus) params.append("status", selectStatus);
    if (selectSort) params.append("sort", selectSort);
    params.append("_t", Date.now());

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:#22c55e;"></i><p style="margin-top:10px; color:#64748b;">Loading user records from database...</p></td></tr>`;
    }

    try {
        let res = await fetch(`${API_BASE}/users?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) {
            await discoverBackend();
            res = await fetch(`${API_BASE}/users?${params.toString()}`, { cache: "no-store" });
        }
        if (!res.ok) throw new Error("Failed to load users");
        const data = await res.json();
        
        // Store raw users
        currentUsers = data.users || [];

        // Apply Client-Side Sort to guarantee perfect sorting order
        currentUsers = sortUsersList(currentUsers, selectSort);

        // Update Summary Cards
        if (data.metrics) {
            if (document.getElementById("total-users")) document.getElementById("total-users").textContent = data.metrics.totalUsers;
            if (document.getElementById("active-users")) document.getElementById("active-users").textContent = data.metrics.activeUsers;
            if (document.getElementById("inactive-users")) document.getElementById("inactive-users").textContent = data.metrics.inactiveUsers;
            if (document.getElementById("new-users")) document.getElementById("new-users").textContent = data.metrics.newUsers;
        }

        // Update Result Text
        const resultText = document.getElementById("searchResultText");
        if (resultText) {
            resultText.textContent = `Showing ${currentUsers.length} user${currentUsers.length === 1 ? "" : "s"}`;
        }

        // Render Table Rows
        renderUserTable(currentUsers);
    } catch (err) {
        console.error("fetchUsers error:", err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:40px; color:#ef4444;"><i class="fa-solid fa-circle-exclamation" style="font-size:28px;"></i><p style="margin-top:10px;">Backend connection error. Make sure Python backend or Apache is running.</p></td></tr>`;
        }
    }
}

// 6. Render Table HTML
function renderUserTable(users) {
    const tbody = document.getElementById("userTableBody");
    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10"><div class="empty-data"><i class="fa-solid fa-users-slash" style="font-size:32px; color:#94a3b8;"></i><h2>No users found</h2><p>No records matched your search/filter criteria.</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = "";
    users.forEach(user => {
        const tr = document.createElement("tr");
        const initials = getInitials(user.full_name);
        const bg = getAvatarColor(user.full_name);
        const statusClass = user.status === "Active" ? "badge-active" : "badge-inactive";
        const dateOnly = user.create_at ? user.create_at.split(" ")[0] : "?";
        const address = user.address && user.address.trim() ? user.address : "<span style='color:#94a3b8;'>?</span>";

        let avatarHtml = `<div class="user-avatar" style="background:${bg};"><span>${initials}</span></div>`;
        if (user.profile_picture) {
            avatarHtml = `<div class="user-avatar"><img src="${user.profile_picture}" alt="${user.full_name}"></div>`;
        }

        tr.innerHTML = `
            <td><input type="checkbox" class="user-row-checkbox" value="${user.id}"></td>
            <td><strong>#${user.id}</strong></td>
            <td>
                <div class="user-cell">
                    ${avatarHtml}
                    <div class="user-meta">
                        <span class="user-name">${user.full_name}</span>
                        <span class="user-username">@${user.username}</span>
                    </div>
                </div>
            </td>
            <td>${user.email}</td>
            <td>${user.mobile}</td>
            <td>${address}</td>
            <td><span class="role-badge">${user.role || "User"}</span></td>
            <td><span class="status-badge ${statusClass}"><i class="fa-solid fa-circle" style="font-size:6px;"></i> ${user.status}</span></td>
            <td>${dateOnly}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view-btn" data-id="${user.id}" title="View Complete Profile"><i class="fa-solid fa-eye"></i></button>
                    <button class="action-btn edit-btn" data-id="${user.id}" title="Edit User Information"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn delete-btn" data-id="${user.id}" title="Delete User"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll(".view-btn").forEach(btn => {
        btn.onclick = () => {
            const uid = btn.getAttribute("data-id");
            const u = currentUsers.find(x => x.id == uid);
            if (u) openViewModal(u);
        };
    });

    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.onclick = () => {
            const uid = btn.getAttribute("data-id");
            const u = currentUsers.find(x => x.id == uid);
            if (u) openEditModal(u);
        };
    });

    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.onclick = () => {
            const uid = btn.getAttribute("data-id");
            const u = currentUsers.find(x => x.id == uid);
            if (u) openDeleteModal(u);
        };
    });
}

// 7. View User Modal (Only displays data)
function openViewModal(user) {
    const initials = getInitials(user.full_name);
    const bg = getAvatarColor(user.full_name);
    const avatarBox = document.getElementById("viewAvatar");
    if (user.profile_picture) {
        avatarBox.innerHTML = `<img src="${user.profile_picture}" alt="${user.full_name}">`;
    } else {
        avatarBox.style.background = bg;
        avatarBox.innerHTML = `<span>${initials}</span>`;
    }

    document.getElementById("viewFullName").textContent = user.full_name;
    document.getElementById("viewUsername").textContent = `@${user.username}`;
    document.getElementById("viewRole").textContent = user.role || "User";

    const st = document.getElementById("viewStatus");
    st.textContent = user.status;
    st.className = `status-badge ${user.status === "Active" ? "badge-active" : "badge-inactive"}`;

    document.getElementById("viewId").textContent = `#${user.id}`;
    document.getElementById("viewEmail").textContent = user.email;
    document.getElementById("viewMobile").textContent = user.mobile;
    document.getElementById("viewAddress").textContent = user.address || "Not Provided";
    document.getElementById("viewRoleDetail").textContent = user.role || "Cashier";
    document.getElementById("viewCreatedAt").textContent = user.create_at || "?";

    document.getElementById("viewUserModal").classList.add("show");
}

function closeViewModal() {
    document.getElementById("viewUserModal").classList.remove("show");
}

// 8. Add / Edit Modals
function openAddModal() {
    const form = document.getElementById("userForm");
    form.reset();
    document.getElementById("userId").value = "";
    document.getElementById("modalTitle").innerHTML = `<i class="fa-solid fa-user-plus"></i> Add New User`;
    document.getElementById("passwordLabel").innerHTML = `Password <span class="required">*</span>`;
    document.getElementById("passwordVal").required = true;
    document.getElementById("passwordVal").placeholder = "Enter secure password";
    document.getElementById("passwordHelp").style.display = "none";
    document.getElementById("modalFormMessage").style.display = "none";
    document.getElementById("userModal").classList.add("show");
}

function openEditModal(user) {
    const form = document.getElementById("userForm");
    form.reset();
    document.getElementById("userId").value = user.id;
    document.getElementById("fullName").value = user.full_name;
    document.getElementById("usernameVal").value = user.username;
    document.getElementById("emailVal").value = user.email;
    document.getElementById("mobileVal").value = user.mobile;
    document.getElementById("addressVal").value = user.address || "";
    document.getElementById("roleVal").value = user.role || "Cashier";
    document.getElementById("statusVal").value = user.status || "Active";
    document.getElementById("passwordVal").value = "";
    document.getElementById("passwordVal").required = false;
    document.getElementById("passwordVal").placeholder = "Leave blank to keep current password";
    document.getElementById("passwordLabel").innerHTML = `Password <small style="color:#64748b;">(Optional)</small>`;
    document.getElementById("passwordHelp").style.display = "block";
    document.getElementById("modalTitle").innerHTML = `<i class="fa-solid fa-user-pen"></i> Edit User #${user.id}`;
    document.getElementById("modalFormMessage").style.display = "none";
    document.getElementById("userModal").classList.add("show");
}

function closeUserModal() {
    document.getElementById("userModal").classList.remove("show");
    document.getElementById("userForm").reset();
}

// 9. Delete Modal
function openDeleteModal(user) {
    deleteTargetId = user.id;
    document.getElementById("deleteTargetName").textContent = `${user.full_name} (@${user.username})`;
    document.getElementById("deleteTargetDetails").textContent = `User ID: #${user.id} | Email: ${user.email}`;
    document.getElementById("deleteConfirmModal").classList.add("show");
}

function closeDeleteModal() {
    document.getElementById("deleteConfirmModal").classList.remove("show");
    deleteTargetId = null;
}

// 10. Initialize Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    // Header Search Input
    const headerSearch = document.getElementById("headerSearch");
    const headerSearchBtn = document.getElementById("headerSearchBtn");

    function onHeaderSearch() {
        if (document.getElementById("searchId")) document.getElementById("searchId").value = "";
        if (document.getElementById("searchName")) document.getElementById("searchName").value = "";
        fetchUsers();
    }

    if (headerSearch) {
        // Live typing search with 250ms debounce
        headerSearch.addEventListener("input", () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(onHeaderSearch, 250);
        });

        // Search immediately on Enter
        headerSearch.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                clearTimeout(searchDebounceTimer);
                onHeaderSearch();
            }
        });
    }

    if (headerSearchBtn) {
        headerSearchBtn.addEventListener("click", () => {
            clearTimeout(searchDebounceTimer);
            onHeaderSearch();
        });
    }

    // Filter Card Inputs
    const searchIdInput = document.getElementById("searchId");
    const searchNameInput = document.getElementById("searchName");
    const selectStatus = document.getElementById("selectStatus");
    const selectSort = document.getElementById("selectSort");
    const filterBtn = document.getElementById("filterBtn");
    const clearFilterBtn = document.getElementById("clearFilterBtn");
    const refreshListBtn = document.getElementById("refreshListBtn");

    function onFilterCardAction() {
        if (document.getElementById("headerSearch")) document.getElementById("headerSearch").value = "";
        fetchUsers();
    }

    // Live User ID filter
    if (searchIdInput) {
        searchIdInput.addEventListener("input", () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(onFilterCardAction, 250);
        });
        searchIdInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                clearTimeout(searchDebounceTimer);
                onFilterCardAction();
            }
        });
    }

    // Live Customer Name filter
    if (searchNameInput) {
        searchNameInput.addEventListener("input", () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(onFilterCardAction, 250);
        });
        searchNameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                clearTimeout(searchDebounceTimer);
                onFilterCardAction();
            }
        });
    }

    // Instant Filter on Status Change
    if (selectStatus) {
        selectStatus.addEventListener("change", () => {
            onFilterCardAction();
        });
    }

    // Instant Sort on Sort Dropdown Change (A-Z, Z-A, Newest, Oldest)
    if (selectSort) {
        selectSort.addEventListener("change", () => {
            const sortVal = selectSort.value;
            // 1. Instantly re-sort currently loaded table rows (0ms response)
            if (currentUsers && currentUsers.length > 0) {
                currentUsers = sortUsersList(currentUsers, sortVal);
                renderUserTable(currentUsers);
            }
            // 2. Synchronize with backend API
            onFilterCardAction();
        });
    }

    // Filter Button Click
    if (filterBtn) {
        filterBtn.addEventListener("click", () => {
            clearTimeout(searchDebounceTimer);
            onFilterCardAction();
        });
    }

    // Clear Button Click
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener("click", () => {
            clearTimeout(searchDebounceTimer);
            if (document.getElementById("headerSearch")) document.getElementById("headerSearch").value = "";
            if (document.getElementById("searchId")) document.getElementById("searchId").value = "";
            if (document.getElementById("searchName")) document.getElementById("searchName").value = "";
            if (document.getElementById("selectStatus")) document.getElementById("selectStatus").value = "";
            if (document.getElementById("selectSort")) document.getElementById("selectSort").value = "newest";
            fetchUsers();
            showToast("Filters cleared.", "info");
        });
    }

    // Refresh Button Click
    if (refreshListBtn) {
        refreshListBtn.addEventListener("click", () => {
            fetchUsers();
            showToast("List refreshed.", "info");
        });
    }

    // Form Submit (Add / Edit)
    const userForm = document.getElementById("userForm");
    if (userForm) {
        userForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const uid = document.getElementById("userId").value;
            const mode = uid ? "edit" : "add";
            const mobileVal = document.getElementById("mobileVal").value.trim();

            const payload = {
                full_name: document.getElementById("fullName").value.trim(),
                username: document.getElementById("usernameVal").value.trim(),
                email: document.getElementById("emailVal").value.trim(),
                mobile: mobileVal,
                mobail: mobileVal,
                address: document.getElementById("addressVal").value.trim(),
                role: document.getElementById("roleVal").value,
                status: document.getElementById("statusVal").value,
                password: document.getElementById("passwordVal").value
            };
            if (uid) payload.id = uid;

            const msgEl = document.getElementById("modalFormMessage");
            try {
                const res = await fetch(`${API_BASE}/users/${mode}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok && data.status === "success") {
                    showToast(data.message, "success");
                    closeUserModal();
                    fetchUsers();
                } else {
                    msgEl.textContent = data.message || "Failed to save.";
                    msgEl.className = "modal-message error";
                    msgEl.style.display = "block";
                }
            } catch (err) {
                msgEl.textContent = "Server error occurred.";
                msgEl.className = "modal-message error";
                msgEl.style.display = "block";
            }
        });
    }

    // Confirm Delete
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", async () => {
            if (!deleteTargetId) return;
            try {
                const res = await fetch(`${API_BASE}/users/delete`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: deleteTargetId })
                });
                const data = await res.json();
                if (res.ok && data.status === "success") {
                    showToast(data.message, "success");
                    closeDeleteModal();
                    fetchUsers();
                } else {
                    showToast(data.message || "Delete failed", "error");
                }
            } catch (err) {
                showToast("Server error during deletion", "error");
            }
        });
    }

    // Modal Triggers
    const addUserBtn = document.getElementById("addUserBtn");
    if (addUserBtn) addUserBtn.addEventListener("click", openAddModal);

    const closeModal = document.getElementById("closeModal");
    const cancelBtn = document.getElementById("cancelBtn");
    if (closeModal) closeModal.addEventListener("click", closeUserModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeUserModal);

    const closeView = document.getElementById("closeViewModal");
    const closeViewB = document.getElementById("closeViewBtn");
    if (closeView) closeView.addEventListener("click", closeViewModal);
    if (closeViewB) closeViewB.addEventListener("click", closeViewModal);

    const cancelDel = document.getElementById("cancelDeleteBtn");
    if (cancelDel) cancelDel.addEventListener("click", closeDeleteModal);

    // Profile Dropdown & Dynamic Loading
    async function fetchHeaderProfile() {
        try {
            const res = await fetch(`${API_BASE}/users/profile?_t=${Date.now()}`, { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                const u = data.user || data.profile;
                if (u) {
                    const initials = getInitials(u.full_name);
                    const color = getAvatarColor(u.full_name);

                    const headerAvatar = document.getElementById("headerAvatar");
                    const headerUserName = document.getElementById("headerUserName");
                    const headerUserRole = document.getElementById("headerUserRole");
                    const dropdownAvatar = document.getElementById("dropdownAvatar");
                    const dropdownFullName = document.getElementById("dropdownFullName");
                    const dropdownEmail = document.getElementById("dropdownEmail");
                    const dropdownStatusBadge = document.getElementById("dropdownStatusBadge");

                    if (headerAvatar) {
                        if (u.profile_picture && u.profile_picture.trim()) {
                            headerAvatar.innerHTML = `<img src="${u.profile_picture}" alt="${u.full_name}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                            headerAvatar.style.background = "transparent";
                        } else {
                            headerAvatar.style.background = color;
                            headerAvatar.innerHTML = `<span>${initials}</span>`;
                        }
                    }
                    if (headerUserName) headerUserName.textContent = u.full_name || "Admin User";
                    if (headerUserRole) headerUserRole.textContent = u.role || "Administrator";

                    if (dropdownAvatar) {
                        if (u.profile_picture && u.profile_picture.trim()) {
                            dropdownAvatar.innerHTML = `<img src="${u.profile_picture}" alt="${u.full_name}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                            dropdownAvatar.style.background = "transparent";
                        } else {
                            dropdownAvatar.style.background = color;
                            dropdownAvatar.innerHTML = `<span>${initials}</span>`;
                        }
                    }
                    if (dropdownFullName) dropdownFullName.textContent = u.full_name || "Admin User";
                    if (dropdownEmail) dropdownEmail.textContent = u.email || "admin@example.com";
                    if (dropdownStatusBadge) {
                        dropdownStatusBadge.textContent = u.status || "Active";
                        dropdownStatusBadge.className = `dropdown-badge ${String(u.status).toLowerCase() === 'active' ? 'badge-active' : 'badge-inactive'}`;
                    }
                }
            }
        } catch (err) {
            console.warn("Error loading user profile:", err);
        }
    }

    const profileTrigger = document.getElementById("profileTrigger");
    const dropdownWrapper = document.getElementById("profileDropdownWrapper");
    if (profileTrigger && dropdownWrapper) {
        profileTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdownWrapper.classList.toggle("open");
        });
        document.addEventListener("click", (e) => {
            if (!dropdownWrapper.contains(e.target)) {
                dropdownWrapper.classList.remove("open");
            }
        });
    }

    // Logout Modal Handling
    const dropdownLogoutBtn = document.getElementById("dropdownLogoutBtn");
    const logoutModal = document.getElementById("logoutConfirmModal");
    const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
    const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");

    if (dropdownLogoutBtn && logoutModal) {
        dropdownLogoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (dropdownWrapper) dropdownWrapper.classList.remove("open");
            logoutModal.classList.add("show");
        });
    }

    if (cancelLogoutBtn && logoutModal) {
        cancelLogoutBtn.addEventListener("click", () => {
            logoutModal.classList.remove("show");
        });
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

    // Select All
    const selectAll = document.getElementById("selectAllUsers");
    if (selectAll) {
        selectAll.addEventListener("change", (e) => {
            document.querySelectorAll(".user-row-checkbox").forEach(cb => cb.checked = e.target.checked);
        });
    }

    // Initial Load
    (async () => {
        await discoverBackend();
        fetchHeaderProfile();
        fetchUsers();
    })();
});
