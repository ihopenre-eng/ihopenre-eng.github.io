// 읽을 때는 숨기고, 위로 스크롤하거나 탐색할 때는 다시 보여 준다.
(() => {
  const dock = document.getElementById('site-navigation');
  const nav = dock.querySelector('.dock-tabs');
  const popovers = [...document.querySelectorAll('#dock-more-panel[popover]')];
  let lastY = Math.max(0, scrollY);
  let travel = 0;
  let frame = 0;
  let pointerBusy = false;
  let lastWidth = innerWidth;
  const enableMotion = () => requestAnimationFrame(() => requestAnimationFrame(() => dock.setAttribute('data-motion-ready', '')));
  enableMotion();

  function reveal(keyboard = false) {
    dock.toggleAttribute('data-keyboard-reveal', keyboard);
    dock.removeAttribute('data-scroll-hidden');
    dock.inert = false;
    travel = 0;
    lastY = Math.max(0, scrollY);
  }
  function update() {
    frame = 0;
    // iOS의 상·하단 오버스크롤을 방향 전환으로 처리하지 않는다.
    const maxY = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const y = Math.max(0, Math.min(maxY, scrollY));
    const delta = y - lastY;
    lastY = y;
    const keyboardFocus = dock.contains(document.activeElement) && !dock.hasAttribute('data-pointer-input');
    if (y <= 24 || pointerBusy || nav.hasAttribute('data-scrubbing') || popovers.some((panel) => panel.matches(':popover-open')) || keyboardFocus) {
      reveal(keyboardFocus);
      return;
    }
    if (Math.abs(delta) < 1) return;
    travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
    dock.removeAttribute('data-keyboard-reveal');
    if (travel < -8) reveal();
    else if (y > 64 && travel > 12) {
      dock.setAttribute('data-scroll-hidden', '');
      dock.inert = true;
    }
  }
  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });
  // 숨겨진 컨트롤도 Tab으로 접근할 수 있도록 기본 포커스 이동 전에 복원한다.
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' || dock.contains(document.activeElement)) reveal(true);
  }, true);
  dock.addEventListener('focusin', () => reveal(!dock.hasAttribute('data-pointer-input')));
  dock.addEventListener('pointerdown', () => { pointerBusy = true; reveal(); });
  const release = () => { pointerBusy = false; lastY = Math.max(0, scrollY); travel = 0; };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);
  popovers.forEach((panel) => panel.addEventListener('beforetoggle', (event) => {
    if (event.newState === 'open') reveal();
  }));
  window.addEventListener('hashchange', () => reveal());
  window.addEventListener('resize', () => {
    // 모바일 주소창 높이 변화에는 반응하지 않고 실제 가로 크기 변경에만 복원한다.
    if (innerWidth !== lastWidth) {
      lastWidth = innerWidth;
      dock.removeAttribute('data-motion-ready');
      reveal();
      enableMotion();
    }
  });
})();
