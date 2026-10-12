/**
 * home.js - Unified Dynamic JavaScript for GroceryHub Landing Page
 * Connects directly to Python HTTPServer & MySQL Database with smart endpoint auto-discovery
 */

// Candidate API endpoints
const API_CANDIDATES = [
    "http://localhost:9000/api",
    "http://127.0.0.1:9000/api",
    "http://localhost:9007/api",
    "http://127.0.0.1:9007/api",
    "http://localhost:9013/api",
    "http://127.0.0.1:9013/api",
    "http://localhost:9008/api",
    "http://127.0.0.1:9008/api",
    "http://localhost:9010/api",
    "http://127.0.0.1:9010/api",
    (window.location.origin && !window.location.origin.startsWith('file') && window.location.origin !== 'null') ? window.location.origin + '/api' : '',
    '/api',
    '/demo/api'
].filter(Boolean);

let ACTIVE_API_BASE = API_CANDIDATES[0];

// Category image mapper
const CATEGORY_IMAGE_MAP = {
    "fruits": "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=400&q=80",
    "fresh fruits": "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=400&q=80",
    "vegetables": "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80",
    "fresh vegetables": "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80",
    "dairy": "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=400&q=80",
    "dairy & eggs": "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=400&q=80",
    "cold drinks": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80",
    "beverages": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80",
    "beverages & drinks": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80",
    "dry fruits": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80",
    "snacks": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=80",
    "bakery": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80",
    "foodgrains": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80",
    "frozen foods": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
    "personal care": "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80"
};

// Customer Pagination State
let ALL_CUSTOMERS = [];
let CURRENT_CUST_PAGE = 0;
const CUST_PER_PAGE = 3;

