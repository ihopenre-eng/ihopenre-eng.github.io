// 도크와 항목 순서는 고정하고, 누른 채 훑는 탭을 즉시 선택한다.
(() => {
  const nav = document.querySelector('.dock-tabs');
  const mobile = matchMedia('(max-width: 900px)');
  const tabs = [...nav.querySelectorAll('[data-tab]')];
  let gesture = null;
  let suppressClickUntil = 0;

  // 이전에 잘못 추가한 도크 위치 기억 기능의 값만 정리한다.
  try { localStorage.removeItem('portfolio-dock-position-v1'); } catch { /* 저장소 없이도 전환할 수 있다. */ }

  function activateAt(x, y) {
    const r = nav.getBoundingClientRect();
    if (x < r.left - 16 || x > r.right + 16 || y < r.top - 16 || y > r.bottom + 16) return;
    const visible = tabs.filter((tab) => tab.offsetWidth > 0);
    const position = mobile.matches ? x : y;
    const nearest = visible.reduce((best, tab) => {
      const b = tab.getBoundingClientRect();
      const distance = Math.abs(position - (mobile.matches ? b.left + b.width / 2 : b.top + b.height / 2));
      return !best || distance < best.distance ? { tab, distance } : best;
    }, null)?.tab;
    if (nearest && nearest.getAttribute('aria-selected') !== 'true') nearest.click();
  }
  function finish(event, cancelled = false) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const previous = gesture;
    gesture = null;
    nav.removeAttribute('data-scrubbing');
    if (previous.button.hasPointerCapture(previous.id)) previous.button.releasePointerCapture(previous.id);
    if (previous.moved || previous.pointerType === 'touch') suppressClickUntil = performance.now() + 300;
    if (previous.moved) {
      if (cancelled) {
        history.replaceState(null, '', previous.hash || location.pathname + location.search);
        syncTab(false);
        window.scrollTo({ top: previous.scrollY, behavior: 'instant' });
      } else {
        tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')?.focus({ preventScroll: true });
      }
    } else if (!cancelled && !previous.multiTouch && previous.pointerType === 'touch') {
      const r = previous.button.getBoundingClientRect();
      if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) previous.button.click();
    }
  }
  nav.addEventListener('pointerdown', (event) => {
    if (gesture && !event.isPrimary) gesture.multiTouch = true;
    if (gesture || !event.isPrimary || event.button !== 0) return;
    const button = event.target.closest('[data-tab]');
    if (!button) return;
    suppressClickUntil = 0;
    gesture = { id: event.pointerId, pointerType: event.pointerType, button, x: event.clientX, y: event.clientY, hash: location.hash, scrollY, moved: false, multiTouch: false };
  });
  window.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (event.pointerType !== 'touch' && event.buttons === 0) { finish(event, true); return; }
    if (!gesture.moved) {
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 6) return;
      gesture.moved = true;
      nav.setAttribute('data-scrubbing', '');
      gesture.button.setPointerCapture(event.pointerId);
      for (const panel of document.querySelectorAll('#dock-more-panel, #contact-panel')) if (panel.matches(':popover-open')) panel.hidePopover();
    }
    activateAt(event.clientX, event.clientY);
  }, { passive: true });
  window.addEventListener('pointerup', (event) => finish(event));
  window.addEventListener('pointercancel', (event) => finish(event, true));
  nav.addEventListener('lostpointercapture', (event) => {
    if (gesture && event.target === gesture.button) finish(event, true);
  });
  nav.addEventListener('click', (event) => {
    if (event.detail > 0 && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  nav.addEventListener('dragstart', (event) => event.preventDefault());
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && gesture?.moved) { event.preventDefault(); finish({ pointerId: gesture.id }, true); }
  });
  const cancelGesture = () => { if (gesture) finish({ pointerId: gesture.id }, true); };
  window.addEventListener('blur', cancelGesture);
  window.addEventListener('resize', cancelGesture);
})();
