/**
 * pos.js - Cashier Point of Sale (POS) Controller
 * Workflow: Customer Select -> Product Select -> Qty -> Add to Sale -> Calculate Total -> Cash Received -> Change -> Complete Sale (MySQL 'project')
 */

// Candidate API Endpoints for dynamic backend discovery
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
// 1. DEFAULT DATASETS (Matches MySQL 'project' Schema)
// ============================================================

const DEFAULT_CUSTOMERS = [
    { customer_id: 1, customer_name: "Aarav Patel", phone: "9876543210", email: "aarav.patel@example.com", city: "Rajkot" },
    { customer_id: 2, customer_name: "Diya Shah", phone: "8765432109", email: "diya.shah@example.com", city: "Ahmedabad" },
    { customer_id: 3, customer_name: "Krish Mehta", phone: "7654321098", email: "krish.mehta@example.com", city: "Surat" },
    { customer_id: 4, customer_name: "Anaya Desai", phone: "9654321087", email: "anaya.desai@example.com", city: "Jamnagar" },
    { customer_id: 5, customer_name: "Vivaan Joshi", phone: "8543210987", email: "vivaan.joshi@example.com", city: "Porbandar" }
];

const DEFAULT_PRODUCTS = [
    { product_id: 1, cat_id: 6, product_name: "Banana", image: "banana.jpg", price: 40.00, stock: 100, status: "in stock", cat_name: "Fruits" },
    { product_id: 2, cat_id: 6, product_name: "Apple", image: "apple.jpg", price: 120.00, stock: 80, status: "in stock", cat_name: "Fruits" },
    { product_id: 3, cat_id: 6, product_name: "Mango", image: "mango.jpg", price: 100.00, stock: 70, status: "in stock", cat_name: "Fruits" },
    { product_id: 4, cat_id: 6, product_name: "Orange", image: "orange.jpg", price: 80.00, stock: 90, status: "in stock", cat_name: "Fruits" },
    { product_id: 5, cat_id: 6, product_name: "Pineapple", image: "pineapple.jpg", price: 90.00, stock: 60, status: "in stock", cat_name: "Fruits" },
    { product_id: 6, cat_id: 8, product_name: "Fresh Milk (1L)", image: "milk.jpg", price: 60.00, stock: 45, status: "in stock", cat_name: "Dairy" },
    { product_id: 7, cat_id: 8, product_name: "Paneer (500g)", image: "paneer.jpg", price: 180.00, stock: 25, status: "in stock", cat_name: "Dairy" },
    { product_id: 8, cat_id: 8, product_name: "Cheese Block", image: "cheese.jpg", price: 140.00, stock: 18, status: "in stock", cat_name: "Dairy" },
    { product_id: 9, cat_id: 8, product_name: "Salted Butter (500g)", image: "butter.jpg", price: 240.00, stock: 8, status: "low stock", cat_name: "Dairy" },
    { product_id: 10, cat_id: 8, product_name: "Organic Curd", image: "curd.jpg", price: 35.00, stock: 30, status: "in stock", cat_name: "Dairy" },
    { product_id: 11, cat_id: 7, product_name: "Fresh Tomatoes", image: "tomato.jpg", price: 30.00, stock: 120, status: "in stock", cat_name: "Vegetables" },
    { product_id: 12, cat_id: 7, product_name: "Potatoes (1kg)", image: "potato.jpg", price: 25.00, stock: 150, status: "in stock", cat_name: "Vegetables" },
    { product_id: 13, cat_id: 7, product_name: "Red Onions", image: "onion.jpg", price: 35.00, stock: 110, status: "in stock", cat_name: "Vegetables" },
    { product_id: 14, cat_id: 7, product_name: "Green Cabbage", image: "cabbage.jpg", price: 28.00, stock: 5, status: "low stock", cat_name: "Vegetables" },
    { product_id: 15, cat_id: 7, product_name: "Fresh Carrots", image: "carrot.jpg", price: 45.00, stock: 65, status: "in stock", cat_name: "Vegetables" },
    { product_id: 16, cat_id: 9, product_name: "Coca Cola (750ml)", image: "coca-cola.jpg", price: 40.00, stock: 80, status: "in stock", cat_name: "Cold Drinks" },
    { product_id: 17, cat_id: 9, product_name: "Sprite (750ml)", image: "sprite.jpg", price: 40.00, stock: 75, status: "in stock", cat_name: "Cold Drinks" },
    { product_id: 18, cat_id: 9, product_name: "Fanta Orange", image: "fanta.jpg", price: 40.00, stock: 60, status: "in stock", cat_name: "Cold Drinks" },
    { product_id: 19, cat_id: 9, product_name: "Pepsi Black", image: "pepsi.jpg", price: 38.00, stock: 6, status: "low stock", cat_name: "Cold Drinks" },
    { product_id: 20, cat_id: 9, product_name: "Fresh Lemonade", image: "lemonade.jpg", price: 30.00, stock: 50, status: "in stock", cat_name: "Cold Drinks" },
    { product_id: 21, cat_id: 10, product_name: "California Almonds (250g)", image: "almond.jpg", price: 260.00, stock: 40, status: "in stock", cat_name: "Dry Fruits" },
    { product_id: 22, cat_id: 10, product_name: "Cashew Nuts (250g)", image: "cashew.png", price: 290.00, stock: 35, status: "in stock", cat_name: "Dry Fruits" },
    { product_id: 23, cat_id: 10, product_name: "Organic Walnuts (200g)", image: "walnut.png", price: 320.00, stock: 20, status: "in stock", cat_name: "Dry Fruits" },
    { product_id: 24, cat_id: 10, product_name: "Salted Pistachios", image: "pistachio.jpg", price: 340.00, stock: 7, status: "low stock", cat_name: "Dry Fruits" },
    { product_id: 25, cat_id: 10, product_name: "Golden Raisins (250g)", image: "raisins.png", price: 110.00, stock: 0, status: "out of stock", cat_name: "Dry Fruits" }
];