// =============================================================================
// 1. SMART HTTP REQUEST HELPER (AUTO-FAILOVER & RETRY ACROSS BACKEND PORTS)
// =============================================================================
async function apiRequest(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    const candidates = [ACTIVE_API_BASE, ...API_CANDIDATES.filter(c => c !== ACTIVE_API_BASE)];
    
    let lastError = null;
    for (const base of candidates) {
        try {
            const url = `${base}${cleanEndpoint}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            const fetchOpts = {
                ...options,
                signal: controller.signal
            };

            const res = await fetch(url, fetchOpts);
            clearTimeout(timeoutId);

            if (res.ok || res.status === 400 || res.status === 404 || res.status === 500) {
                ACTIVE_API_BASE = base;
                return res;
            }
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError || new Error("Failed to connect to backend server.");
}

// =============================================================================
// 2. INITIALIZATION & SERVER DETECTION
// =============================================================================
document.addEventListener("DOMContentLoaded", async () => {
    setupNavigation();
    setupModalKeyEvents();
    loadDashboardMetrics();
    loadLiveCategories();
    loadLiveCustomers();
    loadStoreSettings();
});

// =============================================================================
// 3. LOAD LIVE METRICS FROM MYSQL DATABASE
// =============================================================================
async function loadDashboardMetrics() {
    try {
        const res = await apiRequest(`/dashboard-stats?_t=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch dashboard stats");
        const data = await res.json();

        // Update Total Products
        const prodCount = (data.totalProducts !== undefined) ? data.totalProducts : 0;
        const prodElem = document.getElementById("statProducts");
        if (prodElem) prodElem.textContent = prodCount;

        // Update Total Customers
        const custCount = (data.totalCustomers !== undefined) ? data.totalCustomers : (data.totalUsers || 0);
        const custElem = document.getElementById("statCustomers");
        if (custElem) custElem.textContent = custCount;
        const custHighlight = document.getElementById("custCardCount");
        if (custHighlight) custHighlight.textContent = custCount;

        // Update Total Categories
        const catCount = (data.totalCategories !== undefined) ? data.totalCategories : 0;
        const catElem = document.getElementById("statCategories");
        if (catElem) catElem.textContent = catCount;

        // Update Total Orders
        const ordCount = (data.totalOrders !== undefined) ? data.totalOrders : 0;
        const ordElem = document.getElementById("statOrders");
        if (ordElem) ordElem.textContent = ordCount;

        // Update Revenue
        const rev = Number(data.totalRevenue || 0);
        const revFormatted = "₹" + rev.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        const revElem = document.getElementById("statRevenue");
        if (revElem) revElem.textContent = revFormatted;

    } catch (err) {
        console.warn("[Metrics Notice]:", err);
    }
}

// =============================================================================
// 4. LOAD CATEGORIES & CATEGORY PRODUCTS MODAL (NO DASHBOARD REDIRECT)
// =============================================================================
async function loadLiveCategories() {
    try {
        const res = await apiRequest(`/categories?_t=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch categories");
        const data = await res.json();
        const categories = data.categories || data || [];

        const catCountElem = document.getElementById("statCategories");
        if (catCountElem && Array.isArray(categories)) {
            catCountElem.textContent = categories.length;
        }

        const grid = document.getElementById("categoriesGrid");
        if (!grid) return;
        grid.innerHTML = "";

        if (Array.isArray(categories) && categories.length > 0) {
            categories.forEach(cat => {
                const catId = cat.cat_id || cat.id;
                const name = cat.cat_name || "Category";
                const desc = cat.description || "Fresh products & daily store essentials";
                const catKey = name.toLowerCase().trim();
                let imgUrl = cat.image || CATEGORY_IMAGE_MAP[catKey];
                if (!imgUrl || !imgUrl.startsWith("http")) {
                    imgUrl = CATEGORY_IMAGE_MAP[catKey] || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80";
                }

                const card = document.createElement("div");
                card.className = "category-card";
                card.innerHTML = `
                    <div class="cat-img-box">
                        <img src="${imgUrl}" alt="${name}" class="cat-img" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80'">
                    </div>
                    <div class="cat-body">
                        <h4 class="cat-title">${escapeHtml(name)}</h4>
                        <p class="cat-desc">${escapeHtml(desc)}</p>
                        <button type="button" class="btn btn-cat-link" onclick="openCategoryProducts(${catId}, '${escapeJsString(name)}')">
                            <i class="fas fa-eye"></i> View Products
                        </button>
                    </div>
                `;
                grid.appendChild(card);
            });
        } else {
            grid.innerHTML = `<div class="empty-state-card"><p><i class="fas fa-info-circle"></i> No categories available at the moment.</p></div>`;
        }
    } catch (err) {
        console.warn("[Categories Load Notice]:", err);
    }
}

/**
 * Open in-page modal to view only products belonging to the selected category
 */
async function openCategoryProducts(catId, catName) {
    const modal = document.getElementById("categoryProductsModal");
    const modalTitle = document.getElementById("catModalTitle");
    const modalSubtitle = document.getElementById("catModalSubtitle");
    const list = document.getElementById("catProductsList");

    if (!modal || !list) return;

    modalTitle.textContent = `${catName} Products`;
    modalSubtitle.textContent = `Fetching live database products for ${catName}...`;
    list.innerHTML = `
        <div class="modal-loading-box">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
            <p>Loading products from MySQL database...</p>
        </div>
    `;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    try {
        // Query products filtered by cat_id
        const res = await apiRequest(`/products?cat_id=${catId}&category=${encodeURIComponent(catName)}&_t=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch category products");
        const data = await res.json();
        let products = data.products || [];

        // Client-side category filter fallback
        if (products.length > 0) {
            const filtered = products.filter(p => {
                if (p.cat_id && String(p.cat_id) === String(catId)) return true;
                if (p.cat_name && p.cat_name.toLowerCase() === catName.toLowerCase()) return true;
                return false;
            });
            if (filtered.length > 0) {
                products = filtered;
            }
        }

        modalSubtitle.textContent = `${products.length} product${products.length === 1 ? '' : 's'} in ${catName}`;

        if (products.length === 0) {
            list.innerHTML = `
                <div class="cat-empty-products">
                    <i class="fas fa-box-open fa-3x"></i>
                    <h4>No Products Found</h4>
                    <p>There are currently no products registered under <strong>${escapeHtml(catName)}</strong>.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = "";
        products.forEach((prod, index) => {
            const pName = prod.product_name || `Product #${prod.product_id}`;
            const price = Number(prod.price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const stock = prod.stock !== undefined ? prod.stock : 0;
            const status = (prod.status || "in stock").toLowerCase();
            let statusBadgeClass = "badge-in-stock";
            let statusText = `In Stock (${stock})`;

            if (status.includes("out") || stock === 0) {
                statusBadgeClass = "badge-out-stock";
                statusText = "Out of Stock";
            } else if (status.includes("low") || stock <= 10) {
                statusBadgeClass = "badge-low-stock";
                statusText = `Low Stock (${stock})`;
            }

            const item = document.createElement("div");
            item.className = "cat-product-item";
            item.innerHTML = `
                <div class="cat-prod-index">${index + 1}</div>
                <div class="cat-prod-icon">
                    <i class="fas fa-cube"></i>
                </div>
                <div class="cat-prod-info">
                    <h4 class="cat-prod-name">${escapeHtml(pName)}</h4>
                    <span class="cat-prod-category"><i class="fas fa-tag"></i> ${escapeHtml(catName)}</span>
                </div>
                <div class="cat-prod-meta">
                    <span class="cat-prod-price">₹${price}</span>
                    <span class="cat-prod-status ${statusBadgeClass}">${statusText}</span>
                </div>
            `;
            list.appendChild(item);
        });

    } catch (err) {
        console.error("[Category Products Error]:", err);
        list.innerHTML = `
            <div class="cat-empty-products error">
                <i class="fas fa-exclamation-triangle fa-3x"></i>
                <h4>Unable to load products</h4>
                <p>${escapeHtml(err.message || 'Please ensure python server.py is running.')}</p>
            </div>
        `;
    }
}

function closeCategoryModal(event) {
    if (event && event.target && event.target.closest('.category-modal-card') && !event.target.classList.contains('btn-modal-close')) {
        return;
    }
    const modal = document.getElementById("categoryProductsModal");
    if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }
}

function setupModalKeyEvents() {
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeCategoryModal();
        }
    });
}

