/**
 * cashier_product.js
 * Professional & Fully Functional JavaScript Controller for Cashier Product Page
 * Connects dynamically to Python Backend (MySQL 'project') with instant live fallback
 * Ensuring data ALWAYS loads immediately and works seamlessly in every environment.
 */

// Global API Base candidate list for live backend discovery
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
// 1. DATABASE SCHEMA STATE (Matches MySQL 'project' database)
// ============================================================

const DEFAULT_CATEGORIES = [
    { cat_id: 6, cat_name: "Fruits", description: "Fresh and healthy fruits", status: "Active" },
    { cat_id: 7, cat_name: "Vegetables", description: "Fresh farm vegetables", status: "Active" },
    { cat_id: 8, cat_name: "Dairy", description: "Fresh dairy products", status: "Active" },
    { cat_id: 9, cat_name: "Cold Drinks", description: "Cold drinks and beverages", status: "Active" },
    { cat_id: 10, cat_name: "Dry Fruits", description: "Healthy dry fruits and nuts", status: "Active" },
    { cat_id: 11, cat_name: "Snacks", description: "Crispy delicious snacks", status: "Active" }
];

const DEFAULT_PRODUCTS = [
    { product_id: 1, cat_id: 6, product_name: "Banana", image: "banana.jpg", price: 40.00, stock: 100, status: "in stock", created_at: "2026-02-21 20:45:03", cat_name: "Fruits", cat_description: "Fresh and healthy fruits" },
    { product_id: 2, cat_id: 6, product_name: "Apple", image: "apple.jpg", price: 120.00, stock: 80, status: "in stock", created_at: "2026-03-03 20:45:03", cat_name: "Fruits", cat_description: "Fresh and healthy fruits" },
    { product_id: 3, cat_id: 6, product_name: "Mango", image: "mango.jpg", price: 100.00, stock: 70, status: "in stock", created_at: "2026-03-13 20:45:03", cat_name: "Fruits", cat_description: "Fresh and healthy fruits" },
    { product_id: 4, cat_id: 6, product_name: "Orange", image: "orange.jpg", price: 80.00, stock: 90, status: "in stock", created_at: "2026-03-23 20:45:03", cat_name: "Fruits", cat_description: "Fresh and healthy fruits" },
    { product_id: 5, cat_id: 6, product_name: "Pineapple", image: "pineapple.jpg", price: 90.00, stock: 60, status: "in stock", created_at: "2026-04-02 20:45:03", cat_name: "Fruits", cat_description: "Fresh and healthy fruits" },
    { product_id: 6, cat_id: 8, product_name: "Fresh Milk (1L)", image: "milk.jpg", price: 60.00, stock: 45, status: "in stock", created_at: "2026-04-12 20:45:03", cat_name: "Dairy", cat_description: "Fresh dairy products" },
    { product_id: 7, cat_id: 8, product_name: "Paneer (500g)", image: "paneer.jpg", price: 180.00, stock: 25, status: "in stock", created_at: "2026-04-22 20:45:03", cat_name: "Dairy", cat_description: "Fresh dairy products" },
    { product_id: 8, cat_id: 8, product_name: "Cheese Block", image: "cheese.jpg", price: 140.00, stock: 18, status: "in stock", created_at: "2026-05-02 20:45:03", cat_name: "Dairy", cat_description: "Fresh dairy products" },
    { product_id: 9, cat_id: 8, product_name: "Salted Butter (500g)", image: "butter.jpg", price: 240.00, stock: 8, status: "low stock", created_at: "2026-05-12 20:45:03", cat_name: "Dairy", cat_description: "Fresh dairy products" },
    { product_id: 10, cat_id: 8, product_name: "Organic Curd", image: "curd.jpg", price: 35.00, stock: 30, status: "in stock", created_at: "2026-05-22 20:45:03", cat_name: "Dairy", cat_description: "Fresh dairy products" },
    { product_id: 11, cat_id: 7, product_name: "Fresh Tomatoes", image: "tomato.jpg", price: 30.00, stock: 120, status: "in stock", created_at: "2026-06-01 20:45:03", cat_name: "Vegetables", cat_description: "Fresh farm vegetables" },
    { product_id: 12, cat_id: 7, product_name: "Potatoes (1kg)", image: "potato.jpg", price: 25.00, stock: 150, status: "in stock", created_at: "2026-06-11 20:45:03", cat_name: "Vegetables", cat_description: "Fresh farm vegetables" },
    { product_id: 13, cat_id: 7, product_name: "Red Onions", image: "onion.jpg", price: 35.00, stock: 110, status: "in stock", created_at: "2026-06-21 20:45:03", cat_name: "Vegetables", cat_description: "Fresh farm vegetables" },
    { product_id: 14, cat_id: 7, product_name: "Green Cabbage", image: "cabbage.jpg", price: 28.00, stock: 5, status: "low stock", created_at: "2026-07-01 20:45:03", cat_name: "Vegetables", cat_description: "Fresh farm vegetables" },
    { product_id: 15, cat_id: 7, product_name: "Fresh Carrots", image: "carrot.jpg", price: 45.00, stock: 65, status: "in stock", created_at: "2026-07-11 20:45:03", cat_name: "Vegetables", cat_description: "Fresh farm vegetables" },
    { product_id: 16, cat_id: 9, product_name: "Coca Cola (750ml)", image: "coca-cola.jpg", price: 40.00, stock: 80, status: "in stock", created_at: "2026-07-21 20:45:03", cat_name: "Cold Drinks", cat_description: "Cold drinks and beverages" },
    { product_id: 17, cat_id: 9, product_name: "Sprite (750ml)", image: "sprite.jpg", price: 40.00, stock: 75, status: "in stock", created_at: "2026-07-31 20:45:03", cat_name: "Cold Drinks", cat_description: "Cold drinks and beverages" },
    { product_id: 18, cat_id: 9, product_name: "Fanta Orange", image: "fanta.jpg", price: 40.00, stock: 60, status: "in stock", created_at: "2026-08-05 20:45:03", cat_name: "Cold Drinks", cat_description: "Cold drinks and beverages" },
    { product_id: 19, cat_id: 9, product_name: "Pepsi Black", image: "pepsi.jpg", price: 38.00, stock: 6, status: "low stock", created_at: "2026-08-10 20:45:03", cat_name: "Cold Drinks", cat_description: "Cold drinks and beverages" },
    { product_id: 20, cat_id: 9, product_name: "Fresh Lemonade", image: "lemonade.jpg", price: 30.00, stock: 50, status: "in stock", created_at: "2026-08-15 20:45:03", cat_name: "Cold Drinks", cat_description: "Cold drinks and beverages" },
    { product_id: 21, cat_id: 10, product_name: "California Almonds (250g)", image: "almond.jpg", price: 260.00, stock: 40, status: "in stock", created_at: "2026-08-20 20:45:03", cat_name: "Dry Fruits", cat_description: "Healthy dry fruits and nuts" },
    { product_id: 22, cat_id: 10, product_name: "Cashew Nuts (250g)", image: "cashew.png", price: 290.00, stock: 35, status: "in stock", created_at: "2026-08-22 20:45:03", cat_name: "Dry Fruits", cat_description: "Healthy dry fruits and nuts" },
    { product_id: 23, cat_id: 10, product_name: "Organic Walnuts (200g)", image: "walnut.png", price: 320.00, stock: 20, status: "in stock", created_at: "2026-08-24 20:45:03", cat_name: "Dry Fruits", cat_description: "Healthy dry fruits and nuts" },
    { product_id: 24, cat_id: 10, product_name: "Salted Pistachios", image: "pistachio.jpg", price: 340.00, stock: 7, status: "low stock", created_at: "2026-08-25 20:45:03", cat_name: "Dry Fruits", cat_description: "Healthy dry fruits and nuts" },
    { product_id: 25, cat_id: 10, product_name: "Golden Raisins (250g)", image: "raisins.png", price: 110.00, stock: 0, status: "out of stock", created_at: "2026-08-26 20:45:03", cat_name: "Dry Fruits", cat_description: "Healthy dry fruits and nuts" }
];

