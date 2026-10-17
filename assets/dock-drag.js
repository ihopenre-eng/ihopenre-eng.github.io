// 드래그와 클릭을 구분하고, 화면 크기별 도크 위치를 브라우저에만 저장한다.
(() => {
  const dock = document.getElementById('site-navigation');
  const more = document.getElementById('dock-more-panel');
  const contact = document.getElementById('contact-panel');
  const status = document.getElementById('dock-position-status');
  const mobile = matchMedia('(max-width: 900px)');
  const storageKey = 'portfolio-dock-position-v1';
  let positions = {};
  let drag = null;
  let suppressClickUntil = 0;
  let resizeFrame = 0;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    for (const key of ['desktop', 'mobile']) {
      const p = saved?.[key];
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) positions[key] = p;
    }
  } catch { /* 저장소가 차단돼도 도크 이동은 동작한다. */ }

  const mode = () => mobile.matches ? 'mobile' : 'desktop';
  const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));
  function viewport() {
    const v = window.visualViewport;
    const css = getComputedStyle(dock);
    const safe = (side) => Math.max(12, parseFloat(css.getPropertyValue('--dock-safe-' + side)) || 0);
    const x = v?.offsetLeft || 0;
    const y = v?.offsetTop || 0;
    return { left: x + safe('left'), top: y + safe('top'), right: x + (v?.width || innerWidth) - safe('right'), bottom: y + (v?.height || innerHeight) - safe('bottom') };
  }
  function bounds() {
    const v = viewport();
    return { ...v, maxX: Math.max(v.left, v.right - dock.offsetWidth), maxY: Math.max(v.top, v.bottom - dock.offsetHeight) };
  }
  function placeDock(x, y, limits = bounds()) {
    const p = { x: clamp(x, limits.left, limits.maxX), y: clamp(y, limits.top, limits.maxY) };
    dock.setAttribute('data-positioned', '');
    dock.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    return p;
  }
  function rememberPosition() {
    const b = bounds();
    const r = dock.getBoundingClientRect();
    positions[mode()] = { x: clamp((r.left - b.left) / (b.maxX - b.left || 1), 0, 1), y: clamp((r.top - b.top) / (b.maxY - b.top || 1), 0, 1) };
    try { localStorage.setItem(storageKey, JSON.stringify(positions)); } catch { /* 메모리 위치는 유지한다. */ }
  }
  function closePanels() {
    for (const panel of [more, contact]) if (panel.matches(':popover-open')) panel.hidePopover();
  }
  function positionPanel(panel) {
    if (!panel.matches(':popover-open')) return;
    const trigger = document.querySelector(`[popovertarget="${panel.id}"]`);
    const a = trigger.getBoundingClientRect();
    const d = dock.getBoundingClientRect();
    const v = viewport();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    let x, y, origin;
    if (!mobile.matches && d.right + 12 + w <= v.right) {
      x = d.right + 12; y = a.bottom - h; origin = 'bottom left';
    } else if (!mobile.matches && d.left - 12 - w >= v.left) {
      x = d.left - 12 - w; y = a.bottom - h; origin = 'bottom right';
    } else {
      x = a.left + a.width / 2 - w / 2;
      const above = d.top - h - 12;
      const below = d.bottom + 12;
      y = above >= v.top ? above : below + h <= v.bottom ? below : above;
      origin = y < d.top ? 'bottom center' : 'top center';
    }
    panel.style.inset = 'auto';
    panel.style.left = clamp(x, v.left, v.right - w) + 'px';
    panel.style.top = clamp(y, v.top, v.bottom - h) + 'px';
    panel.style.transformOrigin = origin;
  }
  function positionTips() {
    const v = viewport();
    const d = dock.getBoundingClientRect();
    for (const tip of dock.querySelectorAll('.dock-tab-label, .dock-tip')) {
      const button = tip.parentElement;
      if (!button.offsetWidth) continue;
      const r = button.getBoundingClientRect();
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let x, y;
      if (mobile.matches) {
        x = r.left + r.width / 2 - w / 2;
        y = d.top - h - 16 >= v.top ? d.top - h - 16 : d.bottom + 16;
      } else {
        x = d.right + 16 + w <= v.right ? d.right + 16 : d.left - 16 - w;
        y = r.top + (r.height - h) / 2;
      }
      tip.style.inset = 'auto';
      tip.style.left = clamp(x, v.left, v.right - w) - r.left + 'px';
      tip.style.top = clamp(y, v.top, v.bottom - h) - r.top + 'px';
      tip.style.transform = 'none';
    }
  }
  function restorePosition() {
    const p = positions[mode()];
    if (p) {
      const b = bounds();
      placeDock(b.left + p.x * (b.maxX - b.left), b.top + p.y * (b.maxY - b.top), b);
    } else {
      dock.removeAttribute('data-positioned');
      dock.style.removeProperty('transform');
    }
    positionTips();
    positionPanel(more);
    positionPanel(contact);
  }
  function finishDrag(event, cancelled = false) {
    if (!drag || event.pointerId !== drag.id) return;
    const previous = drag;
    drag = null;
    dock.removeAttribute('data-dragging');
    if (previous.captureTarget.hasPointerCapture(previous.id)) previous.captureTarget.releasePointerCapture(previous.id);
    if (!previous.moved) {
      // 커스텀 드래그 후 합성 클릭이 생략되거나 늦게 오는 브라우저에서도
      // 짧은 터치 탭을 한 번만 활성화한다. 마우스·키보드는 기본 클릭을 쓴다.
      if (previous.pointerType === 'touch') suppressClickUntil = performance.now() + 300;
      if (!cancelled && !previous.multiTouch && previous.pointerType === 'touch' && previous.captureTarget instanceof HTMLButtonElement) {
        const r = previous.captureTarget.getBoundingClientRect();
        if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) {
          previous.captureTarget.click();
        }
      }
      return;
    }
    suppressClickUntil = performance.now() + 300;
    if (cancelled) placeDock(previous.left, previous.top);
    else { rememberPosition(); status.textContent = '도크 위치를 변경했습니다.'; }
    positionTips();
  }
  dock.addEventListener('pointerdown', (event) => {
    if (drag && event.pointerType === 'touch' && !event.isPrimary) drag.multiTouch = true;
    if (drag || !event.isPrimary || event.button !== 0) return;
    suppressClickUntil = 0;
    const r = dock.getBoundingClientRect();
    drag = { id: event.pointerId, pointerType: event.pointerType, captureTarget: event.target.closest('button') || dock, x: event.clientX, y: event.clientY, left: r.left, top: r.top, limits: bounds(), moved: false, multiTouch: false };
  });
  window.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (event.pointerType !== 'touch' && event.buttons === 0) { finishDrag(event, true); return; }
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < (event.pointerType === 'touch' ? 8 : 6)) return;
      drag.moved = true;
      closePanels();
      dock.setAttribute('data-dragging', '');
      drag.captureTarget.setPointerCapture(event.pointerId);
    }
    placeDock(drag.left + dx, drag.top + dy, drag.limits);
  }, { passive: true });
  window.addEventListener('pointerup', (event) => finishDrag(event));
  window.addEventListener('pointercancel', (event) => finishDrag(event, true));
  window.addEventListener('blur', () => { if (drag) finishDrag({ pointerId: drag.id }, true); });
  dock.addEventListener('lostpointercapture', (event) => {
    // 시작 버튼의 캡처를 유지해 터치의 암시적 캡처 전환을 피한다.
    if (drag && event.target === drag.captureTarget) finishDrag(event, true);
  });
  dock.addEventListener('click', (event) => {
    if (event.detail > 0 && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  dock.addEventListener('dragstart', (event) => event.preventDefault());
  dock.addEventListener('keydown', (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closePanels();
    if (event.key === 'Home') {
      delete positions[mode()];
      try { localStorage.setItem(storageKey, JSON.stringify(positions)); } catch { /* 기본 위치 복원은 저장소 없이도 가능하다. */ }
      restorePosition();
      status.textContent = '도크를 기본 위치로 되돌렸습니다.';
    } else {
      const step = event.shiftKey ? 40 : 16;
      const r = dock.getBoundingClientRect();
      placeDock(r.left + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), r.top + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0));
      rememberPosition();
      positionTips();
      status.textContent = '도크 위치를 변경했습니다.';
    }
  }, true);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drag?.moved) { event.preventDefault(); finishDrag({ pointerId: drag.id }, true); }
  });
  for (const panel of [more, contact]) {
    panel.addEventListener('beforetoggle', (event) => {
      if (event.newState === 'open') queueMicrotask(() => positionPanel(panel));
    });
    panel.addEventListener('toggle', () => positionPanel(panel));
  }
  function scheduleRestore() {
    if (drag) finishDrag({ pointerId: drag.id }, true);
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(restorePosition);
  }
  window.addEventListener('resize', scheduleRestore);
  window.visualViewport?.addEventListener('resize', scheduleRestore);
  window.visualViewport?.addEventListener('scroll', scheduleRestore);
  new ResizeObserver(scheduleRestore).observe(dock);
  restorePosition();
})();
