/* ============================================================
   SecGlobe2D — High-Performance D3 Canvas Map Engine
   ============================================================ */
window.SecGlobe2D = (() => {
  'use strict';

  let canvas, ctx;
  let bgCanvas, bgCtx;
  let width = 0, height = 0, dpr = 1;
  let animFrameId = null;
  let isRunning = false;
  
  let projection, geoPath, geoPathBg;
  let worldData = null;
  // Create a graticule (lat/lon grid) for a tactical radar look
  let graticule = typeof d3 !== 'undefined' ? d3.geoGraticule10() : null;

  const arcsData = [];
  const MAX_ARCS = 50;

  function resize() {
    if (!canvas || typeof d3 === 'undefined') return;
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    bgCanvas.width = width * dpr;
    bgCanvas.height = height * dpr;
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Setup projection to fit the world perfectly into the canvas
    projection = d3.geoEquirectangular()
      .fitSize([width, height], {type: "Sphere"});
      
    geoPath = d3.geoPath().projection(projection).context(ctx);
    geoPathBg = d3.geoPath().projection(projection).context(bgCtx);

    if (worldData) {
      drawBackgroundMap();
    }
  }

  async function loadMapData() {
    try {
      const response = await fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json');
      const topo = await response.json();
      worldData = topojson.feature(topo, topo.objects.countries);
      drawBackgroundMap();
    } catch (e) {
      console.error("Failed to load map data:", e);
    }
  }

  function drawBackgroundMap() {
    bgCtx.clearRect(0, 0, width, height);

    if (!geoPathBg) return;

    // Draw Graticule (Grid lines)
    if (graticule) {
      bgCtx.beginPath();
      geoPathBg(graticule);
      bgCtx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
      bgCtx.lineWidth = 1;
      bgCtx.stroke();
    }

    // Draw Countries
    bgCtx.beginPath();
    geoPathBg(worldData);
    bgCtx.fillStyle = 'rgba(13, 18, 40, 0.9)'; // Match panel bg closely
    bgCtx.fill();
    
    // Country borders - Neon glow effect
    bgCtx.lineWidth = 1;
    bgCtx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    bgCtx.shadowColor = 'rgba(0, 240, 255, 0.5)';
    bgCtx.shadowBlur = 6;
    bgCtx.stroke();
    
    // Reset shadow
    bgCtx.shadowBlur = 0;
  }

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    // Offscreen canvas for static map background (Massive performance boost)
    bgCanvas = document.createElement('canvas');
    bgCtx = bgCanvas.getContext('2d');
    
    if (typeof d3 === 'undefined') {
      console.error("[SecGlobe2D] D3 is required but not loaded.");
      return;
    }

    resize();
    window.addEventListener('resize', resize);
    loadMapData();
    
    console.log('[SecGlobe2D] High-Def 2D D3 Map initialized.');
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    animFrameId = requestAnimationFrame(loop);
  }

  function stop() {
    isRunning = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
  }

  function addAttack(fromCity, toCity, type) {
    const fromCoords = window.SecUtils.CITY_COORDS[fromCity];
    const toCoords = window.SecUtils.CITY_COORDS[toCity];
    if (!fromCoords || !toCoords || !projection) return;

    arcsData.push({
      startLon: fromCoords[1], startLat: fromCoords[0],
      endLon: toCoords[1], endLat: toCoords[0],
      type: type,
      startTime: performance.now(),
      duration: 1500
    });

    if (arcsData.length > MAX_ARCS) arcsData.shift();
  }

  function hexToRgb(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 7) {
      r = parseInt(hex.substring(1,3), 16);
      g = parseInt(hex.substring(3,5), 16);
      b = parseInt(hex.substring(5,7), 16);
    }
    return `${r},${g},${b}`;
  }

  function drawArcs(now) {
    for (let i = arcsData.length - 1; i >= 0; i--) {
      const arc = arcsData[i];
      const elapsed = now - arc.startTime;
      const progress = elapsed / arc.duration;

      if (progress >= 1.2) {
        arcsData.splice(i, 1);
        continue;
      }

      if (progress <= 0) continue;
      
      const p1 = projection([arc.startLon, arc.startLat]);
      const p2 = projection([arc.endLon, arc.endLat]);
      if (!p1 || !p2) continue;
      
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      
      // Control point for quadratic curve (gives it an arc shape in 2D)
      const cx = p1[0] + dx/2 - dy * 0.25;
      const cy = p1[1] + dy/2 + dx * 0.25;

      const t = Math.min(progress, 1);
      const tStart = Math.max(0, t - 0.25); // Tail length

      function getBezierPoint(pt) {
        const x = Math.pow(1-pt, 2)*p1[0] + 2*(1-pt)*pt*cx + Math.pow(pt, 2)*p2[0];
        const y = Math.pow(1-pt, 2)*p1[1] + 2*(1-pt)*pt*cy + Math.pow(pt, 2)*p2[1];
        return [x, y];
      }

      const color = window.SecUtils.THREAT_COLORS[arc.type] || '#00f0ff';
      const rgb = hexToRgb(color);
      
      // Draw neon comet tail
      ctx.beginPath();
      const tailPt = getBezierPoint(tStart);
      ctx.moveTo(tailPt[0], tailPt[1]);
      
      for(let step = tStart; step <= t; step += 0.02) {
        const bp = getBezierPoint(step);
        ctx.lineTo(bp[0], bp[1]);
      }
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw explosion impact if arrived
      if (progress > 1 && progress < 1.2) {
        const radius = (progress - 1) * 35;
        const opacity = 1 - (progress - 1) * 5;
        
        // Outer glow
        ctx.beginPath();
        ctx.arc(p2[0], p2[1], radius, 0, Math.PI*2);
        ctx.fillStyle = `rgba(${rgb}, ${opacity * 0.5})`;
        ctx.fill();
        
        // Inner intense core
        ctx.beginPath();
        ctx.arc(p2[0], p2[1], radius * 0.3, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fill();
      }
    }
  }

  function loop() {
    if (!isRunning) return;
    
    // Clear main canvas completely
    ctx.clearRect(0, 0, width, height);
    
    // Draw the cached beautiful static background map
    if (bgCanvas.width > 0) {
      ctx.drawImage(bgCanvas, 0, 0, width, height);
    }
    
    // Draw the laser beams
    drawArcs(performance.now());
    animFrameId = requestAnimationFrame(loop);
  }

  return { init, addAttack, start, stop, resize };
})();
