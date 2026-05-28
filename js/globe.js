/* ============================================================
   SecGlobe — 3D WebGL World Map with Animated Attack Arcs
   ============================================================ */
window.SecGlobe = (() => {
  'use strict';

  let globe;
  let containerId;
  let arcsData = [];
  
  // Track cleanup for arcs
  const MAX_ARCS = 40;

  // Colors for attack types
  function getArcColor(type) {
    return window.SecUtils.THREAT_COLORS[type] || '#00f0ff';
  }

  function init(id) {
    containerId = id;
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Clear just in case
    container.innerHTML = '';

    // Initialize 3D Globe
    globe = Globe()(container)
      .backgroundColor('rgba(0,0,0,0)')
      .showGlobe(true)
      .showAtmosphere(true)
      .atmosphereColor('#00f0ff')
      .atmosphereAltitude(0.15)
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
      // Arc styling
      .arcStartLat(d => d.startLat)
      .arcStartLng(d => d.startLng)
      .arcEndLat(d => d.endLat)
      .arcEndLng(d => d.endLng)
      // Make start transparent, end bright to show direction (Comet effect)
      .arcColor(d => ['rgba(0,0,0,0)', getArcColor(d.type)])
      .arcAltitude(d => d.arcAlt)
      .arcStroke(1.5) // Make arcs thicker
      .arcDashLength(0.5) // Longer comet tail
      .arcDashGap(2)
      .arcDashInitialGap(d => d.order * 0.1 || 0)
      .arcDashAnimateTime(1500) // Slightly slower so eyes can track
      .arcsTransitionDuration(0);

    // Initial camera position
    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.2 });

    // Auto-rotate setup
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.5;
    
    // UI Toggle Button logic
    const toggleBtn = document.getElementById('toggle-rotation-btn');
    const statusText = document.getElementById('rotation-status');
    
    function setRotation(active) {
      globe.controls().autoRotate = active;
      if (statusText) {
        statusText.textContent = active ? 'AÇIK' : 'KAPALI';
        statusText.style.color = active ? 'var(--accent-cyan)' : 'var(--text-muted)';
      }
      if (toggleBtn) {
        toggleBtn.style.borderColor = active ? 'var(--accent-cyan)' : 'var(--border-color)';
      }
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        setRotation(!globe.controls().autoRotate);
      });
    }

    // Disable auto-rotate when user interacts (drags/zooms)
    globe.controls().addEventListener('start', () => {
      setRotation(false);
    });
    
    // Disable zooming/panning to keep dashboard static or allow it?
    // Let's allow it but restrict zoom distance
    globe.controls().minDistance = 150;
    globe.controls().maxDistance = 400;

    // Handle Window Resize
    window.addEventListener('resize', () => {
      if (globe && container) {
        globe.width(container.clientWidth);
        globe.height(container.clientHeight);
      }
    });

    console.log('[SecGlobe] 3D WebGL Globe initialized.');
  }

  function addAttack(fromCity, toCity, type) {
    if (!globe) return;
    
    const fromCoords = window.SecUtils.CITY_COORDS[fromCity];
    const toCoords = window.SecUtils.CITY_COORDS[toCity];
    if (!fromCoords || !toCoords) return;

    // Calculate dynamic altitude based on distance
    const dist = Math.sqrt(
      Math.pow(fromCoords[0] - toCoords[0], 2) + 
      Math.pow(fromCoords[1] - toCoords[1], 2)
    );
    // distance scaling: ~100 degrees -> 0.4 altitude
    const arcAlt = Math.max(0.1, Math.min(dist / 200, 0.5));

    const attack = {
      startLat: fromCoords[0],
      startLng: fromCoords[1],
      endLat: toCoords[0],
      endLng: toCoords[1],
      type: type,
      arcAlt: arcAlt,
      order: Math.random(), // used for initial gap variation
      timestamp: Date.now()
    };

    arcsData.push(attack);
    
    // Prune old arcs so WebGL doesn't overload
    if (arcsData.length > MAX_ARCS) {
      arcsData.shift();
    }

    globe.arcsData(arcsData);
  }

  return {
    init,
    addAttack
  };
})();