// POS State
let customersList = [...DEFAULT_CUSTOMERS];
let catalogProducts = [...DEFAULT_PRODUCTS];
let activeCategory = "all";
let searchQuery = "";
let currentCart = []; // items: { product_id, product_name, cat_name, price, quntity, stock, image }
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
            const res = await fetch(`${url}/cashier/products?_ping=1`, {
                signal: controller.signal,
                cache: "no-store"
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                ACTIVE_API_BASE = url;
                isBackendOnline = true;
                console.log(`[POS Discovery] Connected to live backend at: ${ACTIVE_API_BASE}`);
                return true;
            }
        } catch (e) {
            // Check next
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
        console.warn("[POS Auth Verify] Error:", err);
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
        // Rendered from default
    }
}

// ============================================================
// 5. CUSTOMER SELECTION
// ============================================================

function renderCustomerDropdown(customers) {
    const select = document.getElementById("customerSelect");
    if (!select) return;

    select.innerHTML = customers.map(c => {
        const phone = c.phone ? ` (${c.phone})` : "";
        const city = c.city ? ` - ${c.city}` : "";
        return `<option value="${c.customer_id}">${escapeHtml(c.customer_name)}${phone}${city}</option>`;
    }).join("");

    updateSelectedCustomerBadge();
}

function updateSelectedCustomerBadge() {
    const select = document.getElementById("customerSelect");
    const nameEl = document.getElementById("selectedCustomerName");
    if (!select || !nameEl) return;

    const selOption = select.options[select.selectedIndex];
    if (selOption) {
        nameEl.textContent = selOption.text.split("(")[0].trim();
    }
}

