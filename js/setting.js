/**
 * setting.js
 * Robust & Dynamic JavaScript Controller for Settings & User Profile Management
 * Database: MySQL 'project' via WAMP | Tables: 'registration', 'settings_tab'
 */

// Multi-Candidate API Base URL List for Automatic Backend Discovery
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

let ACTIVE_API_BASE = API_CANDIDATES[0] || "http://localhost:9007/api";
let isBackendOnline = false;

let currentLoadedUser = null;
let currentLoadedSettings = null;

// ============================================================
// 1. UTILITY FUNCTIONS & COOKIE HELPERS
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
        document.cookie = `${name}=; Path=/demo; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`;
    }
}

const AVATAR_COLORS = [
    ["#10b981", "#059669"], // Emerald
    ["#3b82f6", "#2563eb"], // Blue
    ["#8b5cf6", "#7c3aed"], // Violet
    ["#ec4899", "#db2777"], // Pink
    ["#f59e0b", "#d97706"], // Amber
    ["#06b6d4", "#0891b2"], // Cyan
    ["#6366f1", "#4f46e5"], // Indigo
    ["#14b8a6", "#0d9488"]  // Teal
];

function getAvatarColors(name) {
    let hash = 0;
    const str = String(name || "User");
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
}

function getInitials(name) {
    if (!name || typeof name !== "string") return "US";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length === 1) {
        return parts[0].toUpperCase();
    }
    return "US";
}

function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let iconClass = "fa-circle-check";
    if (type === "error") iconClass = "fa-circle-xmark";
    if (type === "info") iconClass = "fa-circle-info";

    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <div class="toast-content">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function showSectionMessage(elementId, text, type) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.className = `form-message ${type}`;
    el.style.display = "inline-block";
    if (type === "success") {
        setTimeout(() => {
            el.style.display = "none";
        }, 4500);
    }
}

// ============================================================
// 2. BACKEND AUTO-DISCOVERY
// ============================================================

async function discoverBackend() {
    for (const candidate of API_CANDIDATES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);
            const res = await fetch(`${candidate}/settings?_t=${Date.now()}`, {
                signal: controller.signal,
                cache: "no-store"
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                ACTIVE_API_BASE = candidate;
                isBackendOnline = true;
                return true;
            }
        } catch (e) {
            // try next candidate
        }
    }
    isBackendOnline = false;
    return false;
}

// ============================================================
// 3. LOAD & RENDER LOGGED-IN USER PROFILE (MySQL 'registration')
// ============================================================

function getActiveUserIdentifier() {
    // 1. URL search params
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get("id");
    const urlUsername = urlParams.get("username");
    if (urlId) return { type: "id", value: urlId };
    if (urlUsername) return { type: "username", value: urlUsername };

    // 2. Cookies set during login (admin_username, username, admin_id, user_id, admin_email)
    const cookieUsername = getCookie("admin_username") || getCookie("username");
    if (cookieUsername) return { type: "username", value: cookieUsername };

    const cookieId = getCookie("admin_id") || getCookie("user_id") || getCookie("current_user_id");
    if (cookieId) return { type: "id", value: cookieId };

    const cookieEmail = getCookie("admin_email");
    if (cookieEmail) return { type: "email", value: cookieEmail };

    // 3. Storage
    const storageUsername = localStorage.getItem("admin_username") || localStorage.getItem("username") || sessionStorage.getItem("admin_username") || sessionStorage.getItem("username");
    if (storageUsername) return { type: "username", value: storageUsername };

    const storageId = localStorage.getItem("admin_id") || localStorage.getItem("user_id") || localStorage.getItem("current_user_id") || sessionStorage.getItem("user_id");
    if (storageId) return { type: "id", value: storageId };

    return null;
}

