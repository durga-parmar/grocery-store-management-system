const LOGIN_API_CANDIDATES = [
    "/api/admin/login",
    "/admin_login",
    "http://localhost:9007/api/admin/login",
    "http://localhost:9007/admin_login",
    "http://localhost:9013/api/admin/login",
    "http://localhost:9013/admin_login",
    "http://localhost:9000/api/admin/login",
    "http://localhost:9000/admin_login",
    "http://localhost:8000/api/admin/login",
    "http://localhost:8000/admin_login"
];

function showLoginAlert(msg, type = "error") {
    const alertBox = document.getElementById("loginAlert");
    if (!alertBox) {
        alert(msg);
        return;
    }
    alertBox.style.display = "block";
    if (type === "success") {
        alertBox.style.background = "#dcfce7";
        alertBox.style.border = "1px solid #10b981";
        alertBox.style.color = "#15803d";
    } else {
        alertBox.style.background = "#fee2e2";
        alertBox.style.border = "1px solid #ef4444";
        alertBox.style.color = "#b91c1c";
    }
    alertBox.textContent = msg;
}

async function handleAdminLogin(event) {
    if (event) event.preventDefault();

    const usernameInput = document.getElementById("adminUsername");
    const passwordInput = document.getElementById("adminPassword");
    const btn = document.getElementById("adminLoginBtn");

    const username = usernameInput ? usernameInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value.trim() : "";

    if (!username || !password) {
        showLoginAlert("Please enter both username/email and password.");
        return false;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Verifying...";
    }

    let successData = null;
    let errorMessage = "Unable to connect to login server.";

    for (const url of LOGIN_API_CANDIDATES) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: JSON.stringify({
                    username: username,
                    password: password,
                    role: "Admin"
                })
            });

            const data = await res.json().catch(() => null);

            if (res.ok && data && data.success) {
                successData = data;
                break;
            } else if (data && data.message) {
                errorMessage = data.message;
                break;
            }
        } catch (err) {
            // Try next endpoint candidate
        }
    }

    if (successData) {
        showLoginAlert("Login Successful! Redirecting to Admin Dashboard...", "success");
        setTimeout(() => {
            window.location.href = successData.redirect || "/admin_dash.html";
        }, 500);
    } else {
        showLoginAlert(errorMessage, "error");
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Login";
        }
    }

    return false;
}