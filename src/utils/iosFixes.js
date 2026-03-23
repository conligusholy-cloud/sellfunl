// ─── iOS / Safari optimalizace ────────────────────────────────────────────────
// Importuj v main.jsx nebo App.jsx: import "./utils/iosFixes";

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

if (isIOS || isSafari) {

  // 1. Oprava 100vh na iOS (Safari nezahrnuje spodní lištu)
  function setVh() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  }
  setVh();
  window.addEventListener("resize", setVh);
  window.addEventListener("orientationchange", () => setTimeout(setVh, 200));

  // 2. Zamezení double-tap zoom na iOS
  let lastTouchEnd = 0;
  document.addEventListener("touchend", e => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  // 3. Oprava scroll bounce (elastic scroll) na iOS
  document.addEventListener("touchmove", e => {
    if (e.target.closest(".scroll-container, .mockup-scroll, [data-scroll]")) return;
    // Dovolí scroll jen uvnitř scrollovatelných kontejnerů
  }, { passive: true });

  // 4. Oprava input zoom na iOS (14px min font-size)
  const style = document.createElement("style");
  style.textContent = `
    /* iOS nezoomuje input pokud je font-size >= 16px */
    input, textarea, select {
      font-size: 16px !important;
    }

    /* Oprava 100vh na iOS — použij var(--vh) místo vh */
    .h-screen, [style*="100vh"] {
      height: calc(var(--vh, 1vh) * 100) !important;
    }

    /* Oprava position:fixed při klávesnici na iOS */
    .fixed-bottom {
      position: fixed;
      bottom: env(safe-area-inset-bottom, 0px);
    }

    /* Smooth scroll na iOS */
    * {
      -webkit-overflow-scrolling: touch;
    }

    /* Zamezení text selection při touch */
    .no-select {
      -webkit-user-select: none;
      user-select: none;
    }

    /* Oprava iframe scroll na iOS */
    iframe {
      -webkit-overflow-scrolling: touch;
    }

    /* Safe area padding pro notch */
    .safe-top    { padding-top:    env(safe-area-inset-top,    0px); }
    .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
    .safe-left   { padding-left:   env(safe-area-inset-left,   0px); }
    .safe-right  { padding-right:  env(safe-area-inset-right,  0px); }

    /* Oprava tap highlight */
    * { -webkit-tap-highlight-color: transparent; }

    /* Oprava button appearance na iOS */
    button, input[type="submit"], input[type="button"] {
      -webkit-appearance: none;
      appearance: none;
    }

    /* Oprava contentEditable na iOS */
    [contenteditable] {
      -webkit-user-select: text;
      user-select: text;
    }
  `;
  document.head.appendChild(style);

  // 5. Oprava position:fixed při scrollu (iOS Safari bug)
  // Přidá padding-bottom pro spodní lištu Safari
  const safeAreaBottom = parseInt(
    getComputedStyle(document.documentElement)
      .getPropertyValue("--sat") || "0"
  );

  if (safeAreaBottom > 0) {
    document.documentElement.style.setProperty(
      "--safe-area-bottom", `${safeAreaBottom}px`
    );
  }

  console.log("✅ iOS/Safari optimalizace načtena");
}

export { isIOS, isSafari };