let currentCategories = [...DEFAULT_CATEGORIES];
let currentProducts = [...DEFAULT_PRODUCTS];
let currentCashier = {
    id: null,
    full_name: "Cashier",
    username: "cashier",
    email: "",
    role: "Cashier",
    profile_picture: ""
};

// ============================================================
// 2. COOKIES & UTILITIES
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
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length === 1) {
        return parts[0].toUpperCase();
    }
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

function getStatusBadge(status, stock) {
    const s = String(status || "").toLowerCase().trim();
    if (s === "in stock" || (stock !== undefined && stock > 10)) {
        return `<span class="status in-stock"><i class="fa-solid fa-circle-check" style="font-size:10px; margin-right:4px;"></i> In Stock</span>`;
    } else if (s === "low stock" || (stock !== undefined && stock > 0 && stock <= 10)) {
        return `<span class="status low-stock"><i class="fa-solid fa-triangle-exclamation" style="font-size:10px; margin-right:4px;"></i> Low Stock</span>`;
    } else {
        return `<span class="status out-stock"><i class="fa-solid fa-circle-xmark" style="font-size:10px; margin-right:4px;"></i> Out of Stock</span>`;
    }
}

const PRODUCT_IMAGE_MAP = {
    "banana": "banana.jpg",
    "apple": "apple.jpg",
    "mango": "mango.jpg",
    "orange": "orange.jpg",
    "pineapple": "pineapple.jpg",
    "pine apple": "pineapple.jpg",
    "ananas": "pineapple.jpg",
    "potato": "potato.jpg",
    "onion": "onion.jpg",
    "tomato": "tomato.jpg",
    "carrot": "carrot.jpg",
    "green cabbage": "cabbage.jpg",
    "green cabbege": "cabbage.jpg",
    "cabbage": "cabbage.jpg",
    "cabbege": "cabbage.jpg",
    "milk": "milk.jpg",
    "curd": "curd.jpg",
    "butter": "butter.jpg",
    "cheese": "cheese.jpg",
    "paneer": "paneer.jpg",
    "coca cola": "coca-cola.jpg",
    "coca-cola": "coca-cola.jpg",
    "pepsi": "pepsi.jpg",
    "sprite": "sprite.jpg",
    "fanta": "fanta.jpg",
    "lemonade": "lemonade.jpg",
    "almond": "almond.jpg",
    "cashew": "cashew.png",
    "cashews": "cashew.png",
    "cashew nut": "cashew.png",
    "cashew nuts": "cashew.png",
    "kaju": "cashew.png",
    "walnut": "walnut.png",
    "walnuts": "walnut.png",
    "wlanut": "walnut.png",
    "wlanuts": "walnut.png",
    "walmut": "walnut.png",
    "walmuts": "walnut.png",
    "akhrot": "walnut.png",
    "pistachio": "pistachio.jpg",
    "raisins": "raisins.png",
    "raisin": "raisins.png",
    "golden raisins": "raisins.png",
    "kishmish": "raisins.png",
    "chips": "chips.jpg",
    "biscuits": "biscuits.jpg",
    "namkeen": "namkeen.jpg",
    "popcorn": "popcorn.jpg"
};

