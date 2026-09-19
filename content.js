(() => {
  'use strict';

  // ── Licensing: extract psrId from URL hash ───────────────────────────
  // The NBR portal stores state in the URL hash as:
  //   #/path?stateInfo=<base64-encoded-JSON>
  // The decoded JSON contains a psrId field we use for file-tracking.
  function extractPsrId() {
    try {
      const hash = window.location.hash;
      if (!hash) return null;

      const qIndex = hash.indexOf('?');
      if (qIndex === -1) return null;

      const params = new URLSearchParams(hash.slice(qIndex + 1));
      const stateInfo = params.get('stateInfo');
      if (!stateInfo) return null;

      const json = JSON.parse(atob(stateInfo));
      return json?.psrId ?? null;
    } catch {
      return null;
    }
  }

  // ── Licensing: ask background.js for license status ──────────────────
  function getLicenseStatus() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_LICENSE_STATUS' }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) {
          resolve(null);
        } else {
          resolve(res);
        }
      });
    });
  }

  // ── Licensing: fire-and-forget log-fill ──────────────────────────────
  function logFill(psrId) {
    chrome.runtime.sendMessage({ type: 'LOG_FILL', psrId }, (res) => {
      if (chrome.runtime.lastError || !res?.ok) {
        console.error('[NBR Auto Sum] log-fill failed:', res?.error || chrome.runtime.lastError?.message);
      } else {
        console.log(`[NBR Auto Sum] log-fill ok, filesUsed=${res.filesUsed ?? 'n/a'}`);
      }
    });
  }

  // ── Licensing: show trial-exhausted banner ───────────────────────────
  function showTrialBanner() {
    if (document.getElementById('nbr-license-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'nbr-license-banner';
    banner.innerHTML = `
      <span style="flex:1">
        <strong>Trial limit reached.</strong>
        You've used all your free files this month.
      </span>
      <a href="http://localhost:3000" target="_blank"
         style="color:#fff;font-weight:600;text-decoration:underline;margin-left:12px;">
        Buy License
      </a>
    `;
    Object.assign(banner.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      zIndex: '2147483647',
      background: '#dc3545',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
      fontSize: '14px',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    });
    document.body.appendChild(banner);
  }

  // ── Licensing: attach log-fill to the Next button ────────────────────
  // The portal's Next button has no stable id/formcontrolname. We find it
  // by its visible text content and fire log-fill alongside its own click
  // handler (fire-and-forget).
  function attachNextButtonListener(psrId) {
    const nextBtn = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent.trim() === 'Next'
    );

    if (!nextBtn) {
      // Button not yet in DOM — watch for it via MutationObserver (one-shot)
      const obs = new MutationObserver(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.trim() === 'Next'
        );
        if (btn) {
          obs.disconnect();
          btn.addEventListener('click', () => logFill(psrId));
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      return;
    }

    nextBtn.addEventListener('click', () => logFill(psrId));
  }

  // ══════════════════════════════════════════════════════════════════════
  //  AUTO-FILL ENGINE (existing — untouched)
  // ══════════════════════════════════════════════════════════════════════

  const FORM_GROUP = 'assetsDetail';
  const SOURCE_ATTR = 'formcontrolname';

  const NATIVE_VALUE_SETTER = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;

  const rules = [
    {
      sources: ['totalFund', 'netWealthLastIncomeYear'],
      target: 'sumTotalfundNetwealth',
      label: 'sumTotalfundNetwealth'
    },
    {
      sources: ['livingExpenditure', 'otherLivingExpenditure'],
      target: 'totalLivingExpenditure',
      label: 'totalLivingExpenditure'
    },
    {
      sources: ['totalIncome', 'taxExemptedIncome', 'giftOrOthersIncome'],
      target: 'totalFund',
      label: 'totalFund'
    },
    {
      sources: [
        'institutionalLiabilitiesAmt',
        'nonInstitutionalLiabilitiesAmt',
        'otherLiabilitiesAmt'
      ],
      target: 'totalPersonalLiabilitiesAmt',
      label: 'totalPersonalLiabilitiesAmt'
    },
    {
      sources: ['netWealthThisFinancialYear', 'totalPersonalLiabilitiesAmt'],
      target: 'grossWealth',
      label: 'grossWealth'
    },
    {
      sources: [
        'bankBalanceOutsideBusiness',
        'cashInHandOutsideBusiness',
        'otherFundOutsideBusiness'
      ],
      target: 'totalFundOutsideBusiness',
      label: 'totalFundOutsideBusiness'
    },
    {
      sources: [
        'shareBondEtc',
        'sanchaypatra',
        'loanGiven',
        'savingsDeposit',
        'providentOtherFund',
        'otherInvestment'
      ],
      target: 'totalFinancialAssets',
      label: 'totalFinancialAssets'
    }
  ];

  const bound = new WeakSet();
  const cascading = new Set();

  function queryInput(name) {
    return document.querySelector(
      `[${SOURCE_ATTR}="${name}"]`
    );
  }

  function parseAmount(raw) {
    if (raw === null || raw === undefined) return 0;
    const cleaned = String(raw).replace(/[\s,।৳৲]/g, '').trim();
    if (!cleaned) return 0;
    const val = Number(cleaned);
    return Number.isFinite(val) ? val : 0;
  }

  function setAngularValue(input, value) {
    NATIVE_VALUE_SETTER.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function formatValue(val) {
    const hasDecimals = Number.isInteger(val) === false;
    return hasDecimals ? String(val) : String(Math.round(val));
  }

  function calculateRule(rule) {
    const sources = rule.sources
      .map(queryInput)
      .filter(Boolean);

    const sum = sources.reduce((acc, el) => acc + parseAmount(el.value), 0);

    const target = queryInput(rule.target);
    if (!target) return false;

    const text = formatValue(sum);
    if (target.value === text) return false;

    setAngularValue(target, text);
    console.log(`Auto-filled ${rule.label}: ${text}`);
    return true;
  }

  function cascadeDependents(targetName) {
    rules.forEach((rule) => {
      if (rule.sources.includes(targetName) && !cascading.has(rule)) {
        cascading.add(rule);
        try {
          if (calculateRule(rule)) {
            cascadeDependents(rule.target);
          }
        } finally {
          cascading.delete(rule);
        }
      }
    });
  }

  function handleBlur(rule) {
    cascading.add(rule);
    try {
      if (calculateRule(rule)) {
        cascadeDependents(rule.target);
      }
    } finally {
      cascading.delete(rule);
    }
  }

  function attachBlur(rule) {
    rule.sources.forEach((name) => {
      const el = queryInput(name);
      if (!el || bound.has(el)) return;
      bound.add(el);
      el.addEventListener('blur', () => handleBlur(rule));
    });
  }

  function activate() {
    const observer = new MutationObserver(() => {
      rules.forEach(attachBlur);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    rules.forEach(attachBlur);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  BOOT: license check → activate or block
  // ══════════════════════════════════════════════════════════════════════

  (async function boot() {
    const psrId = extractPsrId();

    // Pages without psrId → can't track, allow auto-fill freely
    if (!psrId) {
      console.log('[NBR Auto Sum] No psrId in URL – enabling auto-fill (untracked).');
      activate();
      return;
    }

    const license = await getLicenseStatus();

    // Not logged in or API unreachable → fall back to old session check
    if (!license) {
      console.log('[NBR Auto Sum] License API unavailable – falling back to session check.');
      // Preserve the original behaviour: check session, activate if valid
      const { sessionToken } = await chrome.storage.local.get('sessionToken');
      if (sessionToken) {
        activate();
      } else {
        console.log('[NBR Auto Sum] No session – feature disabled.');
      }
      return;
    }

    switch (license.status) {
      case 'active':
        // Unlimited — just run auto-fill
        activate();
        break;

      case 'trial':
        if (license.filesUsed >= license.filesLimit) {
          // Trial exhausted — block auto-fill, show banner
          showTrialBanner();
          console.log(`[NBR Auto Sum] Trial exhausted (${license.filesUsed}/${license.filesLimit}).`);
        } else {
          // Trial with capacity — activate auto-fill + track on Next
          activate();
          attachNextButtonListener(psrId);
          console.log(`[NBR Auto Sum] Trial active (${license.filesUsed}/${license.filesLimit}).`);
        }
        break;

      case 'expired':
      case 'revoked':
        showTrialBanner();
        console.log(`[NBR Auto Sum] License ${license.status} – feature disabled.`);
        break;

      default:
        // Unknown status — allow auto-fill
        activate();
        break;
    }
  })();
})();
