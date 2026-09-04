(() => {
  'use strict';

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

  const observer = new MutationObserver(() => {
    rules.forEach(attachBlur);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  rules.forEach(attachBlur);
})();