/* ============================================================
   SecCharts — Pure-Canvas Charting for SOC Dashboard
   ============================================================ */
window.SecCharts = (() => {
  'use strict';

  /* ============================================================
     Shared helpers
     ============================================================ */
  function prepCanvas(canvasId) {
    const canvas = typeof canvasId === 'string'
      ? document.getElementById(canvasId)
      : canvasId;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement
      ? canvas.parentElement.getBoundingClientRect()
      : canvas.getBoundingClientRect();

    const w = rect.width || canvas.clientWidth || 300;
    const h = rect.height || canvas.clientHeight || 200;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    return { canvas, ctx, w, h, dpr };
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function defaultColors(i) {
    const palette = [
      '#00f0ff', '#ff3366', '#a855f7', '#fbbf24', '#3b82f6',
      '#00e676', '#ff8800', '#ff0040', '#64748b', '#06b6d4'
    ];
    return palette[i % palette.length];
  }

  /* ============================================================
     Donut Chart
     ============================================================ */
  function drawDonut(canvasId, data, options = {}) {
    if (!data || data.length === 0) return;

    const info = prepCanvas(canvasId);
    if (!info) return;
    const { ctx, w, h } = info;

    const lineWidth = options.lineWidth || 18;
    const radius = options.radius || Math.min(w, h) * 0.35;
    const cx = w / 2;
    const cy = h * 0.45;
    const gap = 0.03;   // radians between segments
    const total = data.reduce((s, d) => s + d.value, 0);
    const animDuration = options.animate !== false ? 1200 : 0;
    const startTime = performance.now();

    function render(now) {
      const elapsed = now - startTime;
      const progress = animDuration ? Math.min(easeOutCubic(elapsed / animDuration), 1) : 1;

      ctx.clearRect(0, 0, w, h);

      // background ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // segments
      let angle = -Math.PI / 2;
      const sweepTotal = Math.PI * 2 - gap * data.length;

      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        const sweep = (d.value / total) * sweepTotal * progress;
        const color = d.color || defaultColors(i);

        ctx.beginPath();
        ctx.arc(cx, cy, radius, angle, angle + sweep);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        angle += sweep + gap;
      }

      // center text
      if (options.centerText !== undefined) {
        ctx.fillStyle = '#e0e6ed';
        ctx.font = 'bold ' + Math.round(radius * 0.45) + 'px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          typeof options.centerText === 'number'
            ? SecUtils.formatNumber(Math.round(options.centerText * progress))
            : options.centerText,
          cx, cy - 4
        );
      }
      if (options.centerSubtext) {
        ctx.fillStyle = 'rgba(160,180,200,0.7)';
        ctx.font = '11px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(options.centerSubtext, cx, cy + radius * 0.22);
      }

      // legend
      const legendY = cy + radius + lineWidth + 14;
      const legendItemW = w / data.length;
      ctx.font = '10px "Inter", sans-serif';
      ctx.textBaseline = 'top';

      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        const lx = legendItemW * i + legendItemW / 2;
        const color = d.color || defaultColors(i);

        // dot
        ctx.beginPath();
        ctx.arc(lx - 18, legendY + 5, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // label
        ctx.fillStyle = 'rgba(180,200,220,0.8)';
        ctx.textAlign = 'left';
        ctx.fillText(SecUtils.truncate(d.label, 12), lx - 10, legendY);

        // value
        ctx.fillStyle = '#e0e6ed';
        ctx.fillText(SecUtils.formatNumber(d.value), lx - 10, legendY + 14);
      }

      if (progress < 1) requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }

  /* ============================================================
     Bar Chart
     ============================================================ */
  function drawBar(canvasId, data, options = {}) {
    if (!data || data.length === 0) return;

    const info = prepCanvas(canvasId);
    if (!info) return;
    const { ctx, w, h } = info;

    const horizontal = !!options.horizontal;
    const padLeft = horizontal ? 70 : 40;
    const padRight = 20;
    const padTop = 20;
    const padBottom = horizontal ? 20 : 40;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const barGap = options.gap || 8;
    const maxVal = Math.max(...data.map(d => d.value));
    const animDuration = options.animate !== false ? 1000 : 0;
    const startTime = performance.now();

    function roundedRect(x, y, bw, bh, r) {
      r = Math.min(r, bw / 2, bh / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + bw - r, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
      ctx.lineTo(x + bw, y + bh);
      ctx.lineTo(x, y + bh);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function render(now) {
      const elapsed = now - startTime;
      const progress = animDuration ? Math.min(easeOutCubic(elapsed / animDuration), 1) : 1;

      ctx.clearRect(0, 0, w, h);

      // grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 0.5;
      const gridCount = 4;
      for (let i = 0; i <= gridCount; i++) {
        if (horizontal) {
          const gx = padLeft + (chartW / gridCount) * i;
          ctx.beginPath(); ctx.moveTo(gx, padTop); ctx.lineTo(gx, padTop + chartH); ctx.stroke();
        } else {
          const gy = padTop + (chartH / gridCount) * i;
          ctx.beginPath(); ctx.moveTo(padLeft, gy); ctx.lineTo(padLeft + chartW, gy); ctx.stroke();
        }
      }

      const n = data.length;

      if (horizontal) {
        const barH = Math.min((chartH - barGap * (n - 1)) / n, options.barWidth || 24);
        const totalH = barH * n + barGap * (n - 1);
        const offsetY = padTop + (chartH - totalH) / 2;

        for (let i = 0; i < n; i++) {
          const d = data[i];
          const color = d.color || defaultColors(i);
          const barW = (d.value / maxVal) * chartW * progress;
          const by = offsetY + i * (barH + barGap);

          // gradient
          const grad = ctx.createLinearGradient(padLeft, 0, padLeft + barW, 0);
          grad.addColorStop(0, hexToRGBA(color, 0.9));
          grad.addColorStop(1, hexToRGBA(color, 0.5));

          roundedRect(padLeft, by, barW, barH, 4);
          ctx.fillStyle = grad;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;

          // label
          ctx.fillStyle = 'rgba(180,200,220,0.8)';
          ctx.font = '11px "Inter", sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(SecUtils.truncate(d.label, 10), padLeft - 6, by + barH / 2);

          // value
          if (options.showValues !== false) {
            const valStr = SecUtils.formatNumber(Math.floor(d.value * progress));
            const textW = ctx.measureText(valStr).width;
            if (barW > textW + 12) {
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'right';
              ctx.fillText(valStr, padLeft + barW - 6, by + barH / 2);
            } else {
              ctx.fillStyle = '#e0e6ed';
              ctx.textAlign = 'left';
              ctx.fillText(valStr, padLeft + barW + 6, by + barH / 2);
            }
          }
        }
      } else {
        // vertical bars
        const barW = Math.min((chartW - barGap * (n - 1)) / n, options.barWidth || 36);
        const totalW = barW * n + barGap * (n - 1);
        const offsetX = padLeft + (chartW - totalW) / 2;

        for (let i = 0; i < n; i++) {
          const d = data[i];
          const color = d.color || defaultColors(i);
          const barH = (d.value / maxVal) * chartH * progress;
          const bx = offsetX + i * (barW + barGap);
          const by = padTop + chartH - barH;

          // gradient
          const grad = ctx.createLinearGradient(0, by, 0, padTop + chartH);
          grad.addColorStop(0, hexToRGBA(color, 0.9));
          grad.addColorStop(1, hexToRGBA(color, 0.35));

          roundedRect(bx, by, barW, barH, 4);
          ctx.fillStyle = grad;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;

          // value on top
          if (options.showValues !== false) {
            ctx.fillStyle = '#e0e6ed';
            ctx.font = 'bold 11px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(SecUtils.formatNumber(d.value * progress), bx + barW / 2, by - 4);
          }

          // category label
          ctx.fillStyle = 'rgba(160,180,200,0.7)';
          ctx.font = '10px "Inter", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(SecUtils.truncate(d.label, 8), bx + barW / 2, padTop + chartH + 6);
        }
      }

      if (progress < 1) requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }

  /* ============================================================
     Line Chart
     ============================================================ */
  function drawLine(canvasId, data, options = {}) {
    if (!data || data.length === 0) return;

    const info = prepCanvas(canvasId);
    if (!info) return;
    const { ctx, w, h } = info;

    const padLeft = 45;
    const padRight = 15;
    const padTop = 15;
    const padBottom = 30;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const lineColor = options.lineColor || '#00f0ff';
    const smooth = options.smooth !== false;
    const showDots = options.showDots !== false;
    const animDuration = options.animate !== false ? 1400 : 0;
    const startTime = performance.now();

    const maxVal = Math.max(...data.map(d => d.value)) * 1.1 || 1;
    const n = data.length;

    // compute point positions
    const points = data.map((d, i) => ({
      x: padLeft + (i / Math.max(n - 1, 1)) * chartW,
      y: padTop + chartH - (d.value / maxVal) * chartH,
      value: d.value,
      label: d.label
    }));

    function render(now) {
      const elapsed = now - startTime;
      const progress = animDuration ? Math.min(easeOutCubic(elapsed / animDuration), 1) : 1;
      const visibleN = Math.ceil(n * progress);

      ctx.clearRect(0, 0, w, h);

      // horizontal grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      const gridLines = 4;
      for (let i = 0; i <= gridLines; i++) {
        const gy = padTop + (chartH / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(padLeft, gy);
        ctx.lineTo(padLeft + chartW, gy);
        ctx.stroke();

        // axis label
        const val = maxVal - (maxVal / gridLines) * i;
        ctx.fillStyle = 'rgba(140,160,180,0.5)';
        ctx.font = '9px "Inter", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(SecUtils.formatNumber(val), padLeft - 6, gy);
      }

      // build path
      ctx.beginPath();
      for (let i = 0; i < visibleN; i++) {
        const p = points[i];
        if (i === 0) {
          ctx.moveTo(p.x, p.y);
        } else if (smooth && i >= 1) {
          const prev = points[i - 1];
          const cpx = (prev.x + p.x) / 2;
          ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }

      // glow line
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // fill gradient
      if (options.fillGradient !== false && visibleN > 1) {
        const fillPath = new Path2D();
        fillPath.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < visibleN; i++) {
          const p = points[i];
          if (smooth) {
            const prev = points[i - 1];
            const cpx = (prev.x + p.x) / 2;
            fillPath.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y);
          } else {
            fillPath.lineTo(p.x, p.y);
          }
        }
        fillPath.lineTo(points[visibleN - 1].x, padTop + chartH);
        fillPath.lineTo(points[0].x, padTop + chartH);
        fillPath.closePath();

        const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
        grad.addColorStop(0, hexToRGBA(lineColor, 0.25));
        grad.addColorStop(1, hexToRGBA(lineColor, 0.0));
        ctx.fillStyle = grad;
        ctx.fill(fillPath);
      }

      // dots
      if (showDots) {
        for (let i = 0; i < visibleN; i++) {
          const p = points[i];
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = lineColor;
          ctx.shadowColor = lineColor;
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;

          // white core
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
        }
      }

      // x-axis labels
      ctx.fillStyle = 'rgba(160,180,200,0.6)';
      ctx.font = '9px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelStep = Math.max(1, Math.floor(n / 8));
      for (let i = 0; i < n; i += labelStep) {
        ctx.fillText(
          SecUtils.truncate(data[i].label, 6),
          points[i].x,
          padTop + chartH + 8
        );
      }
      // always show last label
      if ((n - 1) % labelStep !== 0) {
        ctx.fillText(
          SecUtils.truncate(data[n - 1].label, 6),
          points[n - 1].x,
          padTop + chartH + 8
        );
      }

      if (progress < 1) requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }

  /* ============================================================
     Animated Counter
     ============================================================ */
  function animateCounter(elementId, targetValue, duration = 2000) {
    const el = typeof elementId === 'string'
      ? document.getElementById(elementId)
      : elementId;
    if (!el) return;

    const currentText = el.textContent.replace(/[^0-9.-]/g, '');
    const startVal = parseFloat(currentText) || 0;
    SecUtils.animateValue(el, startVal, targetValue, duration);
  }

  /* ============================================================
     MITRE ATT&CK Mini Matrix
     ============================================================ */
  function drawMitreMatrix(containerId, data) {
    const container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;
    if (!container || !data || data.length === 0) return;

    container.innerHTML = '';

    // outer wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      display: flex;
      gap: 2px;
      overflow: auto;
      padding: 4px;
      font-family: "Inter", "Segoe UI", sans-serif;
      width: 100%;
      height: 100%;
    `;

    // find global max count for colour scaling
    let globalMax = 0;
    data.forEach(tactic => {
      tactic.techniques.forEach(tech => {
        if (tech.count > globalMax) globalMax = tech.count;
      });
    });
    if (globalMax === 0) globalMax = 1;

    data.forEach(tactic => {
      const col = document.createElement('div');
      col.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 100px;
        flex: 1;
      `;

      // tactic header
      const header = document.createElement('div');
      header.textContent = tactic.tactic;
      header.style.cssText = `
        background: rgba(0, 240, 255, 0.08);
        color: #00f0ff;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 6px 4px;
        text-align: center;
        border-radius: 4px 4px 0 0;
        border-bottom: 1px solid rgba(0, 240, 255, 0.15);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      col.appendChild(header);

      // technique cells
      tactic.techniques.forEach(tech => {
        const cell = document.createElement('div');
        const intensity = Math.min(tech.count / globalMax, 1);

        // colour ramp: low = dark teal, high = bright red
        const r = Math.round(15 + intensity * 240);
        const g = Math.round(30 + (1 - intensity) * 60);
        const b = Math.round(60 + (1 - intensity) * 60);
        const alpha = 0.25 + intensity * 0.55;

        cell.style.cssText = `
          background: rgba(${r},${g},${b},${alpha});
          padding: 5px 4px;
          font-size: 9px;
          color: rgba(224,230,237,${0.5 + intensity * 0.5});
          cursor: pointer;
          border-radius: 2px;
          transition: transform 0.15s, box-shadow 0.15s;
          position: relative;
          line-height: 1.2;
          border: 1px solid rgba(${r},${g},${b},${alpha * 0.5});
        `;

        const idSpan = document.createElement('span');
        idSpan.textContent = tech.id;
        idSpan.style.cssText = 'display:block; font-weight:700; font-size:8px; opacity:0.7; pointer-events:none;';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = tech.name;
        nameSpan.style.cssText = 'display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none;';

        cell.appendChild(idSpan);
        cell.appendChild(nameSpan);

        // We use a global tooltip to prevent overflow clipping
        let mitreTooltip = document.getElementById('mitre-tooltip');
        if (!mitreTooltip) {
          mitreTooltip = document.createElement('div');
          mitreTooltip.id = 'mitre-tooltip';
          mitreTooltip.style.cssText = `
            display: none;
            position: fixed;
            background: rgba(10, 14, 28, 0.95);
            border: 1px solid rgba(0, 240, 255, 0.2);
            border-radius: 6px;
            padding: 8px 10px;
            font-size: 11px;
            color: #e0e6ed;
            white-space: nowrap;
            z-index: 9999;
            pointer-events: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.6);
            transform: translate(-50%, -100%);
            margin-top: -8px;
          `;
          document.body.appendChild(mitreTooltip);
        }

        cell.addEventListener('mouseenter', () => {
          cell.style.transform = 'scale(1.05)';
          cell.style.boxShadow = `0 0 12px rgba(${r},${g},${b},0.5)`;
          cell.style.zIndex = '10';
          
          mitreTooltip.innerHTML = `
            <div style="color:#00f0ff;font-weight:700;margin-bottom:2px;">${tech.id}</div>
            <div>${tech.name}</div>
            <div style="margin-top:4px;color:${intensity > 0.6 ? '#ff3366' : '#fbbf24'};">
              Tespit Sayısı: <strong>${tech.count}</strong>
            </div>
          `;
          
          mitreTooltip.style.display = 'block';
          const rect = cell.getBoundingClientRect();
          mitreTooltip.style.left = (rect.left + rect.width / 2) + 'px';
          mitreTooltip.style.top = rect.top + 'px';
        });

        cell.addEventListener('mouseleave', () => {
          cell.style.transform = 'scale(1)';
          cell.style.boxShadow = 'none';
          cell.style.zIndex = '1';
          mitreTooltip.style.display = 'none';
        });

        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          let pane = document.getElementById('mitre-detail-pane');
          if (pane) pane.remove(); // Always recreate to ensure correct context

          pane = document.createElement('div');
          pane.id = 'mitre-detail-pane';
          
          const modalOverlay = document.getElementById('osint-modal');
          const inModal = modalOverlay && modalOverlay.classList.contains('active');
          
          if (inModal) {
            pane.style.cssText = `
              position: absolute;
              right: 0;
              top: 0;
              bottom: 0;
              width: 380px;
              background: rgba(10, 14, 28, 0.98);
              backdrop-filter: blur(20px);
              border-left: 1px solid rgba(0, 240, 255, 0.5);
              box-shadow: -10px 0 50px rgba(0,0,0,1);
              padding: 24px;
              transform: translateX(100%);
              transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              z-index: 1000;
              overflow-y: auto;
              font-family: "Inter", sans-serif;
            `;
            const modalContainer = document.querySelector('.modal-container');
            modalContainer.style.overflow = 'hidden';
            modalContainer.style.position = 'relative';
            modalContainer.appendChild(pane);
          } else {
            pane.style.cssText = `
              position: fixed;
              right: 0;
              top: 0;
              bottom: 0;
              width: 380px;
              background: rgba(10, 14, 28, 0.98);
              backdrop-filter: blur(20px);
              border-left: 1px solid rgba(0, 240, 255, 0.5);
              box-shadow: -10px 0 50px rgba(0,0,0,1);
              padding: 24px;
              transform: translateX(100%);
              transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              z-index: 2147483647;
              overflow-y: auto;
              font-family: "Inter", sans-serif;
            `;
            document.body.appendChild(pane);
          }
          
          pane.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px;">
              <div>
                <div style="color: #00f0ff; font-weight: 700; font-size: 16px; margin-bottom: 4px; font-family: 'JetBrains Mono', monospace;">${tech.id}</div>
                <div style="font-size: 18px; font-weight: 600; color: #e0e8ff;">${tech.name}</div>
              </div>
              <button id="close-mitre-pane" style="background: none; border: none; color: #8892b0; cursor: pointer; font-size: 24px; padding: 0; line-height: 1;">&times;</button>
            </div>
            <div style="margin-bottom: 20px;">
              <div style="font-size: 11px; color: #5a6480; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Taktik / Kategori</div>
              <div style="font-size: 14px; color: #e0e8ff; padding: 6px 10px; background: rgba(0,240,255,0.05); border-radius: 4px; border: 1px solid rgba(0,240,255,0.1);">${tactic.tactic}</div>
            </div>
            <div style="margin-bottom: 20px;">
              <div style="font-size: 11px; color: #5a6480; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Aktivite Skoru</div>
              <div style="display: flex; align-items: baseline; gap: 8px;">
                <div style="font-size: 28px; font-family: 'JetBrains Mono', monospace; color: ${intensity > 0.6 ? '#ff3366' : '#fbbf24'}; font-weight: 700;">${tech.count}</div>
                <div style="font-size: 12px; color: #8892b0;">olay / 24s</div>
              </div>
            </div>
            <div style="margin-bottom: 20px;">
              <div style="font-size: 11px; color: #5a6480; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Teknik Detayı</div>
              <div style="font-size: 13px; line-height: 1.6; color: #a0aabf; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px;">
                Saldırganlar, <strong>${tactic.tactic}</strong> hedeflerine ulaşmak için <strong>${tech.name}</strong> tekniklerini kullanabilir. 
                Bu faaliyet, sisteme yetkisiz erişim sağlama, kalıcılık (persistence) elde etme, veri sızdırma veya savunma mekanizmalarını atlatma amacı taşıyor olabilir.
              </div>
            </div>
            <div>
              <div style="font-size: 11px; color: #5a6480; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Önerilen Aksiyon (Playbook)</div>
              <div style="font-size: 13px; line-height: 1.6; color: #00ff88; padding: 12px; background: rgba(0, 255, 136, 0.05); border-radius: 6px; border: 1px solid rgba(0, 255, 136, 0.2);">
                - SIEM üzerindeki <strong>${tactic.tactic}</strong> uyarılarını derhal inceleyin.<br><br>
                - Uç nokta (EDR) telemetrisinde olağandışı process ve network bağlantılarını doğrulayın.<br><br>
                - İlgili cihazları karantinaya almayı değerlendirin.
              </div>
            </div>
          `;

          // Slide in
          setTimeout(() => {
            pane.style.transform = 'translateX(0)';
          }, 10);

          document.getElementById('close-mitre-pane').addEventListener('click', () => {
            pane.style.transform = 'translateX(100%)';
          });
        });

        col.appendChild(cell);
      });

      wrapper.appendChild(col);
    });

    container.appendChild(wrapper);
  }

  /* ============================================================
     Hex colour helper (duplicated from globe for independence)
     ============================================================ */
  function hexToRGBA(hex, alpha) {
    let r = 0, g = 0, b = 0;
    if (hex.startsWith('#')) {
      const h = hex.slice(1);
      if (h.length === 3) {
        r = parseInt(h[0] + h[0], 16);
        g = parseInt(h[1] + h[1], 16);
        b = parseInt(h[2] + h[2], 16);
      } else {
        r = parseInt(h.slice(0, 2), 16);
        g = parseInt(h.slice(2, 4), 16);
        b = parseInt(h.slice(4, 6), 16);
      }
    }
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ============================================================
     Public API
     ============================================================ */
  return {
    drawDonut,
    drawBar,
    drawLine,
    animateCounter,
    drawMitreMatrix
  };
})();