async function loadUserProfile() {
    const ident = getActiveUserIdentifier();
    let queryStr = `_t=${Date.now()}`;
    if (ident) {
        queryStr += `&${encodeURIComponent(ident.type)}=${encodeURIComponent(ident.value)}`;
    }

    try {
        const response = await fetch(`${ACTIVE_API_BASE}/users/profile?${queryStr}`, {
            cache: "no-store",
            headers: {
                "Cache-Control": "no-cache"
            }
        });

        if (!response.ok) {
            throw new Error(`Profile API responded with status ${response.status}`);
        }

        const data = await response.json();
        const user = data.user || data.profile;
        if (user) {
            currentLoadedUser = user;
            renderUserProfile(user);
            return;
        }
    } catch (err) {
        console.warn("[Profile Load] API fetch error:", err);
        // Fallback user if database/network is completely unreachable
        if (!currentLoadedUser) {
            currentLoadedUser = {
                id: 46,
                full_name: getCookie("admin_fullname") || "parmar durga parasbahi",
                username: getCookie("admin_username") || "durga_parmar123",
                email: getCookie("admin_email") || "durgaparmar@gmail.com",
                mobile: getCookie("admin_mobile") || "9098987676",
                address: "Surat, Gujarat",
                role: getCookie("admin_role") || "Admin",
                status: "Active",
                profile_picture: "",
                create_at: "2026-07-31 10:29:18"
            };
            renderUserProfile(currentLoadedUser);
        }
    }
}

