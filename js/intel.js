/* ============================================================
   SecIntel — Threat Intelligence Modules (Mock/Simulated)
   ============================================================ */
window.SecIntel = (() => {
  'use strict';

  // 1. Ransomware Groups
  const RANSOMWARE_GROUPS = [
    { group: 'LockBit 3.0', victim: 'City of Oakland', industry: 'Government', severity: 'critical' },
    { group: 'Cl0p', victim: 'BBC, British Airways', industry: 'Media/Transport', severity: 'critical' },
    { group: 'BlackCat (ALPHV)', victim: 'MGM Resorts', industry: 'Hospitality', severity: 'high' },
    { group: 'Play', victim: 'Rackspace', industry: 'Technology', severity: 'high' },
    { group: 'Vice Society', victim: 'LA Unified School', industry: 'Education', severity: 'high' },
    { group: 'Akira', victim: 'Nissan Oceania', industry: 'Automotive', severity: 'medium' },
    { group: 'Rhysida', victim: 'British Library', industry: 'Education', severity: 'high' },
    { group: '8Base', victim: 'Multiple SMBs', industry: 'Various', severity: 'medium' }
  ];

  // 2. Data Breaches
  const DATA_BREACHES = [
    { company: 'MoveIT Transfer', records: '60M+', source: 'Zero-day Exploit', severity: 'critical' },
    { company: 'T-Mobile', records: '37M', source: 'API Vulnerability', severity: 'high' },
    { company: '23andMe', records: '6.9M', source: 'Credential Stuffing', severity: 'critical' },
    { company: 'Okta', records: '100% Support Users', source: 'Support System Compromise', severity: 'critical' },
    { company: 'AnyDesk', records: 'Production Systems', source: 'Cyberattack', severity: 'high' },
    { company: 'Cloudflare', records: 'Source Code', source: 'Auth Token Theft', severity: 'medium' },
    { company: 'Discord.io', records: '760K', source: 'Database Hack', severity: 'medium' },
    { company: 'Equifax', records: '147M', source: 'Struts Exploit', severity: 'critical' },
    { company: 'Marriott', records: '500M', source: 'Database Compromise', severity: 'critical' },
    { company: 'Yahoo', records: '3B', source: 'State-sponsored Attack', severity: 'critical' },
    { company: 'First American', records: '885M', source: 'IDOR Vulnerability', severity: 'high' },
    { company: 'Facebook', records: '533M', source: 'Scraping', severity: 'medium' },
    { company: 'Twitter', records: '200M', source: 'API Scraping', severity: 'medium' },
    { company: 'Capital One', records: '106M', source: 'SSRF', severity: 'critical' },
    { company: 'Under Armour', records: '150M', source: 'App Breach', severity: 'high' },
    { company: 'LinkedIn', records: '700M', source: 'Data Scraping', severity: 'low' },
    { company: 'MyFitnessPal', records: '150M', source: 'DB Breach', severity: 'high' },
    { company: 'Adobe', records: '153M', source: 'Infrastructure Hack', severity: 'critical' },
    { company: 'Canva', records: '137M', source: 'Database Access', severity: 'high' },
    { company: 'Dubsmash', records: '162M', source: 'Unknown', severity: 'medium' }
  ];

  let currentBreaches = DATA_BREACHES.map(b => ({
    ...b,
    timestamp: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 14))
  })).sort((a, b) => b.timestamp - a.timestamp);

  // 3. YARA Rules
  const YARA_RULES = [
    { rule: 'APT29_CozyBear_Implant', family: 'APT29', author: 'CrowdStrike', type: 'APT' },
    { rule: 'WIN_Ransomware_LockBit3', family: 'LockBit', author: 'Kaspersky', type: 'Ransomware' },
    { rule: 'SUSP_PowerShell_Obfuscation', family: 'Generic', author: 'Florian Roth', type: 'Heuristic' },
    { rule: 'Linux_XOR_DDoS_Bot', family: 'XorDDoS', author: 'Trend Micro', type: 'Botnet' },
    { rule: 'CobaltStrike_Beacon_Mem', family: 'CobaltStrike', author: 'Elastic', type: 'C2' },
    { rule: 'VBS_QakBot_Dropper', family: 'QakBot', author: 'Mandiant', type: 'Dropper' }
  ];

  // 4. Targeted Industries
  const INDUSTRIES = [
    { name: 'Finance / Banking', trend: '+14%', count: 420 },
    { name: 'Healthcare', trend: '+28%', count: 385 },
    { name: 'Government / Military', trend: '+5%', count: 310 },
    { name: 'Technology / IT', trend: '-2%', count: 280 },
    { name: 'Education', trend: '+45%', count: 210 },
    { name: 'Manufacturing', trend: '+12%', count: 195 }
  ];

  // Generators for randomizing data slightly on load
  function getRansomware() {
    return RANSOMWARE_GROUPS.map(g => ({
      ...g,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 7))
    })).sort((a, b) => b.timestamp - a.timestamp);
  }

  function getBreaches() {
    return currentBreaches;
  }

  function getYaraRules() {
    return YARA_RULES.map(y => ({
      ...y,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 2))
    })).sort((a, b) => b.timestamp - a.timestamp);
  }

  function getIndustries() {
    // Already sorted by count roughly
    return INDUSTRIES;
  }

  /* ── Render Functions ──────────────────────────────────── */

  function renderRansomwareList(containerId, isModal = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    const data = getRansomware();
    const displayData = isModal ? data : data.slice(0, 5);
    
    displayData.forEach(item => {
      const div = document.createElement('div');
      div.className = 'feed-item';
      div.innerHTML = `
        <div class="feed-content">
          <div class="feed-title" style="color: var(--accent-red)">${item.group}</div>
          <div class="feed-meta">
            <span>Target: ${item.victim}</span>
            <span>(${item.industry})</span>
          </div>
        </div>
        <div class="feed-severity-badge severity-${item.severity}">${item.severity.toUpperCase()}</div>
      `;
      container.appendChild(div);
    });
  }

  function renderBreachList(containerId, isModal = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    const data = getBreaches();
    const displayData = isModal ? data : data.slice(0, 20);
    
    displayData.forEach(item => {
      const div = document.createElement('div');
      div.className = 'feed-item';
      div.innerHTML = `
        <div class="feed-content">
          <div class="feed-title">${item.company}</div>
          <div class="feed-meta">
            <span>${item.records} Records</span>
            <span>— ${item.source}</span>
          </div>
        </div>
        <div class="feed-severity-badge severity-${item.severity}">${item.severity.toUpperCase()}</div>
      `;
      container.appendChild(div);
    });
  }

  function renderYaraList(containerId, isModal = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    const data = getYaraRules();
    const displayData = isModal ? data : data.slice(0, 5);
    
    displayData.forEach(item => {
      const div = document.createElement('div');
      div.className = 'feed-item';
      div.innerHTML = `
        <div class="feed-content">
          <div class="feed-title" style="font-family: var(--font-mono); font-size: 10px;">${item.rule}</div>
          <div class="feed-meta">
            <span>By: ${item.author}</span>
            <span>Family: ${item.family}</span>
          </div>
        </div>
        <div class="feed-severity-badge" style="background: rgba(0, 240, 255, 0.1); color: var(--accent-cyan); font-size: 9px;">${item.type}</div>
      `;
      container.appendChild(div);
    });
  }

  function renderIndustryList(containerId, isModal = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    const data = getIndustries();
    const displayData = isModal ? data : data; // show all 6 usually
    
    const maxCount = Math.max(...data.map(d => d.count));
    
    displayData.forEach(item => {
      const div = document.createElement('div');
      div.className = 'country-item'; // Reuse country-item css
      const percent = Math.round((item.count / maxCount) * 100);
      const isUp = item.trend.startsWith('+');
      const trendColor = isUp ? 'var(--accent-red)' : 'var(--accent-green)';
      
      div.innerHTML = `
        <div class="country-name" style="flex: 1.5">${item.name}</div>
        <div class="country-bar">
          <div class="country-bar-fill" style="width: ${percent}%; background: linear-gradient(90deg, transparent, var(--accent-orange));"></div>
        </div>
        <div class="country-count" style="color: ${trendColor}">${item.trend}</div>
      `;
      container.appendChild(div);
    });
  }

  function simulateNewBreach() {
    const mockCompanies = ['TechCorp', 'GlobalBank', 'MegaHealth', 'RetailMax', 'GovAgencyX', 'CloudProvider Y'];
    const mockSources = ['Ransomware Leak', 'Insider Threat', 'Misconfigured S3 Bucket', 'Phishing', 'SQL Injection'];
    const mockSeverities = ['low', 'medium', 'high', 'critical'];
    
    const newBreach = {
      company: mockCompanies[Math.floor(Math.random() * mockCompanies.length)],
      records: Math.floor(Math.random() * 10) + 'M',
      source: mockSources[Math.floor(Math.random() * mockSources.length)],
      severity: mockSeverities[Math.floor(Math.random() * mockSeverities.length)],
      timestamp: new Date()
    };
    
    currentBreaches.unshift(newBreach);
    
    // Auto-update panels if they exist
    renderBreachList('breach-feed-list', false);
    
    // If modal is open for breaches, update it too
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle && (modalTitle.textContent.includes('Veri Sızıntıları') || modalTitle.textContent.includes('Data Breach'))) {
      renderBreachList('modal-body', true);
    }
  }

  // Check and add new breach every 5 minutes (300000 ms)
  setInterval(simulateNewBreach, 300000);

  return {
    renderRansomwareList,
    renderBreachList,
    renderYaraList,
    renderIndustryList
  };

})();
