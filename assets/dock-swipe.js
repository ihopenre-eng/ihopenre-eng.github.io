// 드래그 중에는 배경만 미리 보고, 손을 놓을 때 탭 전환을 확정한다.
(() => {
  const nav = document.querySelector('.dock-tabs');
  const mobile = matchMedia('(max-width: 900px)');
  const tabs = [...nav.querySelectorAll('[data-tab]')];
  const indicator = nav.querySelector('.dock-indicator');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let gesture = null;
  let suppressClickUntil = 0;
  let edgeFrame = 0;
  let edgeTime = 0;

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
    if (!nearest) return;
    gesture.pendingTab = nearest;
    tabs.forEach((tab) => tab.toggleAttribute('data-drag-preview', tab === nearest));
    indicator.hidden = false;
    indicator.style.width = nearest.offsetWidth + 'px';
    indicator.style.height = nearest.offsetHeight + 'px';
    if (reduceMotion.matches) {
      indicator.style.transform = `translate(${nearest.offsetLeft}px, ${nearest.offsetTop}px)`;
      return;
    }
    // 배경만 포인터에 붙인다. 도크 위치와 탭 순서는 바뀌지 않는다.
    const first = visible[0];
    const last = visible[visible.length - 1];
    const offset = mobile.matches ? 'offsetLeft' : 'offsetTop';
    const size = mobile.matches ? 'offsetWidth' : 'offsetHeight';
    const raw = position - (mobile.matches ? r.left : r.top) + (mobile.matches ? nav.scrollLeft : 0) - nearest[size] / 2;
    const at = Math.max(first[offset], Math.min(last[offset], raw));
    indicator.hidden = false;
    indicator.style.transform = mobile.matches ? `translate(${at}px, 0px)` : `translate(0px, ${at}px)`;
  }
  function edgeScroll(time) {
    edgeFrame = 0;
    if (!gesture?.moved || !mobile.matches) return;
    const r = nav.getBoundingClientRect();
    const x = gesture.pointerX;
    const y = gesture.pointerY;
    const edge = Math.min(48, r.width * .18);
    const clamp = (value) => Math.max(0, Math.min(1, value));
    const inside = x >= r.left - 24 && x <= r.right + 24 && y >= r.top - 20 && y <= r.bottom + 20;
    const pressure = inside ? clamp((x - r.right + edge) / edge) - clamp((r.left + edge - x) / edge) : 0;
    const elapsed = Math.min(32, Math.max(0, time - edgeTime));
    edgeTime = time;
    // 가장자리로 밀수록 빨라지며, 한 화면 분량을 약 1초에 이동한다.
    if (pressure) nav.scrollLeft += pressure * r.width * elapsed / 1000;
    activateAt(x, y);
    edgeFrame = requestAnimationFrame(edgeScroll);
  }
  function finish(event, cancelled = false) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const previous = gesture;
    gesture = null;
    cancelAnimationFrame(edgeFrame);
    edgeFrame = 0;
    nav.removeAttribute('data-scrubbing');
    tabs.forEach((tab) => tab.removeAttribute('data-drag-preview'));
    if (previous.button.hasPointerCapture(previous.id)) previous.button.releasePointerCapture(previous.id);
    if (previous.moved || previous.pointerType === 'touch') suppressClickUntil = performance.now() + 300;
    if (previous.moved) {
      if (cancelled || previous.multiTouch) {
        moveIndicator(false);
        revealTab(tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || document.getElementById('contact-trigger'), false);
      } else {
        activateTab(previous.pendingTab, true);
        tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')?.focus({ preventScroll: true });
      }
    } else if (!cancelled && !previous.multiTouch && previous.pointerType === 'touch') {
      const r = previous.button.getBoundingClientRect();
      if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) activateTab(previous.button, true);
    }
  }
  nav.addEventListener('pointerdown', (event) => {
    if (gesture && !event.isPrimary) gesture.multiTouch = true;
    if (gesture || !event.isPrimary || event.button !== 0) return;
    const button = event.target.closest('[data-tab]');
    if (!button) return;
    suppressClickUntil = 0;
    gesture = { id: event.pointerId, pointerType: event.pointerType, button, pendingTab: button, x: event.clientX, y: event.clientY, pointerX: event.clientX, pointerY: event.clientY, moved: false, multiTouch: false };
  });
  window.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    gesture.pointerX = event.clientX;
    gesture.pointerY = event.clientY;
    if (event.pointerType !== 'touch' && event.buttons === 0) { finish(event, true); return; }
    if (!gesture.moved) {
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 6) return;
      gesture.moved = true;
      nav.setAttribute('data-scrubbing', '');
      gesture.button.setPointerCapture(event.pointerId);
      if (mobile.matches) { edgeTime = performance.now(); edgeFrame = requestAnimationFrame(edgeScroll); }
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
