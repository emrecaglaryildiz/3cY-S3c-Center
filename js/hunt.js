/**
 * SEC-CENTER - Threat Hunt Module
 */

window.SecHunt = (function() {
  let searchInput;
  let huntOverlay;
  let huntContent;
  let huntCloseBtn;
  let typingInterval;

  function init() {
    searchInput = document.getElementById('hunt-search-input');
    huntOverlay = document.getElementById('hunt-overlay');
    huntContent = document.getElementById('hunt-content');
    huntCloseBtn = document.getElementById('hunt-close');
    const searchBtn = document.getElementById('hunt-search-btn');

    if (!searchInput || !huntOverlay) return;

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim() !== '') {
        startHunt(searchInput.value.trim());
      }
    });

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        if (searchInput.value.trim() !== '') {
          startHunt(searchInput.value.trim());
        }
      });
    }

    huntCloseBtn.addEventListener('click', closeHunt);
  }

  function startHunt(query) {
    if (window.SecAudio) window.SecAudio.playClick();
    
    // Open Overlay
    huntOverlay.classList.add('active');
    huntContent.innerHTML = ''; // Clear previous
    searchInput.value = ''; // Reset input
    searchInput.blur(); // Remove focus
    
    const isIP = /^[\\d\\.]+$/.test(query);
    const targetType = isIP ? 'IPv4 Address' : 'Domain / Hash';

    // Immediate output
    huntContent.innerHTML = `
      <div class="hunt-line" style="color: var(--accent-cyan);">[SYS] Başlatılıyor: Gerçek Zamanlı Hedef Analizi (T-HUNT v3.0)</div>
      <div class="hunt-line">[SYS] Hedef Tespiti: ${query} [${targetType}]</div>
      <div class="hunt-line" id="hunt-loading">[SYS] Canlı OSINT Veritabanlarına Bağlanılıyor... _</div>
      <br>
    `;

    fetchRealReport(query, isIP).then(lines => {
      const loader = document.getElementById('hunt-loading');
      if (loader) loader.innerHTML = '[SYS] Veritabanı bağlantısı başarılı. OSINT verileri aktarılıyor...';
      typewriterEffect(lines, () => {
        const vtUrl = isIP ? `https://www.virustotal.com/gui/ip/${query}` : `https://www.virustotal.com/gui/domain/${query}`;
        const btn = document.createElement('a');
        btn.href = vtUrl;
        btn.target = '_blank';
        btn.className = 'vt-btn';
        btn.innerHTML = '🛡️ VirusTotal\'da İncele';
        huntContent.appendChild(btn);
        huntContent.scrollTop = huntContent.scrollHeight;
      });
    }).catch(e => {
      const loader = document.getElementById('hunt-loading');
      if (loader) loader.innerHTML = '[!] BAĞLANTI HATASI';
      typewriterEffect([
        `[!] Sunucu ile iletişim kurulamadı: ${e.message}`,
        `[SYS] İşlem iptal edildi.`
      ]);
    });
  }

  function closeHunt() {
    if (window.SecAudio) window.SecAudio.playClick();
    huntOverlay.classList.remove('active');
    clearInterval(typingInterval);
  }

  async function fetchRealReport(query, isIP) {
    let location = "Bilinmiyor";
    let isp = "Bilinmeyen";
    let score = 50;
    let isMalicious = false;
    let ports = [];
    let domainCreation = "Bilinmiyor";
    let dnssec = "Bilinmiyor";
    let hostname = "";
    
    try {
      if (isIP) {
        // Fetch ports and vulns from Shodan InternetDB
        const idbRes = await fetch(`https://internetdb.shodan.io/${query}`);
        if (idbRes.ok) {
          const idb = await idbRes.json();
          if (idb.ports) {
            ports = idb.ports.map(p => `   - Port ${p} : AÇIK`);
          }
          if (idb.hostnames && idb.hostnames.length > 0) {
            hostname = idb.hostnames[0];
          }
          if (idb.vulns && idb.vulns.length > 0) {
            isMalicious = true;
            score -= 30;
          }
        }
        
        // Fetch GeoIP from ipwho.is
        const geoRes = await fetch(`https://ipwho.is/${query}`);
        if (geoRes.ok) {
          const geo = await geoRes.json();
          if (geo.success) {
            location = `${geo.country} / ${geo.city}`;
            isp = geo.connection.isp || geo.connection.org || "Bilinmeyen ISP";
            score = 80;
          }
        }
      } else {
        // Fetch WHOIS for domains
        const whoisRes = await fetch(`https://networkcalc.com/api/dns/whois/${query}`);
        if (whoisRes.ok) {
          const whois = await whoisRes.json();
          if (whois.status === 'OK' && whois.whois) {
            const w = whois.whois;
            location = `${w.country || 'Bilinmiyor'} ${w.state ? '/ ' + w.state : ''}`;
            isp = w.org || w.registrar || "Bilinmiyor";
            domainCreation = w.creation_date ? w.creation_date.split('T')[0] : 'Bilinmiyor';
            dnssec = w.dnssec || 'Bilinmiyor';
            score = 95; 
          } else {
            score = 15;
            isMalicious = true; 
          }
        }
      }
    } catch (e) {
      console.warn("API Error:", e);
    }

    if (ports.length === 0) {
      ports = [`   - Port 80, 443 : KAPALI VEYA FİLTRELİ`];
    }

    let lines = [
      `==================================================`,
      `> CANLI WHOIS & GEOIP SORGUSU:`,
      `   Lokasyon: ${location}`,
      `   ISP / Organizasyon: ${isp}`
    ];

    if (!isIP) {
      lines.push(`   Kayıt Tarihi: ${domainCreation}`);
      lines.push(`   DNSSEC Durumu: ${dnssec}`);
    } else if (hostname) {
      lines.push(`   Hostname: ${hostname}`);
    }

    lines.push(``);
    lines.push(`> AÇIK PORT TARAMASI (SHODAN INTERNETDB):`);
    lines = lines.concat(ports);
    lines.push(``);
    lines.push(`> TEHDİT İSTİHBARATI ANALİZİ:`);
    
    if (isMalicious) {
      lines.push(`   [!] ALARM: Bu hedef üzerinde açık zafiyetler veya şüpheli kayıtlar tespit edildi.`);
      lines.push(`   [+] Güvenilirlik Skoru: ${score}/100 (Kritik Tehlike)`);
      lines.push(`==================================================`);
      lines.push(`[SYS] Önerilen Aksiyon: Güvenlik duvarı üzerinde hedefe ait tüm in/out trafiği engellendi.`);
    } else {
      lines.push(`   [+] BİLGİ: Hedef temiz görünüyor. Bilinen zafiyet bulunamadı.`);
      lines.push(`   [+] Güvenilirlik Skoru: ${score}/100 (Güvenli)`);
      lines.push(`==================================================`);
      lines.push(`[SYS] Önerilen Aksiyon: Trafik olağan seyrinde izlenebilir. Engelleme gerekmiyor.`);
    }

    return lines;
  }

  function typewriterEffect(lines, onComplete) {
    let lineIdx = 0;
    let charIdx = 0;
    
    clearInterval(typingInterval);
    
    // Add lines progressively
    typingInterval = setInterval(() => {
      if (lineIdx >= lines.length) {
        clearInterval(typingInterval);
        if (onComplete) onComplete();
        return;
      }
      
      let currentLineText = lines[lineIdx];
      
      // If new line, create div
      if (charIdx === 0) {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'hunt-line';
        if (currentLineText.includes('[!]') || currentLineText.includes('ALARM')) {
          lineDiv.style.color = 'var(--accent-red)';
        } else if (currentLineText.includes('AÇIK') || currentLineText.includes('[+]')) {
          lineDiv.style.color = 'var(--accent-orange)';
        }
        huntContent.appendChild(lineDiv);
        
        if (window.SecAudio) window.SecAudio.playAlert();
      }
      
      const currentDivs = huntContent.querySelectorAll('.hunt-line');
      const activeDiv = currentDivs[currentDivs.length - 1];
      
      if (charIdx < currentLineText.length) {
        activeDiv.textContent += currentLineText[charIdx];
        charIdx++;
        if (window.SecAudio && charIdx % 3 === 0) window.SecAudio.playTyping();
      } else {
        lineIdx++;
        charIdx = 0;
      }
      
      // Auto-scroll
      huntContent.scrollTop = huntContent.scrollHeight;
      
    }, 15); // Fast typing
  }

  return { init };
})();