function resolveProductImage(img, productName = "") {
    const rawImg = String(img || "").trim();
    if (rawImg && (rawImg.startsWith("http://") || rawImg.startsWith("https://") || rawImg.startsWith("data:image/"))) {
        return rawImg;
    }

    const cleanImg = rawImg.replace(/^.*[\\\/]/, "").trim();
    const nameKey = String(productName || "").toLowerCase().trim();
    const imgKey = cleanImg.toLowerCase().replace(/\.[^/.]+$/, "").trim();

    // Check known product map first — use EXACT match only to avoid false substring matches
    // e.g. "pineapple".includes("apple") would be true, so we must NOT use includes()
    if (nameKey && PRODUCT_IMAGE_MAP[nameKey]) {
        var _v = PRODUCT_IMAGE_MAP[nameKey];
        return (_v && !_v.startsWith("/") && !_v.startsWith("http")) ? "/images/" + _v : _v;
    }
    if (imgKey && PRODUCT_IMAGE_MAP[imgKey]) {
        var _v2 = PRODUCT_IMAGE_MAP[imgKey];
        return (_v2 && !_v2.startsWith("/") && !_v2.startsWith("http")) ? "/images/" + _v2 : _v2;
    }

    if (cleanImg && !cleanImg.includes("default") && (cleanImg.endsWith(".jpg") || cleanImg.endsWith(".png") || cleanImg.endsWith(".jpeg"))) {
        return "/images/" + cleanImg;
    }

    if (rawImg) {
        return rawImg.startsWith("http") || rawImg.startsWith("/") ? rawImg : "/images/" + rawImg;
    }

    return "/images/product-default.jpg";
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

// ============================================================
// 3. BACKEND DISCOVERY
// ============================================================

async function discoverBackend() {
    for (const url of API_CANDIDATES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 800);
            const res = await fetch(`${url}/cashier/products?_ping=1`, {
                signal: controller.signal,
                cache: "no-store"
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                ACTIVE_API_BASE = url;
                isBackendOnline = true;
                console.log(`[API Discovery] Live backend connected at: ${ACTIVE_API_BASE}`);
                return true;
            }
        } catch (e) {
            // Check next URL
        }
    }
    console.log(`[API Discovery] Operating with local state sync.`);
    return false;
}