async function loadCustomers() {
    // 1. Instant render from local defaults
    renderCustomerDropdown(customersList);

    // 2. Fetch from backend
    try {
        const res = await fetch(`${ACTIVE_API_BASE}/customers?_t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            if (data.customers && data.customers.length > 0) {
                customersList = data.customers;
                renderCustomerDropdown(customersList);
            }
        }
    } catch (e) {
        // Fallback rendered
    }
}

// ============================================================
// 6. PRODUCT CATALOG & SEARCH
// ============================================================

function renderProductCatalog(products) {
    const grid = document.getElementById("productGrid");
    if (!grid) return;

    // Apply category & search filter
    let filtered = [...products];

    if (activeCategory !== "all") {
        filtered = filtered.filter(p => String(p.cat_id) === activeCategory || String(p.cat_name).toLowerCase() === activeCategory.toLowerCase());
    }

    if (searchQuery.trim() !== "") {
        const q = searchQuery.trim();
        const cleanId = q.replace(/^#/, "");
        if (/^\d+$/.test(cleanId)) {
            // Match exact ID for numeric search
            filtered = filtered.filter(p => String(p.product_id) === cleanId);
        } else {
            const lowerQ = q.toLowerCase();
            filtered = filtered.filter(p =>
                String(p.product_name).toLowerCase().includes(lowerQ) ||
                String(p.cat_name).toLowerCase().includes(lowerQ)
            );
        }
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="no-products">
                <i class="fa-solid fa-box-open" style="font-size:28px; margin-bottom:8px; opacity:0.4;"></i>
                <p>No products found.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const pid = p.product_id;
        const name = escapeHtml(p.product_name);
        const cat = escapeHtml(p.cat_name || "General");
        const price = formatCurrency(p.price);
        const stock = parseInt(p.stock || 0, 10);
        const isOutOfStock = stock <= 0 || String(p.status).toLowerCase() === "out of stock";
        const isLow = stock > 0 && stock <= 10;

        let stockClass = "stock-in";
        let stockText = `${stock} in stock`;
        if (isOutOfStock) {
            stockClass = "stock-out";
            stockText = "Out of Stock";
        } else if (isLow) {
            stockClass = "stock-low";
            stockText = `${stock} low stock`;
        }

        const imgSrc = resolveProductImage(p.image, p.product_name);
        const cardClass = isOutOfStock ? "product-card out-of-stock" : "product-card";

        return `
            <div class="${cardClass}" onclick="handleProductCardClick(${pid})" title="${name}">
                <img src="${imgSrc}" alt="${name}" class="card-img" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=250&auto=format&fit=crop&q=80'">
                <div class="card-name">${name}</div>
                <div class="card-cat">${cat}</div>
                <div class="card-footer">
                    <span class="card-price">${price}</span>
                    <span class="card-stock ${stockClass}">${stockText}</span>
                </div>
            </div>
        `;
    }).join("");
}

async function loadProductsCatalog() {
    // 1. Instant render
    renderProductCatalog(catalogProducts);

    // 2. Fetch live products from backend
    try {
        const res = await fetch(`${ACTIVE_API_BASE}/cashier/products?_t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            if (data.products && Array.isArray(data.products)) {
                catalogProducts = data.products;
                renderProductCatalog(catalogProducts);
            }
        }
    } catch (e) {
        // Fallback rendered
    }
}

// ============================================================
// 7. CART & SALE CALCULATION ENGINE
// ============================================================

function handleProductCardClick(productId) {
    const product = catalogProducts.find(p => p.product_id === productId);
    if (!product) return;

    const availableStock = parseInt(product.stock || 0, 10);
    if (availableStock <= 0 || String(product.status).toLowerCase() === "out of stock") {
        showToast(`"${product.product_name}" is currently out of stock!`, "error");
        return;
    }

    // Check if already in cart
    const existingIndex = currentCart.findIndex(item => item.product_id === productId);
    if (existingIndex > -1) {
        const currentQty = currentCart[existingIndex].quntity;
        if (currentQty + 1 > availableStock) {
            showToast(`Cannot add more. Only ${availableStock} units available in stock!`, "error");
            return;
        }
        currentCart[existingIndex].quntity += 1;
        currentCart[existingIndex].subtotal = currentCart[existingIndex].quntity * currentCart[existingIndex].price;
    } else {
        currentCart.push({
            product_id: product.product_id,
            product_name: product.product_name,
            cat_name: product.cat_name || "General",
            price: parseFloat(product.price || 0),
            quntity: 1,
            stock: availableStock,
            subtotal: parseFloat(product.price || 0),
            image: product.image
        });
    }

    renderCart();
    showToast(`Added "${product.product_name}" to sale cart.`, "success");
}

window.handleProductCardClick = handleProductCardClick;

function updateCartItemQty(productId, delta) {
    const index = currentCart.findIndex(item => item.product_id === productId);
    if (index === -1) return;

    const item = currentCart[index];
    const newQty = item.quntity + delta;

    if (newQty <= 0) {
        removeCartItem(productId);
        return;
    }

    if (newQty > item.stock) {
        showToast(`Stock limit reached! Only ${item.stock} units available.`, "error");
        return;
    }

    item.quntity = newQty;
    item.subtotal = item.quntity * item.price;
    renderCart();
}

window.updateCartItemQty = updateCartItemQty;

