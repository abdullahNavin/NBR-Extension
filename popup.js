const API_BASE = "http://localhost:3000";

const loginView = document.getElementById("loginView");
const mainView = document.getElementById("mainView");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const nbrBtn = document.getElementById("nbrBtn");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const licenseInfo = document.getElementById("licenseInfo");

function showLogin() {
  loginView.classList.remove("hidden");
  mainView.classList.add("hidden");
}

function showMain(session) {
  loginView.classList.add("hidden");
  mainView.classList.remove("hidden");

  userAvatar.src = session.user.image || "";
  userAvatar.style.display = session.user.image ? "block" : "none";
  userName.textContent = session.user.name || "User";
  userEmail.textContent = session.user.email || "";
}

async function checkSession() {
  const data = await chrome.storage.local.get(["sessionToken", "sessionUser"]);
  if (data.sessionToken && data.sessionUser) {
    showMain({ user: data.sessionUser });
    return;
  }
  showLogin();
}

async function signInWithGoogle() {
  loginError.classList.add("hidden");
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in...";

  try {
    const accessToken = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken(
        { interactive: true },
        (token) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(token);
          }
        }
      );
    });

    const res = await fetch(`${API_BASE}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server error ${res.status}`);
    }

    const { token, user } = await res.json();

    await chrome.storage.local.set({
      sessionToken: token,
      sessionUser: user,
    });

    showMain({ user });
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in with Google";
  }
}

async function signOut() {
  await chrome.storage.local.remove(["sessionToken", "sessionUser"]);

  // Revoke the Google token so the user must re-consent
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (token) {
      chrome.identity.removeCachedAuthToken({ token });
      fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
    }
  });

  showLogin();
}

loginBtn.addEventListener("click", signInWithGoogle);
logoutBtn.addEventListener("click", signOut);
nbrBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://office.etaxnbr.gov.bd" });
});

checkSession();
