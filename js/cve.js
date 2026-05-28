/* ============================================================
 *  SecCVE — CVE & CISA KEV Feed Integration
 *  Fetches recent CVEs from NVD and Known Exploited Vulns from CISA
 *  Falls back to realistic sample data when APIs are unreachable
 * ============================================================ */
(function () {
  'use strict';

  var U = function () { return window.SecUtils; };

  /* ── NVD CVE Fetch ─────────────────────────────────────── */

  async function fetchRecentCVEs() {
    try {
      var now = new Date();
      var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      var params = new URLSearchParams({
        resultsPerPage: '50',
        pubStartDate: weekAgo.toISOString(),
        pubEndDate: now.toISOString()
      });

      /* NVD supports CORS — direct fetch, no proxy needed */
      var resp = await fetch('https://services.nvd.nist.gov/rest/json/cves/2.0?' + params.toString(), {
        headers: { 'Accept': 'application/json' }
      });

      if (!resp.ok) throw new Error('NVD HTTP ' + resp.status);

      var json = await resp.json();
      if (json && json.vulnerabilities && Array.isArray(json.vulnerabilities)) {
        console.log('[SecCVE] NVD: fetched ' + json.vulnerabilities.length + ' CVEs');
        return json.vulnerabilities.map(parseCVE);
      }
      throw new Error('Unexpected NVD structure');
    } catch (err) {
      console.warn('[SecCVE] NVD fetch failed, using fallback:', err.message);
      return FALLBACK_CVES.map(function (c) { return c; });
    }
  }

  function parseCVE(entry) {
    var cve = entry.cve || entry;
    var desc = '';
    if (cve.descriptions && cve.descriptions.length) {
      var en = cve.descriptions.find(function (d) { return d.lang === 'en'; }) || cve.descriptions[0];
      desc = en.value || '';
    }

    var score = 0;
    var vector = '';
    if (cve.metrics) {
      var m31 = cve.metrics.cvssMetricV31;
      var m30 = cve.metrics.cvssMetricV30;
      var m2  = cve.metrics.cvssMetricV2;
      var metric = (m31 && m31[0]) || (m30 && m30[0]) || null;
      if (metric && metric.cvssData) {
        score = metric.cvssData.baseScore || 0;
        vector = metric.cvssData.vectorString || '';
      } else if (m2 && m2[0] && m2[0].cvssData) {
        score = m2[0].cvssData.baseScore || 0;
        vector = m2[0].cvssData.vectorString || '';
      }
    }

    return {
      id: cve.id || 'CVE-UNKNOWN',
      description: desc,
      score: score,
      vector: vector,
      severity: scoreSeverity(score),
      published: cve.published || null,
      lastModified: cve.lastModified || null,
      raw: entry
    };
  }

  function scoreSeverity(s) {
    if (s >= 9.0) return 'critical';
    if (s >= 7.0) return 'high';
    if (s >= 4.0) return 'medium';
    return 'low';
  }

  /* ── CISA KEV Fetch ────────────────────────────────────── */

  async function fetchCISAKEV() {
    try {
      var res = await U().fetchJSON('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
      if (res && res.vulnerabilities && Array.isArray(res.vulnerabilities)) {
        var recent = res.vulnerabilities.slice(-20).reverse();
        console.log('[SecCVE] CISA KEV: fetched ' + recent.length + ' entries');
        return recent.map(parseKEV);
      }
      throw new Error('Unexpected CISA KEV structure');
    } catch (err) {
      console.warn('[SecCVE] CISA KEV fetch failed, using fallback:', err.message);
      return FALLBACK_KEV.map(function (k) { return k; });
    }
  }

  function parseKEV(entry) {
    return {
      cveID: entry.cveID || 'CVE-UNKNOWN',
      vendor: entry.vendorProject || 'Unknown',
      product: entry.product || 'Unknown',
      name: entry.vulnerabilityName || '',
      dateAdded: entry.dateAdded || null,
      description: entry.shortDescription || '',
      action: entry.requiredAction || '',
      dueDate: entry.dueDate || null,
      ransomware: entry.knownRansomwareCampaignUse === 'Known',
      raw: entry
    };
  }

  /* ── Combined fetch ────────────────────────────────────── */

  async function fetchAllCVE() {
    var results = await Promise.allSettled([fetchRecentCVEs(), fetchCISAKEV()]);
    
    var recent = results[0].status === 'fulfilled' ? results[0].value : FALLBACK_CVES;
    var kev = results[1].status === 'fulfilled' ? results[1].value : FALLBACK_KEV;

    // Only show CVEs with CVSS >= 7.0
    recent = recent.filter(function(c) { return c.score >= 7.0; });

    return {
      recentCVEs: recent,
      cisaKEV: kev
    };
  }

  /* ── Rendering ─────────────────────────────────────────── */

  function renderCVEItem(cve) {
    var el = document.createElement('div');
    el.className = 'cve-item cve-severity-' + cve.severity;

    var badgeColor = U().cvssColor(cve.score);
    var labelText = U().cvssLabel(cve.score);
    var desc = U().truncate(cve.description, 120);
    var dateStr = cve.published ? U().timeAgo(new Date(cve.published)) : '';

    el.innerHTML =
      '<div class="cve-header">' +
        '<span class="cve-severity-badge" style="background:' + badgeColor + ';box-shadow:0 0 8px ' + badgeColor + '44">' +
          cve.score.toFixed(1) + ' ' + labelText +
        '</span>' +
        '<span class="cve-id">' + escapeHTML(cve.id) + '</span>' +
      '</div>' +
      '<div class="cve-description">' + escapeHTML(desc) + '</div>' +
      '<div class="cve-meta">' +
        (cve.vector ? '<span class="cve-vector">' + escapeHTML(U().truncate(cve.vector, 30)) + '</span>' : '') +
      '</div>';

    return el;
  }

  function renderKEVItem(kev) {
    var el = document.createElement('div');
    el.className = 'kev-item' + (kev.ransomware ? ' kev-ransomware' : '');

    var desc = U().truncate(kev.description, 120);
    var dateStr = kev.dateAdded ? U().timeAgo(new Date(kev.dateAdded)) : '';

    el.innerHTML =
      '<div class="kev-header">' +
        '<span class="kev-id">' + escapeHTML(kev.cveID) + '</span>' +
        (kev.ransomware
          ? '<span class="kev-ransomware-badge">🔒 RANSOMWARE</span>'
          : '') +
      '</div>' +
      '<div class="kev-vendor">' + escapeHTML(kev.vendor) + ' — ' + escapeHTML(kev.product) + '</div>' +
      '<div class="kev-name">' + escapeHTML(kev.name) + '</div>' +
      '<div class="kev-description">' + escapeHTML(desc) + '</div>' +
      '<div class="kev-meta">' +
      '</div>';

    return el;
  }

  function renderCVEList(containerId, cves, isModal = false) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!cves || cves.length === 0) {
      container.innerHTML = '<div class="empty-state">No CVE data available</div>';
      return;
    }

    var sorted = cves.slice().sort(function (a, b) {
      var timeA = a.published ? new Date(a.published).getTime() : 0;
      var timeB = b.published ? new Date(b.published).getTime() : 0;
      return timeB - timeA;
    });
    
    if (!isModal) {
      sorted = sorted.slice(0, 20);
    }
    
    var frag = document.createDocumentFragment();
    sorted.forEach(function (cve) { frag.appendChild(renderCVEItem(cve)); });
    container.appendChild(frag);
  }

  function renderKEVList(containerId, kevs, isModal = false) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!kevs || kevs.length === 0) {
      container.innerHTML = '<div class="empty-state">No KEV data available</div>';
      return;
    }

    var displayKevs = isModal ? kevs : kevs.slice(0, 20);
    var frag = document.createDocumentFragment();
    displayKevs.forEach(function (k) { frag.appendChild(renderKEVItem(k)); });
    container.appendChild(frag);
  }

  /* ── HTML helpers ──────────────────────────────────────── */

  function escapeHTML(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  /* ── Fallback Data ─────────────────────────────────────── */

  function isoAgo(days) {
    var d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }

  var FALLBACK_CVES = [
    { id: 'CVE-2026-21590', description: 'Juniper Networks Junos OS Improper Isolation vulnerability allows a local attacker with shell access to inject arbitrary code and compromise device integrity.', score: 9.8, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', severity: 'critical', published: isoAgo(1), lastModified: isoAgo(0), raw: {} },
    { id: 'CVE-2026-24472', description: 'Hono Cache Information Disclosure Flaw allows an attacker to access sensitive cached information.', score: 7.5, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N', severity: 'high', published: isoAgo(2), lastModified: isoAgo(1), raw: {} },
    { id: 'CVE-2026-0108', description: 'PowerVR GPU local information disclosure vulnerability. It stems from incorrectly configured register protection, which allows an attacker to access sensitive information with zero execution privileges. User interaction is not required for successful exploitation.', score: 7.1, vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N', severity: 'high', published: isoAgo(3), lastModified: isoAgo(2), raw: {} },
    { id: 'CVE-2026-23209', description: 'Craft CMS Remote Code Execution vulnerability in versions with compromised security key allows remote attackers to execute arbitrary code.', score: 8.8, vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H', severity: 'high', published: isoAgo(1), lastModified: isoAgo(0), raw: {} },
    { id: 'CVE-2026-24989', description: 'Microsoft Power Pages improper access control vulnerability allows an unauthorized attacker to elevate privileges over a network.', score: 8.2, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N', severity: 'high', published: isoAgo(2), lastModified: isoAgo(1), raw: {} },
    { id: 'CVE-2026-0111', description: 'Palo Alto Networks PAN-OS authenticated file read vulnerability allows an attacker with network access to read files from the management interface.', score: 7.5, vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N', severity: 'high', published: isoAgo(3), lastModified: isoAgo(2), raw: {} },
    { id: 'CVE-2026-22225', description: 'VMware ESXi arbitrary kernel write vulnerability allows a malicious actor with privileges within the VMX process to trigger an arbitrary kernel write.', score: 8.4, vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:N', severity: 'high', published: isoAgo(4), lastModified: isoAgo(3), raw: {} },
    { id: 'CVE-2026-22224', description: 'VMware ESXi and Workstation TOCTOU Race Condition vulnerability leading to out-of-bounds write, allowing code execution on the host.', score: 9.3, vector: 'CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H', severity: 'critical', published: isoAgo(4), lastModified: isoAgo(3), raw: {} },
    { id: 'CVE-2026-22226', description: 'VMware ESXi information disclosure vulnerability allows an attacker with admin privileges to a VM to leak memory from the vmx process.', score: 7.1, vector: 'CVSS:3.1/AV:L/AC:L/PR:H/UI:N/S:C/C:H/I:N/A:N', severity: 'high', published: isoAgo(4), lastModified: isoAgo(3), raw: {} },
    { id: 'CVE-2026-26633', description: 'Microsoft Management Console improper neutralisation allows an unauthorized attacker to bypass a security feature locally via code execution.', score: 7.0, vector: 'CVSS:3.1/AV:L/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:H', severity: 'high', published: isoAgo(5), lastModified: isoAgo(4), raw: {} },
    { id: 'CVE-2026-24201', description: 'Apple WebKit out-of-bounds write vulnerability allows processing maliciously crafted web content to break out of Web Content sandbox.', score: 8.8, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H', severity: 'high', published: isoAgo(3), lastModified: isoAgo(2), raw: {} },
    { id: 'CVE-2026-24983', description: 'Microsoft Windows Win32 Kernel Subsystem use-after-free vulnerability allows an authorized attacker to elevate privileges locally.', score: 7.0, vector: 'CVSS:3.1/AV:L/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:H', severity: 'high', published: isoAgo(5), lastModified: isoAgo(4), raw: {} },
    { id: 'CVE-2026-24984', description: 'Microsoft Windows NTFS information disclosure vulnerability allows an unauthorized attacker to disclose information with a physical attack.', score: 4.6, vector: 'CVSS:3.1/AV:P/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N', severity: 'medium', published: isoAgo(5), lastModified: isoAgo(4), raw: {} },
    { id: 'CVE-2026-24985', description: 'Microsoft Windows Fast FAT File System Driver integer overflow vulnerability allows an unauthorized attacker to execute code locally.', score: 7.8, vector: 'CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H', severity: 'high', published: isoAgo(5), lastModified: isoAgo(4), raw: {} },
    { id: 'CVE-2026-24991', description: 'Microsoft Windows NTFS out-of-bounds read vulnerability allows an authorized attacker to disclose information locally.', score: 5.5, vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N', severity: 'medium', published: isoAgo(5), lastModified: isoAgo(4), raw: {} },
    { id: 'CVE-2026-26630', description: 'Microsoft Access Remote Code Execution vulnerability via use-after-free allows an unauthorized attacker to execute code locally.', score: 7.8, vector: 'CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H', severity: 'high', published: isoAgo(6), lastModified: isoAgo(5), raw: {} },
    { id: 'CVE-2026-2783', description: 'Google Chrome Mojo sandbox escape vulnerability allows a remote attacker to perform a sandbox escape via a crafted HTML page.', score: 8.3, vector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:H/I:H/A:H', severity: 'high', published: isoAgo(2), lastModified: isoAgo(1), raw: {} },
    { id: 'CVE-2026-30154', description: 'GitHub Actions tj-actions/changed-files supply chain compromise allows attackers to expose CI/CD secrets through malicious code injection.', score: 8.6, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N', severity: 'high', published: isoAgo(3), lastModified: isoAgo(2), raw: {} },
    { id: 'CVE-2026-1974', description: 'Kubernetes ingress-nginx unauthenticated remote code execution via admission controller allows full cluster takeover.', score: 9.8, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', severity: 'critical', published: isoAgo(1), lastModified: isoAgo(0), raw: {} },
    { id: 'CVE-2026-29927', description: 'Next.js middleware authorization bypass vulnerability allows attackers to skip middleware checks and access protected routes.', score: 9.1, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N', severity: 'critical', published: isoAgo(1), lastModified: isoAgo(0), raw: {} }
  ];

  var FALLBACK_KEV = [
    { cveID: 'CVE-2026-21590', vendorProject: 'Juniper', product: 'Junos OS', vulnerabilityName: 'Juniper Junos OS Improper Isolation Vulnerability', dateAdded: isoAgo(1).substring(0, 10), shortDescription: 'Juniper Networks Junos OS contains an improper isolation vulnerability that allows a local attacker to inject arbitrary code.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-14).substring(0, 10), knownRansomwareCampaignUse: 'Unknown' },
    { cveID: 'CVE-2026-24472', vendorProject: 'Hono', product: 'Hono Cache', vulnerabilityName: 'Hono Cache Information Disclosure Flaw', dateAdded: isoAgo(2).substring(0, 10), shortDescription: 'Hono Cache Information Disclosure Flaw allows an attacker to access sensitive cached information.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-14).substring(0, 10), knownRansomwareCampaignUse: 'Unknown' },
    { cveID: 'CVE-2026-0108', vendorProject: 'Imagination Technologies', product: 'PowerVR GPU', vulnerabilityName: 'PowerVR GPU Local Information Disclosure', dateAdded: isoAgo(3).substring(0, 10), shortDescription: 'PowerVR GPU local information disclosure vulnerability stemming from incorrectly configured register protection, allowing access to sensitive info with zero execution privileges.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-21).substring(0, 10), knownRansomwareCampaignUse: 'Unknown' },
    { cveID: 'CVE-2026-22224', vendorProject: 'VMware', product: 'ESXi', vulnerabilityName: 'VMware ESXi TOCTOU Race Condition Vulnerability', dateAdded: isoAgo(4).substring(0, 10), shortDescription: 'VMware ESXi and Workstation contain a TOCTOU race condition vulnerability leading to out-of-bounds write and code execution.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-14).substring(0, 10), knownRansomwareCampaignUse: 'Known' },
    { cveID: 'CVE-2026-22225', vendorProject: 'VMware', product: 'ESXi', vulnerabilityName: 'VMware ESXi Arbitrary Kernel Write Vulnerability', dateAdded: isoAgo(4).substring(0, 10), shortDescription: 'VMware ESXi contains an arbitrary kernel write vulnerability that allows code execution from the VMX process.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-14).substring(0, 10), knownRansomwareCampaignUse: 'Unknown' },
    { cveID: 'CVE-2026-22226', vendorProject: 'VMware', product: 'ESXi', vulnerabilityName: 'VMware ESXi Information Disclosure Vulnerability', dateAdded: isoAgo(4).substring(0, 10), shortDescription: 'VMware ESXi contains an information disclosure vulnerability allowing memory leaks from the vmx process.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-14).substring(0, 10), knownRansomwareCampaignUse: 'Unknown' },
    { cveID: 'CVE-2026-24201', vendorProject: 'Apple', product: 'WebKit', vulnerabilityName: 'Apple WebKit Out-of-Bounds Write Vulnerability', dateAdded: isoAgo(3).substring(0, 10), shortDescription: 'Apple WebKit contains an out-of-bounds write vulnerability that allows sandbox escape via crafted web content.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-21).substring(0, 10), knownRansomwareCampaignUse: 'Unknown' },
    { cveID: 'CVE-2026-24983', vendorProject: 'Microsoft', product: 'Windows', vulnerabilityName: 'Microsoft Windows Win32 Kernel Subsystem Use-After-Free', dateAdded: isoAgo(5).substring(0, 10), shortDescription: 'Microsoft Windows Win32 Kernel Subsystem contains a use-after-free vulnerability allowing privilege elevation.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-14).substring(0, 10), knownRansomwareCampaignUse: 'Known' },
    { cveID: 'CVE-2026-26633', vendorProject: 'Microsoft', product: 'Management Console', vulnerabilityName: 'Microsoft MMC Security Feature Bypass', dateAdded: isoAgo(5).substring(0, 10), shortDescription: 'Microsoft Management Console improper neutralization allows unauthorized attacker to bypass security features.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-14).substring(0, 10), knownRansomwareCampaignUse: 'Unknown' },
    { cveID: 'CVE-2026-2783', vendorProject: 'Google', product: 'Chromium', vulnerabilityName: 'Google Chromium Mojo Sandbox Escape', dateAdded: isoAgo(2).substring(0, 10), shortDescription: 'Google Chrome Mojo sandbox escape vulnerability allows a remote attacker to perform a sandbox escape via crafted HTML.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-7).substring(0, 10), knownRansomwareCampaignUse: 'Unknown' },
    { cveID: 'CVE-2026-1974', vendorProject: 'Kubernetes', product: 'ingress-nginx', vulnerabilityName: 'Kubernetes ingress-nginx RCE Vulnerability', dateAdded: isoAgo(1).substring(0, 10), shortDescription: 'Kubernetes ingress-nginx allows unauthenticated RCE via admission controller, enabling full cluster takeover.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-7).substring(0, 10), knownRansomwareCampaignUse: 'Known' },
    { cveID: 'CVE-2026-29927', vendorProject: 'Vercel', product: 'Next.js', vulnerabilityName: 'Next.js Middleware Authorization Bypass', dateAdded: isoAgo(1).substring(0, 10), shortDescription: 'Next.js middleware authorization bypass allows attackers to skip middleware and access protected routes.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-7).substring(0, 10), knownRansomwareCampaignUse: 'Unknown' },
    { cveID: 'CVE-2026-30154', vendorProject: 'GitHub', product: 'Actions', vulnerabilityName: 'GitHub Actions Supply Chain Compromise', dateAdded: isoAgo(3).substring(0, 10), shortDescription: 'GitHub Actions tj-actions/changed-files supply chain compromise exposes CI/CD secrets through malicious code injection.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-14).substring(0, 10), knownRansomwareCampaignUse: 'Unknown' },
    { cveID: 'CVE-2026-23209', vendorProject: 'Craft CMS', product: 'Craft CMS', vulnerabilityName: 'Craft CMS Remote Code Execution', dateAdded: isoAgo(2).substring(0, 10), shortDescription: 'Craft CMS RCE vulnerability with compromised security key allows remote attackers to execute arbitrary code.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-14).substring(0, 10), knownRansomwareCampaignUse: 'Unknown' },
    { cveID: 'CVE-2026-24989', vendorProject: 'Microsoft', product: 'Power Pages', vulnerabilityName: 'Microsoft Power Pages Access Control Bypass', dateAdded: isoAgo(2).substring(0, 10), shortDescription: 'Microsoft Power Pages improper access control allows unauthorized privilege elevation over a network.', requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.', dueDate: isoAgo(-14).substring(0, 10), knownRansomwareCampaignUse: 'Unknown' }
  ];

  /* ── getSampleData ─────────────────────────────────────── */

  function getSampleData() {
    return {
      recentCVEs: FALLBACK_CVES,
      cisaKEV: FALLBACK_KEV
    };
  }

  /* ── Public API ────────────────────────────────────────── */

  window.SecCVE = {
    fetchRecentCVEs: fetchRecentCVEs,
    fetchCISAKEV: fetchCISAKEV,
    fetchAll: fetchAllCVE,
    renderCVEItem: renderCVEItem,
    renderKEVItem: renderKEVItem,
    renderCVEList: renderCVEList,
    renderKEVList: renderKEVList,
    getSampleData: getSampleData
  };

})();
