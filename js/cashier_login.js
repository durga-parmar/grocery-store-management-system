const CASHIER_LOGIN_CANDIDATES = [
    "/api/cashier/login",
    "/cashier_login",
    "http://localhost:9002/cashier_login",
    "http://localhost:9007/api/cashier/login",
    "http://localhost:9007/cashier_login",
    "http://localhost:9013/api/cashier/login",
    "http://localhost:9013/cashier_login",
    "http://localhost:9000/cashier_login",
    "http://localhost:8000/cashier_login"
];

function showCashierAlert(msg, type = "error") {
    const alertBox = document.getElementById("cashierAlert");
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

function setCashierClientCookies(username, userObj) {
    const expireDays = 7;
    const date = new Date();
    date.setTime(date.getTime() + (expireDays * 24 * 60 * 60 * 1000));
    const expires = "; expires=" + date.toUTCString();
    
    document.cookie = "cashier_username=" + encodeURIComponent(username) + expires + "; path=/";
    document.cookie = "username=" + encodeURIComponent(username) + expires + "; path=/";
    document.cookie = "admin_username=" + encodeURIComponent(username) + expires + "; path=/";
    document.cookie = "admin_role=Cashier" + expires + "; path=/";
    document.cookie = "role=Cashier" + expires + "; path=/";
    document.cookie = "cashier_role=Cashier" + expires + "; path=/";
    
    if (userObj) {
        if (userObj.id) {
            document.cookie = "cashier_id=" + userObj.id + expires + "; path=/";
            document.cookie = "admin_id=" + userObj.id + expires + "; path=/";
            document.cookie = "user_id=" + userObj.id + expires + "; path=/";
        }
        if (userObj.full_name || userObj.name) {
            document.cookie = "admin_fullname=" + encodeURIComponent(userObj.full_name || userObj.name) + expires + "; path=/";
            document.cookie = "cashier_fullname=" + encodeURIComponent(userObj.full_name || userObj.name) + expires + "; path=/";
        }
        if (userObj.email) {
            document.cookie = "admin_email=" + encodeURIComponent(userObj.email) + expires + "; path=/";
            document.cookie = "cashier_email=" + encodeURIComponent(userObj.email) + expires + "; path=/";
        }
    }
}

async function cashierLogin(event) {
    if (event) event.preventDefault();

    const usernameInput = document.getElementById("cashierusername");
    const passwordInput = document.getElementById("cashierpassword");
    const btn = document.getElementById("cashierLoginBtn");

    const username = usernameInput ? usernameInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value.trim() : "";

    if (!username || !password) {
        showCashierAlert("Please enter both username/email and password.");
        return false;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Verifying...";
    }

    let isSuccess = false;
    let redirectUrl = "cashierdash.html";
    let errorMessage = "Unable to connect to login server.";

    for (const url of CASHIER_LOGIN_CANDIDATES) {
        try {
            // 1. Try JSON POST
            let res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: JSON.stringify({
                    username: username,
                    password: password,
                    role: "Cashier"
                })
            }).catch(() => null);

            // 2. If JSON not accepted or failed, try Form URLEncoded
            if (!res || !res.ok) {
                res = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: "username=" + encodeURIComponent(username) + "&password=" + encodeURIComponent(password) + "&role=Cashier"
                }).catch(() => null);
            }

            if (res) {
                const textResp = await res.text();
                let jsonResp = null;
                try { jsonResp = JSON.parse(textResp); } catch(e) {}

                if (jsonResp && (jsonResp.success || jsonResp.status === "Success")) {
                    isSuccess = true;
                    if (jsonResp.redirect) redirectUrl = jsonResp.redirect;
                    setCashierClientCookies(username, jsonResp.user || null);
                    break;
                } else if (textResp.trim() === "Success") {
                    isSuccess = true;
                    setCashierClientCookies(username, null);
                    break;
                } else if (jsonResp && jsonResp.message) {
                    errorMessage = jsonResp.message;
                    break;
                } else if (textResp && textResp.length < 150 && !textResp.includes("<!DOCTYPE")) {
                    errorMessage = textResp.trim();
                    break;
                }
            }
        } catch (err) {
            // Try next candidate
        }
    }

    if (isSuccess) {
        showCashierAlert("Cashier Login Successful! Redirecting...", "success");
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 400);
    } else {
        showCashierAlert(errorMessage, "error");
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Login";
        }
    }

    return false;
}