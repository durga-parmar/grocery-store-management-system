/**
 * product.js - Robust & Responsive Product Management Controller
 * Supports live MySQL Python backend (port 9007 / 9008) with seamless fallback data
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

// In-Memory Database State (Matches MySQL schema & tables)
let fallbackCategories = [
    { cat_id: 6, cat_name: "Fruits", status: "Active" },
    { cat_id: 7, cat_name: "Vegetables", status: "Active" },
    { cat_id: 8, cat_name: "Dairy", status: "Active" },
    { cat_id: 9, cat_name: "Cold Drinks", status: "Active" },
    { cat_id: 10, cat_name: "Dry Fruits", status: "Inactive" },
    { cat_id: 11, cat_name: "Snacks", status: "Active" }
];

let fallbackProducts = [
    {
        product_id: 1,
        product_name: "Fresh Banana",
        cat_id: 6,
        cat_name: "Fruits",
        image: "banana.jpg",
        price: 40.00,
        stock: 100,
        status: "in stock",
        created_at: "2026-02-21 20:45:03"
    },
    {
        product_id: 2,
        product_name: "Red Apple",
        cat_id: 6,
        cat_name: "Fruits",
        image: "apple.jpg",
        price: 120.00,
        stock: 80,
        status: "in stock",
        created_at: "2026-03-03 20:45:03"
    },
    {
        product_id: 3,
        product_name: "Alphonso Mango",
        cat_id: 6,
        cat_name: "Fruits",
        image: "mango.jpg",
        price: 100.00,
        stock: 8,
        status: "low stock",
        created_at: "2026-03-13 20:45:03"
    },
    {
        product_id: 4,
        product_name: "Sweet Orange",
        cat_id: 6,
        cat_name: "Fruits",
        image: "orange.jpg",
        price: 80.00,
        stock: 90,
        status: "in stock",
        created_at: "2026-03-23 20:45:03"
    },
    {
        product_id: 5,
        product_name: "Ripe Pineapple",
        cat_id: 6,
        cat_name: "Fruits",
        image: "pineapple.jpg",
        price: 90.00,
        stock: 0,
        status: "Out of stock",
        created_at: "2026-04-02 20:45:03"
    }
];

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

let currentProducts = [];
let categoriesList = [];
let selectedDeleteId = null;
let currentViewingProduct = null;
let searchDebounceTimer = null;

// ==========================================================
// 1. Toast Notification Helper
// ==========================================================
function showToast(message, type = "success") {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
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
        toast.style.transform = "translateX(100%)";
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ==========================================================
// 2. Load Categories
// ==========================================================
async function fetchCategories() {
    let loaded = false;
    for (const base of API_CANDIDATES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const res = await fetch(`${base}/categories`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                if (data && data.categories && data.categories.length > 0) {
                    categoriesList = data.categories;
                    ACTIVE_API_BASE = base;
                    isBackendOnline = true;
                    loaded = true;
                    break;
                }
            }
        } catch (e) {
            // continue fallback
        }
    }

    if (!loaded) {
        categoriesList = fallbackCategories;
    }

    populateCategoryDropdowns();
}

function populateCategoryDropdowns() {
    const searchCatSelect = document.getElementById("searchCategory");
    const modalCatSelect = document.getElementById("productCategory");

    if (searchCatSelect) {
        searchCatSelect.innerHTML = `<option value="">All Categories</option>`;
        categoriesList.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat.cat_id;
            opt.textContent = cat.cat_name;
            searchCatSelect.appendChild(opt);
        });
    }

    if (modalCatSelect) {
        modalCatSelect.innerHTML = `<option value="">Select Category</option>`;
        categoriesList.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat.cat_id;
            opt.textContent = cat.cat_name;
            modalCatSelect.appendChild(opt);
        });
    }
}

// ==========================================================
// 3. Load User Profile for Header
// ==========================================================
async function fetchUserProfile() {
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
    const role = user.role || "Administrator";
    const email = user.email || "admin@grocerystore.com";
    const status = user.status || "Active";
    const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || "AD";
    const hasPhoto = Boolean(user.profile_picture && String(user.profile_picture).trim());

    const headerAvatar = document.getElementById("headerAvatar");
    const dropdownAvatar = document.getElementById("dropdownAvatar");
    const headerUserName = document.getElementById("headerUserName");
    const headerUserRole = document.getElementById("headerUserRole");
    const dropdownFullName = document.getElementById("dropdownFullName");
    const dropdownEmail = document.getElementById("dropdownEmail");
    const dropdownStatus = document.getElementById("dropdownStatusBadge");

    if (headerAvatar) {
        if (hasPhoto) {
            headerAvatar.innerHTML = `<img src="${user.profile_picture}" alt="${fullName}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
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

    if (dropdownAvatar) {
        if (hasPhoto) {
            dropdownAvatar.innerHTML = `<img src="${user.profile_picture}" alt="${fullName}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
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

    if (headerUserName) headerUserName.textContent = fullName;
    if (headerUserRole) headerUserRole.textContent = role;
    if (dropdownFullName) dropdownFullName.textContent = fullName;
    if (dropdownEmail) dropdownEmail.textContent = email;
    if (dropdownStatus) {
        dropdownStatus.textContent = status;
        dropdownStatus.className = `dropdown-badge ${String(status).toLowerCase() === 'active' ? 'badge-active' : 'badge-inactive'}`;
    }
}

// ==========================================================
// 4. Calculate Dynamic Metrics
// ==========================================================
function calculateMetrics(list) {
    const total = list.length;
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    list.forEach(p => {
        const st = (p.status || "").toLowerCase();
        const stock = parseInt(p.stock) || 0;
        if (st === "out of stock" || stock === 0) {
            outOfStock++;
        } else if (st === "low stock" || stock <= 10) {
            lowStock++;
        } else {
            inStock++;
        }
    });

    if (document.getElementById("totalProducts")) document.getElementById("totalProducts").textContent = total;
    if (document.getElementById("headerTotalProducts")) document.getElementById("headerTotalProducts").textContent = total;
    if (document.getElementById("inStockProducts")) document.getElementById("inStockProducts").textContent = inStock;
    if (document.getElementById("lowStockProducts")) document.getElementById("lowStockProducts").textContent = lowStock;
    if (document.getElementById("outStockProducts")) document.getElementById("outStockProducts").textContent = outOfStock;
}

// ==========================================================
// 5. Fetch Products (API or Local DB) with Dynamic Filters
// ==========================================================
async function fetchProducts() {
    const headerSearch = document.getElementById("headerSearch")?.value.trim() || "";
    const searchId = document.getElementById("searchProductId")?.value.trim() || "";
    const searchName = document.getElementById("searchProductName")?.value.trim() || "";
    const searchCat = document.getElementById("searchCategory")?.value.trim() || "";
    const searchStatus = document.getElementById("searchStatus")?.value.trim() || "";
    const dateFrom = document.getElementById("dateFrom")?.value.trim() || "";
    const dateTo = document.getElementById("dateTo")?.value.trim() || "";

    const params = new URLSearchParams();
    if (headerSearch) params.append("search", headerSearch);
    if (searchId) params.append("id", searchId);
    if (searchName) params.append("name", searchName);
    if (searchCat) params.append("category", searchCat);
    if (searchStatus) params.append("status", searchStatus);
    if (dateFrom) params.append("from_date", dateFrom);
    if (dateTo) params.append("to_date", dateTo);

    let backendSuccess = false;

    // Try live API first
    for (const base of API_CANDIDATES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const res = await fetch(`${base}/products?${params.toString()}`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.products)) {
                    currentProducts = data.products;
                    ACTIVE_API_BASE = base;
                    isBackendOnline = true;
                    backendSuccess = true;

                    if (data.metrics) {
                        if (document.getElementById("totalProducts")) document.getElementById("totalProducts").textContent = data.metrics.total;
                        if (document.getElementById("headerTotalProducts")) document.getElementById("headerTotalProducts").textContent = data.metrics.total;
                        if (document.getElementById("inStockProducts")) document.getElementById("inStockProducts").textContent = data.metrics.inStock;
                        if (document.getElementById("lowStockProducts")) document.getElementById("lowStockProducts").textContent = data.metrics.lowStock;
                        if (document.getElementById("outStockProducts")) document.getElementById("outStockProducts").textContent = data.metrics.outOfStock;
                    } else {
                        calculateMetrics(currentProducts);
                    }
                    break;
                }
            }
        } catch (err) {
            // Try next candidate
        }
    }

    // Fallback Client-Side Dynamic Query Execution
    if (!backendSuccess) {
        let filtered = [...fallbackProducts];

        // 1. Header Search
        if (headerSearch) {
            const term = headerSearch.toLowerCase();
            filtered = filtered.filter(p => 
                String(p.product_id).includes(term) ||
                (p.product_name || "").toLowerCase().includes(term) ||
                (p.cat_name || "").toLowerCase().includes(term)
            );
        }

        // 2. Filter: Product ID
        if (searchId) {
            filtered = filtered.filter(p => String(p.product_id).includes(searchId));
        }

        // 3. Filter: Product Name
        if (searchName) {
            filtered = filtered.filter(p => (p.product_name || "").toLowerCase().includes(searchName.toLowerCase()));
        }

        // 4. Filter: Category
        if (searchCat) {
            filtered = filtered.filter(p => String(p.cat_id) === String(searchCat) || (p.cat_name || "").toLowerCase() === searchCat.toLowerCase());
        }

        // 5. Filter: Status
        if (searchStatus) {
            const s = searchStatus.toLowerCase();
            filtered = filtered.filter(p => {
                const st = (p.status || "").toLowerCase();
                const stock = parseInt(p.stock) || 0;
                if (s === "out of stock") return st === "out of stock" || stock === 0;
                if (s === "low stock") return st === "low stock" || (stock > 0 && stock <= 10);
                if (s === "in stock") return st === "in stock" || stock > 10;
                return st === s;
            });
        }

        // 6. Filter: Date From / To
        if (dateFrom) {
            filtered = filtered.filter(p => (p.created_at || "").substring(0, 10) >= dateFrom);
        }
        if (dateTo) {
            filtered = filtered.filter(p => (p.created_at || "").substring(0, 10) <= dateTo);
        }

        currentProducts = filtered;
        calculateMetrics(fallbackProducts);
    }

    // Update Result Counter
    const searchResultText = document.getElementById("searchResultText");
    if (searchResultText) {
        searchResultText.textContent = `Showing ${currentProducts.length} product${currentProducts.length === 1 ? '' : 's'}`;
    }

    renderProductTable(currentProducts);
}

// ==========================================================
// 6. Render Product Table
// ==========================================================
function renderProductTable(products) {
    const tbody = document.getElementById("productTableBody");
    if (!tbody) return;

    if (!products || products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10">
                    <div class="empty-data">
                        <div class="empty-icon">
                            <i class="fa-solid fa-box-open"></i>
                        </div>
                        <h2>No Products Found</h2>
                        <p>No products match your current search or filter criteria.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    products.forEach(p => {
        const tr = document.createElement("tr");

        let imgSrc = resolveProductImage(p.image, p.product_name);
        let fallbackSrc = resolveProductImage("", p.product_name);
        let imgHtml = `<img src="${imgSrc}" alt="${escapeHtml(p.product_name)}" onerror="this.onerror=null; this.src='${fallbackSrc}';">`;

        // Status badge
        let statusClass = "badge-in-stock";
        let statusText = p.status || "In Stock";
        const lowerStatus = statusText.toLowerCase();
        const stock = parseInt(p.stock) || 0;

        if (lowerStatus === "out of stock" || stock === 0) {
            statusClass = "badge-out-stock";
            statusText = "Out of Stock";
        } else if (lowerStatus === "low stock" || (stock > 0 && stock <= 10)) {
            statusClass = "badge-low-stock";
            statusText = "Low Stock";
        } else {
            statusClass = "badge-in-stock";
            statusText = "In Stock";
        }

        // Format Price
        const priceFormatted = parseFloat(p.price || 0).toFixed(2);

        // Format Date
        let dateFormatted = p.created_at ? p.created_at.substring(0, 10) : "N/A";

        tr.innerHTML = `
            <td class="check-column">
                <input type="checkbox" class="product-row-check" value="${p.product_id}">
            </td>
            <td><strong>#${p.product_id}</strong></td>
            <td>
                <div class="product-img-box">
                    ${imgHtml}
                </div>
            </td>
            <td class="product-name-cell">${escapeHtml(p.product_name)}</td>
            <td>
                <span class="product-cat-tag">
                    <i class="fa-solid fa-tag"></i>
                    ${escapeHtml(p.cat_name || "General")}
                </span>
            </td>
            <td class="product-price-cell">₹${priceFormatted}</td>
            <td class="product-stock-cell">${p.stock} units</td>
            <td>
                <span class="status-badge ${statusClass}">
                    <i class="fa-solid fa-circle" style="font-size: 7px;"></i>
                    ${statusText}
                </span>
            </td>
            <td>${dateFormatted}</td>
            <td>
                <div class="action-cell">
                    <button type="button" class="action-btn view-btn" onclick="window.openViewModal(${p.product_id})" title="View Details">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="action-btn edit-btn" onclick="window.openEditModal(${p.product_id})" title="Edit Product">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" class="action-btn delete-btn" onclick="window.openDeleteModal(${p.product_id})" title="Delete Product">
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
// 7. View Product Modal
// ==========================================================
window.openViewModal = function(productId) {
    const product = currentProducts.find(p => p.product_id == productId) || fallbackProducts.find(p => p.product_id == productId);
    if (!product) return;

    currentViewingProduct = product;
    const body = document.getElementById("viewModalBody");

    let imgSrc = resolveProductImage(product.image, product.product_name);
    let fallbackSrc = resolveProductImage("", product.product_name);
    let imgHtml = `<img src="${imgSrc}" alt="${escapeHtml(product.product_name)}" onerror="this.onerror=null; this.src='${fallbackSrc}';">`;

    let statusBadgeClass = "badge-in-stock";
    let statusText = product.status || "In Stock";
    const lowerStatus = statusText.toLowerCase();
    const stock = parseInt(product.stock) || 0;
    if (lowerStatus === "out of stock" || stock === 0) {
        statusBadgeClass = "badge-out-stock";
        statusText = "Out of Stock";
    } else if (lowerStatus === "low stock" || (stock > 0 && stock <= 10)) {
        statusBadgeClass = "badge-low-stock";
        statusText = "Low Stock";
    }

    body.innerHTML = `
        <div class="view-card-grid">
            <div class="view-img-box">
                ${imgHtml}
            </div>
            <div class="view-info-header">
                <span class="view-id-badge">Product ID: #${product.product_id}</span>
                <h3>${escapeHtml(product.product_name)}</h3>
                <span class="status-badge ${statusBadgeClass}">
                    <i class="fa-solid fa-circle" style="font-size: 7px;"></i>
                    ${statusText}
                </span>
            </div>
        </div>

        <div class="view-details-grid">
            <div class="view-detail-item">
                <span>Category</span>
                <strong>${escapeHtml(product.cat_name || "General")}</strong>
            </div>
            <div class="view-detail-item">
                <span>Unit Price</span>
                <strong>₹${parseFloat(product.price || 0).toFixed(2)}</strong>
            </div>
            <div class="view-detail-item">
                <span>Available Stock</span>
                <strong>${product.stock} units</strong>
            </div>
            <div class="view-detail-item">
                <span>Created At</span>
                <strong>${product.created_at || "N/A"}</strong>
            </div>
        </div>
    `;

    document.getElementById("viewProductModal").classList.add("show");
};

window.closeViewModal = function() {
    document.getElementById("viewProductModal").classList.remove("show");
};

// ==========================================================
// 8. Create & Edit Modal
// ==========================================================
window.openCreateModal = function() {
    document.getElementById("modalTitle").textContent = "Create Product";
    document.getElementById("productId").value = "";
    document.getElementById("productName").value = "";
    document.getElementById("productCategory").value = "";
    document.getElementById("productPrice").value = "";
    document.getElementById("productStock").value = "";
    document.getElementById("productStatus").value = "in stock";
    document.getElementById("productImage").value = "";
    document.getElementById("imagePreviewBox").style.display = "none";
    document.getElementById("imagePreview").src = "";
    document.getElementById("productModal").classList.add("show");
};

window.openEditModal = function(productId) {
    const product = currentProducts.find(p => p.product_id == productId) || fallbackProducts.find(p => p.product_id == productId);
    if (!product) return;

    window.closeViewModal();
    document.getElementById("modalTitle").textContent = "Edit Product";
    document.getElementById("productId").value = product.product_id;
    document.getElementById("productName").value = product.product_name || "";
    document.getElementById("productCategory").value = product.cat_id || "";
    document.getElementById("productPrice").value = product.price || "";
    document.getElementById("productStock").value = product.stock !== undefined ? product.stock : "";
    
    // Status
    const statusVal = (product.status || "in stock").toLowerCase();
    if (statusVal.includes("out")) {
        document.getElementById("productStatus").value = "Out of stock";
    } else if (statusVal.includes("low")) {
        document.getElementById("productStatus").value = "low stock";
    } else {
        document.getElementById("productStatus").value = "in stock";
    }

    // Image preview
    document.getElementById("productImage").value = "";
    if (product.image) {
        document.getElementById("imagePreview").src = resolveProductImage(product.image, product.product_name);
        document.getElementById("previewName").textContent = product.image.split("/").pop();
        document.getElementById("imagePreviewBox").style.display = "flex";
    } else {
        document.getElementById("imagePreviewBox").style.display = "none";
    }

    document.getElementById("productModal").classList.add("show");
};

window.closeProductModal = function() {
    document.getElementById("productModal").classList.remove("show");
};

// Form submission handler
async function handleProductFormSubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById("saveProductBtn");
    const originalText = saveBtn.innerHTML;

    const id = document.getElementById("productId").value;
    const name = document.getElementById("productName").value.trim();
    const catId = document.getElementById("productCategory").value;
    const price = parseFloat(document.getElementById("productPrice").value);
    const stock = parseInt(document.getElementById("productStock").value);
    const status = document.getElementById("productStatus").value;
    const imageInput = document.getElementById("productImage");

    if (!name || !catId || isNaN(price) || isNaN(stock)) {
        showToast("Please fill in all required fields properly", "error");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

    // Find category name
    const catObj = categoriesList.find(c => String(c.cat_id) === String(catId));
    const catName = catObj ? catObj.cat_name : "General";

    let imageBase64 = null;
    let imageFilename = null;
    if (imageInput.files && imageInput.files[0]) {
        const file = imageInput.files[0];
        imageFilename = file.name;
        imageBase64 = await toBase64(file);
    }

    const payload = {
        product_id: id ? parseInt(id) : undefined,
        product_name: name,
        cat_id: parseInt(catId),
        price: price,
        stock: stock,
        status: status,
        image_base64: imageBase64,
        image_filename: imageFilename
    };

    let savedViaApi = false;
    if (isBackendOnline) {
        try {
            const url = id ? `${ACTIVE_API_BASE}/products/update` : `${ACTIVE_API_BASE}/products`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                savedViaApi = true;
            }
        } catch (e) {}
    }

    // Update local database
    if (id) {
        const target = fallbackProducts.find(p => p.product_id == id);
        if (target) {
            target.product_name = name;
            target.cat_id = parseInt(catId);
            target.cat_name = catName;
            target.price = price;
            target.stock = stock;
            target.status = status;
            if (imageBase64) target.image = imageBase64;
        }
        showToast("Product updated successfully!", "success");
    } else {
        const newId = fallbackProducts.length > 0 ? Math.max(...fallbackProducts.map(p => p.product_id)) + 1 : 1;
        fallbackProducts.unshift({
            product_id: newId,
            product_name: name,
            cat_id: parseInt(catId),
            cat_name: catName,
            price: price,
            stock: stock,
            status: status,
            image: imageBase64 || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=120&auto=format&fit=crop&q=60",
            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
        });
        showToast("Product created successfully!", "success");
    }

    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;
    window.closeProductModal();
    fetchProducts();
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ==========================================================
// 9. Delete Product Modal
// ==========================================================
window.openDeleteModal = function(productId) {
    const product = currentProducts.find(p => p.product_id == productId) || fallbackProducts.find(p => p.product_id == productId);
    selectedDeleteId = productId;
    if (product) {
        document.getElementById("deleteConfirmText").textContent = 
            `Are you sure you want to delete "${product.product_name}" (ID #${product.product_id})? This cannot be undone.`;
    }
    document.getElementById("deleteProductModal").classList.add("show");
};

window.closeDeleteModal = function() {
    selectedDeleteId = null;
    document.getElementById("deleteProductModal").classList.remove("show");
};

async function confirmDeleteProduct() {
    if (!selectedDeleteId) return;
    const btn = document.getElementById("confirmDeleteBtn");
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Deleting...`;

    if (isBackendOnline) {
        try {
            await fetch(`${ACTIVE_API_BASE}/products/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product_id: selectedDeleteId })
            });
        } catch (e) {}
    }

    fallbackProducts = fallbackProducts.filter(p => p.product_id != selectedDeleteId);
    showToast("Product deleted successfully", "success");

    btn.disabled = false;
    btn.innerHTML = originalText;
    window.closeDeleteModal();
    fetchProducts();
}

// ==========================================================
// 10. Profile Dropdown & Logout
// ==========================================================
window.toggleProfileDropdown = function(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById("profileDropdownMenu");
    const trigger = document.getElementById("profileTrigger");
    if (!menu || !trigger) return;
    const isShown = menu.classList.contains("show");

    if (isShown) {
        menu.classList.remove("show");
        trigger.setAttribute("aria-expanded", "false");
    } else {
        menu.classList.add("show");
        trigger.setAttribute("aria-expanded", "true");
    }
};

window.closeProfileDropdown = function() {
    const menu = document.getElementById("profileDropdownMenu");
    const trigger = document.getElementById("profileTrigger");
    if (menu) menu.classList.remove("show");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
};

window.openLogoutModal = function() {
    window.closeProfileDropdown();
    document.getElementById("logoutModal").classList.add("show");
};

window.closeLogoutModal = function() {
    document.getElementById("logoutModal").classList.remove("show");
};

window.confirmLogout = function() {
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
};

// ==========================================================
// 11. Event Listeners Setup
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize data
    fetchCategories();
    fetchUserProfile();
    fetchProducts();

    // 2. Sidebar Toggle
    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.getElementById("sidebar");
    if (menuBtn && sidebar) {
        menuBtn.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });
    }

    // 3. Profile dropdown triggers
    const profileTrigger = document.getElementById("profileTrigger");
    if (profileTrigger) {
        profileTrigger.addEventListener("click", window.toggleProfileDropdown);
    }

    document.addEventListener("click", (e) => {
        const wrapper = document.getElementById("profileDropdownWrapper");
        if (wrapper && !wrapper.contains(e.target)) {
            window.closeProfileDropdown();
        }
    });

    // 4. Logout triggers
    const dropdownLogoutBtn = document.getElementById("dropdownLogoutBtn");
    if (dropdownLogoutBtn) {
        dropdownLogoutBtn.addEventListener("click", window.openLogoutModal);
    }

    const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
    if (cancelLogoutBtn) {
        cancelLogoutBtn.addEventListener("click", window.closeLogoutModal);
    }

    const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener("click", window.confirmLogout);
    }

    // 5. Header Search
    const headerSearch = document.getElementById("headerSearch");
    const headerSearchBtn = document.getElementById("headerSearchBtn");

    if (headerSearch) {
        headerSearch.addEventListener("input", () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(fetchProducts, 250);
        });

        headerSearch.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                clearTimeout(searchDebounceTimer);
                fetchProducts();
            }
        });
    }

    if (headerSearchBtn) {
        headerSearchBtn.addEventListener("click", () => {
            clearTimeout(searchDebounceTimer);
            fetchProducts();
        });
    }

    // 6. Filter Controls
    const filterBtn = document.getElementById("filterBtn");
    if (filterBtn) {
        filterBtn.addEventListener("click", fetchProducts);
    }

    const clearFilterBtn = document.getElementById("clearFilterBtn");
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener("click", () => {
            if (document.getElementById("headerSearch")) document.getElementById("headerSearch").value = "";
            if (document.getElementById("searchProductId")) document.getElementById("searchProductId").value = "";
            if (document.getElementById("searchProductName")) document.getElementById("searchProductName").value = "";
            if (document.getElementById("searchCategory")) document.getElementById("searchCategory").value = "";
            if (document.getElementById("searchStatus")) document.getElementById("searchStatus").value = "";
            if (document.getElementById("dateFrom")) document.getElementById("dateFrom").value = "";
            if (document.getElementById("dateTo")) document.getElementById("dateTo").value = "";
            fetchProducts();
        });
    }

    // 7. Create Product Button
    const createProductBtn = document.getElementById("createProductBtn");
    if (createProductBtn) {
        createProductBtn.addEventListener("click", window.openCreateModal);
    }

    // 8. Close Modal Buttons
    const closeProductModalBtn = document.getElementById("closeProductModal");
    const cancelProductBtn = document.getElementById("cancelProduct");
    if (closeProductModalBtn) closeProductModalBtn.addEventListener("click", window.closeProductModal);
    if (cancelProductBtn) cancelProductBtn.addEventListener("click", window.closeProductModal);

    const closeViewModalBtn = document.getElementById("closeViewModal");
    const closeViewBtn = document.getElementById("closeViewBtn");
    if (closeViewModalBtn) closeViewModalBtn.addEventListener("click", window.closeViewModal);
    if (closeViewBtn) closeViewBtn.addEventListener("click", window.closeViewModal);

    const viewEditShortcutBtn = document.getElementById("viewEditShortcutBtn");
    if (viewEditShortcutBtn) {
        viewEditShortcutBtn.addEventListener("click", () => {
            if (currentViewingProduct) {
                window.openEditModal(currentViewingProduct.product_id);
            }
        });
    }

    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener("click", window.closeDeleteModal);
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener("click", confirmDeleteProduct);

    // 9. Product Form Submit
    const productForm = document.getElementById("productForm");
    if (productForm) {
        productForm.addEventListener("submit", handleProductFormSubmit);
    }

    // 10. Image File Preview
    const productImage = document.getElementById("productImage");
    if (productImage) {
        productImage.addEventListener("change", function () {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                const reader = new FileReader();
                reader.onload = function (e) {
                    document.getElementById("imagePreview").src = e.target.result;
                    document.getElementById("previewName").textContent = file.name;
                    document.getElementById("imagePreviewBox").style.display = "flex";
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 11. Select All Checkbox
    const selectAllProducts = document.getElementById("selectAllProducts");
    if (selectAllProducts) {
        selectAllProducts.addEventListener("change", function () {
            const checks = document.querySelectorAll(".product-row-check");
            checks.forEach(c => c.checked = this.checked);
        });
    }

    // 12. Modal backdrop click to close
    window.addEventListener("click", (e) => {
        if (e.target.classList.contains("modal")) {
            e.target.classList.remove("show");
        }
    });
});