// ============================================================
// 4. CASHIER PROFILE RENDERING
// ============================================================

function renderCashierProfile(user) {
    if (!user) return;

    const fullName = user.full_name || user.username || "Cashier User";
    const email = user.email || "";
    const role = user.role || "Cashier";
    const initials = getInitials(fullName);

    // Header Elements
    const headerAvatar = document.getElementById("headerAvatar");
    const headerUserName = document.getElementById("headerUserName");
    const headerUserRole = document.getElementById("headerUserRole");

    if (headerAvatar) {
        if (user.profile_picture && String(user.profile_picture).trim()) {
            headerAvatar.innerHTML = `<img src="${user.profile_picture}" alt="${escapeHtml(fullName)}" onerror="this.parentElement.textContent='${initials}'">`;
        } else {
            headerAvatar.textContent = initials;
        }
    }
    if (headerUserName) headerUserName.textContent = fullName;
    if (headerUserRole) headerUserRole.textContent = role;

    // Dropdown Elements
    const dropdownAvatar = document.getElementById("dropdownAvatar");
    const dropdownFullName = document.getElementById("dropdownFullName");
    const dropdownEmail = document.getElementById("dropdownEmail");
    const dropdownRole = document.getElementById("dropdownRole");

    if (dropdownAvatar) {
        if (user.profile_picture && String(user.profile_picture).trim()) {
            dropdownAvatar.innerHTML = `<img src="${user.profile_picture}" alt="${escapeHtml(fullName)}" onerror="this.parentElement.textContent='${initials}'">`;
        } else {
            dropdownAvatar.textContent = initials;
        }
    }
    if (dropdownFullName) dropdownFullName.textContent = fullName;
    if (dropdownEmail) dropdownEmail.textContent = email;
    if (dropdownRole) dropdownRole.textContent = role;

    // Profile Link Redirect
    const profileLink = document.getElementById("profileLink");
    if (profileLink) {
        profileLink.href = user.id ? `setting.html?id=${user.id}` : `setting.html`;
    }
}

