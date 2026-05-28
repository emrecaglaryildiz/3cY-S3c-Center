window.SecI18n = (() => {
  'use strict';

  const dict = {
    tr: {
      subtitle: "Küresel Siber Tehdit İstihbaratı",
      nav_threat_feeds: "TEHDİT AKIŞLARI",
      nav_cve_monitor: "CVE MONİTÖRÜ",
      nav_attack_map: "SALDIRI HARİTASI",
      last_update: "SON GÜNCELLEME",
      stat_active_attacks: "Aktif Saldırılar",
      stat_threats: "Tehditler",
      stat_iocs: "IOC'ler",
      stat_cves_today: "Bugünkü CVE'ler",
      header_live_threat: "🔴 Canlı Tehdit Akışı",
      header_raw_console: ">_ RAW_INTERCEPT_CONSOLE",
      term_init: "Güvenli sızma matrisi başlatılıyor...",
      term_wait: "Canlı veri bekleniyor...",
      map_attacks_per_sec: "Saldırı/sn",
      map_targeted_countries: "Hedeflenen Ülkeler",
      map_total_attacks: "Toplam Saldırı (24s)",
      map_mode: "Harita Modu",
      map_auto_rotate: "Oto. Dönüş",
      legend_malware: "Zararlı Yazılım",
      legend_phishing: "Oltalama",
      legend_botnet: "C2/Botnet",
      legend_ddos: "DDoS",
      legend_exploit: "İstismar (Exploit)",
      header_top_countries: "🌍 En Çok Saldırıya Uğrayan Ülkeler",
      header_botnet_cc: "🤖 Botnet C&C Sunucuları",
      header_recent_cves: "🛡️ Son CVE'ler",
      header_attack_categories: "⚔️ Saldırı Kategorileri",
      header_mitre: "🏴‍☠️ MITRE ATT&CK",
      header_24h_activity: "📈 24 Saatlik Aktivite",
      header_urlhaus: "🔗 Şüpheli Domainler",
      header_ransomware: "🏴‍☠️ Fidye Yazılımı Monitörü",
      header_breaches: "🚨 Veri Sızıntıları Radar",
      header_yara: "🛡️ Yeni YARA İmzaları",
      header_industry: "📉 Hedefteki Sektörler",
      btn_malwarebazaar: "MalwareBazaar (abuse.ch)",
      desc_malwarebazaar: "Güncel Zararlı Yazılım Örnekleri",
      btn_phishstats: "PhishStats",
      desc_phishstats: "Küresel Oltalama (Phishing) Verileri",
      
      // Dynamic mapping
      status_on: "AÇIK",
      status_off: "KAPALI",
      map_2d: "2D Klasik",
      map_3d: "3D WebGL",
      sev_critical: "Kritik",
      sev_high: "Yüksek",
      sev_medium: "Orta",
      sev_low: "Düşük",
      chart_malware: "ZARARLI YAZILIM",
      chart_dist: "Dağılım",
      intrusion_detected: "SIZMA TESPİT EDİLDİ",
      loading: "Veri yükleniyor..."
    },
    en: {
      subtitle: "Global Cyber Threat Intelligence",
      nav_threat_feeds: "THREAT FEEDS",
      nav_cve_monitor: "CVE MONITOR",
      nav_attack_map: "ATTACK MAP",
      last_update: "LAST UPDATE",
      stat_active_attacks: "Active Attacks",
      stat_threats: "Threats",
      stat_iocs: "IOCs",
      stat_cves_today: "CVEs Today",
      header_live_threat: "🔴 Live Threat Feed",
      header_raw_console: ">_ RAW_INTERCEPT_CONSOLE",
      term_init: "Initiating secure intercept matrix...",
      term_wait: "Waiting for live data...",
      map_attacks_per_sec: "Attacks/sec",
      map_targeted_countries: "Targeted Countries",
      map_total_attacks: "Total Attacks (24h)",
      map_mode: "Map Mode",
      map_auto_rotate: "Auto-Rotate",
      legend_malware: "Malware",
      legend_phishing: "Phishing",
      legend_botnet: "C2/Botnet",
      legend_ddos: "DDoS",
      legend_exploit: "Exploit",
      header_top_countries: "🌍 Top Attacked Countries",
      header_botnet_cc: "🤖 Botnet C&C Servers",
      header_recent_cves: "🛡️ Recent CVEs",
      header_attack_categories: "⚔️ Attack Categories",
      header_mitre: "🏴‍☠️ MITRE ATT&CK",
      header_24h_activity: "📈 24h Activity",
      header_urlhaus: "🔗 Suspicious Domains",
      header_ransomware: "🏴‍☠️ Ransomware Monitor",
      header_breaches: "🚨 Data Breach Radar",
      header_yara: "🛡️ New YARA Signatures",
      header_industry: "📉 Targeted Industries",
      btn_malwarebazaar: "MalwareBazaar (abuse.ch)",
      desc_malwarebazaar: "Recent Malware Samples",
      btn_phishstats: "PhishStats",
      desc_phishstats: "Global Phishing Data",
      
      // Dynamic mapping
      status_on: "ON",
      status_off: "OFF",
      map_2d: "2D Classic",
      map_3d: "3D WebGL",
      sev_critical: "Critical",
      sev_high: "High",
      sev_medium: "Medium",
      sev_low: "Low",
      chart_malware: "MALWARE",
      chart_dist: "Distribution",
      intrusion_detected: "INTRUSION DETECTED",
      loading: "Loading data..."
    }
  };

  // Cache display names formatters
  const displayNamesTR = new Intl.DisplayNames(['tr'], { type: 'region' });
  const displayNamesEN = new Intl.DisplayNames(['en'], { type: 'region' });

  function t(key) {
    const lang = window.SecLang || 'tr';
    if (dict[lang] && dict[lang][key]) {
      return dict[lang][key];
    }
    return key;
  }

  function getCountryName(code) {
    if (!code) return "Unknown";
    const lang = window.SecLang || 'tr';
    try {
      if (lang === 'tr') {
        return displayNamesTR.of(code);
      } else {
        return displayNamesEN.of(code);
      }
    } catch (e) {
      return code;
    }
  }

  function applyTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      // For elements with mixed content (like icons), we only want to change the text node.
      // But for simplicity, we will just set textContent if there are no child elements except maybe a status dot.
      
      // Let's check if the element has a status dot icon
      const dot = el.querySelector('.status-dot');
      const defconDot = el.querySelector('.defcon-dot');
      const badge = el.querySelector('.section-badge');
      const legendDot = el.querySelector('.legend-dot');
      
      if (dot) {
        el.innerHTML = '';
        el.appendChild(dot);
        el.appendChild(document.createTextNode(t(key)));
      } else if (legendDot) {
        el.innerHTML = '';
        el.appendChild(legendDot);
        el.appendChild(document.createTextNode(t(key)));
      } else if (badge) {
        const text = t(key);
        // If it's a section header with a badge, the key is on the span containing text
        el.textContent = text;
      } else {
        el.textContent = t(key);
      }
    });
  }

  return { t, getCountryName, applyTranslations };
})();