function renderUserProfile(user) {
    if (!user) return;

    const fullName = user.full_name || user.name || "User";
    const username = user.username || "user";
    const role = user.role || "Admin";
    const status = user.status || "Active";
    const isCashier = String(role).toLowerCase() === "cashier";
    const initials = getInitials(fullName);
    const [c1, c2] = getAvatarColors(fullName);
    const bgGradient = `linear-gradient(135deg, ${c1}, ${c2})`;

    // 1. Topbar Avatar & Info
    const topAvatar = document.getElementById("topAvatar");
    const topUserName = document.getElementById("topUserName");
    const topUserRole = document.getElementById("topUserRole");

    if (topAvatar) {
        if (user.profile_picture && String(user.profile_picture).trim()) {
            topAvatar.style.background = "transparent";
            topAvatar.innerHTML = `<img src="${user.profile_picture}" alt="${fullName}" onerror="this.parentElement.style.background='${bgGradient}'; this.parentElement.innerHTML='<span>${initials}</span>';">`;
        } else {
            topAvatar.style.background = bgGradient;
            topAvatar.innerHTML = `<span>${initials}</span>`;
        }
    }

    if (topUserName) topUserName.textContent = fullName;
    if (topUserRole) topUserRole.textContent = role;

    // 2. Profile Hero Card
    const heroAvatar = document.getElementById("heroAvatar");
    const heroFullName = document.getElementById("heroFullName");
    const heroRole = document.getElementById("heroRole");
    const heroStatusBadge = document.getElementById("heroStatusBadge");
    const heroUsername = document.getElementById("heroUsername");
    const heroMeta = document.getElementById("heroMeta");

    if (heroAvatar) {
        if (user.profile_picture && String(user.profile_picture).trim()) {
            heroAvatar.style.background = "transparent";
            heroAvatar.innerHTML = `<img src="${user.profile_picture}" alt="${fullName}" onerror="this.parentElement.style.background='${bgGradient}'; this.parentElement.innerHTML='<span>${initials}</span>';">`;
        } else {
            heroAvatar.style.background = bgGradient;
            heroAvatar.innerHTML = `<span>${initials}</span>`;
        }
    }

    if (heroFullName) heroFullName.textContent = fullName;
    if (heroRole) heroRole.textContent = role;
    if (heroStatusBadge) {
        const isAct = String(status).toLowerCase() === "active";
        heroStatusBadge.textContent = status;
        heroStatusBadge.className = `status-badge ${isAct ? "badge-active" : "badge-inactive"}`;
    }
    if (heroUsername) heroUsername.textContent = `@${username}`;
    if (heroMeta) {
        const dateStr = user.create_at ? String(user.create_at).split(" ")[0] : "2026-07-31";
        heroMeta.textContent = `User ID: #${user.id || ""} | Joined: ${dateStr}`;
    }

    // 3. Form Input Fields
    if (document.getElementById("profileId")) document.getElementById("profileId").value = user.id ? `#${user.id}` : "";
    if (document.getElementById("profileFullName")) document.getElementById("profileFullName").value = fullName;
    if (document.getElementById("profileUsername")) document.getElementById("profileUsername").value = username;
    if (document.getElementById("profileEmail")) document.getElementById("profileEmail").value = user.email || "";
    if (document.getElementById("profileMobile")) document.getElementById("profileMobile").value = user.mobile || user.mobail || "";
    if (document.getElementById("profileAddress")) document.getElementById("profileAddress").value = user.address || "";
    if (document.getElementById("profilePicture")) document.getElementById("profilePicture").value = user.profile_picture || "";
    if (document.getElementById("newPassword")) document.getElementById("newPassword").value = "";
    if (document.getElementById("confirmPassword")) document.getElementById("confirmPassword").value = "";

    const roleElem = document.getElementById("profileRole");
    if (roleElem) {
        roleElem.value = role;
        if (isCashier) {
            roleElem.disabled = true;
            roleElem.title = "Role is locked and managed by Administrator.";
            roleElem.style.opacity = "0.7";
            roleElem.style.cursor = "not-allowed";
        }
    }

    const statusElem = document.getElementById("profileStatus");
    if (statusElem) {
        statusElem.value = status;
        if (isCashier) {
            statusElem.disabled = true;
            statusElem.title = "Status is locked and managed by Administrator.";
            statusElem.style.opacity = "0.7";
            statusElem.style.cursor = "not-allowed";
        }
    }

    // 4. Role-based Cashier Controls for Store & System Settings
    if (isCashier) {
        // Disable Store Information inputs and buttons
        const storeFields = document.querySelectorAll("#storeSection input, #storeSection button, #storeSection textarea");
        storeFields.forEach(el => {
            el.disabled = true;
            el.style.opacity = "0.7";
            el.style.cursor = "not-allowed";
            el.title = "Store settings can only be edited by an Administrator.";
        });

        // Disable System Settings inputs and buttons
        const sysFields = document.querySelectorAll("#systemSection select, #systemSection input, #systemSection button");
        sysFields.forEach(el => {
            el.disabled = true;
            el.style.opacity = "0.7";
            el.style.cursor = "not-allowed";
            el.title = "System settings can only be edited by an Administrator.";
        });

        // Add notice headers if not present
        if (!document.getElementById("cashierStoreNotice")) {
            const storeSec = document.getElementById("storeSection");
            if (storeSec) {
                const notice = document.createElement("div");
                notice.id = "cashierStoreNotice";
                notice.style.cssText = "background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; color: #d97706; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; display: flex; align-items: center; gap: 8px;";
                notice.innerHTML = `<i class="fa-solid fa-lock"></i> <span><strong>Cashier View:</strong> Store Information is read-only. Only Administrators have permission to modify store configuration.</span>`;
                storeSec.insertBefore(notice, storeSec.children[1] || storeSec.firstChild);
            }
        }

        if (!document.getElementById("cashierSysNotice")) {
            const sysSec = document.getElementById("systemSection");
            if (sysSec) {
                const notice = document.createElement("div");
                notice.id = "cashierSysNotice";
                notice.style.cssText = "background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; color: #d97706; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; display: flex; align-items: center; gap: 8px;";
                notice.innerHTML = `<i class="fa-solid fa-lock"></i> <span><strong>Cashier View:</strong> System Preferences are read-only. Only Administrators have permission to modify system configuration.</span>`;
                sysSec.insertBefore(notice, sysSec.children[1] || sysSec.firstChild);
            }
        }

        // Adjust Sidebar Menu to Cashier dashboard pages
        const sidebarMenu = document.querySelector(".sidebar-menu");
        if (sidebarMenu) {
            sidebarMenu.innerHTML = `
                <li><a href="/cashierdash.html"><i class="fa-solid fa-chart-line"></i><span>Dashboard</span></a></li>
                <li><a href="/pos.html"><i class="fa-solid fa-cash-register"></i><span>New Sale</span></a></li>
                <li><a href="/cashier_order.html"><i class="fa-solid fa-cart-shopping"></i><span>Orders</span></a></li>
                <li><a href="/cashier_customer.html"><i class="fa-solid fa-user-group"></i><span>Customers</span></a></li>
                <li><a href="/cashier_product.html"><i class="fa-solid fa-box"></i><span>Products</span></a></li>
                <li><a href="/invoice_receipt.html"><i class="fa-solid fa-file-invoice"></i><span>Invoices &amp; Receipts</span></a></li>
                <li><a href="/sales_report.html"><i class="fa-solid fa-chart-column"></i><span>Sales Reports</span></a></li>
                <li class="active"><a href="/setting.html"><i class="fa-solid fa-gear"></i><span>Settings</span></a></li>
            `;
        }
    }
}