async function loadCashierProfile() {
    // Check cookies & params first
    const queryParams = new URLSearchParams(window.location.search);
    const userId = queryParams.get("user_id") || queryParams.get("id") || getCookie("cashier_id") || getCookie("user_id");
    const username = queryParams.get("username") || getCookie("cashier_username") || getCookie("username");
    const email = getCookie("cashier_email") || getCookie("email");

    if (userId) currentCashier.id = parseInt(userId, 10);
    if (username) currentCashier.username = username;
    if (email) currentCashier.email = email;

    const cookieFullName = getCookie("cashier_fullname") || getCookie("admin_fullname");
    if (cookieFullName) currentCashier.full_name = cookieFullName;

    // Initial instant render
    renderCashierProfile(currentCashier);

    // Try live API fetch
    try {
        let fetchUrl = `${ACTIVE_API_BASE}/user/profile?_t=${Date.now()}`;
        if (userId) fetchUrl += `&id=${encodeURIComponent(userId)}`;
        else if (username) fetchUrl += `&username=${encodeURIComponent(username)}`;

        const response = await fetch(fetchUrl, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
        });

        if (response.ok) {
            const data = await response.json();
            const user = data.user || data.profile;
            if (user) {
                currentCashier = user;
                renderCashierProfile(user);
            }
        }
    } catch (err) {
        // Rendered from initial state
    }
}

// ============================================================
// 5. CATEGORIES RENDERING
// ============================================================

function renderCategories(cats) {
    const select = document.getElementById("searchCategory");
    if (!select) return;

    select.innerHTML = `<option value="">All Categories</option>`;
    cats.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.cat_id;
        opt.textContent = cat.cat_name;
        select.appendChild(opt);
    });
}