// =============================================================================
// 5. LOAD LIVE CUSTOMERS WITH PREVIOUS / NEXT BROWSING (NO DASHBOARD REDIRECT)
// =============================================================================
async function loadLiveCustomers() {
    try {
        const res = await apiRequest(`/customers?_t=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch customers");
        const data = await res.json();
        ALL_CUSTOMERS = data.customers || [];

        // Update count on card & metrics
        const total = ALL_CUSTOMERS.length;
        const custHighlight = document.getElementById("custCardCount");
        if (custHighlight) custHighlight.textContent = total;
        const custMetric = document.getElementById("statCustomers");
        if (custMetric) custMetric.textContent = total;

        CURRENT_CUST_PAGE = 0;
        renderCustomerPage();

    } catch (err) {
        console.warn("[Customer Load Notice]:", err);
        const grid = document.getElementById("customerCardsGrid");
        if (grid) {
            grid.innerHTML = `<div class="empty-state-card"><p><i class="fas fa-info-circle"></i> Unable to load customer records.</p></div>`;
        }
    }
}

function renderCustomerPage() {
    const grid = document.getElementById("customerCardsGrid");
    const info = document.getElementById("custPaginationInfo");
    const prevBtn = document.getElementById("custPrevBtn");
    const nextBtn = document.getElementById("custNextBtn");

    if (!grid) return;

    if (ALL_CUSTOMERS.length === 0) {
        grid.innerHTML = `<div class="empty-state-card"><p>No customer records found in database.</p></div>`;
        if (info) info.textContent = "0 of 0";
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        return;
    }

    const totalPages = Math.ceil(ALL_CUSTOMERS.length / CUST_PER_PAGE);
    if (CURRENT_CUST_PAGE >= totalPages) CURRENT_CUST_PAGE = totalPages - 1;
    if (CURRENT_CUST_PAGE < 0) CURRENT_CUST_PAGE = 0;

    const startIdx = CURRENT_CUST_PAGE * CUST_PER_PAGE;
    const endIdx = Math.min(startIdx + CUST_PER_PAGE, ALL_CUSTOMERS.length);
    const pageCustomers = ALL_CUSTOMERS.slice(startIdx, endIdx);

    grid.innerHTML = "";
    pageCustomers.forEach(c => {
        const name = c.customer_name || "Valued Customer";
        const phone = c.phone || "N/A";
        const city = c.city || "Gujarat";
        const email = c.email || "customer@example.com";

        const card = document.createElement("div");
        card.className = "customer-card";
        card.innerHTML = `
            <div class="cust-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="cust-details">
                <h4 class="cust-name">${escapeHtml(name)}</h4>
                <p class="cust-phone"><i class="fas fa-phone"></i> ${escapeHtml(phone)}</p>
                <p class="cust-city"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(city)}</p>
                <p class="cust-email"><i class="fas fa-envelope"></i> ${escapeHtml(email)}</p>
            </div>
        `;
        grid.appendChild(card);
    });

    if (info) {
        info.textContent = `${startIdx + 1}–${endIdx} of ${ALL_CUSTOMERS.length}`;
    }

    if (prevBtn) {
        prevBtn.disabled = (CURRENT_CUST_PAGE === 0);
    }
    if (nextBtn) {
        nextBtn.disabled = (CURRENT_CUST_PAGE >= totalPages - 1);
    }
}

function prevCustomerPage() {
    if (CURRENT_CUST_PAGE > 0) {
        CURRENT_CUST_PAGE--;
        renderCustomerPage();
    }
}

function nextCustomerPage() {
    const totalPages = Math.ceil(ALL_CUSTOMERS.length / CUST_PER_PAGE);
    if (CURRENT_CUST_PAGE < totalPages - 1) {
        CURRENT_CUST_PAGE++;
        renderCustomerPage();
    }
}

// =============================================================================
// 6. LOAD STORE SETTINGS & CONTACT INFO
// =============================================================================
async function loadStoreSettings() {
    try {
        const res = await apiRequest(`/settings?_t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        const store = data.store || (data.data && data.data.store) || {};

        if (store.name) {
            const elem = document.getElementById("infoStoreName");
            if (elem) elem.textContent = store.name;
        }
        if (store.address) {
            const elem = document.getElementById("infoStoreAddress");
            if (elem) elem.textContent = store.address;
        }
        if (store.phone) {
            const elem = document.getElementById("infoStorePhone");
            if (elem) elem.textContent = store.phone;
        }
        if (store.email) {
            const elem = document.getElementById("infoStoreEmail");
            if (elem) elem.textContent = store.email;
        }
        if (store.gst) {
            const elem = document.getElementById("infoStoreGst");
            if (elem) elem.textContent = store.gst;
        }
    } catch (e) {
        // fallback
    }
}

