const loginView = document.getElementById("loginView");
const mainView = document.getElementById("mainView");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const nbrBtn = document.getElementById("nbrBtn");
const userAvatar = document.getElementById("userAvatar");
const avatarFallback = document.getElementById("avatarFallback");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const statusBadge = document.getElementById("statusBadge");
const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const usageInfo = document.getElementById("usageInfo");
const statusMessage = document.getElementById("statusMessage");
const buyLicense = document.getElementById("buyLicense");

function showLogin() {
  loginView.classList.remove("hidden");
  mainView.classList.add("hidden");
}

function showMain(session, license) {
  loginView.classList.add("hidden");
  mainView.classList.remove("hidden");

  if (session.user.image) {
    userAvatar.src = session.user.image;
    userAvatar.classList.remove("hidden");
    avatarFallback.classList.add("hidden");
  } else {
    userAvatar.classList.add("hidden");
    avatarFallback.classList.remove("hidden");
  }

  userName.textContent = session.user.name || "User";
  userEmail.textContent = session.user.email || "";

  if (license) {
    const s = license.status;
    statusBadge.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    statusBadge.className = "status-pill status-" + s;

    progressWrap.classList.add("hidden");
    statusMessage.classList.add("hidden");

    if (s === "trial") {
      const pct = Math.min(100, Math.round((license.filesUsed / license.filesLimit) * 100));
      progressFill.style.width = pct + "%";
      usageInfo.textContent = license.filesUsed + " / " + license.filesLimit + " files used";
      progressWrap.classList.remove("hidden");
    } else if (s === "active") {
      statusMessage.textContent = "Unlimited";
      statusMessage.className = "status-msg status-msg-muted";
      statusMessage.classList.remove("hidden");
    } else {
      statusMessage.textContent = "Purchase a license to continue";
      statusMessage.className = "status-msg status-msg-alert";
      statusMessage.classList.remove("hidden");
    }

    const nearLimit = s === "trial" && license.filesUsed >= license.filesLimit - 2;
    const urgent = nearLimit || s === "expired" || s === "revoked";
    buyLicense.className = urgent ? "btn-primary" : "btn-secondary";
  } else {
    statusBadge.textContent = "Unknown";
    statusBadge.className = "status-pill status-revoked";
    progressWrap.classList.add("hidden");
    statusMessage.classList.add("hidden");
    buyLicense.className = "btn-secondary";
  }
}

async function checkSession() {
  const data = await chrome.storage.local.get(["sessionToken", "sessionUser"]);
  if (!data.sessionToken || !data.sessionUser) {
    showLogin();
    return;
  }

  chrome.runtime.sendMessage({ type: "GET_LICENSE_STATUS" }, (res) => {
    const license = res?.ok
      ? { status: res.status, filesUsed: res.filesUsed, filesLimit: res.filesLimit }
      : null;
    showMain({ user: data.sessionUser }, license);
  });
}

async function signInWithGoogle() {
  loginError.classList.add("hidden");
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in...";

  chrome.runtime.sendMessage({ type: "LOGIN", interactive: true }, (res) => {
    if (res?.ok) {
      showMain({ user: res.user }, null);
    } else {
      loginError.textContent = res?.error || "Login failed";
      loginError.classList.remove("hidden");
    }
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in with Google";
  });
}

function signOut() {
  chrome.runtime.sendMessage({ type: "LOGOUT" }, () => {
    showLogin();
  });
}

loginBtn.addEventListener("click", signInWithGoogle);
logoutBtn.addEventListener("click", signOut);
nbrBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://office.etaxnbr.gov.bd" });
});

checkSession();