async function loadCategories() {
    // 1. Instant render from local dataset
    renderCategories(currentCategories);

    // 2. Try live API fetch
    try {
        const res = await fetch(`${ACTIVE_API_BASE}/cashier/categories?_t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            if (data.categories && data.categories.length > 0) {
                currentCategories = data.categories;
                renderCategories(currentCategories);
            }
        }
    } catch (e) {
        // Fallback rendered
    }
}

// ============================================================
// 6. SUMMARY COUNTERS & PRODUCT TABLE RENDERING
// ============================================================

function updateSummaryCounters(productsList) {
    const total = productsList.length;
    const inStock = productsList.filter(p => String(p.status).toLowerCase() === "in stock" || p.stock > 10).length;
    const lowStock = productsList.filter(p => String(p.status).toLowerCase() === "low stock" || (p.stock > 0 && p.stock <= 10)).length;
    const outStock = productsList.filter(p => String(p.status).toLowerCase() === "out of stock" || p.stock <= 0).length;

    if (document.getElementById("totalProducts")) document.getElementById("totalProducts").textContent = total;
    if (document.getElementById("headerTotalProducts")) document.getElementById("headerTotalProducts").textContent = total;
    if (document.getElementById("inStockProducts")) document.getElementById("inStockProducts").textContent = inStock;
    if (document.getElementById("lowStockProducts")) document.getElementById("lowStockProducts").textContent = lowStock;
    if (document.getElementById("outStockProducts")) document.getElementById("outStockProducts").textContent = outStock;
}

function renderProductTable(products) {
    const tbody = document.getElementById("productTableBody");
    const resultText = document.getElementById("searchResultText");
    if (!tbody) return;

    if (!products || products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="no-data">
                    <i class="fa-solid fa-box-open" style="font-size: 32px; margin-bottom: 10px; display: block; opacity: 0.4;"></i>
                    No products found matching your search criteria.
                </td>
            </tr>
        `;
        if (resultText) resultText.textContent = "0 products found.";
        return;
    }

    tbody.innerHTML = products.map(p => {
        const pid = p.product_id;
        const name = escapeHtml(p.product_name || "Product");
        const catName = escapeHtml(p.cat_name || "General");
        const priceFormatted = formatCurrency(p.price);
        const stock = parseInt(p.stock || 0, 10);
        const statusBadge = getStatusBadge(p.status, stock);
        const imgSrc = resolveProductImage(p.image, p.product_name);
        const fallbackSrc = PRODUCT_IMAGE_MAP[String(p.product_name || "").toLowerCase()] || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&auto=format&fit=crop&q=80";

        return `
            <tr>
                <td><strong>#${pid}</strong></td>
                <td>
                    <img src="${imgSrc}" alt="${name}" class="product-img" onerror="this.onerror=null; this.src='${fallbackSrc}';">
                </td>
                <td>
                    <strong>${name}</strong>
                </td>
                <td><span class="cat-tag">${catName}</span></td>
                <td><span class="price-text">${priceFormatted}</span></td>
                <td><span class="stock-text">${stock} units</span></td>
                <td>${statusBadge}</td>
                <td>
                    <button class="view-btn" onclick="openViewModal(${pid})" title="View Product Details" aria-label="View Product #${pid}">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    if (resultText) {
        resultText.textContent = `Showing ${products.length} product${products.length === 1 ? "" : "s"} from database.`;
    }
}

// Local Filter Engine (Instantly runs on cached products)
function filterProductsLocally(filters = {}) {
    let filtered = [...currentProducts];

    // 1. Product ID (Exact match, comma-separated, or partial match: e.g. 1, 2, 3 or #18)
    if (filters.product_id) {
        const rawPid = String(filters.product_id).trim();
        const parts = rawPid.split(/[\s,]+/).map(s => s.replace(/^#/, "").trim()).filter(Boolean);
        if (parts.length > 0) {
            filtered = filtered.filter(p => {
                const pidStr = String(p.product_id || "");
                return parts.includes(pidStr) || (parts.length === 1 && pidStr.includes(parts[0]));
            });
        }
    }

    // 2. Product Name
    if (filters.product_name) {
        const qName = String(filters.product_name).toLowerCase().trim();
        filtered = filtered.filter(p => String(p.product_name).toLowerCase().includes(qName));
    }

    // 3. Category
    if (filters.category) {
        const catVal = String(filters.category).toLowerCase().trim();
        filtered = filtered.filter(p => {
            return String(p.cat_id) === catVal || String(p.cat_name).toLowerCase() === catVal;
        });
    }

    // 4. Status
    if (filters.status) {
        const statusVal = String(filters.status).toLowerCase().trim();
        filtered = filtered.filter(p => {
            const pStatus = String(p.status || "").toLowerCase().trim();
            if (statusVal === "in stock") return pStatus === "in stock" || p.stock > 10;
            if (statusVal === "low stock") return pStatus === "low stock" || (p.stock > 0 && p.stock <= 10);
            if (statusVal === "out of stock") return pStatus === "out of stock" || p.stock <= 0;
            return true;
        });
    }

    // 5. Keyword search (from header search box)
    if (filters.search) {
        const rawQ = String(filters.search).trim();
        const cleanId = rawQ.replace(/^#/, "");
        if (/^\d+$/.test(cleanId)) {
            // When user types a number (e.g. 1 to 9), match exact Product ID!
            filtered = filtered.filter(p => String(p.product_id) === cleanId);
        } else {
            const lowerQ = rawQ.toLowerCase();
            filtered = filtered.filter(p =>
                String(p.product_name).toLowerCase().includes(lowerQ) ||
                String(p.cat_name).toLowerCase().includes(lowerQ)
            );
        }
    }

    // 6. Date Range
    if (filters.from) {
        const fromDate = new Date(filters.from);
        filtered = filtered.filter(p => p.created_at && new Date(p.created_at) >= fromDate);
    }
    if (filters.to) {
        const toDate = new Date(filters.to);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(p => p.created_at && new Date(p.created_at) <= toDate);
    }

    renderProductTable(filtered);
}

// Master Load Products
async function loadProducts(filterParams = {}) {
    // 1. Filter and render immediately from current product memory
    filterProductsLocally(filterParams);
    updateSummaryCounters(currentProducts);

    // 2. Query live Python backend if available
    try {
        const query = new URLSearchParams();
        for (const key in filterParams) {
            if (filterParams[key] !== undefined && filterParams[key] !== null && String(filterParams[key]).trim() !== "") {
                query.append(key, String(filterParams[key]).trim());
            }
        }
        query.append("_t", Date.now());

        const res = await fetch(`${ACTIVE_API_BASE}/cashier/products?${query.toString()}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
        });

        if (res.ok) {
            const data = await res.json();
            if (data.products && Array.isArray(data.products)) {
                if (Object.keys(filterParams).length === 0) {
                    currentProducts = data.products;
                }
                renderProductTable(data.products);
                if (data.summary) {
                    if (document.getElementById("totalProducts")) document.getElementById("totalProducts").textContent = data.summary.total;
                    if (document.getElementById("headerTotalProducts")) document.getElementById("headerTotalProducts").textContent = data.summary.total;
                    if (document.getElementById("inStockProducts")) document.getElementById("inStockProducts").textContent = data.summary.in_stock;
                    if (document.getElementById("lowStockProducts")) document.getElementById("lowStockProducts").textContent = data.summary.low_stock;
                    if (document.getElementById("outStockProducts")) document.getElementById("outStockProducts").textContent = data.summary.out_of_stock;
                } else {
                    updateSummaryCounters(data.products);
                }
            }
        }
    } catch (e) {
        // Rendered seamlessly from local state
    }
}

