window.SecApp = (() => {
  const state = {
    feeds: {},
    cves: {},
    processed: {},
    activeMapMode: '2d'
  };

  async function init() {
    console.log('[SEC-CENTER] Initializing...');
    
    // 1. Start clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // 2. Initialize both globe/map engines
    window.SecGlobe.init('globe-container');
    window.SecGlobe2D.init('globe-canvas-2d');
    
    // Default to 2D
    if (window.SecGlobe2D) window.SecGlobe2D.start();
    
    // Setup UI Toggles
    setupMapToggle();
    setupLangToggle();
    
    // Setup Audio and Hunt
    if (window.SecAudio) {
      window.SecAudio.init();
      document.body.addEventListener('click', () => window.SecAudio.init(), { once: true });
    }
    if (window.SecHunt) window.SecHunt.init();
    if (window.SecNews) window.SecNews.init();
    
    // 3. Fetch all data
    await loadAllData();
    
    // 4. Render all panels
    renderDashboard();
    
    // 5. Start auto-refresh (every 1 minute)
    setInterval(loadAllData, 60 * 1000);
    
    // 6. Start generating map attacks from real data + simulated
    startAttackSimulation();
    
    // 6b. Update attack categories and counters every 20 seconds
    setInterval(() => {
      if (state.processed && state.processed.threats) {
        const attackStats = window.SecThreats.getAttackTypeStats(state.processed);
        window.SecCharts.drawBar('attack-type-chart', attackStats, {horizontal: true});
        
        window.SecCharts.animateCounter('attack-count', state.processed.totalAttacks || 0);
        const mapTotalEl = document.getElementById('map-total-attacks');
        if (mapTotalEl) mapTotalEl.textContent = window.SecUtils.formatNumber(state.processed.totalAttacks || 0);
        
        // Calculate dynamic DEFCON
        updateDefcon();
      }
    }, 20000);
    
    // 6c. Update country rankings every 30 seconds
    setInterval(() => {
      if (state.processed) {
        const countryStats = window.SecThreats.getCountryStats(state.processed);
        window.SecThreats.renderCountryRanking('country-ranking', countryStats);
        
        const mapCountriesEl = document.getElementById('map-countries-targeted');
        if (mapCountriesEl) mapCountriesEl.textContent = countryStats.length.toString();
      }
    }, 30000);
    
    // 7. Handle window resize
    window.addEventListener('resize', handleResize);
    
    console.log('[SEC-CENTER] Dashboard ready.');
  }

  function updateClock() {
    const now = new Date();
    const clock = document.getElementById('clock');
    const clockDate = document.getElementById('clock-date');
    if (clock) clock.textContent = now.toLocaleTimeString('en-US', {hour12: false});
    if (clockDate) clockDate.textContent = now.toLocaleDateString('en-US');
  }

  async function loadAllData() {
    setLoadingState(true);
    
    try {
      const [feedsData, cveData] = await Promise.allSettled([
        window.SecFeeds.fetchAll(),
        window.SecCVE.fetchAll()
      ]);
      
      state.feeds = feedsData.status === 'fulfilled' ? feedsData.value : window.SecFeeds.getSampleData();
      state.cves = cveData.status === 'fulfilled' ? cveData.value : window.SecCVE.getSampleData();
      
      const oldAttacks = state.processed ? state.processed.totalAttacks : null;
      const oldSimulated = state.processed && state.processed.threats 
        ? state.processed.threats.filter(t => t.simulated) 
        : [];
      
      const oldCountries = {};
      if (state.processed && state.processed.threats) {
        state.processed.threats.forEach(t => {
          if (t.id && t.country) oldCountries[t.id] = t.country;
        });
      }
        
      state.processed = window.SecThreats.processAllData(state.feeds, state.cves);
      
      // Re-apply old countries to prevent reshuffling
      state.processed.threats.forEach(t => {
        if (t.id && oldCountries[t.id]) t.country = oldCountries[t.id];
      });
      
      if (oldAttacks) state.processed.totalAttacks = oldAttacks;
      if (oldSimulated.length > 0) state.processed.threats.push(...oldSimulated);
      
    } catch (err) {
      console.error('[SEC-CENTER] Data loading failed, using simulated data:', err);
      state.feeds = window.SecFeeds.getSampleData();
      state.cves = window.SecCVE.getSampleData();
      
      const oldAttacks = state.processed ? state.processed.totalAttacks : null;
      const oldSimulated = state.processed && state.processed.threats 
        ? state.processed.threats.filter(t => t.simulated) 
        : [];
        
      state.processed = window.SecThreats.generateSimulatedData();
      
      if (oldAttacks) state.processed.totalAttacks = oldAttacks;
      if (oldSimulated.length > 0) state.processed.threats.push(...oldSimulated);
    }
    
    setLoadingState(false);
    updateLastUpdateTime();
    renderDashboard(); // Re-render after fetch
  }

  function renderDashboard() {
    // 1. Update stat cards with animated counters
    window.SecCharts.animateCounter('attack-count', state.processed.totalAttacks || 0);
    window.SecCharts.animateCounter('threat-count', state.processed.totalThreats || 0);
    window.SecCharts.animateCounter('ioc-count', state.processed.totalIOCs || 0);
    window.SecCharts.animateCounter('cve-count', state.cves.recentCVEs ? state.cves.recentCVEs.length : 0);
    
    // 2. Render threat feed
    window.SecFeeds.renderFeedList('threat-feed-list', state.feeds.threatfox || []);
    updateBadge('threat-feed-badge', state.feeds.threatfox ? state.feeds.threatfox.length : 0);
    
    window.SecFeeds.renderFeedList('url-feed-list', state.feeds.urlhaus || []);
    updateBadge('url-feed-badge', state.feeds.urlhaus ? state.feeds.urlhaus.length : 0);
    
    window.SecCVE.renderCVEList('cve-list', state.cves.recentCVEs || []);
    updateBadge('cve-badge', state.cves.recentCVEs ? state.cves.recentCVEs.length : 0);
    
    window.SecCVE.renderKEVList('kev-list', state.cves.cisaKEV || []);
    updateBadge('kev-badge', state.cves.cisaKEV ? state.cves.cisaKEV.length : 0);
    
    window.SecFeeds.renderFeedList('botnet-list', state.feeds.feodo || []);
    updateBadge('botnet-badge', state.feeds.feodo ? state.feeds.feodo.length : 0);
    
    // Country ranking
    const countryStats = window.SecThreats.getCountryStats(state.processed);
    window.SecThreats.renderCountryRanking('country-ranking', countryStats);
    
    // Charts
    const malwareStats = window.SecThreats.getMalwareStats(state.processed);
    window.SecCharts.drawDonut('malware-type-chart', malwareStats, {
      centerText: window.SecI18n ? window.SecI18n.t('chart_malware') : 'Malware',
      centerSubtext: window.SecI18n.t('chart_dist')
    });
    
    // Intel Modules
    if (window.SecIntel) {
      window.SecIntel.renderBreachList('breach-feed-list');
      window.SecIntel.renderRansomwareList('ransomware-feed-list');
      window.SecIntel.renderYaraList('yara-feed-list');
      window.SecIntel.renderIndustryList('industry-feed-list');
    }
    
    const attackStats = window.SecThreats.getAttackTypeStats(state.processed);
    window.SecCharts.drawBar('attack-type-chart', attackStats, {horizontal: true});
    
    const mitreData = window.SecThreats.getMitreMapping(state.processed);
    window.SecCharts.drawMitreMatrix('mitre-matrix', mitreData);
    
    const timelineData = window.SecThreats.getTimelineData(state.processed);
    window.SecCharts.drawLine('timeline-chart', timelineData, {
      lineColor: '#00f0ff',
      fillGradient: true
    });
    
    // Update map overlay stats
    const mapAttacksEl = document.getElementById('map-attacks-per-sec');
    if (mapAttacksEl) mapAttacksEl.textContent = window.SecUtils.formatNumber(state.processed.attacksPerSecond || 0);
    
    const mapCountriesEl = document.getElementById('map-countries-targeted');
    if (mapCountriesEl) mapCountriesEl.textContent = countryStats.length.toString();
    
    const mapTotalEl = document.getElementById('map-total-attacks');
    if (mapTotalEl) mapTotalEl.textContent = window.SecUtils.formatNumber(state.processed.totalAttacks || 0);
  }

  function startAttackSimulation() {
    function generateAttack() {
      const ObjectKeys = Object.keys(window.SecUtils.CITY_COORDS);
      if (ObjectKeys.length === 0) return;
      const types = ['malware', 'phishing', 'c2', 'ddos', 'exploit', 'bruteforce', 'ransomware'];
      
      const from = window.SecUtils.randomPick(ObjectKeys);
      let to = window.SecUtils.randomPick(ObjectKeys);
      while (to === from) to = window.SecUtils.randomPick(ObjectKeys);
      const type = window.SecUtils.randomPick(types);
      
      // Route attack to active map engine
      if (state.activeMapMode === '3d') {
        window.SecGlobe.addAttack(from, to, type);
      } else {
        window.SecGlobe2D.addAttack(from, to, type);
      }
      
      // Sync simulated attacks into the global state so charts can update
      if (state.processed && state.processed.threats) {
        const cCode = window.SecUtils.randomPick(Object.keys(window.SecUtils.COUNTRY_NAMES));
        state.processed.threats.push({ type: type, severity: 'medium', timestamp: Date.now(), country: cCode, simulated: true });
        state.processed.totalAttacks = (state.processed.totalAttacks || 0) + 1;
        localStorage.setItem('sec_center_total_attacks', state.processed.totalAttacks);
        
        // Push to matrix terminal randomly
        if (Math.random() > 0.6) {
          const severities = ['high', 'critical', 'system'];
          const sev = window.SecUtils.randomPick(severities);
          
          const intrusion_text = window.SecI18n.t('intrusion_detected');
          const msgStr = `> ${intrusion_text}: ${from} -> ${to} [${type.toUpperCase()}]`;
          appendTerminalLine(msgStr, sev);
        }
      }
    }
    
    function scheduleNext() {
      generateAttack();
      const delay = window.SecUtils.randomBetween(300, 1500);
      setTimeout(scheduleNext, delay);
    }
    scheduleNext();
  }

  function updateBadge(id, count) {
    const badge = document.getElementById(id);
    if (badge) badge.textContent = count || 0;
  }

  function setLoadingState(loading) {
    document.querySelectorAll('.feed-list, #country-ranking').forEach(el => {
      if (loading && !el.children.length) {
        el.innerHTML = `<div class="empty-state">${window.SecI18n ? window.SecI18n.t('loading') : 'Loading data...'}</div>`;
      }
    });
  }

  function updateLastUpdateTime() {
    const el = document.getElementById('last-update');
    if (el) el.textContent = new Date().toLocaleTimeString('en-US', {hour12: false});
  }

  function handleResize() {
    if (window.SecGlobe.resize) {
      window.SecGlobe.resize();
    }
  }

  /* ============================================================
     DEFCON & MATRIX TERMINAL LOGIC
     ============================================================ */
  function updateDefcon() {
    const indicator = document.getElementById('defcon-indicator');
    const textEl = indicator.querySelector('.defcon-text');
    if (!indicator || !textEl) return;

    // Use random bumps to simulate threat waves
    const fakeThreatScore = Math.random() * 10;
    
    if (fakeThreatScore > 8) {
      indicator.classList.add('critical');
      textEl.textContent = 'ALARM 2';
    } else if (fakeThreatScore > 5) {
      indicator.classList.remove('critical');
      textEl.textContent = 'ALARM 3';
    } else {
      indicator.classList.remove('critical');
      textEl.textContent = 'ALARM 5';
    }
  }

  function appendTerminalLine(text, type = 'system') {
    const terminals = document.querySelectorAll('.live-terminal');
    if (!terminals.length) return;

    terminals.forEach(terminal => {
      const div = document.createElement('div');
      div.className = `terminal-line ${type}`;
      div.textContent = text;
      
      terminal.appendChild(div);
      
      // Auto-scroll
      terminal.scrollTop = terminal.scrollHeight;

      // Keep only last 50 lines to prevent memory leak
      if (terminal.childElementCount > 50) {
        terminal.removeChild(terminal.firstElementChild);
      }
    });
  }

  function setupMapToggle() {
    const mapToggleBtn = document.getElementById('toggle-map-mode-btn');
    const mapStatusText = document.getElementById('map-mode-status');
    const rotationBtn = document.getElementById('toggle-rotation-btn');
    const globe3D = document.getElementById('globe-container');
    const globe2D = document.getElementById('globe-canvas-2d');

    if (!mapToggleBtn) return;

    mapToggleBtn.addEventListener('click', () => {
      if (state.activeMapMode === '3d') {
        // Switch to 2D
        state.activeMapMode = '2d';
        globe3D.style.display = 'none';
        globe2D.style.display = 'block';
        rotationBtn.style.display = 'none'; // Hide rotation toggle in 2D
        
        mapStatusText.textContent = window.SecI18n.t('map_2d');
        mapToggleBtn.style.background = 'rgba(0, 255, 136, 0.1)';
        mapToggleBtn.style.borderColor = 'var(--accent-green)';
        mapStatusText.style.color = 'var(--accent-green)';
        
        window.SecGlobe2D.start();
      } else {
        // Switch to 3D
        state.activeMapMode = '3d';
        globe2D.style.display = 'none';
        globe3D.style.display = 'block';
        rotationBtn.style.display = 'flex'; // Show rotation toggle in 3D
        
        mapStatusText.textContent = window.SecI18n.t('map_3d');
        mapToggleBtn.style.background = 'rgba(168, 85, 247, 0.1)';
        mapToggleBtn.style.borderColor = 'var(--accent-purple)';
        mapStatusText.style.color = 'var(--accent-purple)';
        
        window.SecGlobe2D.stop();
      }
    });
  }

  function setupLangToggle() {
    window.SecLang = 'tr'; 
    const langBtn = document.getElementById('lang-toggle');
    
    if (!langBtn) return;
    
    langBtn.addEventListener('click', () => {
      if (window.SecLang === 'tr') {
        window.SecLang = 'en';
        langBtn.textContent = 'EN';
        langBtn.style.color = 'var(--accent-green)';
        langBtn.style.borderColor = 'var(--accent-green)';
      } else {
        window.SecLang = 'tr';
        langBtn.textContent = 'TR';
        langBtn.style.color = 'var(--accent-cyan)';
        langBtn.style.borderColor = 'var(--accent-cyan)';
      }
      
      const mapStatusText = document.getElementById('map-mode-status');
      if (mapStatusText) {
         mapStatusText.textContent = state.activeMapMode === '3d' ? window.SecI18n.t('map_3d') : window.SecI18n.t('map_2d');
      }

      window.SecI18n.applyTranslations();
      refreshDataUI();
    });
    
    // Initial apply
    if (window.SecI18n) {
      window.SecI18n.applyTranslations();
    }
  }

  function getState() {
    return state;
  }

  return { init, refreshData: loadAllData, getState };
})();

// Auto-start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.SecApp.init);
} else {
  window.SecApp.init();
}
