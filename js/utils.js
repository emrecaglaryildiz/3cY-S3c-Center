/* ============================================================
   SecUtils — SOC Dashboard Utility Module
   ============================================================ */
window.SecUtils = (() => {
  'use strict';

  /* --------------------------------------------------------
     CORS Proxy helpers
     -------------------------------------------------------- */
  const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
  ];
  let currentProxyIndex = 0;

  function _timeout(ms) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms)
    );
  }

  async function fetchWithCORS(url, options = {}) {
    // 1. Try direct fetch (8 s timeout)
    try {
      const res = await Promise.race([
        fetch(url, options),
        _timeout(8000)
      ]);
      if (res.ok) return res;
    } catch (_) { /* fall through */ }

    // 2. Try each CORS proxy (10 s timeout each)
    for (let i = 0; i < CORS_PROXIES.length; i++) {
      const idx = (currentProxyIndex + i) % CORS_PROXIES.length;
      const proxyUrl = CORS_PROXIES[idx] + encodeURIComponent(url);
      try {
        const res = await Promise.race([
          fetch(proxyUrl, options),
          _timeout(10000)
        ]);
        if (res.ok) {
          currentProxyIndex = idx;          // remember the one that worked
          return res;
        }
      } catch (_) { /* try next */ }
    }

    throw new Error(`All fetch attempts failed for: ${url}`);
  }

  async function fetchJSON(url, options = {}) {
    const response = await fetchWithCORS(url, options);
    return response.json();
  }

  async function postJSON(url, body, extraHeaders = {}) {
    return fetchWithCORS(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders),
      body: JSON.stringify(body)
    });
  }

  /* --------------------------------------------------------
     Formatting helpers
     -------------------------------------------------------- */
  function formatDate(date) {
    if (!(date instanceof Date)) date = new Date(date);
    return date.toLocaleString('tr-TR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function timeAgo(date) {
    if (!(date instanceof Date)) date = new Date(date);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return seconds + 's ago';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  function formatNumber(num) {
    if (num == null || isNaN(num)) return '0';
    const abs = Math.abs(num);
    if (abs >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return Math.round(num).toLocaleString('en-US');
  }

  function randomBetween(min, max) { return Math.random() * (max - min) + min; }
  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function cvssColor(score) {
    if (score >= 9) return '#ff0040';
    if (score >= 7) return '#ff8800';
    if (score >= 4) return '#fbbf24';
    return '#00e676';
  }

  function cvssLabel(score) {
    if (!window.SecI18n) return score >= 9 ? 'CRITICAL' : score >= 7 ? 'HIGH' : score >= 4 ? 'MEDIUM' : 'LOW';
    if (score >= 9) return window.SecI18n.t('sev_critical').toUpperCase();
    if (score >= 7) return window.SecI18n.t('sev_high').toUpperCase();
    if (score >= 4) return window.SecI18n.t('sev_medium').toUpperCase();
    if (score > 0) return window.SecI18n.t('sev_low').toUpperCase();
    return 'UNKNOWN';
  }

  function truncate(str, maxLen = 50) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
  }

  let _uidCounter = 0;
  function uid() {
    _uidCounter += 1;
    return 'sec-' + Date.now().toString(36) + '-' + _uidCounter.toString(36);
  }

  function countryFlag(code) {
    if (!code || code.length !== 2) return '🏳️';
    const offset = 0x1F1E6;
    const a = code.toUpperCase().charCodeAt(0) - 65 + offset;
    const b = code.toUpperCase().charCodeAt(1) - 65 + offset;
    return String.fromCodePoint(a) + String.fromCodePoint(b);
  }

  /* --------------------------------------------------------
     Animation helper
     -------------------------------------------------------- */
  function animateValue(element, start, end, duration = 2000) {
    if (!element) return;
    const startTime = performance.now();
    const diff = end - start;

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function step(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const current = start + diff * easeOutCubic(t);
      element.textContent = formatNumber(Math.round(current));
      if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  /* --------------------------------------------------------
     DOM helper
     -------------------------------------------------------- */
  function createElement(tag, props = {}, children = []) {
    const el = document.createElement(tag);

    for (const [key, val] of Object.entries(props)) {
      if (key === 'className') {
        el.className = val;
      } else if (key === 'innerHTML') {
        el.innerHTML = val;
      } else if (key === 'textContent') {
        el.textContent = val;
      } else if (key === 'style' && typeof val === 'object') {
        Object.assign(el.style, val);
      } else if (key.startsWith('on') && typeof val === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), val);
      } else {
        el.setAttribute(key, val);
      }
    }

    children.forEach(child => {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    });

    return el;
  }

  /* --------------------------------------------------------
     Static data
     -------------------------------------------------------- */
  const CITY_COORDS = {
    'New York': [40.71, -74.01],
    'Washington DC': [38.91, -77.04],
    'Los Angeles': [34.05, -118.24],
    'Chicago': [41.88, -87.63],
    'San Francisco': [37.77, -122.42],
    'Toronto': [43.65, -79.38],
    'Mexico City': [19.43, -99.13],
    'Miami': [25.76, -80.19],
    'Dallas': [32.78, -96.80],
    'Seattle': [47.61, -122.33],
    'London': [51.51, -0.13],
    'Paris': [48.86, 2.35],
    'Berlin': [52.52, 13.41],
    'Moscow': [55.76, 37.62],
    'Amsterdam': [52.37, 4.90],
    'Frankfurt': [50.11, 8.68],
    'Stockholm': [59.33, 18.07],
    'Istanbul': [41.01, 28.98],
    'Madrid': [40.42, -3.70],
    'Rome': [41.90, 12.50],
    'Warsaw': [52.23, 21.01],
    'Kyiv': [50.45, 30.52],
    'Beijing': [39.91, 116.40],
    'Shanghai': [31.23, 121.47],
    'Tokyo': [35.69, 139.69],
    'Seoul': [37.57, 126.98],
    'Singapore': [1.35, 103.82],
    'Mumbai': [19.08, 72.88],
    'Delhi': [28.61, 77.21],
    'Hong Kong': [22.32, 114.17],
    'Taipei': [25.03, 121.57],
    'Bangkok': [13.76, 100.50],
    'Jakarta': [-6.21, 106.85],
    'Tel Aviv': [32.09, 34.78],
    'Dubai': [25.20, 55.27],
    'Riyadh': [24.77, 46.74],
    'São Paulo': [-23.55, -46.63],
    'Buenos Aires': [-34.60, -58.38],
    'Bogotá': [4.71, -74.07],
    'Lima': [-12.05, -77.04],
    'Lagos': [6.52, 3.38],
    'Cairo': [30.04, 31.24],
    'Johannesburg': [-26.20, 28.05],
    'Nairobi': [-1.29, 36.82],
    'Sydney': [-33.87, 151.21],
    'Melbourne': [-37.81, 144.96],
    'Ankara': [39.93, 32.86],
    'Bucharest': [44.43, 26.10]
  };

  const COUNTRY_NAMES = {
    'US': 'United States', 'CN': 'China', 'RU': 'Russia', 'DE': 'Germany',
    'GB': 'United Kingdom', 'FR': 'France', 'JP': 'Japan', 'KR': 'South Korea',
    'BR': 'Brazil', 'IN': 'India', 'NL': 'Netherlands', 'UA': 'Ukraine',
    'TR': 'Turkey', 'ID': 'Indonesia', 'VN': 'Vietnam', 'TW': 'Taiwan',
    'IR': 'Iran', 'TH': 'Thailand', 'PL': 'Poland', 'IT': 'Italy',
    'ES': 'Spain', 'CA': 'Canada', 'AU': 'Australia', 'SG': 'Singapore',
    'HK': 'Hong Kong', 'ZA': 'South Africa', 'MX': 'Mexico', 'AR': 'Argentina',
    'NG': 'Nigeria', 'EG': 'Egypt', 'SA': 'Saudi Arabia', 'AE': 'UAE',
    'IL': 'Israel', 'RO': 'Romania', 'SE': 'Sweden', 'NO': 'Norway'
  };

  const THREAT_COLORS = {
    malware: '#ff3366',
    phishing: '#ff8800',
    c2: '#a855f7',
    ransomware: '#ff0040',
    botnet: '#ff8800',
    exploit: '#fbbf24',
    ddos: '#00f0ff',
    bruteforce: '#3b82f6',
    scan: '#64748b',
    default: '#00f0ff'
  };

  /* --------------------------------------------------------
     Public API
     -------------------------------------------------------- */
  return {
    fetchWithCORS, fetchJSON, postJSON,
    formatDate, timeAgo, formatNumber,
    randomBetween, randomInt, randomPick,
    cvssColor, cvssLabel, truncate, uid,
    animateValue, createElement, countryFlag,
    CITY_COORDS, COUNTRY_NAMES, THREAT_COLORS
  };
})();