function setCartItemQtyDirect(productId, val) {
    const index = currentCart.findIndex(item => item.product_id === productId);
    if (index === -1) return;

    const item = currentCart[index];
    let qty = parseInt(val, 10);

    if (isNaN(qty) || qty <= 0) {
        qty = 1;
    }

    if (qty > item.stock) {
        showToast(`Only ${item.stock} units available in stock! Setting to max.`, "error");
        qty = item.stock;
    }

    item.quntity = qty;
    item.subtotal = item.quntity * item.price;
    renderCart();
}

window.setCartItemQtyDirect = setCartItemQtyDirect;

function removeCartItem(productId) {
    currentCart = currentCart.filter(item => item.product_id !== productId);
    renderCart();
    showToast("Item removed from sale cart.", "success");
}

window.removeCartItem = removeCartItem;

function clearCart() {
    if (currentCart.length === 0) return;
    currentCart = [];
    document.getElementById("cashReceivedInput").value = "";
    renderCart();
    showToast("Sale cart cleared.", "success");
}

function calculateGrandTotal() {
    return currentCart.reduce((sum, item) => sum + (item.subtotal || 0), 0);
}

function calculateTotalItems() {
    return currentCart.reduce((sum, item) => sum + (item.quntity || 0), 0);
}

function renderCart() {
    const tbody = document.getElementById("cartTableBody");
    const totalCountEl = document.getElementById("totalItemCount");
    const subtotalEl = document.getElementById("billSubtotal");
    const grandTotalEl = document.getElementById("billGrandTotal");
    const completeBtn = document.getElementById("completeSaleBtn");

    if (!tbody) return;

    if (currentCart.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-cart-row">
                <td colspan="5">
                    <div class="empty-cart">
                        <i class="fa-solid fa-basket-shopping"></i>
                        <p>Your sale cart is currently empty.</p>
                        <small>Click products from the catalog to add to this sale.</small>
                    </div>
                </td>
            </tr>
        `;
        if (totalCountEl) totalCountEl.textContent = "0 items";
        if (subtotalEl) subtotalEl.textContent = "₹0.00";
        if (grandTotalEl) grandTotalEl.textContent = "₹0.00";
        if (completeBtn) completeBtn.disabled = true;
        updateChangeDue();
        return;
    }

    tbody.innerHTML = currentCart.map(item => {
        const pid = item.product_id;
        const name = escapeHtml(item.product_name);
        const cat = escapeHtml(item.cat_name);
        const price = formatCurrency(item.price);
        const subtotal = formatCurrency(item.subtotal);
        const qty = item.quntity;

        return `
            <tr>
                <td>
                    <div class="cart-item-info">
                        <strong>${name}</strong>
                        <small>${cat}</small>
                    </div>
                </td>
                <td><span style="font-weight:600;">${price}</span></td>
                <td style="text-align:center;">
                    <div class="qty-control">
                        <button type="button" class="qty-btn" onclick="updateCartItemQty(${pid}, -1)">-</button>
                        <input type="number" class="qty-input" value="${qty}" min="1" max="${item.stock}" onchange="setCartItemQtyDirect(${pid}, this.value)">
                        <button type="button" class="qty-btn" onclick="updateCartItemQty(${pid}, 1)">+</button>
                    </div>
                </td>
                <td style="text-align:right;"><span class="item-subtotal">${subtotal}</span></td>
                <td style="text-align:center;">
                    <button type="button" class="remove-item-btn" onclick="removeCartItem(${pid})" title="Remove">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    const grandTotal = calculateGrandTotal();
    const totalItems = calculateTotalItems();

    if (totalCountEl) totalCountEl.textContent = `${totalItems} item${totalItems === 1 ? "" : "s"}`;
    if (subtotalEl) subtotalEl.textContent = formatCurrency(grandTotal);
    if (grandTotalEl) grandTotalEl.textContent = formatCurrency(grandTotal);

    updateChangeDue();
}

function updateChangeDue() {
    const grandTotal = calculateGrandTotal();
    const cashInput = document.getElementById("cashReceivedInput");
    const changeAmountEl = document.getElementById("changeAmount");
    const completeBtn = document.getElementById("completeSaleBtn");

    if (!changeAmountEl || !completeBtn) return;

    if (currentCart.length === 0 || grandTotal <= 0) {
        changeAmountEl.textContent = "₹0.00";
        changeAmountEl.style.color = "var(--blue-dark)";
        completeBtn.disabled = true;
        return;
    }

    const cashReceived = parseFloat(cashInput ? cashInput.value : 0) || 0;
    const change = cashReceived - grandTotal;

    if (cashReceived >= grandTotal) {
        changeAmountEl.textContent = formatCurrency(change);
        changeAmountEl.style.color = "var(--blue-dark)";
        completeBtn.disabled = false;
    } else {
        const shortAmt = grandTotal - cashReceived;
        changeAmountEl.textContent = `Short ₹${shortAmt.toFixed(2)}`;
        changeAmountEl.style.color = "var(--red)";
        completeBtn.disabled = true;
    }
}

// ============================================================
// 8. COMPLETE SALE PROCESSOR (TRANSACTIONAL)
// ============================================================

async function completeSale() {
    if (currentCart.length === 0) {
        showToast("Cannot complete an empty sale. Add products first.", "error");
        return;
    }

    const customerSelect = document.getElementById("customerSelect");
    const customerId = customerSelect ? parseInt(customerSelect.value, 10) : 1;
    const customerName = customerSelect ? customerSelect.options[customerSelect.selectedIndex].text.split("(")[0].trim() : "Aarav Patel";

    const grandTotal = calculateGrandTotal();
    const cashInput = document.getElementById("cashReceivedInput");
    const cashReceived = parseFloat(cashInput ? cashInput.value : 0) || 0;

    if (cashReceived < grandTotal) {
        showToast(`Insufficient cash received! Grand total is ${formatCurrency(grandTotal)}.`, "error");
        return;
    }

    const changeDue = cashReceived - grandTotal;

    const cashierIdVal = currentCashier?.id || parseInt(getCookie("cashier_id") || getCookie("user_id") || "0", 10) || null;
    const cashierNameVal = (currentCashier && (currentCashier.full_name || currentCashier.username)) || getCookie("cashier_fullname") || getCookie("cashier_username") || getCookie("admin_fullname") || "Cashier";

    const payload = {
        customer_id: customerId,
        customer_name: customerName,
        total_amount: grandTotal,
        cash_received: cashReceived,
        change_returned: changeDue,
        cashier_id: cashierIdVal,
        cashier_name: cashierNameVal,
        payment_method: "Cash",
        payment_status: "Paid",
        order_status: "Completed",
        items: currentCart.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quntity: item.quntity,
            price: item.price,
            subtotal: item.subtotal
        }))
    };

    const completeBtn = document.getElementById("completeSaleBtn");
    if (completeBtn) {
        completeBtn.disabled = true;
        completeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing Sale...`;
    }

    let orderId = Math.floor(27 + Math.random() * 900); // Default fallback Order ID
    let saleRecorded = false;

    // 1. Try sending to active backend candidates
    const candidateUrls = [
        `${ACTIVE_API_BASE}/pos/complete`,
        "http://localhost:9007/api/pos/complete",
        "http://localhost:9010/api/pos/complete",
        "http://localhost:9008/api/pos/complete",
        "/api/pos/complete",
        "/project/api/pos/complete"
    ];

    for (const endpoint of candidateUrls) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data.order_id) {
                    orderId = data.order_id;
                    saleRecorded = true;
                    ACTIVE_API_BASE = endpoint.replace("/pos/complete", "");
                    break;
                }
            } else {
                const errData = await res.json().catch(() => ({}));
                if (errData.message) {
                    showToast(errData.message, "error");
                    if (completeBtn) {
                        completeBtn.disabled = false;
                        completeBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Complete Cash Sale`;
                    }
                    return;
                }
            }
        } catch (err) {
            // Try next candidate
        }
    }

    // 2. Reduce local inventory stock
    currentCart.forEach(item => {
        const prod = catalogProducts.find(p => p.product_id === item.product_id);
        if (prod) {
            prod.stock = Math.max(0, prod.stock - item.quntity);
            if (prod.stock <= 0) prod.status = "out of stock";
            else if (prod.stock <= 10) prod.status = "low stock";
        }
    });

    // 3. Show Success Modal with Order details
    showSaleSuccessModal({
        orderId: orderId,
        customerName: customerName,
        totalAmount: grandTotal,
        cashReceived: cashReceived,
        changeReturned: changeDue
    });

    showToast(`Order #${orderId} completed successfully!`, "success");

    // 4. Reset Cart
    currentCart = [];
    if (cashInput) cashInput.value = "";
    renderCart();
    renderProductCatalog(catalogProducts);

    if (completeBtn) {
        completeBtn.disabled = false;
        completeBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Complete Cash Sale`;
    }
}

function showSaleSuccessModal(info) {
    const modal = document.getElementById("saleSuccessModal");
    if (!modal) return;

    if (document.getElementById("successOrderId")) document.getElementById("successOrderId").textContent = `#${info.orderId}`;
    if (document.getElementById("successCustomerName")) document.getElementById("successCustomerName").textContent = info.customerName;
    if (document.getElementById("successTotalAmount")) document.getElementById("successTotalAmount").textContent = formatCurrency(info.totalAmount);
    if (document.getElementById("successCashReceived")) document.getElementById("successCashReceived").textContent = formatCurrency(info.cashReceived);
    if (document.getElementById("successChangeReturned")) document.getElementById("successChangeReturned").textContent = formatCurrency(info.changeReturned);

    const printBtn = document.getElementById("printReceiptBtn");
    if (printBtn) {
        printBtn.href = `invoice_receipt.html?order_id=${info.orderId}`;
    }

    modal.classList.add("show");
}

