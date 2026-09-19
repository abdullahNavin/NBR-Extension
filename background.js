const API_BASE = "http://localhost:3000";

// ── Auth helpers ────────────────────────────────────────────────────────

async function getGoogleAccessToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

async function login(interactive = true) {
  const accessToken = await getGoogleAccessToken(interactive);

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

  return { token, user };
}

async function logout() {
  const data = await chrome.storage.local.get("sessionToken");

  await chrome.storage.local.remove(["sessionToken", "sessionUser"]);

  // Revoke the Google token
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (token) {
      chrome.identity.removeCachedAuthToken({ token });
      fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
    }
  });

  return !!data.sessionToken;
}

// ── Authenticated fetch helper ──────────────────────────────────────────

async function authFetch(path, options = {}) {
  const { sessionToken } = await chrome.storage.local.get("sessionToken");

  if (!sessionToken) {
    throw new Error("Not logged in");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error ${res.status}`);
  }

  return res.json();
}

// ── Message API ─────────────────────────────────────────────────────────
// content.js and popup.js communicate with us via chrome.runtime.sendMessage.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case "GET_LICENSE_STATUS":
      authFetch("/license/status")
        .then((data) => sendResponse({ ok: true, ...data }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true; // async response

    case "LOG_FILL":
      authFetch("/license/log-fill", {
        method: "POST",
        body: JSON.stringify({ psrId: msg.psrId }),
      })
        .then((data) => sendResponse({ ok: true, ...data }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true; // async response

    case "LOGIN":
      login(msg.interactive !== false)
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;

    case "LOGOUT":
      logout()
        .then((wasLoggedIn) => sendResponse({ ok: true, wasLoggedIn }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;

    case "GET_SESSION":
      chrome.storage.local
        .get(["sessionToken", "sessionUser"])
        .then((data) =>
          sendResponse({
            ok: true,
            loggedIn: !!data.sessionToken,
            user: data.sessionUser || null,
          })
        );
      return true;
  }
});
