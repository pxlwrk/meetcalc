// Minimal cross-browser Fullscreen API helpers. Safari (desktop/iPadOS) still
// ships the legacy webkit-prefixed names; iPhone Safari has no Fullscreen API
// for arbitrary elements at all, so every call here is best-effort.

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
  msFullscreenElement?: Element | null;
  msExitFullscreen?: () => Promise<void>;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
};

export function isFullscreenActive(): boolean {
  const doc = document as FullscreenDocument;
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
}

export function requestFullscreen(el: HTMLElement): void {
  const target = el as FullscreenElement;
  const fn = target.requestFullscreen ?? target.webkitRequestFullscreen ?? target.msRequestFullscreen;
  fn?.call(target)?.catch(() => {
    // Ignored: most commonly a browser (e.g. iPhone Safari) that doesn't
    // support the API, or a call made without sufficient user activation.
  });
}

export function exitFullscreen(): void {
  const doc = document as FullscreenDocument;
  const fn = doc.exitFullscreen ?? doc.webkitExitFullscreen ?? doc.msExitFullscreen;
  fn?.call(doc)?.catch(() => {});
}