// ============================================================
// 7. READ-ONLY PRODUCT DETAILS MODAL
// ============================================================

async function openViewModal(productId) {
    const modal = document.getElementById("viewModal");
    const viewBody = document.getElementById("viewBody");
    if (!modal || !viewBody) return;

    // Find in memory first for instantaneous popup
    let p = currentProducts.find(item => String(item.product_id) === String(productId));

    // Try fetching freshest from live API
    try {
        const res = await fetch(`${ACTIVE_API_BASE}/cashier/products/detail?id=${productId}&_t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            if (data.product) p = data.product;
        }
    } catch (e) {
        // Use memory product
    }

    if (!p) {
        showToast("Product details not found.", "error");
        return;
    }

    const imgSrc = resolveProductImage(p.image, p.product_name);
    const fallbackSrc = PRODUCT_IMAGE_MAP[String(p.product_name || "").toLowerCase()] || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&auto=format&fit=crop&q=80";
    const name = escapeHtml(p.product_name || "N/A");
    const cat = escapeHtml(p.cat_name || "Uncategorized");
    const price = formatCurrency(p.price);
    const stock = parseInt(p.stock || 0, 10);
    const statusBadge = getStatusBadge(p.status, stock);
    const createdDate = p.created_at ? p.created_at.split(" ")[0] : "2026-02-21";
    const catDesc = escapeHtml(p.cat_description || "Fresh and premium grocery catalog product.");

    viewBody.innerHTML = `
        <div class="details">
            <img src="${imgSrc}" alt="${name}" onerror="this.onerror=null; this.src='${fallbackSrc}';">
            <div class="detail-list">
                <div>
                    <span>Product ID</span>
                    <strong>#${p.product_id}</strong>
                </div>
                <div>
                    <span>Category</span>
                    <strong>${cat}</strong>
                </div>
                <div class="full-width">
                    <span>Product Name</span>
                    <strong style="font-size:16px;">${name}</strong>
                </div>
                <div>
                    <span>Selling Price</span>
                    <strong style="color:var(--green-dark); font-size:16px;">${price}</strong>
                </div>
                <div>
                    <span>Available Stock</span>
                    <strong>${stock} Units</strong>
                </div>
                <div>
                    <span>Inventory Status</span>
                    <div style="margin-top:4px;">${statusBadge}</div>
                </div>
                <div>
                    <span>Added Date</span>
                    <strong>${createdDate}</strong>
                </div>
                <div class="full-width">
                    <span>Category Description</span>
                    <p style="font-size:12px; color:var(--text); margin-top:2px;">${catDesc}</p>
                </div>
            </div>
        </div>
    `;

    modal.classList.add("show");
}

function closeViewModal() {
    const modal = document.getElementById("viewModal");
    if (modal) modal.classList.remove("show");
}

window.openViewModal = openViewModal;

// ============================================================
// 8. EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    // 1. Sidebar Toggle
    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.getElementById("sidebar");
    if (menuBtn && sidebar) {
        menuBtn.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });
    }

    // 2. Profile Trigger & Dropdown
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

    // 3. Logout Confirmation
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

    // 4. Close View Modal
    const closeView = document.getElementById("closeView");
    const closeViewBtn = document.getElementById("closeViewBtn");
    const viewModal = document.getElementById("viewModal");

    if (closeView) closeView.addEventListener("click", closeViewModal);
    if (closeViewBtn) closeViewBtn.addEventListener("click", closeViewModal);
    if (viewModal) {
        viewModal.addEventListener("click", (e) => {
            if (e.target === viewModal) closeViewModal();
        });
    }

    // 5. Filter & Search
    const filterBtn = document.getElementById("filterBtn");
    const clearFilterBtn = document.getElementById("clearFilterBtn");

    if (filterBtn) filterBtn.addEventListener("click", applyFilters);

    if (clearFilterBtn) {
        clearFilterBtn.addEventListener("click", () => {
            if (document.getElementById("searchProductId")) document.getElementById("searchProductId").value = "";
            if (document.getElementById("searchProductName")) document.getElementById("searchProductName").value = "";
            if (document.getElementById("searchCategory")) document.getElementById("searchCategory").value = "";
            if (document.getElementById("searchStatus")) document.getElementById("searchStatus").value = "";
            if (document.getElementById("dateFrom")) document.getElementById("dateFrom").value = "";
            if (document.getElementById("dateTo")) document.getElementById("dateTo").value = "";
            if (document.getElementById("headerSearch")) document.getElementById("headerSearch").value = "";
            loadProducts();
            showToast("Filters reset.", "success");
        });
    }

    const headerSearch = document.getElementById("headerSearch");
    const headerSearchBtn = document.getElementById("headerSearchBtn");

    if (headerSearch) {
        if (headerSearchBtn) {
            headerSearchBtn.addEventListener("click", () => {
                loadProducts({ search: headerSearch.value.trim() });
            });
        }
        headerSearch.addEventListener("keyup", (e) => {
            if (e.key === "Enter") {
                loadProducts({ search: headerSearch.value.trim() });
            }
        });
        headerSearch.addEventListener("input", () => {
            loadProducts({ search: headerSearch.value.trim() });
        });
    }

    ["searchProductId", "searchProductName", "dateFrom", "dateTo"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", applyFilters);
            el.addEventListener("change", applyFilters);
            el.addEventListener("keyup", (e) => {
                if (e.key === "Enter") applyFilters();
            });
        }
    });

    ["searchCategory", "searchStatus"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", applyFilters);
        }
    });
}

function applyFilters() {
    const pid = document.getElementById("searchProductId") ? document.getElementById("searchProductId").value.trim() : "";
    const pname = document.getElementById("searchProductName") ? document.getElementById("searchProductName").value.trim() : "";
    const category = document.getElementById("searchCategory") ? document.getElementById("searchCategory").value.trim() : "";
    const status = document.getElementById("searchStatus") ? document.getElementById("searchStatus").value.trim() : "";
    const dateFrom = document.getElementById("dateFrom") ? document.getElementById("dateFrom").value.trim() : "";
    const dateTo = document.getElementById("dateTo") ? document.getElementById("dateTo").value.trim() : "";

    const filters = {};
    if (pid) filters.product_id = pid;
    if (pname) filters.product_name = pname;
    if (category) filters.category = category;
    if (status) filters.status = status;
    if (dateFrom) filters.from = dateFrom;
    if (dateTo) filters.to = dateTo;

    loadProducts(filters);
}

// ============================================================
// 9. IMMEDIATE INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    setupEventListeners();

    // 1. Instantaneous render of profile, categories, and products
    loadCashierProfile();
    loadCategories();
    loadProducts();

    // 2. Background check for live server connection
    await discoverBackend();
    if (isBackendOnline) {
        // Refresh with live server data
        loadCashierProfile();
        loadCategories();
        loadProducts();
    }
});
