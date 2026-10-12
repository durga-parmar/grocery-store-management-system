/**
 * cashier_notifications.js
 * Unified Real-Time Notification & Audio Alert Manager for CashierPanel
 * Handles:
 *  - 🔔 New Order Received (Order ID, Customer Name, Total Amount, Sound once, Orders Badge update)
 *  - ⚠️ Low Stock Alert (Stock 1-5, Product Name, Current Stock, Sound once)
 *  - 🚫 Out of Stock Alert (Stock = 0, Product Name, Sound once)
 *  - Common Rules: Stock > 5 ignored, no duplicate toasts/sounds, dynamic polling without refresh,
 *                  System Notifications ON/OFF control.
 */

(function () {
    "use strict";

    // Configuration
    const POLL_INTERVAL_MS = 4000; // Poll every 4 seconds
    const STORAGE_KEY_LAST_ORDER_ID = "cashier_last_seen_order_id";
    const STORAGE_KEY_STOCK_STATE = "cashier_stock_notif_state";
    const STORAGE_KEY_NOTIF_ON = "cashier_system_notifications_enabled";
    const STORAGE_KEY_RECENT_NOTIFS = "cashier_recent_notifications_list";

    // Audio Context (Synthesizes sound via Web Audio API - no external assets required)
    let audioCtx = null;
    let audioUnlocked = false;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioCtx = new AudioContext();
            }
        }
        if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    // Unlock audio context on first user click or tap anywhere on page
    function initAudioUnlock() {
        const unlock = () => {
            const ctx = getAudioContext();
            if (ctx && ctx.state === "suspended") {
                ctx.resume().then(() => {
                    audioUnlocked = true;
                }).catch(() => {});
            } else if (ctx && ctx.state === "running") {
                audioUnlocked = true;
            }
            document.removeEventListener("click", unlock);
            document.removeEventListener("keydown", unlock);
        };
        document.addEventListener("click", unlock, { once: true });
        document.addEventListener("keydown", unlock, { once: true });
    }

    // Sound: New Order (Pleasant bright dual-tone chime: D5 -> A5)
    function playOrderSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            // Tone 1: D5 (587.33 Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = "sine";
            osc1.frequency.setValueAtTime(587.33, now);
            gain1.gain.setValueAtTime(0.18, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.3);

            // Tone 2: A5 (880.00 Hz)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(880.00, now + 0.12);
            gain2.gain.setValueAtTime(0.22, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.6);
        } catch (e) {
            console.log("[CashierNotif Audio]:", e);
        }
    }

    // Sound: Low Stock (Warning tone: C5 -> E5)
    function playLowStockSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.15);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.45);
        } catch (e) {
            console.log("[CashierNotif Audio]:", e);
        }
    }

    // Sound: Out of Stock (Alert tone: A4 -> F4)
    function playOutOfStockSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(440.00, now);
            osc.frequency.setValueAtTime(349.23, now + 0.18);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.5);
        } catch (e) {
            console.log("[CashierNotif Audio]:", e);
        }
    }

    // Escape HTML helper
    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Notification State Manager
    class CashierNotificationManager {
        constructor() {
            this.isFirstSync = true;
            this.systemNotificationsEnabled = true;
            this.pollTimer = null;
            this.recentNotifs = this.loadRecentNotifs();
            this.initDOM();
            this.initEvents();
            this.startPolling();
        }

        loadRecentNotifs() {
            try {
                const stored = localStorage.getItem(STORAGE_KEY_RECENT_NOTIFS);
                return stored ? JSON.parse(stored) : [];
            } catch (e) {
                return [];
            }
        }

        saveRecentNotifs() {
            try {
                localStorage.setItem(STORAGE_KEY_RECENT_NOTIFS, JSON.stringify(this.recentNotifs.slice(0, 30)));
            } catch (e) {}
        }

        addRecentNotif(notif) {
            notif.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            this.recentNotifs.unshift(notif);
            if (this.recentNotifs.length > 30) this.recentNotifs.pop();
            this.saveRecentNotifs();
            this.renderDropdownList();
            this.updateBellBadge();
        }

        // Initialize UI Elements (Toast Container, Topbar Bell, Sidebar Orders Badge)
        initDOM() {
            // 1. Ensure Toast Container
            let container = document.getElementById("toastContainer");
            if (!container) {
                container = document.createElement("div");
                container.id = "toastContainer";
                document.body.appendChild(container);
            }

            // 2. Inject Topbar Notification Bell if not already present
            this.injectTopbarBell();

            // 3. Inject / Update Sidebar Orders Badge
            this.updateSidebarOrdersBadge();
        }

        injectTopbarBell() {
            if (document.getElementById("notifBellWrapper")) return;

            const headerRight = document.querySelector(".top-header .header-right") ||
                                document.querySelector(".topbar .topbar-right") ||
                                document.querySelector("header .header-right");

            if (!headerRight) return;

            const bellWrapper = document.createElement("div");
            bellWrapper.className = "notif-bell-wrapper";
            bellWrapper.id = "notifBellWrapper";
            bellWrapper.innerHTML = `
                <button class="notif-bell-btn" id="notifBellBtn" type="button" aria-label="Notifications" title="Notifications">
                    <i class="fa-solid fa-bell"></i>
                    <span class="notif-bell-badge" id="notifBellBadge" style="display:none;">0</span>
                </button>
                <div class="notif-dropdown" id="notifDropdown">
                    <div class="notif-dropdown-header">
                        <h4><i class="fa-solid fa-bell" style="color:#10b981;"></i> Notifications</h4>
                        <label class="notif-toggle-label" title="Toggle System Notifications ON / OFF">
                            <span id="notifStatusText">Alerts ON</span>
                            <span class="notif-toggle-switch">
                                <input type="checkbox" id="notifSystemToggle" checked>
                                <span class="notif-toggle-slider"></span>
                            </span>
                        </label>
                    </div>
                    <div class="notif-dropdown-list" id="notifDropdownList">
                        <div class="notif-empty-state">
                            <i class="fa-regular fa-bell"></i>
                            No notifications yet
                        </div>
                    </div>
                </div>
            `;

            // Insert before profile wrapper or append
            const profileWrapper = headerRight.querySelector(".profile-wrapper") || headerRight.querySelector(".user-profile");
            if (profileWrapper) {
                headerRight.insertBefore(bellWrapper, profileWrapper);
            } else {
                headerRight.appendChild(bellWrapper);
            }

            this.renderDropdownList();
        }

        initEvents() {
            // Dropdown Toggle
            document.addEventListener("click", (e) => {
                const btn = document.getElementById("notifBellBtn");
                const dropdown = document.getElementById("notifDropdown");
                if (!btn || !dropdown) return;

                if (btn.contains(e.target)) {
                    dropdown.classList.toggle("show");
                    btn.classList.toggle("active");
                    // Clear badge count on open
                    this.clearBellBadge();
                } else if (!dropdown.contains(e.target)) {
                    dropdown.classList.remove("show");
                    btn.classList.remove("active");
                }
            });

            // System Notification Switch
            document.addEventListener("change", async (e) => {
                if (e.target && e.target.id === "notifSystemToggle") {
                    const isEnabled = e.target.checked;
                    this.setSystemNotificationsEnabled(isEnabled, true);
                }
            });
        }

        setSystemNotificationsEnabled(enabled, syncBackend = true) {
            this.systemNotificationsEnabled = Boolean(enabled);
            localStorage.setItem(STORAGE_KEY_NOTIF_ON, this.systemNotificationsEnabled ? "true" : "false");

            const toggleInput = document.getElementById("notifSystemToggle");
            if (toggleInput) toggleInput.checked = this.systemNotificationsEnabled;

            const statusText = document.getElementById("notifStatusText");
            if (statusText) statusText.textContent = this.systemNotificationsEnabled ? "Alerts ON" : "Alerts OFF";

            if (syncBackend) {
                fetch("/api/cashier/notifications/toggle", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ enabled: this.systemNotificationsEnabled })
                }).catch(() => {});
            }
        }

        updateBellBadge() {
            const badge = document.getElementById("notifBellBadge");
            if (!badge) return;
            const count = this.unreadCount || 0;
            if (count > 0) {
                badge.textContent = count > 99 ? "99+" : count;
                badge.style.display = "block";
            } else {
                badge.style.display = "none";
            }
        }

        clearBellBadge() {
            this.unreadCount = 0;
            this.updateBellBadge();
        }

        renderDropdownList() {
            const listEl = document.getElementById("notifDropdownList");
            if (!listEl) return;

            if (!this.recentNotifs || this.recentNotifs.length === 0) {
                listEl.innerHTML = `
                    <div class="notif-empty-state">
                        <i class="fa-regular fa-bell"></i>
                        No notifications yet
                    </div>
                `;
                return;
            }

            listEl.innerHTML = this.recentNotifs.map(n => {
                let iconClass = "fa-cart-shopping";
                let typeClass = "order";
                if (n.type === "low_stock") {
                    iconClass = "fa-triangle-exclamation";
                    typeClass = "low";
                } else if (n.type === "out_stock") {
                    iconClass = "fa-ban";
                    typeClass = "out";
                }

                return `
                    <div class="notif-item">
                        <div class="notif-item-icon ${typeClass}">
                            <i class="fa-solid ${iconClass}"></i>
                        </div>
                        <div class="notif-item-content">
                            <div class="notif-item-title">
                                <span>${escapeHtml(n.title)}</span>
                                <span class="time">${escapeHtml(n.time || "")}</span>
                            </div>
                            <div class="notif-item-desc">${escapeHtml(n.desc)}</div>
                        </div>
                    </div>
                `;
            }).join("");
        }

        updateSidebarOrdersBadge(count) {
            // Remove sidebar order badge so Orders menu item has no badge
            const badges = document.querySelectorAll(".sidebar-order-badge, #sidebarOrderBadge");
            badges.forEach(b => b.remove());

            // Update any order count elements on page
            if (count !== undefined) {
                const kpiTotal = document.getElementById("kpiTotalOrders");
                if (kpiTotal) kpiTotal.textContent = count;
                const totalCountEl = document.getElementById("totalOrdersCount");
                if (totalCountEl) totalCountEl.textContent = count;
            }
        }

        // Display Floating Toast Card
        showToast(type, title, desc, pills = []) {
            if (!this.systemNotificationsEnabled) return;

            const container = document.getElementById("toastContainer");
            if (!container) return;

            const toast = document.createElement("div");
            let typeClass = "order-toast";
            let iconHtml = '<i class="fa-solid fa-cart-shopping"></i>';

            if (type === "low_stock") {
                typeClass = "low-stock-toast";
                iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';
            } else if (type === "out_stock") {
                typeClass = "out-stock-toast";
                iconHtml = '<i class="fa-solid fa-ban"></i>';
            }

            toast.className = `notif-toast-card ${typeClass}`;

            const pillsHtml = pills.length > 0 ? `
                <div class="notif-toast-pills">
                    ${pills.map(p => `<span class="notif-pill ${p.colorClass || 'pill-gray'}">${escapeHtml(p.text)}</span>`).join("")}
                </div>
            ` : "";

            toast.innerHTML = `
                <div class="notif-toast-inner">
                    <div class="notif-toast-icon-wrap">
                        ${iconHtml}
                    </div>
                    <div class="notif-toast-body">
                        <div class="notif-toast-header">
                            <span class="notif-toast-title">${escapeHtml(title)}</span>
                            <button class="notif-toast-close" type="button" title="Dismiss">&times;</button>
                        </div>
                        <div class="notif-toast-meta">${desc}</div>
                        ${pillsHtml}
                    </div>
                </div>
                <div class="notif-toast-progress">
                    <div class="notif-toast-bar"></div>
                </div>
            `;

            container.appendChild(toast);

            const removeToast = () => {
                if (toast.classList.contains("closing")) return;
                toast.classList.add("closing");
                setTimeout(() => toast.remove(), 300);
            };

            // Close button
            const closeBtn = toast.querySelector(".notif-toast-close");
            if (closeBtn) {
                closeBtn.addEventListener("click", removeToast);
            }

            // Auto dismiss after 6s
            setTimeout(removeToast, 6000);
        }

        // Main Polling Method
        async pollNotifications() {
            try {
                // Get last seen order ID from localStorage
                let lastOrderId = parseInt(localStorage.getItem(STORAGE_KEY_LAST_ORDER_ID) || "0", 10);

                const res = await fetch(`/api/cashier/notifications?last_order_id=${lastOrderId}&_t=${Date.now()}`, {
                    cache: "no-store"
                });

                if (!res.ok) return;
                const data = await res.json();
                if (!data || !data.success) return;

                // Sync System Notifications setting from backend
                if (data.system_notifications !== undefined) {
                    // If backend setting changed, sync local state
                    if (this.isFirstSync) {
                        this.setSystemNotificationsEnabled(data.system_notifications, false);
                    } else if (data.system_notifications !== this.systemNotificationsEnabled) {
                        this.setSystemNotificationsEnabled(data.system_notifications, false);
                    }
                }

                // Update orders badge / count
                if (data.total_orders !== undefined) {
                    this.updateSidebarOrdersBadge(data.total_orders);
                }

                // On first load, initialize lastOrderId to current max_order_id without spamming past orders
                if (this.isFirstSync) {
                    if (data.max_order_id !== undefined) {
                        localStorage.setItem(STORAGE_KEY_LAST_ORDER_ID, String(data.max_order_id));
                    }
                    this.isFirstSync = false;

                    // Initialize stock baseline without playing sound immediately on page load
                    this.processStockBaseline(data.low_stock_products || [], data.out_of_stock_products || []);
                    return;
                }

                // Process New Orders
                if (data.new_orders && Array.isArray(data.new_orders) && data.new_orders.length > 0) {
                    let hasNewOrder = false;
                    let maxSeen = lastOrderId;

                    data.new_orders.forEach(order => {
                        const oid = parseInt(order.order_id, 10);
                        if (oid > lastOrderId) {
                            hasNewOrder = true;
                            if (oid > maxSeen) maxSeen = oid;

                            const custName = order.customer_name || "Walk-in Customer";
                            const amt = parseFloat(order.total_amount || 0).toFixed(2);

                            // Show toast
                            this.showToast(
                                "new_order",
                                "🔔 New Order Received",
                                `Order <strong>#${oid}</strong> received from <strong>${escapeHtml(custName)}</strong>.`,
                                [
                                    { text: `Order #${oid}`, colorClass: "pill-green" },
                                    { text: `₹${amt}`, colorClass: "pill-gray" }
                                ]
                            );

                            // Add to dropdown history
                            this.unreadCount = (this.unreadCount || 0) + 1;
                            this.addRecentNotif({
                                type: "new_order",
                                title: "🔔 New Order Received",
                                desc: `Order #${oid} • ${custName} • ₹${amt}`
                            });
                        }
                    });

                    if (hasNewOrder) {
                        localStorage.setItem(STORAGE_KEY_LAST_ORDER_ID, String(maxSeen));
                        if (this.systemNotificationsEnabled) {
                            playOrderSound(); // Play once for the batch of new orders
                        }
                    }
                } else if (data.max_order_id !== undefined && data.max_order_id > lastOrderId) {
                    localStorage.setItem(STORAGE_KEY_LAST_ORDER_ID, String(data.max_order_id));
                }

                // Process Low Stock & Out of Stock Alerts
                this.processStockAlerts(data.low_stock_products || [], data.out_of_stock_products || []);

            } catch (err) {
                console.log("[CashierNotif Poll Notice]:", err);
            }
        }

        // Initialize stock baseline on first run (prevents duplicate audio alerts on first page visit)
        processStockBaseline(lowProds, outProds) {
            let stockState = {};
            try {
                const stored = localStorage.getItem(STORAGE_KEY_STOCK_STATE);
                stockState = stored ? JSON.parse(stored) : {};
            } catch (e) {
                stockState = {};
            }

            // Record current out of stock
            outProds.forEach(p => {
                stockState[p.product_id] = { status: "out", stock: 0 };
            });

            // Record current low stock
            lowProds.forEach(p => {
                stockState[p.product_id] = { status: "low", stock: p.stock };
            });

            localStorage.setItem(STORAGE_KEY_STOCK_STATE, JSON.stringify(stockState));
        }

        // Process stock alerts with strict de-duplication rules:
        // - Stock 1–5 → ⚠️ Low Stock Alert (once when product enters low stock)
        // - Stock = 0 → 🚫 Out of Stock (once when product enters out of stock)
        // - Stock > 5 → no notification, clear alerted state
        processStockAlerts(lowProds, outProds) {
            let stockState = {};
            try {
                const stored = localStorage.getItem(STORAGE_KEY_STOCK_STATE);
                stockState = stored ? JSON.parse(stored) : {};
            } catch (e) {
                stockState = {};
            }

            let stateChanged = false;
            let playLowSound = false;
            let playOutSound = false;

            const currentLowIds = new Set(lowProds.map(p => p.product_id));
            const currentOutIds = new Set(outProds.map(p => p.product_id));

            // 1. Check Out of Stock (stock = 0)
            outProds.forEach(p => {
                const pid = p.product_id;
                const prev = stockState[pid];

                // Only alert if NOT already alerted as 'out'
                if (!prev || prev.status !== "out") {
                    stockState[pid] = { status: "out", stock: 0 };
                    stateChanged = true;
                    playOutSound = true;

                    this.showToast(
                        "out_stock",
                        "🚫 Out of Stock",
                        `Product <strong>${escapeHtml(p.product_name)}</strong> is currently out of stock!`,
                        [
                            { text: "Stock: 0", colorClass: "pill-red" }
                        ]
                    );

                    this.unreadCount = (this.unreadCount || 0) + 1;
                    this.addRecentNotif({
                        type: "out_stock",
                        title: "🚫 Out of Stock",
                        desc: `${p.product_name} is out of stock.`
                    });
                }
            });

            // 2. Check Low Stock (stock 1-5)
            lowProds.forEach(p => {
                const pid = p.product_id;
                const prev = stockState[pid];

                // Only alert if NOT already alerted for low stock with same or alerted state
                if (!prev || prev.status !== "low") {
                    stockState[pid] = { status: "low", stock: p.stock };
                    stateChanged = true;
                    playLowSound = true;

                    this.showToast(
                        "low_stock",
                        "⚠️ Low Stock Alert",
                        `Product <strong>${escapeHtml(p.product_name)}</strong> is running low on stock.`,
                        [
                            { text: `Only ${p.stock} left in stock`, colorClass: "pill-amber" }
                        ]
                    );

                    this.unreadCount = (this.unreadCount || 0) + 1;
                    this.addRecentNotif({
                        type: "low_stock",
                        title: "⚠️ Low Stock Alert",
                        desc: `${p.product_name} • Only ${p.stock} remaining.`
                    });
                }
            });

            // 3. Clear products whose stock is now > 5 (restocked)
            Object.keys(stockState).forEach(pidStr => {
                const pid = parseInt(pidStr, 10);
                if (!currentLowIds.has(pid) && !currentOutIds.has(pid)) {
                    delete stockState[pid];
                    stateChanged = true;
                }
            });

            if (stateChanged) {
                localStorage.setItem(STORAGE_KEY_STOCK_STATE, JSON.stringify(stockState));
            }

            if (this.systemNotificationsEnabled) {
                if (playOutSound) {
                    playOutOfStockSound();
                } else if (playLowSound) {
                    playLowStockSound();
                }
            }
        }

        startPolling() {
            // Immediate initial poll
            this.pollNotifications();

            // Recurring poll without page refresh
            this.pollTimer = setInterval(() => {
                // Only poll if document is visible or recently active
                if (!document.hidden) {
                    this.pollNotifications();
                }
            }, POLL_INTERVAL_MS);

            // Re-poll immediately when tab becomes visible
            document.addEventListener("visibilitychange", () => {
                if (!document.hidden) {
                    this.pollNotifications();
                }
            });
        }
    }

    // Initialize once DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            initAudioUnlock();
            window.cashierNotifManager = new CashierNotificationManager();
        });
    } else {
        initAudioUnlock();
        window.cashierNotifManager = new CashierNotificationManager();
    }

})();