// =============================================================================
// 7. CONTACT FORM SUBMISSION, TOAST NOTIFICATIONS & AUDIO FEEDBACK
// =============================================================================

/**
 * Play a pleasant dual-tone notification chime synthesized via Web Audio API
 */
function playNotificationSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        const now = ctx.currentTime;
        
        // Note 1: E5 (659.25 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        // Note 2: A5 (880.00 Hz) chime
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880.00, now + 0.12);
        gain2.gain.setValueAtTime(0.25, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.65);

    } catch (e) {
        console.log("[Audio Notice]: AudioContext playback not supported or blocked.", e);
    }
}

/**
 * Show a clear Toast notification in top right corner
 */
function showToast(message, type = "success") {
    const toast = document.getElementById("toastNotification");
    if (!toast) return;

    const icon = (type === "success") ? "fa-check-circle" : "fa-exclamation-circle";
    toast.className = `toast-notification ${type} show`;
    toast.innerHTML = `
        <div class="toast-icon"><i class="fas ${icon}"></i></div>
        <div class="toast-content">${escapeHtml(message)}</div>
        <button class="toast-close" onclick="hideToast()">&times;</button>
    `;

    if (window._toastTimeout) clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
        hideToast();
    }, 5000);
}

function hideToast() {
    const toast = document.getElementById("toastNotification");
    if (toast) {
        toast.classList.remove("show");
    }
}

/**
 * Handle Contact Us Form Submit
 */
