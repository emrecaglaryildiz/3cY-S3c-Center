/* ============================================================
   SecModal — Dynamic Pop-up System
   ============================================================ */
window.SecModal = (() => {
  'use strict';

  let overlay, container, titleEl, bodyEl, closeBtn;

  function init() {
    overlay = document.getElementById('osint-modal');
    if (!overlay) return;
    
    container = overlay.querySelector('.modal-container');
    titleEl = document.getElementById('modal-title');
    bodyEl = document.getElementById('modal-body');
    closeBtn = document.getElementById('modal-close');

    // Close events
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) close();
    });

    // Attach click listeners to all modal targets
    document.querySelectorAll('[data-modal-target]').forEach(el => {
      el.addEventListener('click', () => {
        if (window.SecAudio) window.SecAudio.playClick();
        const target = el.getAttribute('data-modal-target');
        openTarget(target);
      });
    });
  }

  function openTarget(target) {
    bodyEl.innerHTML = `<div class="empty-state">${window.SecI18n ? window.SecI18n.t('loading') : 'Loading data...'}</div>`;
    overlay.classList.add('active');

    // Route to appropriate fetcher/renderer based on target
    if (target === 'threat-feed') {
      titleEl.textContent = window.SecI18n ? window.SecI18n.t('header_live_threat') : 'Live Threat Feed';
      if (window.SecApp && window.SecApp.getState) {
        const state = window.SecApp.getState();
        window.SecFeeds.renderFeedList('modal-body', state.feeds.threatfox || [], true);
      }
    } 
    else if (target === 'botnet-feed') {
      titleEl.textContent = window.SecI18n ? window.SecI18n.t('header_botnet_cc') : 'Botnet C&C Servers';
      if (window.SecApp && window.SecApp.getState) {
        const state = window.SecApp.getState();
        window.SecFeeds.renderFeedList('modal-body', state.feeds.feodo || [], true);
      }
    }
    else if (target === 'cve-feed') {
      titleEl.textContent = window.SecI18n ? window.SecI18n.t('header_recent_cves') : 'Recent CVEs';
      if (window.SecApp && window.SecApp.getState) {
        const state = window.SecApp.getState();
        window.SecCVE.renderCVEList('modal-body', state.cves.recentCVEs || [], true);
      }
    }
    else if (target === 'url-feed') {
      titleEl.textContent = window.SecI18n ? window.SecI18n.t('header_urlhaus') : 'Suspicious Domains';
      if (window.SecApp && window.SecApp.getState) {
        const state = window.SecApp.getState();
        window.SecFeeds.renderFeedList('modal-body', state.feeds.urlhaus || [], true);
      }
    }
    else if (target === 'ransomware-feed') {
      titleEl.textContent = window.SecI18n ? window.SecI18n.t('header_ransomware') : 'Ransomware Monitor';
      if (window.SecIntel) window.SecIntel.renderRansomwareList('modal-body', true);
    }
    else if (target === 'breach-feed') {
      titleEl.textContent = window.SecI18n ? window.SecI18n.t('header_breaches') : 'Data Breaches';
      if (window.SecIntel) window.SecIntel.renderBreachList('modal-body', true);
    }
    else if (target === 'yara-feed') {
      titleEl.textContent = window.SecI18n ? window.SecI18n.t('header_yara') : 'New YARA Signatures';
      if (window.SecIntel) window.SecIntel.renderYaraList('modal-body', true);
    }
    else if (target === 'industry-feed') {
      titleEl.textContent = window.SecI18n ? window.SecI18n.t('header_industry') : 'Targeted Industries';
      if (window.SecIntel) window.SecIntel.renderIndustryList('modal-body', true);
    }
    else if (target === 'terminal-feed') {
      titleEl.textContent = window.SecI18n ? window.SecI18n.t('header_raw_console') : '>_ RAW_INTERCEPT_CONSOLE';
      const sourceTerm = document.getElementById('live-terminal');
      if (sourceTerm) {
        bodyEl.innerHTML = sourceTerm.innerHTML;
        bodyEl.classList.add('live-terminal'); // Enables CSS and appending
      }
    }
    else if (target === 'country-ranking-feed') {
      titleEl.textContent = window.SecI18n ? window.SecI18n.t('header_top_countries') : 'Top Attacked Countries';
      if (window.SecApp && window.SecApp.getState) {
        const state = window.SecApp.getState();
        const countryStats = window.SecThreats.getCountryStats(state.processed, 100); // Pass larger limit for modal
        window.SecThreats.renderCountryRanking('modal-body', countryStats);
      }
    }
    else if (target === 'attack-categories-feed') {
      titleEl.textContent = window.SecI18n ? window.SecI18n.t('header_attack_categories') : 'Attack Categories';
      bodyEl.innerHTML = '<div class="canvas-container" style="height: 100%; min-height: 400px; display: flex; justify-content: center; align-items: center;"><canvas id="modal-attack-chart"></canvas></div>';
      
      if (window.SecApp && window.SecApp.getState) {
        const state = window.SecApp.getState();
        const attackStats = window.SecThreats.getAttackTypeStats(state.processed);
        setTimeout(() => {
          window.SecCharts.drawBar('modal-attack-chart', attackStats, {horizontal: false});
        }, 50);
      }
    }
    else if (target === 'mitre-attack-feed') {
      titleEl.textContent = window.SecI18n ? window.SecI18n.t('header_mitre') : 'MITRE ATT&CK';
      bodyEl.innerHTML = '<div id="modal-mitre-matrix" class="mitre-grid" style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; padding: 20px;"></div>';
      
      if (window.SecApp && window.SecApp.getState) {
        const state = window.SecApp.getState();
        const mitreData = window.SecThreats.getMitreMapping(state.processed);
        setTimeout(() => {
          window.SecCharts.drawMitreMatrix('modal-mitre-matrix', mitreData);
        }, 50);
      }
    }
    else if (target === 'node-graph-feed') {
      titleEl.textContent = 'APT & MALWARE İSTİHBARAT AĞI (NODE GRAPH)';
      bodyEl.innerHTML = '<div id="node-graph-container" style="width: 100%; height: 100%; min-height: 500px; display:flex; justify-content:center; align-items:center;">Yükleniyor...</div>';
      setTimeout(() => {
        if (window.SecGraph) window.SecGraph.draw('node-graph-container');
      }, 50);
    }
  }

  function close() {
    if (overlay) {
      // Clean up specific classes
      if (bodyEl) {
        bodyEl.classList.remove('live-terminal');
      }
      overlay.classList.remove('active');
      setTimeout(() => {
        bodyEl.innerHTML = '';
      }, 300); // clear after animation
    }
  }

  // Initialize after DOM load
  window.addEventListener('DOMContentLoaded', init);

  return { init, open: openTarget, close };
})();