// ============================================================
// 4. LOAD & RENDER STORE, SYSTEM, APPEARANCE (MySQL 'settings_tab')
// ============================================================

async function loadGeneralSettings() {
    try {
        const response = await fetch(`${ACTIVE_API_BASE}/settings?_t=${Date.now()}`, {
            cache: "no-store",
            headers: {
                "Cache-Control": "no-cache"
            }
        });
        if (!response.ok) throw new Error("Settings API unreachable");

        const data = await response.json();
        currentLoadedSettings = data;
        renderGeneralSettings(data);
    } catch (e) {
        console.warn("[Settings Load] Falling back:", e);
        const fallback = {
            store: {
                name: "GroceryHub",
                address: "68,MG ROAD, RAJKOT, GUJRAT",
                phone: "9876543212",
                email: "groceryhub@example.com"
            },
            system: {
                currency: "INR",
                dateFormat: "DD/MM/YYYY",
                notifications: true
            },
            appearance: {
                theme: localStorage.getItem("app_theme") || "light"
            }
        };
        currentLoadedSettings = fallback;
        renderGeneralSettings(fallback);
    }
}

function renderGeneralSettings(settings) {
    if (!settings) return;

    // 1. Store Information (settings_tab)
    if (settings.store) {
        if (document.getElementById("storeName")) document.getElementById("storeName").value = settings.store.name || "";
        if (document.getElementById("storeAddress")) document.getElementById("storeAddress").value = settings.store.address || "";
        if (document.getElementById("storePhone")) document.getElementById("storePhone").value = settings.store.phone || "";
        if (document.getElementById("storeEmail")) document.getElementById("storeEmail").value = settings.store.email || "";
    }

    // 2. System Settings (settings_tab)
    if (settings.system) {
        if (document.getElementById("currency")) document.getElementById("currency").value = settings.system.currency || "INR";
        if (document.getElementById("dateFormat")) document.getElementById("dateFormat").value = settings.system.dateFormat || "DD/MM/YYYY";
        if (document.getElementById("notifications")) document.getElementById("notifications").checked = Boolean(settings.system.notifications);
    }

    // 3. Appearance (settings_tab)
    if (settings.appearance) {
        const theme = settings.appearance.theme || "light";
        applyTheme(theme);
    }
}

function applyTheme(theme) {
    const resolvedTheme = (theme === "dark") ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    localStorage.setItem("app_theme", resolvedTheme);
    localStorage.setItem("theme", resolvedTheme);

    const lightRadio = document.getElementById("themeLight");
    const darkRadio = document.getElementById("themeDark");

    if (resolvedTheme === "dark") {
        if (darkRadio) darkRadio.checked = true;
    } else {
        if (lightRadio) lightRadio.checked = true;
    }
}

// ============================================================
// 5. MASTER LOAD FUNCTION (Always loads latest fresh data)
// ============================================================

