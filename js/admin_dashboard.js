// =========================================================
// admin_dashboard.js
// Works with admin_dash.html (AdminPanel Dashboard)
// =========================================================

// ---------------------------------------------------
// API endpoint candidates -- Python backend
// ---------------------------------------------------
const DASHBOARD_API_CANDIDATES = [
  "/api/dashboard-stats",
  "http://localhost:9013/api/dashboard-stats",
  "http://localhost:9007/api/dashboard-stats",
  "http://localhost:9000/api/dashboard-stats",
  "http://localhost:8000/api/dashboard-stats"
];

document.addEventListener("DOMContentLoaded", async () => {

  // 0. VERIFY DATABASE ROLE ACCESS (Admin Only)
  try {
    const authRes = await fetch(`/api/auth/verify?_t=${Date.now()}`, { cache: "no-store" });
    if (authRes.ok) {
      const authData = await authRes.json();
      if (authData.role && authData.role.toLowerCase() === 'cashier') {
        window.location.replace("/cashierdash.html");
        return;
      }
    }
  } catch (err) {
    console.warn("Auth verify error:", err);
  }

  // Apply theme on load
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.classList.toggle("dark-theme", savedTheme === "dark");

  // ---------------------------------------------------
  // 1. FETCH REAL DATA FROM MYSQL
  // ---------------------------------------------------
  let dashboardData = {
    totalUsers: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalRevenue: 0
  };

  for (const url of DASHBOARD_API_CANDIDATES) {
    try {
      const response = await fetch(`${url}?_t=${Date.now()}`, { cache: "no-store" });
      if (response.ok) {
        dashboardData = await response.json();
        break;
      }
    } catch (e) {
      // Try next candidate
    }
  }


  // ---------------------------------------------------
  // 2. HIGHLIGHT ACTIVE SIDEBAR LINK
  // ---------------------------------------------------
  const navLinks = document.querySelectorAll(".sidebar nav a");
  const currentPage = window.location.pathname.split("/").pop();

  navLinks.forEach(link => {

    link.classList.remove("active");

    const linkPage = link.getAttribute("href");

    if (linkPage === currentPage) {
      link.classList.add("active");
    }

  });

  // Fallback
  if (![...navLinks].some(link => link.classList.contains("active"))) {
    navLinks[0]?.classList.add("active");
  }


  // ---------------------------------------------------
  // 3. HAMBURGER — TOGGLE SIDEBAR COLLAPSE
  // ---------------------------------------------------
  const hamburger = document.querySelector(".hamburger");
  const sidebar = document.querySelector(".sidebar");
  const mainSection = document.querySelector(".main");

  if (hamburger) {

    hamburger.addEventListener("click", () => {

      sidebar.classList.toggle("collapsed");
      mainSection.classList.toggle("expanded");

    });

  }


  // ---------------------------------------------------
  // 4. GLOBAL SEARCH (Live, Debounced, Multi-Category)
  // ---------------------------------------------------
  const searchInput = document.querySelector(".search-box input");
  const searchIcon  = document.querySelector(".search-box .fa-magnifying-glass");

  if (searchInput) {

    searchInput.setAttribute("id", "globalSearchInput");
    searchInput.setAttribute("autocomplete", "off");
    searchInput.setAttribute("aria-label", "Search customers, products, orders, users");

    // Dropdown container
    const searchResults = document.createElement("div");
    searchResults.id = "globalSearchDropdown";
    searchResults.className = "global-search-results";
    searchResults.style.cssText = "display:none;position:absolute;top:calc(100% + 6px);left:0;width:430px;max-height:460px;overflow-y:auto;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,0.13);border-radius:10px;z-index:9999;border:1px solid #e8edf5;";

    const searchBox = document.querySelector(".search-box");
    if (searchBox) {
      searchBox.style.position = "relative";
      searchBox.appendChild(searchResults);
    }

    function escHtml(str) {
      return String(str == null ? "" : str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }

    function hlMatch(text, q) {
      var safe = escHtml(text);
      if (!q) return safe;
      var re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + ")", "gi");
      return safe.replace(re, '<mark style="background:#fef08a;padding:0 1px;border-radius:2px;">$1</mark>');
    }

    function secHeader(label, color, icon) {
      return '<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:' + color + ';padding:8px 12px 5px;border-bottom:1px solid #f0f4f8;margin-top:4px;"><i class="fa-solid ' + icon + '" style="font-size:10px;"></i>&nbsp;' + label + '</div>';
    }

    function resRow(href, title, subtitle) {
      return '<a href="' + href + '" style="display:block;padding:9px 14px;text-decoration:none;color:#1e293b;border-bottom:1px solid #f8fafc;transition:background .15s;" onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'transparent\'"><div style="font-weight:500;font-size:13.5px;line-height:1.3;">' + title + '</div><div style="font-size:12px;color:#64748b;margin-top:2px;">' + subtitle + '</div></a>';
    }

    var SEARCH_BASES = [
      "/api/global-search",
      "http://localhost:9013/api/global-search",
      "http://localhost:9007/api/global-search",
      "http://localhost:9000/api/global-search"
    ];

    var _debounceTimer = null;

    async function performGlobalSearch() {
      var q = searchInput.value.trim();
      if (q.length < 1) { searchResults.style.display = "none"; return; }

      searchResults.style.display = "block";
      searchResults.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;"><i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Searching...</div>';

      var data = null;
      for (var bi = 0; bi < SEARCH_BASES.length; bi++) {
        try {
          var res = await fetch(SEARCH_BASES[bi] + "?q=" + encodeURIComponent(q) + "&_t=" + Date.now(), { cache: "no-store" });
          if (res.ok) { data = await res.json(); break; }
        } catch(e2) {}
      }

      if (!data) {
        searchResults.innerHTML = '<div style="padding:14px;text-align:center;color:#ef4444;font-size:13px;">Could not connect to server.</div>';
        return;
      }

      var html = ""; var total = 0;

      if (data.products && data.products.length > 0) {
        total += data.products.length;
        html += secHeader("Products (" + data.products.length + ")", "#3b82f6", "fa-cube");
        data.products.forEach(function(p) {
          html += resRow("product.html?search=" + encodeURIComponent(p.product_name || p.product_id),
            hlMatch(p.product_name, q) + ' <span style="color:#94a3b8;font-size:11px;">#' + p.product_id + '</span>',
            "Stock: " + (p.stock != null ? p.stock : 0) + " &nbsp;|&nbsp; Price: &#8377;" + Number(p.price||0).toFixed(2) + " &nbsp;|&nbsp; " + escHtml(p.status || ""));
        });
      }

      if (data.customers && data.customers.length > 0) {
        total += data.customers.length;
        html += secHeader("Customers (" + data.customers.length + ")", "#10b981", "fa-users");
        data.customers.forEach(function(c) {
          html += resRow("customer.html?search=" + encodeURIComponent(c.customer_name || c.customer_id),
            hlMatch(c.customer_name, q) + ' <span style="color:#94a3b8;font-size:11px;">#' + c.customer_id + '</span>',
            escHtml(c.email || "N/A") + " &nbsp;|&nbsp; " + escHtml(c.phone || "N/A"));
        });
      }

      if (data.orders && data.orders.length > 0) {
        total += data.orders.length;
        html += secHeader("Orders (" + data.orders.length + ")", "#f59e0b", "fa-cart-shopping");
        data.orders.forEach(function(o) {
          var sc = o.order_status === "Completed" ? "#10b981" : o.order_status === "Cancelled" ? "#ef4444" : "#f59e0b";
          html += resRow("order.html?search=" + encodeURIComponent(o.order_id),
            "Order <strong>#" + o.order_id + "</strong> &mdash; " + hlMatch(o.customer_name || "Guest", q),
            "&#8377;" + Number(o.total_amount||0).toFixed(2) + " &nbsp;|&nbsp; <span style=\"color:" + sc + ";font-weight:600;\">" + escHtml(o.order_status) + "</span>");
        });
      }

      if (data.users && data.users.length > 0) {
        total += data.users.length;
        html += secHeader("Users (" + data.users.length + ")", "#8b5cf6", "fa-user-shield");
        data.users.forEach(function(u) {
          html += resRow("user_dash.html?search=" + encodeURIComponent(u.full_name || u.id),
            hlMatch(u.full_name || u.username, q) + ' <span style="color:#94a3b8;font-size:11px;">#' + u.id + '</span>',
            escHtml(u.username || "—") + " &nbsp;|&nbsp; " + escHtml(u.role || "—") + " &nbsp;|&nbsp; " + escHtml(u.status || "—"));
        });
      }

      if (data.categories && data.categories.length > 0) {
        total += data.categories.length;
        html += secHeader("Categories (" + data.categories.length + ")", "#ec4899", "fa-grip");
        data.categories.forEach(function(c) {
          html += resRow("categories.html?search=" + encodeURIComponent(c.cat_name),
            hlMatch(c.cat_name, q), "Status: " + escHtml(c.status || "—"));
        });
      }

      if (total === 0) {
        html = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;"><i class="fa-solid fa-magnifying-glass" style="font-size:20px;display:block;margin-bottom:8px;opacity:.4;"></i>No results for <strong>"' + escHtml(q) + '"</strong></div>';
      } else {
        html += '<div style="padding:7px 12px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #f0f4f8;">' + total + ' result' + (total > 1 ? "s" : "") + ' found</div>';
      }

      searchResults.innerHTML = html;
    }

    // Live debounce on every keystroke
    searchInput.addEventListener("input", function() {
      clearTimeout(_debounceTimer);
      if (searchInput.value.trim().length === 0) { searchResults.style.display = "none"; return; }
      _debounceTimer = setTimeout(performGlobalSearch, 280);
    });

    // Keyboard: Enter triggers immediately, Escape closes
    searchInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") { clearTimeout(_debounceTimer); performGlobalSearch(); }
      if (e.key === "Escape") { searchResults.style.display = "none"; searchInput.blur(); }
    });

    // Icon click
    if (searchIcon) {
      searchIcon.style.cursor = "pointer";
      searchIcon.addEventListener("click", function() { clearTimeout(_debounceTimer); performGlobalSearch(); });
    }

    // Click outside closes dropdown
    document.addEventListener("click", function(e) {
      if (!e.target.closest(".search-box")) { searchResults.style.display = "none"; }
    });

    // Re-open on focus if value exists
    searchInput.addEventListener("focus", function() {
      if (searchInput.value.trim().length > 0 && searchResults.innerHTML.trim()) {
        searchResults.style.display = "block";
      }
    });

  }


  // ---------------------------------------------------
  // 5. ANIMATE STAT CARDS
  // ---------------------------------------------------
  const statValues = document.querySelectorAll(".stat-value");

  const targets = [
    parseInt(dashboardData.totalUsers) || 0,
    parseInt(dashboardData.totalOrders) || 0,
    parseInt(dashboardData.totalProducts) || 0,
    Math.round(parseFloat(dashboardData.totalRevenue) || 0)
  ];

  function animateCount(el, target, isCurrency = false) {
    if (!el) return;
    if (target === 0) {
      el.textContent = isCurrency ? "₹ 0" : "0";
      return;
    }
    let current = 0;
    const duration = 800;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = target / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      const formatted = Math.round(current).toLocaleString("en-IN");
      el.textContent = isCurrency ? `₹ ${formatted}` : formatted;
    }, stepTime);
  }

  statValues.forEach((el, index) => {
    const isCurrency = el.textContent.includes("₹") || index === 3;
    animateCount(el, targets[index], isCurrency);
  });

  // ---------------------------------------------------
  // 6. UPDATE TOTAL MINI COUNTER
  // ---------------------------------------------------
  const totalMini = document.querySelector(".total-mini strong");
  if (totalMini) {
    const totalCount = (parseInt(dashboardData.totalUsers) || 0) + (parseInt(dashboardData.totalOrders) || 0);
    animateCount(totalMini, totalCount);
  }


  // ---------------------------------------------------
  // 7. PROFILE DROPDOWN & LOGOUT
  // ---------------------------------------------------
  const profile =
    document.querySelector(".profile");


  function getCookie(name) {

    const value = `; ${document.cookie}`;

    const parts =
      value.split(`; ${name}=`);


    if (parts.length === 2) {

      return decodeURIComponent(
        parts.pop().split(";").shift()
      );

    }

    return null;

  }


  function clearAllCookies() {

    const cookies =
      document.cookie.split(";");


    for (let i = 0; i < cookies.length; i++) {

      const cookie = cookies[i];

      const eqPos =
        cookie.indexOf("=");

      const name =
        eqPos > -1
          ? cookie.substr(0, eqPos).trim()
          : cookie.trim();


      document.cookie =
        `${name}=; Path=/; ` +
        `Expires=Thu, 01 Jan 1970 00:00:00 GMT; ` +
        `Max-Age=0`;


      document.cookie =
        `${name}=; Path=/demo; ` +
        `Expires=Thu, 01 Jan 1970 00:00:00 GMT; ` +
        `Max-Age=0`;

    }

  }


  function getInitials(name) {

    if (!name) return "AD";


    const parts =
      name.trim().split(/\s+/);


    if (parts.length >= 2) {

      return (
        parts[0][0] +
        parts[1][0]
      ).toUpperCase();

    }


    return parts[0]
      .substring(0, 2)
      .toUpperCase();

  }


  const avatar =
    profile
      ? profile.querySelector(".avatar")
      : null;


  let currentUserData = null;


  // ---------------------------------------------------
  // LOGOUT POPUP
  // ---------------------------------------------------
  function showLogoutPopup(e) {

    if (e) {

      e.preventDefault();
      e.stopPropagation();

    }


    const existing =
      document.getElementById(
        "adminLogoutModalOverlay"
      );


    if (existing) {

      existing.remove();

    }


    const overlay =
      document.createElement("div");


    overlay.id =
      "adminLogoutModalOverlay";


    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.backgroundColor =
      "rgba(15, 23, 42, 0.6)";
    overlay.style.backdropFilter =
      "blur(4px)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "99999";


    const box =
      document.createElement("div");


    box.style.backgroundColor = "#fff";
    box.style.padding = "28px 32px 24px";
    box.style.borderRadius = "16px";
    box.style.boxShadow =
      "0 20px 25px -5px rgba(0,0,0,0.15)";
    box.style.textAlign = "center";
    box.style.maxWidth = "400px";
    box.style.width = "90%";


    box.innerHTML = `

      <div style="
        width:60px;
        height:60px;
        border-radius:50%;
        background:#fee2e2;
        color:#ef4444;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:26px;
        margin:0 auto 16px;
      ">
        <i class="fa-solid fa-right-from-bracket"></i>
      </div>

      <h3 style="
        margin:0 0 8px 0;
        color:#0f172a;
        font-size:20px;
        font-weight:700;
      ">
        Confirm Logout
      </h3>

      <p style="
        color:#64748b;
        margin:0 0 24px 0;
        font-size:14px;
        line-height:1.5;
      ">
        Are you sure you want to log out of your session?
      </p>

      <div style="
        display:flex;
        gap:12px;
        justify-content:center;
      ">

        <button
          id="cancelLogoutBtn"
          style="
            padding:10px 22px;
            border:1px solid #cbd5e1;
            background:#fff;
            color:#475569;
            border-radius:8px;
            cursor:pointer;
            font-weight:600;
            font-size:14px;
          "
        >
          Cancel
        </button>

        <button
          id="confirmLogoutBtn"
          style="
            padding:10px 22px;
            border:none;
            background:#ef4444;
            color:#fff;
            border-radius:8px;
            cursor:pointer;
            font-weight:600;
            font-size:14px;
            display:inline-flex;
            align-items:center;
            gap:8px;
          "
        >
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
          Yes, Logout
        </button>

      </div>
    `;


    overlay.appendChild(box);

    document.body.appendChild(overlay);


    document
      .getElementById("cancelLogoutBtn")
      .addEventListener("click", () => {

        overlay.remove();

      });


    document
      .getElementById("confirmLogoutBtn")
      .addEventListener("click", () => {

        localStorage.clear();
        sessionStorage.clear();

        clearAllCookies();

        window.location.href = "/login.html";

      });


    overlay.addEventListener(
      "click",
      (evt) => {

        if (evt.target === overlay) {

          overlay.remove();

        }

      }
    );

  }


  // ---------------------------------------------------
  // CREATE PROFILE DROPDOWN
  // ---------------------------------------------------
  const dropdownMenu =
    document.createElement("div");


  dropdownMenu.classList.add(
    "profile-dropdown"
  );


  dropdownMenu.style.display = "none";
  dropdownMenu.style.position = "absolute";
  dropdownMenu.style.top = "60px";
  dropdownMenu.style.right = "0";
  dropdownMenu.style.backgroundColor = "#fff";
  dropdownMenu.style.boxShadow =
    "0 10px 25px -5px rgba(0, 0, 0, 0.12)";
  dropdownMenu.style.borderRadius = "12px";
  dropdownMenu.style.width = "280px";
  dropdownMenu.style.zIndex = "1000";
  dropdownMenu.style.border =
    "1px solid #e2e8f0";
  dropdownMenu.style.overflow = "hidden";


  if (profile) {

    profile.style.position = "relative";
    profile.style.cursor = "pointer";

    profile.appendChild(
      dropdownMenu
    );

  }


  function renderProfileMenu(user) {

    const fullName =
      user.full_name ||
      user.name ||
      "Admin User";


    const role =
      user.role ||
      "Admin";


    const email =
      user.email ||
      "admin@example.com";


    const initials =
      getInitials(fullName);


    const hasPhoto =
      Boolean(
        user.profile_picture &&
        String(user.profile_picture).trim()
      );


    if (avatar) {
      if (hasPhoto) {
        avatar.innerHTML = `
          <img
            src="${user.profile_picture}"
            alt="${fullName}"
            style="width:100%; height:100%; object-fit:cover; border-radius:50%; display:block;"
            onerror="this.style.display='none'; this.parentElement.style.background='linear-gradient(135deg, #10b981, #059669)'; this.parentElement.innerHTML='<span>${initials}</span>';"
          >
        `;
        avatar.style.background = "transparent";
      } else {
        avatar.innerHTML = `<span>${initials}</span>`;
        avatar.style.background = "linear-gradient(135deg, #10b981, #059669)";
        avatar.style.color = "#ffffff";
        avatar.style.display = "flex";
        avatar.style.alignItems = "center";
        avatar.style.justifyContent = "center";
        avatar.style.fontWeight = "700";
        avatar.style.fontSize = "14px";
      }
    }

    const avatarHtml = hasPhoto
      ? `
        <img
          src="${user.profile_picture}"
          alt="${fullName}"
          style="width:100%; height:100%; object-fit:cover; display:block;"
          onerror="this.style.display='none'; this.parentElement.innerHTML='<span>${initials}</span>';"
        >
      `
      : `<span>${initials}</span>`;


    dropdownMenu.innerHTML = `

      <div style="
        padding:16px;
        border-bottom:1px solid #e2e8f0;
        display:flex;
        align-items:center;
        gap:12px;
        background:#f8fafc;
      ">

        <div style="
          width:44px;
          height:44px;
          border-radius:50%;
          background:linear-gradient(
            135deg,
            #10b981,
            #059669
          );
          color:#fff;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight:700;
          font-size:15px;
          overflow:hidden;
          flex-shrink:0;
        ">

          ${avatarHtml}

        </div>


        <div style="
          overflow:hidden;
          flex:1;
        ">

          <div style="
            font-weight:700;
            color:#0f172a;
            font-size:14px;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          ">
            ${fullName}
          </div>

          <div style="
            font-size:12px;
            color:#10b981;
            font-weight:600;
          ">
            ${role}
          </div>

          <div style="
            font-size:12px;
            color:#64748b;
            margin-top:1px;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          ">
            ${email}
          </div>

        </div>

      </div>


      <div style="padding:8px 0;">

        <a
          href="/setting.html"
          id="profileOption"
          style="
            display:flex;
            align-items:center;
            gap:10px;
            padding:10px 18px;
            color:#334155;
            text-decoration:none;
            font-size:14px;
            font-weight:600;
          "
        >

          <i
            class="fa-solid fa-user-gear"
            style="
              color:#10b981;
              width:18px;
            "
          ></i>

          <span>Profile</span>

        </a>


        <button
          type="button"
          id="adminLogoutOption"
          style="
            width:100%;
            border:none;
            background:transparent;
            display:flex;
            align-items:center;
            gap:10px;
            padding:10px 18px;
            color:#ef4444;
            font-size:14px;
            font-weight:600;
            cursor:pointer;
            text-align:left;
          "
        >

          <i
            class="fa-solid fa-right-from-bracket"
            style="
              color:#ef4444;
              width:18px;
            "
          ></i>

          <span>Logout</span>

        </button>

      </div>
    `;


    const logoutBtn =
      dropdownMenu.querySelector(
        "#adminLogoutOption"
      );


    if (logoutBtn) {

      logoutBtn.addEventListener(
        "click",
        (e) => {

          e.stopPropagation();

          dropdownMenu.style.display =
            "none";

          showLogoutPopup(e);

        }
      );

    }


    const links =
      dropdownMenu.querySelectorAll("a");


    links.forEach(link => {

      link.addEventListener(
        "mouseenter",
        () => {
          link.style.backgroundColor =
            "#f1f5f9";
        }
      );


      link.addEventListener(
        "mouseleave",
        () => {
          link.style.backgroundColor =
            "transparent";
        }
      );

    });

  }


  // ---------------------------------------------------
  // FETCH ADMIN PROFILE
  // ---------------------------------------------------
  async function fetchAdminProfile() {

    const candidates = [

      "/api/users/profile",

      "http://localhost:9007/api/users/profile",

      "http://localhost:9013/api/users/profile",

      "/api/user/profile"

    ];


    for (const url of candidates) {

      try {

        const res =
          await fetch(
            `${url}?_t=${Date.now()}`,
            {
              cache: "no-store"
            }
          );


        if (res.ok) {

          const data =
            await res.json();


          const user =
            data.user ||
            data.profile;


          if (user) {

            currentUserData =
              user;

            renderProfileMenu(
              user
            );

            return;

          }

        }

      } catch (e) {

        // Try next API

      }

    }


    // Fallback
    const fallback = {

      full_name:
        getCookie("admin_fullname") ||
        "parmar durga parasbahi",

      username:
        getCookie("admin_username") ||
        "durga_parmar123",

      email:
        getCookie("admin_email") ||
        "durgaparmar@gmail.com",

      role:
        getCookie("admin_role") ||
        "Admin",

      profile_picture: ""

    };


    currentUserData =
      fallback;


    renderProfileMenu(
      fallback
    );

  }


  // Load profile
  fetchAdminProfile();


  // ---------------------------------------------------
  // PROFILE CLICK
  // ---------------------------------------------------
  if (profile) {

    profile.addEventListener(
      "click",
      (e) => {

        e.stopPropagation();


        const isHidden =
          dropdownMenu.style.display ===
          "none";


        dropdownMenu.style.display =
          isHidden
            ? "block"
            : "none";

      }
    );

  }


  // ---------------------------------------------------
  // CLOSE DROPDOWN
  // ---------------------------------------------------
  document.addEventListener(
    "click",
    () => {

      dropdownMenu.style.display =
        "none";

    }
  );


  // ---------------------------------------------------
  // SIDEBAR LOGOUT
  // ---------------------------------------------------
  document
    .querySelectorAll(
      ".logout-sidebar-link"
    )
    .forEach(link => {

      link.removeAttribute(
        "data-bs-toggle"
      );


      link.addEventListener(
        "click",
        showLogoutPopup
      );

    });
});
