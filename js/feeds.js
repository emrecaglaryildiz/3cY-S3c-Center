/* ============================================================
 *  SecFeeds — Threat Intelligence Feed Integration
 *  Fetches IOCs from ThreatFox, URLhaus, MalwareBazaar, Feodo
 *  Falls back to realistic sample data when APIs are unreachable
 * ============================================================ */
(function () {
  'use strict';

  /* ── helpers ────────────────────────────────────────────── */
  const U = () => window.SecUtils;

  function severityFromConfidence(confidence) {
    if (confidence >= 75) return 'critical';
    if (confidence >= 50) return 'high';
    if (confidence >= 25) return 'medium';
    return 'low';
  }

  function severityFromStatus(status) {
    if (status === 'online') return 'critical';
    if (status === 'offline') return 'medium';
    return 'low';
  }

  const SEVERITY_COLORS = {
    critical: '#ff2c6d',
    high: '#ff6b35',
    medium: '#f5a623',
    low: '#00e5ff'
  };

  /* ── Normalisation ─────────────────────────────────────── */

  function normalizeThreatFox(item) {
    return {
      id: item.ioc || item.ioc_value || item.id || U().uid(),
      type: 'ioc',
      title: item.ioc || item.ioc_value || 'Unknown IOC',
      description: [item.malware, item.threat_type].filter(Boolean).join(' — ') || 'IOC',
      severity: severityFromConfidence(item.confidence_level || 50),
      timestamp: new Date(item.first_seen || Date.now()),
      source: 'ThreatFox',
      tags: Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? item.tags.split(',').map(t => t.trim()) : []),
      country: item.country || null,
      raw: item
    };
  }

  function normalizeURLhaus(item) {
    const sev = item.threat === 'malware_download' ? 'critical'
              : item.url_status === 'online' ? 'high'
              : item.url_status === 'offline' ? 'medium' : 'low';
    return {
      id: item.url || U().uid(),
      type: 'url',
      title: item.url || 'Unknown URL',
      description: item.threat || 'Malicious URL',
      severity: sev,
      timestamp: new Date(item.date_added || Date.now()),
      source: 'URLhaus',
      tags: Array.isArray(item.tags) ? item.tags : (item.tags ? String(item.tags).split(',').map(t => t.trim()) : []),
      country: item.country || null,
      raw: item
    };
  }

  function normalizeMalwareBazaar(item) {
    return {
      id: item.sha256_hash || U().uid(),
      type: 'malware',
      title: item.sha256_hash ? item.sha256_hash.substring(0, 16) + '…' : 'Unknown Hash',
      description: item.signature || item.file_type || 'Malware Sample',
      severity: item.signature ? 'critical' : 'high',
      timestamp: new Date(item.first_seen || Date.now()),
      source: 'MalwareBazaar',
      tags: Array.isArray(item.tags) ? item.tags : (item.tags ? String(item.tags).split(',').map(t => t.trim()) : []),
      country: null,
      raw: item
    };
  }

  function normalizeFeodo(item) {
    return {
      id: item.ip_address + (item.port ? ':' + item.port : '') || U().uid(),
      type: 'botnet',
      title: item.ip_address + (item.port ? ':' + item.port : ''),
      description: [item.as_name, item.hostname].filter(Boolean).join(' — ') || 'Botnet C2',
      severity: severityFromStatus(item.status || 'online'),
      timestamp: new Date(item.first_seen || item.last_online || Date.now()),
      source: 'Feodo Tracker',
      tags: [item.status, item.country].filter(Boolean),
      country: item.country || null,
      raw: item
    };
  }

  /* ── Fetch functions ───────────────────────────────────── */

  async function fetchThreatFox() {
    try {
      const res = await U().postJSON(
        'https://threatfox-api.abuse.ch/api/v1/',
        { query: 'get_iocs', days: 1 },
        { 'Content-Type': 'application/json' }
      );
      if (res && res.data && Array.isArray(res.data)) {
        console.log('[SecFeeds] ThreatFox: fetched ' + res.data.length + ' IOCs');
        return res.data.map(normalizeThreatFox);
      }
      throw new Error('Invalid ThreatFox response');
    } catch (err) {
      console.warn('[SecFeeds] ThreatFox fetch failed, using fallback:', err.message);
      return FALLBACK.threatfox.map(normalizeThreatFox);
    }
  }

  async function fetchURLhaus() {
    try {
      const res = await U().fetchJSON('https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/');
      if (res && res.urls && Array.isArray(res.urls)) {
        console.log('[SecFeeds] URLhaus: fetched ' + res.urls.length + ' URLs');
        return res.urls.map(normalizeURLhaus);
      }
      throw new Error('Invalid URLhaus response');
    } catch (err) {
      console.warn('[SecFeeds] URLhaus fetch failed, using fallback:', err.message);
      return FALLBACK.urlhaus.map(normalizeURLhaus);
    }
  }

  async function fetchMalwareBazaar() {
    try {
      const res = await U().postJSON(
        'https://mb-api.abuse.ch/api/v1/',
        { query: 'get_recent', selector: 'time' },
        { 'Content-Type': 'application/json' }
      );
      if (res && res.data && Array.isArray(res.data)) {
        console.log('[SecFeeds] MalwareBazaar: fetched ' + res.data.length + ' samples');
        return res.data.map(normalizeMalwareBazaar);
      }
      throw new Error('Invalid MalwareBazaar response');
    } catch (err) {
      console.warn('[SecFeeds] MalwareBazaar fetch failed, using fallback:', err.message);
      return FALLBACK.malwarebazaar.map(normalizeMalwareBazaar);
    }
  }

  async function fetchFeodo() {
    try {
      const res = await U().fetchJSON('https://feodotracker.abuse.ch/downloads/ipblocklist_aggressive.json');
      if (res && Array.isArray(res)) {
        const subset = res.slice(0, 50);
        console.log('[SecFeeds] Feodo: fetched ' + subset.length + ' C2 IPs');
        return subset.map(normalizeFeodo);
      }
      throw new Error('Invalid Feodo response');
    } catch (err) {
      console.warn('[SecFeeds] Feodo fetch failed, using fallback:', err.message);
      return FALLBACK.feodo.map(normalizeFeodo);
    }
  }

  async function fetchAll() {
    const [tf, uh, mb, fd] = await Promise.allSettled([
      fetchThreatFox(),
      fetchURLhaus(),
      fetchMalwareBazaar(),
      fetchFeodo()
    ]);
    return {
      threatfox: tf.status === 'fulfilled' ? tf.value : FALLBACK.threatfox.map(normalizeThreatFox),
      urlhaus:   uh.status === 'fulfilled' ? uh.value : FALLBACK.urlhaus.map(normalizeURLhaus),
      malwarebazaar: mb.status === 'fulfilled' ? mb.value : FALLBACK.malwarebazaar.map(normalizeMalwareBazaar),
      feodo:     fd.status === 'fulfilled' ? fd.value : FALLBACK.feodo.map(normalizeFeodo)
    };
  }

  /* ── Rendering ─────────────────────────────────────────── */

  function renderFeedItem(item) {
    const el = document.createElement('div');
    el.className = 'feed-item feed-severity-' + item.severity;

    const dotColor = SEVERITY_COLORS[item.severity] || '#888';

    let tagsHTML = '';
    if (item.tags && item.tags.length) {
      tagsHTML = '<div class="feed-tags">' +
        item.tags.slice(0, 4).map(function (t) {
          return '<span class="feed-tag">' + escapeHTML(t) + '</span>';
        }).join('') +
        '</div>';
    }

    el.innerHTML =
      '<div class="feed-icon" style="background:' + dotColor + ';box-shadow:0 0 6px ' + dotColor + '"></div>' +
      '<div class="feed-content">' +
        '<div class="feed-title" title="' + escapeAttr(item.title) + '">' + escapeHTML(U().truncate(item.title, 60)) + '</div>' +
        '<div class="feed-meta">' +
          '<span class="feed-source">' + escapeHTML(item.source) + '</span>' +
          '<span class="feed-time">' + U().timeAgo(item.timestamp) + '</span>' +
          '<span class="feed-desc">' + escapeHTML(U().truncate(item.description, 40)) + '</span>' +
        '</div>' +
        tagsHTML +
      '</div>' +
      '<div class="feed-severity-badge severity-' + item.severity + '">' + item.severity.toUpperCase() + '</div>';

    return el;
  }

  function renderFeedList(containerId, items, isModal = false) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!items || items.length === 0) {
      container.innerHTML = '<div class="empty-state">No data available</div>';
      return;
    }

    var sorted = items.slice().sort(function (a, b) {
      return b.timestamp - a.timestamp;
    });
    
    if (!isModal) {
      sorted = sorted.slice(0, 20);
    }

    var fragment = document.createDocumentFragment();
    sorted.forEach(function (item) {
      fragment.appendChild(renderFeedItem(item));
    });
    container.appendChild(fragment);
  }

  /* ── HTML helpers ──────────────────────────────────────── */

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── Fallback / Sample Data ────────────────────────────── */

  function recentISO(hoursAgo) {
    var d = new Date();
    d.setHours(d.getHours() - hoursAgo);
    return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  }

  var FALLBACK = {
    /* ── ThreatFox ── */
    threatfox: [
      { ioc: '185.215.113.43:8080', threat_type: 'botnet_cc', malware: 'Emotet', confidence_level: 90, first_seen: recentISO(1), reporter: 'abuse_ch', tags: ['emotet','epoch5','botnet'], country: 'NL' },
      { ioc: '94.232.46.202:443', threat_type: 'botnet_cc', malware: 'QakBot', confidence_level: 85, first_seen: recentISO(2), reporter: 'malware_traffic', tags: ['qakbot','c2'], country: 'RU' },
      { ioc: '103.146.232.154:447', threat_type: 'botnet_cc', malware: 'IcedID', confidence_level: 80, first_seen: recentISO(3), reporter: 'threatfox_user', tags: ['icedid','bokbot'], country: 'SG' },
      { ioc: 'dark-update-service.com', threat_type: 'payload_delivery', malware: 'Agent Tesla', confidence_level: 75, first_seen: recentISO(4), reporter: 'abuse_ch', tags: ['agenttesla','stealer'], country: 'US' },
      { ioc: '45.61.136.85:8443', threat_type: 'botnet_cc', malware: 'CobaltStrike', confidence_level: 95, first_seen: recentISO(1), reporter: 'threatfox_user', tags: ['cobaltstrike','c2','beacon'], country: 'US' },
      { ioc: 'secure-docview.cloud', threat_type: 'payload_delivery', malware: 'RedLine', confidence_level: 70, first_seen: recentISO(5), reporter: 'malware_traffic', tags: ['redline','stealer','infostealer'], country: 'DE' },
      { ioc: '193.56.146.38:9001', threat_type: 'botnet_cc', malware: 'Dridex', confidence_level: 88, first_seen: recentISO(2), reporter: 'abuse_ch', tags: ['dridex','bugat'], country: 'UA' },
      { ioc: '91.243.44.21:443', threat_type: 'botnet_cc', malware: 'BumbleBee', confidence_level: 82, first_seen: recentISO(6), reporter: 'threatfox_user', tags: ['bumblebee','loader'], country: 'RO' },
      { ioc: 'dl-invoice-update.top', threat_type: 'payload_delivery', malware: 'Formbook', confidence_level: 65, first_seen: recentISO(7), reporter: 'abuse_ch', tags: ['formbook','xloader'], country: 'RU' },
      { ioc: '172.105.25.33:80', threat_type: 'botnet_cc', malware: 'AsyncRAT', confidence_level: 78, first_seen: recentISO(3), reporter: 'malware_traffic', tags: ['asyncrat','rat'], country: 'US' },
      { ioc: '5.42.199.87:7707', threat_type: 'botnet_cc', malware: 'Remcos', confidence_level: 72, first_seen: recentISO(8), reporter: 'abuse_ch', tags: ['remcos','rat'], country: 'NL' },
      { ioc: 'crypto-wallet-update.xyz', threat_type: 'payload_delivery', malware: 'Vidar', confidence_level: 60, first_seen: recentISO(4), reporter: 'threatfox_user', tags: ['vidar','stealer'], country: 'DE' },
      { ioc: '185.174.101.232:8888', threat_type: 'botnet_cc', malware: 'NjRAT', confidence_level: 68, first_seen: recentISO(9), reporter: 'abuse_ch', tags: ['njrat','bladabindi'], country: 'TR' },
      { ioc: '146.19.253.45:443', threat_type: 'botnet_cc', malware: 'SystemBC', confidence_level: 84, first_seen: recentISO(5), reporter: 'malware_traffic', tags: ['systembc','proxy','socks5'], country: 'BG' },
      { ioc: 'ms-cloud-auth.services', threat_type: 'payload_delivery', malware: 'Raccoon Stealer', confidence_level: 77, first_seen: recentISO(10), reporter: 'abuse_ch', tags: ['raccoon','stealer','v2'], country: 'US' },
      { ioc: '37.120.247.199:4443', threat_type: 'botnet_cc', malware: 'Sliver', confidence_level: 92, first_seen: recentISO(1), reporter: 'threatfox_user', tags: ['sliver','c2','implant'], country: 'RO' },
      { ioc: '104.168.164.78:443', threat_type: 'botnet_cc', malware: 'Mythic', confidence_level: 89, first_seen: recentISO(2), reporter: 'abuse_ch', tags: ['mythic','c2'], country: 'US' },
      { ioc: 'adobe-license-renew.click', threat_type: 'payload_delivery', malware: 'Lumma Stealer', confidence_level: 73, first_seen: recentISO(6), reporter: 'malware_traffic', tags: ['lumma','stealer'], country: 'RU' },
      { ioc: '89.22.225.14:9090', threat_type: 'botnet_cc', malware: 'Pikabot', confidence_level: 81, first_seen: recentISO(3), reporter: 'abuse_ch', tags: ['pikabot','loader'], country: 'LV' },
      { ioc: '176.97.76.118:8080', threat_type: 'botnet_cc', malware: 'SmokeLoader', confidence_level: 86, first_seen: recentISO(4), reporter: 'threatfox_user', tags: ['smokeloader','dofoil'], country: 'MD' }
    ],

    /* ── URLhaus ── */
    urlhaus: [
      { url: 'http://45.95.147.236/bins/mirai.x86', url_status: 'online', threat: 'malware_download', host: '45.95.147.236', date_added: recentISO(1), tags: ['elf','mirai'] },
      { url: 'http://distribute-docs.click/invoice_EN3892.doc', url_status: 'online', threat: 'malware_download', host: 'distribute-docs.click', date_added: recentISO(2), tags: ['doc','emotet'] },
      { url: 'https://ms-login-verify.top/auth/signin', url_status: 'online', threat: 'phishing', host: 'ms-login-verify.top', date_added: recentISO(1), tags: ['phishing','microsoft'] },
      { url: 'http://198.46.189.42/loader.exe', url_status: 'online', threat: 'malware_download', host: '198.46.189.42', date_added: recentISO(3), tags: ['exe','smokeloader'] },
      { url: 'http://cdn-update-flash.xyz/FlashUpdate.msi', url_status: 'offline', threat: 'malware_download', host: 'cdn-update-flash.xyz', date_added: recentISO(4), tags: ['msi','redline'] },
      { url: 'https://secure-banking-auth.com/login.php', url_status: 'online', threat: 'phishing', host: 'secure-banking-auth.com', date_added: recentISO(2), tags: ['phishing','banking'] },
      { url: 'http://91.215.85.209/gate.php', url_status: 'online', threat: 'malware_download', host: '91.215.85.209', date_added: recentISO(5), tags: ['php','formbook'] },
      { url: 'http://download-tool-kit.xyz/Setup.exe', url_status: 'online', threat: 'malware_download', host: 'download-tool-kit.xyz', date_added: recentISO(3), tags: ['exe','raccoon'] },
      { url: 'https://icloud-verification.support/verify', url_status: 'online', threat: 'phishing', host: 'icloud-verification.support', date_added: recentISO(1), tags: ['phishing','apple'] },
      { url: 'http://185.117.88.81/x86_64', url_status: 'online', threat: 'malware_download', host: '185.117.88.81', date_added: recentISO(6), tags: ['elf','gafgyt'] },
      { url: 'http://free-vpn-installer.cloud/vpn_installer.exe', url_status: 'offline', threat: 'malware_download', host: 'free-vpn-installer.cloud', date_added: recentISO(7), tags: ['exe','agenttesla'] },
      { url: 'http://37.49.230.41/wp-content/uploads/doc.xlsm', url_status: 'online', threat: 'malware_download', host: '37.49.230.41', date_added: recentISO(4), tags: ['xlsm','dridex'] },
      { url: 'https://office365-password-reset.com/reset', url_status: 'online', threat: 'phishing', host: 'office365-password-reset.com', date_added: recentISO(2), tags: ['phishing','o365'] },
      { url: 'http://46.4.122.193/bins/tsunami.arm7', url_status: 'online', threat: 'malware_download', host: '46.4.122.193', date_added: recentISO(5), tags: ['elf','tsunami'] },
      { url: 'http://driver-update-centre.net/update.bat', url_status: 'offline', threat: 'malware_download', host: 'driver-update-centre.net', date_added: recentISO(8), tags: ['bat','powershell'] },
      { url: 'https://dhl-track-shipment.cloud/tracking', url_status: 'online', threat: 'phishing', host: 'dhl-track-shipment.cloud', date_added: recentISO(3), tags: ['phishing','dhl'] },
      { url: 'http://78.142.18.215/scan.ps1', url_status: 'online', threat: 'malware_download', host: '78.142.18.215', date_added: recentISO(6), tags: ['ps1','cobaltstrike'] },
      { url: 'http://game-cheat-pro.xyz/injector.exe', url_status: 'online', threat: 'malware_download', host: 'game-cheat-pro.xyz', date_added: recentISO(4), tags: ['exe','lumma'] },
      { url: 'https://paypal-confirm-payment.org/confirm', url_status: 'online', threat: 'phishing', host: 'paypal-confirm-payment.org', date_added: recentISO(1), tags: ['phishing','paypal'] },
      { url: 'http://103.74.192.58/a.sh', url_status: 'online', threat: 'malware_download', host: '103.74.192.58', date_added: recentISO(7), tags: ['sh','cryptominer'] }
    ],

    /* ── MalwareBazaar ── */
    malwarebazaar: [
      { sha256_hash: 'a3b9c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', file_type: 'exe', signature: 'Emotet', first_seen: recentISO(1), tags: ['emotet','epoch5'], file_size: 245760 },
      { sha256_hash: 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2', file_type: 'dll', signature: 'QakBot', first_seen: recentISO(2), tags: ['qakbot','qbot'], file_size: 389120 },
      { sha256_hash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b', file_type: 'exe', signature: 'RedLine', first_seen: recentISO(3), tags: ['redline','stealer'], file_size: 532480 },
      { sha256_hash: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3', file_type: 'doc', signature: 'Dridex', first_seen: recentISO(4), tags: ['dridex','maldoc'], file_size: 98304 },
      { sha256_hash: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4', file_type: 'exe', signature: 'Agent Tesla', first_seen: recentISO(1), tags: ['agenttesla','keylogger'], file_size: 614400 },
      { sha256_hash: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', file_type: 'elf', signature: 'Mirai', first_seen: recentISO(5), tags: ['mirai','botnet','iot'], file_size: 45056 },
      { sha256_hash: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', file_type: 'exe', signature: 'Formbook', first_seen: recentISO(6), tags: ['formbook','xloader'], file_size: 286720 },
      { sha256_hash: 'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', file_type: 'exe', signature: 'AsyncRAT', first_seen: recentISO(2), tags: ['asyncrat','rat','dotnet'], file_size: 409600 },
      { sha256_hash: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8', file_type: 'msi', signature: 'Raccoon Stealer', first_seen: recentISO(7), tags: ['raccoon','stealer','v2'], file_size: 753664 },
      { sha256_hash: 'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9', file_type: 'exe', signature: 'CobaltStrike', first_seen: recentISO(3), tags: ['cobaltstrike','beacon','c2'], file_size: 327680 },
      { sha256_hash: 'c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0', file_type: 'dll', signature: 'IcedID', first_seen: recentISO(4), tags: ['icedid','bokbot'], file_size: 491520 },
      { sha256_hash: 'd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1', file_type: 'exe', signature: 'LockBit', first_seen: recentISO(1), tags: ['lockbit','ransomware'], file_size: 819200 },
      { sha256_hash: 'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2', file_type: 'exe', signature: 'Vidar', first_seen: recentISO(8), tags: ['vidar','stealer'], file_size: 368640 },
      { sha256_hash: 'f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3', file_type: 'exe', signature: 'Remcos', first_seen: recentISO(5), tags: ['remcos','rat'], file_size: 552960 },
      { sha256_hash: 'a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4', file_type: 'xlsm', signature: 'BumbleBee', first_seen: recentISO(6), tags: ['bumblebee','loader','iso'], file_size: 163840 },
      { sha256_hash: 'b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5', file_type: 'exe', signature: 'SmokeLoader', first_seen: recentISO(2), tags: ['smokeloader','dofoil'], file_size: 204800 },
      { sha256_hash: 'c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', file_type: 'exe', signature: 'Lumma Stealer', first_seen: recentISO(3), tags: ['lumma','stealer'], file_size: 430080 },
      { sha256_hash: 'd6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7', file_type: 'exe', signature: 'NjRAT', first_seen: recentISO(9), tags: ['njrat','bladabindi'], file_size: 143360 },
      { sha256_hash: 'e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8', file_type: 'dll', signature: 'Pikabot', first_seen: recentISO(4), tags: ['pikabot','loader'], file_size: 573440 },
      { sha256_hash: 'f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9', file_type: 'exe', signature: 'SystemBC', first_seen: recentISO(7), tags: ['systembc','proxy'], file_size: 122880 }
    ],

    /* ── Feodo Tracker ── */
    feodo: [
      { ip_address: '103.75.201.2', port: 443, status: 'online', hostname: '', as_number: 135161, as_name: 'GMO-Z.COM', country: 'JP', first_seen: recentISO(2), last_online: recentISO(0) },
      { ip_address: '185.7.214.7', port: 443, status: 'online', hostname: '', as_number: 60781, as_name: 'LeaseWeb NL', country: 'NL', first_seen: recentISO(3), last_online: recentISO(0) },
      { ip_address: '45.95.169.3', port: 8080, status: 'online', hostname: '', as_number: 202685, as_name: 'Tigaraksa', country: 'ID', first_seen: recentISO(1), last_online: recentISO(0) },
      { ip_address: '64.44.131.109', port: 443, status: 'online', hostname: '', as_number: 29802, as_name: 'HVC-AS', country: 'US', first_seen: recentISO(4), last_online: recentISO(1) },
      { ip_address: '93.123.39.68', port: 443, status: 'offline', hostname: '', as_number: 211252, as_name: 'Delis LLC', country: 'BG', first_seen: recentISO(10), last_online: recentISO(5) },
      { ip_address: '94.232.46.202', port: 443, status: 'online', hostname: '', as_number: 44477, as_name: 'STARK', country: 'RU', first_seen: recentISO(5), last_online: recentISO(0) },
      { ip_address: '176.97.76.118', port: 4143, status: 'online', hostname: '', as_number: 39798, as_name: 'MivoCloud SRL', country: 'MD', first_seen: recentISO(6), last_online: recentISO(1) },
      { ip_address: '87.120.254.98', port: 8080, status: 'online', hostname: '', as_number: 34841, as_name: 'Baltneta UAB', country: 'BG', first_seen: recentISO(3), last_online: recentISO(0) },
      { ip_address: '62.171.178.147', port: 443, status: 'offline', hostname: '', as_number: 51167, as_name: 'Contabo GmbH', country: 'DE', first_seen: recentISO(12), last_online: recentISO(8) },
      { ip_address: '146.19.253.45', port: 443, status: 'online', hostname: '', as_number: 211252, as_name: 'Delis LLC', country: 'BG', first_seen: recentISO(7), last_online: recentISO(0) },
      { ip_address: '37.120.247.199', port: 443, status: 'online', hostname: '', as_number: 9009, as_name: 'M247 Europe SRL', country: 'RO', first_seen: recentISO(4), last_online: recentISO(0) },
      { ip_address: '89.22.225.14', port: 8080, status: 'online', hostname: '', as_number: 43513, as_name: 'NANO IT', country: 'LV', first_seen: recentISO(2), last_online: recentISO(0) },
      { ip_address: '45.61.136.85', port: 443, status: 'online', hostname: '', as_number: 53667, as_name: 'FranTech', country: 'US', first_seen: recentISO(1), last_online: recentISO(0) },
      { ip_address: '172.105.25.33', port: 80, status: 'offline', hostname: '', as_number: 63949, as_name: 'Akamai/Linode', country: 'US', first_seen: recentISO(14), last_online: recentISO(9) },
      { ip_address: '5.42.199.87', port: 7707, status: 'online', hostname: '', as_number: 44477, as_name: 'STARK', country: 'NL', first_seen: recentISO(5), last_online: recentISO(0) },
      { ip_address: '185.174.101.232', port: 8888, status: 'online', hostname: '', as_number: 60068, as_name: 'Datacamp', country: 'TR', first_seen: recentISO(8), last_online: recentISO(1) },
      { ip_address: '193.56.146.38', port: 9001, status: 'online', hostname: '', as_number: 44477, as_name: 'STARK', country: 'UA', first_seen: recentISO(6), last_online: recentISO(0) },
      { ip_address: '91.243.44.21', port: 443, status: 'online', hostname: '', as_number: 9009, as_name: 'M247 Europe SRL', country: 'RO', first_seen: recentISO(3), last_online: recentISO(0) },
      { ip_address: '104.168.164.78', port: 443, status: 'online', hostname: '', as_number: 36352, as_name: 'ColoCrossing', country: 'US', first_seen: recentISO(2), last_online: recentISO(0) },
      { ip_address: '78.142.18.215', port: 9090, status: 'offline', hostname: '', as_number: 44477, as_name: 'STARK', country: 'RU', first_seen: recentISO(15), last_online: recentISO(10) }
    ]
  };

  /* ── getSampleData ─────────────────────────────────────── */

  function getSampleData() {
    return {
      threatfox: FALLBACK.threatfox.map(normalizeThreatFox),
      urlhaus:   FALLBACK.urlhaus.map(normalizeURLhaus),
      malwarebazaar: FALLBACK.malwarebazaar.map(normalizeMalwareBazaar),
      feodo:     FALLBACK.feodo.map(normalizeFeodo)
    };
  }

  /* ── Public API ────────────────────────────────────────── */

  window.SecFeeds = {
    fetchThreatFox: fetchThreatFox,
    fetchURLhaus: fetchURLhaus,
    fetchMalwareBazaar: fetchMalwareBazaar,
    fetchFeodo: fetchFeodo,
    fetchAll: fetchAll,
    renderFeedItem: renderFeedItem,
    renderFeedList: renderFeedList,
    getSampleData: getSampleData
  };

})();