async function handleContactSubmit(event) {
    event.preventDefault();

    const nameInput = document.getElementById("contactName");
    const emailInput = document.getElementById("contactEmail");
    const subjectInput = document.getElementById("contactSubject");
    const messageInput = document.getElementById("contactMessage");

    const errName = document.getElementById("errContactName");
    const errEmail = document.getElementById("errContactEmail");
    const errSubject = document.getElementById("errContactSubject");
    const errMessage = document.getElementById("errContactMessage");

    const statusBox = document.getElementById("contactStatus");
    const btn = document.getElementById("btnContactSubmit");

    // Clear previous error messages
    if (errName) errName.textContent = "";
    if (errEmail) errEmail.textContent = "";
    if (errSubject) errSubject.textContent = "";
    if (errMessage) errMessage.textContent = "";
    if (statusBox) statusBox.style.display = "none";

    const name = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";
    const subject = subjectInput ? subjectInput.value.trim() : "";
    const message = messageInput ? messageInput.value.trim() : "";

    let hasError = false;

    if (!name) {
        if (errName) errName.textContent = "Please enter your name.";
        hasError = true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
        if (errEmail) errEmail.textContent = "Please enter your email address.";
        hasError = true;
    } else if (!emailRegex.test(email)) {
        if (errEmail) errEmail.textContent = "Please enter a valid email address.";
        hasError = true;
    }

    if (!subject) {
        if (errSubject) errSubject.textContent = "Please enter a subject.";
        hasError = true;
    }

    if (!message) {
        if (errMessage) errMessage.textContent = "Please write your message.";
        hasError = true;
    }

    if (hasError) {
        showToast("Please correct the errors in the form.", "error");
        return false;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        const payload = { name, email, subject, message };
        const res = await apiRequest(`/contact`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && (data.success || data.status === "success")) {
            // Play notification sound
            playNotificationSound();

            // Show success toast notification
            showToast("Message sent successfully!", "success");

            // Show in-form status message
            if (statusBox) {
                statusBox.style.display = "block";
                statusBox.className = "contact-status-msg success";
                statusBox.innerHTML = `<i class="fas fa-check-circle"></i> Thank you, <strong>${escapeHtml(name)}</strong>! Your message has been saved to the database.`;
            }

            // Clear / reset form
            document.getElementById("contactForm").reset();

            setTimeout(() => {
                if (statusBox) statusBox.style.display = "none";
            }, 7000);

        } else {
            const errorMsg = data.message || data.error || "Failed to send message. Please try again.";
            showToast(errorMsg, "error");
            if (statusBox) {
                statusBox.style.display = "block";
                statusBox.className = "contact-status-msg error";
                statusBox.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${escapeHtml(errorMsg)}`;
            }
        }
    } catch (err) {
        console.error("[Contact Submit Error]:", err);
        const errorMsg = "Network error: Unable to reach server. Please ensure python server.py is running.";
        showToast(errorMsg, "error");
        if (statusBox) {
            statusBox.style.display = "block";
            statusBox.className = "contact-status-msg error";
            statusBox.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${escapeHtml(errorMsg)}`;
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
    }

    return false;
}

// =============================================================================
// 8. NAVIGATION & UI HELPERS
// =============================================================================
function setupNavigation() {
    const navbar = document.getElementById("navbar");
    const mobileToggle = document.getElementById("mobileToggle");
    const navMenu = document.getElementById("navMenu");
    const navLinks = document.querySelectorAll(".nav-link");

    // Scroll Navbar blur effect
    window.addEventListener("scroll", () => {
        if (window.scrollY > 40) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }

        // Active link highlighting based on section
        const scrollPos = window.scrollY + 100;
        const sections = document.querySelectorAll("section[id]");
        sections.forEach(sec => {
            const top = sec.offsetTop;
            const height = sec.offsetHeight;
            const id = sec.getAttribute("id");
            if (scrollPos >= top && scrollPos < top + height) {
                navLinks.forEach(link => {
                    link.classList.remove("active");
                    if (link.getAttribute("href") === `#${id}`) {
                        link.classList.add("active");
                    }
                });
            }
        });
    });

    // Mobile Menu Toggle
    if (mobileToggle && navMenu) {
        mobileToggle.addEventListener("click", () => {
            navMenu.classList.toggle("open");
            const icon = mobileToggle.querySelector("i");
            if (navMenu.classList.contains("open")) {
                icon.className = "fas fa-times";
            } else {
                icon.className = "fas fa-bars";
            }
        });

        // Close menu on link click
        navLinks.forEach(link => {
            link.addEventListener("click", () => {
                navMenu.classList.remove("open");
                const icon = mobileToggle.querySelector("i");
                if (icon) icon.className = "fas fa-bars";
            });
        });
    }
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

function escapeJsString(str) {
    if (!str) return "";
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}