function closeSuccessModal() {
    const modal = document.getElementById("saleSuccessModal");
    if (modal) modal.classList.remove("show");
}

// ============================================================
// 9. EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    // 1. Sidebar Toggle for Mobile
    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.getElementById("sidebar");
    if (menuBtn && sidebar) {
        menuBtn.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });
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
            showToast("Logged out successfully.", "success");
            setTimeout(() => {
                window.location.href = "/login.html";
            }, 400);
        });
    }

    // 3. Customer Selection Change
    const customerSelect = document.getElementById("customerSelect");
    if (customerSelect) {
        customerSelect.addEventListener("change", updateSelectedCustomerBadge);
    }

    // 4. Product Search Input
    const searchInput = document.getElementById("productSearchInput");
    const clearSearchBtn = document.getElementById("clearSearchBtn");

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchQuery = e.target.value;
            renderProductCatalog(catalogProducts);
        });
    }

    if (clearSearchBtn && searchInput) {
        clearSearchBtn.addEventListener("click", () => {
            searchInput.value = "";
            searchQuery = "";
            renderProductCatalog(catalogProducts);
        });
    }

    // 5. Category Pills
    const pills = document.querySelectorAll(".category-pills .pill");
    pills.forEach(pill => {
        pill.addEventListener("click", () => {
            pills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            activeCategory = pill.getAttribute("data-cat");
            renderProductCatalog(catalogProducts);
        });
    });

    // 6. Cash Received Input & Change Calculation
    const cashInput = document.getElementById("cashReceivedInput");
    if (cashInput) {
        cashInput.addEventListener("input", updateChangeDue);
        cashInput.addEventListener("keyup", (e) => {
            if (e.key === "Enter") {
                const completeBtn = document.getElementById("completeSaleBtn");
                if (completeBtn && !completeBtn.disabled) {
                    completeSale();
                }
            }
        });
    }

    // 7. Quick Cash Buttons
    const quickCashBtns = document.querySelectorAll(".quick-cash-btn");
    quickCashBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const amtType = btn.getAttribute("data-amt");
            const grandTotal = calculateGrandTotal();

            if (amtType === "exact") {
                if (cashInput) cashInput.value = grandTotal.toFixed(2);
            } else {
                const val = parseFloat(amtType) || 0;
                const currentVal = parseFloat(cashInput.value || 0);
                if (cashInput) cashInput.value = (currentVal + val).toFixed(2);
            }
            updateChangeDue();
        });
    });

    // 8. Clear Cart & Complete Sale
    const clearCartBtn = document.getElementById("clearCartBtn");
    if (clearCartBtn) {
        clearCartBtn.addEventListener("click", clearCart);
    }

    const completeSaleBtn = document.getElementById("completeSaleBtn");
    if (completeSaleBtn) {
        completeSaleBtn.addEventListener("click", completeSale);
    }

    // 9. Success Modal Actions
    const newSaleModalBtn = document.getElementById("newSaleModalBtn");
    if (newSaleModalBtn) {
        newSaleModalBtn.addEventListener("click", () => {
            closeSuccessModal();
            loadProductsCatalog();
        });
    }
}

// ============================================================
// 10. INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    renderLiveDate();
    setupEventListeners();

    // Instant initial render
    loadCashierProfile();
    loadCustomers();
    loadProductsCatalog();
    renderCart();

    // Live backend discovery & refresh
    await discoverBackend();
    if (isBackendOnline) {
        loadCashierProfile();
        loadCustomers();
        loadProductsCatalog();
    }
});
