/**
 * SEC-CENTER - Hacker News Ticker Module
 */

window.SecNews = (function() {
  const HN_API_TOP = 'https://hacker-news.firebaseio.com/v0/topstories.json';
  const HN_API_ITEM = 'https://hacker-news.firebaseio.com/v0/item/';
  const MAX_ITEMS = 20;

  let tickerEl = null;

  async function fetchTopNews() {
    try {
      const res = await fetch(HN_API_TOP);
      if (!res.ok) throw new Error('HN API Top Stories Error');
      const topIds = await res.json();
      
      const limitedIds = topIds.slice(0, MAX_ITEMS);
      
      const itemPromises = limitedIds.map(id => 
        fetch(`${HN_API_ITEM}${id}.json`).then(r => r.json())
      );
      
      const items = await Promise.all(itemPromises);
      return items.filter(item => item && item.title && item.url);
    } catch (e) {
      console.warn("Failed to fetch Hacker News:", e);
      return [];
    }
  }

  function renderTicker(newsItems) {
    if (!tickerEl) return;
    
    if (newsItems.length === 0) {
      tickerEl.innerHTML = '<span class="ticker-item">[!] İSTİHBARAT AKIŞI KESİLDİ</span>';
      return;
    }

    tickerEl.innerHTML = '';
    
    // Create elements
    newsItems.forEach(item => {
      const a = document.createElement('a');
      a.className = 'ticker-item';
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      
      // Cyberpunk formatting
      a.innerHTML = `<span class="ticker-bullet">::</span> ${item.title.toUpperCase()} <span class="ticker-score">[${item.score || 0} PTS]</span>`;
      
      // Play sound on click
      a.addEventListener('click', () => {
        if (window.SecAudio) window.SecAudio.playClick();
      });
      
      tickerEl.appendChild(a);
    });

    // Duplicate elements to create an infinite seamless scroll
    const itemsClone = tickerEl.innerHTML;
    tickerEl.innerHTML += itemsClone;
  }

  async function init() {
    tickerEl = document.getElementById('hacker-news-ticker');
    if (!tickerEl) return;

    // Load initial
    const news = await fetchTopNews();
    renderTicker(news);

    // Refresh every 3 minutes
    setInterval(async () => {
      const updatedNews = await fetchTopNews();
      renderTicker(updatedNews);
    }, 3 * 60 * 1000);
  }

  return { init };
})();