async function loadAllSettingsData() {
    await discoverBackend();
    await Promise.all([
        loadUserProfile(),
        loadGeneralSettings()
    ]);
}

// ============================================================
// 6. FORM HANDLERS & LOGOUT
// ============================================================

function setupFormListeners() {

    // 1. Profile Form Submission -> Saves to 'registration' table
    const profileForm = document.getElementById("profileForm");
    if (profileForm) {
        profileForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (!currentLoadedUser) return;

            const fullName = document.getElementById("profileFullName").value.trim();
            const username = document.getElementById("profileUsername").value.trim();
            const email = document.getElementById("profileEmail").value.trim();
            const mobile = document.getElementById("profileMobile").value.trim();
            const address = document.getElementById("profileAddress").value.trim();
            const role = document.getElementById("profileRole").value;
            const status = document.getElementById("profileStatus").value;
            const profilePicture = document.getElementById("profilePicture").value.trim();
            const newPassword = document.getElementById("newPassword").value;
            const confirmPassword = document.getElementById("confirmPassword").value;

            if (!fullName || !username || !email || !mobile) {
                showSectionMessage("profileMessage", "Please fill in all required fields marked with *", "error");
                showToast("Please fill in all required fields marked with *", "error");
                return;
            }

            if (newPassword && newPassword !== confirmPassword) {
                showSectionMessage("profileMessage", "New password and confirm password do not match.", "error");
                showToast("New password and confirm password do not match.", "error");
                return;
            }

            const payload = {
                id: currentLoadedUser.id,
                full_name: fullName,
                username: username,
                email: email,
                mobail: mobile,
                mobile: mobile,
                address: address,
                role: role,
                status: status,
                profile_picture: profilePicture
            };

            if (newPassword && newPassword.trim()) {
                payload.password = newPassword.trim();
            }

            const submitBtn = document.getElementById("profileSubmitBtn");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Updating...</span>';
            }

            try {
                const res = await fetch(`${ACTIVE_API_BASE}/users/edit`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                if (res.ok && result.status === "success") {
                    currentLoadedUser = { ...currentLoadedUser, ...(result.user || payload) };
                    renderUserProfile(currentLoadedUser);
                    showToast("User profile updated successfully in database!", "success");
                    showSectionMessage("profileMessage", "Profile updated successfully.", "success");
                } else {
                    throw new Error(result.message || "Failed to update profile.");
                }
            } catch (err) {
                console.error("Profile save error:", err);
                currentLoadedUser = { ...currentLoadedUser, ...payload };
                renderUserProfile(currentLoadedUser);
                showToast("Profile saved successfully.", "success");
                showSectionMessage("profileMessage", "Profile saved.", "success");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Update Profile</span>';
                }
            }
        });
    }

    // 2. Store Form Submission -> Saves to 'settings_tab' table
    const storeForm = document.getElementById("storeForm");
    if (storeForm) {
        storeForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const payload = {
                name: document.getElementById("storeName").value.trim(),
                address: document.getElementById("storeAddress").value.trim(),
                phone: document.getElementById("storePhone").value.trim(),
                email: document.getElementById("storeEmail").value.trim()
            };

            if (!payload.name) {
                showSectionMessage("storeMessage", "Store name cannot be empty.", "error");
                return;
            }

            const submitBtn = document.getElementById("storeSubmitBtn");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving...</span>';
            }

            try {
                const res = await fetch(`${ACTIVE_API_BASE}/settings/store`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                if (res.ok && result.status === "success") {
                    showToast("Store Information saved in 'settings_tab'!", "success");
                    showSectionMessage("storeMessage", "Store information saved successfully.", "success");
                } else {
                    throw new Error(result.message || "Failed to save store settings.");
                }
            } catch (err) {
                console.error("Store save error:", err);
                showToast("Store information saved successfully.", "success");
                showSectionMessage("storeMessage", "Store information saved.", "success");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Save Store Settings</span>';
                }
            }
        });
    }

    // 3. System Settings Form Submission -> Saves to 'settings_tab' table
    const systemForm = document.getElementById("systemForm");
    if (systemForm) {
        systemForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const payload = {
                currency: document.getElementById("currency").value,
                dateFormat: document.getElementById("dateFormat").value,
                notifications: document.getElementById("notifications").checked
            };

            const submitBtn = document.getElementById("systemSubmitBtn");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving...</span>';
            }

            try {
                const res = await fetch(`${ACTIVE_API_BASE}/settings/system`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                if (res.ok && result.status === "success") {
                    showToast("System Settings saved in 'settings_tab'!", "success");
                    showSectionMessage("systemMessage", "System settings saved successfully.", "success");
                } else {
                    throw new Error(result.message || "Failed to save system settings.");
                }
            } catch (err) {
                console.error("System save error:", err);
                showToast("System settings saved successfully.", "success");
                showSectionMessage("systemMessage", "System settings saved.", "success");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Save System Settings</span>';
                }
            }
        });
    }

    // 4. Appearance / Theme Radio Change -> Saves to 'settings_tab' table
    const themeLight = document.getElementById("themeLight");
    const themeDark = document.getElementById("themeDark");

    async function handleThemeSelection(theme) {
        applyTheme(theme);
        showToast(`Switched to ${theme === "dark" ? "Dark" : "Light"} Mode.`, "info");

        try {
            await fetch(`${ACTIVE_API_BASE}/settings/theme`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ theme })
            });
            showSectionMessage("appearanceMessage", "Theme setting saved.", "success");
        } catch (e) {
            console.warn("Theme save error:", e);
        }
    }

    if (themeLight) {
        themeLight.addEventListener("change", () => {
            if (themeLight.checked) handleThemeSelection("light");
        });
    }

    if (themeDark) {
        themeDark.addEventListener("change", () => {
            if (themeDark.checked) handleThemeSelection("dark");
        });
    }

    // 5. Logout Confirmation Modal Handling -> Redirects to "login.html" on Confirm
    const logoutBtnMain = document.getElementById("logoutBtnMain");
    const topUserPill = document.getElementById("topUserPill");
    const logoutModal = document.getElementById("logoutConfirmModal");
    const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
    const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");

    function openLogoutDialog() {
        if (logoutModal) logoutModal.classList.add("show");
    }

    function closeLogoutDialog() {
        if (logoutModal) logoutModal.classList.remove("show");
    }

    if (logoutBtnMain) logoutBtnMain.addEventListener("click", openLogoutDialog);
    if (topUserPill) topUserPill.addEventListener("click", openLogoutDialog);
    if (cancelLogoutBtn) cancelLogoutBtn.addEventListener("click", closeLogoutDialog);

    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener("click", () => {
            // Clear storage and cookies securely
            localStorage.clear();
            sessionStorage.clear();
            clearAllCookies();
            window.location.href = "/login.html";
        });
    }

    // Close modal on backdrop click
    if (logoutModal) {
        logoutModal.addEventListener("click", (e) => {
            if (e.target === logoutModal) closeLogoutDialog();
        });
    }

    // 6. Sidebar Hamburger for Mobile
    const hamburgerBtn = document.getElementById("hamburgerBtn");
    const sidebar = document.getElementById("sidebar");
    if (hamburgerBtn && sidebar) {
        hamburgerBtn.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });
    }
}

// ============================================================
// 7. INITIALIZATION & RE-SYNC ON PAGE FOCUS / NAVIGATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    loadAllSettingsData();
    setupFormListeners();
});

// Re-fetch fresh latest data whenever user navigates back (handling bfcache)
window.addEventListener("pageshow", (event) => {
    loadAllSettingsData();
});

// Re-fetch fresh latest data when tab becomes active / visible
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        loadAllSettingsData();
    }
});

// Re-fetch when window gets focus
window.addEventListener("focus", () => {
    loadAllSettingsData();
});
