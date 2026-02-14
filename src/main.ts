import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/intel-one-mono/latin-400.css';
import '@fontsource/intel-one-mono/latin-700.css';
import '@fontsource/patrick-hand/latin-400.css';
import * as THREE from 'three';
import './styles.css';
import { registerServiceWorker } from './pwa/register-sw';

const app = document.getElementById('app');
if (!app) {
  throw new Error('App root not found');
}

const gameSquare = document.createElement('div');
gameSquare.className = 'game-square';
app.appendChild(gameSquare);

const uiLayer = document.createElement('div');
uiLayer.className = 'ui-layer';
gameSquare.appendChild(uiLayer);

const uiTop = document.createElement('div');
uiTop.className = 'ui-top ui-panel';

const title = document.createElement('h1');
title.className = 'title';
title.textContent = 'Airship One';
uiTop.appendChild(title);

const statusRow = document.createElement('div');
statusRow.className = 'status-row';

const statusChip = document.createElement('span');
statusChip.className = 'status-chip';
statusChip.textContent = 'Bridge Console Online';
statusRow.appendChild(statusChip);

const statusBuild = document.createElement('span');
statusBuild.className = 'status-build ui-label';
statusBuild.textContent = 'inter / intel one mono / patrick hand';
statusRow.appendChild(statusBuild);

uiTop.appendChild(statusRow);
uiLayer.appendChild(uiTop);

const uiBottom = document.createElement('div');
uiBottom.className = 'ui-bottom ui-panel';

const scriptNote = document.createElement('p');
scriptNote.className = 'script-note';
scriptNote.textContent = 'captain\'s note: keep her steady through the dawn winds';
uiBottom.appendChild(scriptNote);

const actionButton = document.createElement('button');
actionButton.className = 'pixel-button';
actionButton.type = 'button';
actionButton.textContent = 'Open Bridge';
uiBottom.appendChild(actionButton);

const themeButton = document.createElement('button');
themeButton.className = 'pixel-button pixel-button-theme';
themeButton.type = 'button';
uiBottom.appendChild(themeButton);

uiLayer.appendChild(uiBottom);

const canvasWrap = document.createElement('div');
canvasWrap.className = 'canvas-wrap';
gameSquare.appendChild(canvasWrap);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(320, 320, false);
renderer.setPixelRatio(1);
canvasWrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111822);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
camera.position.set(0, 1.2, 2.5);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(3, 2, 4);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

const geometry = new THREE.BoxGeometry(0.9, 0.35, 1.6);
const material = new THREE.MeshStandardMaterial({ color: 0x7fb4ff });
const airship = new THREE.Mesh(geometry, material);
scene.add(airship);

type ThemeMode = 'system' | 'light' | 'dark';

const THEME_KEY = 'airshipone-theme';
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';
const modeCycle: ThemeMode[] = ['system', 'light', 'dark'];

const getThemeIconSvg = (mode: ThemeMode, resolvedTheme: 'light' | 'dark') => {
  if (mode === 'system') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 20h6M12 16v4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="9" cy="10" r="2.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14.8 8.2a3 3 0 1 0 0 3.6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
  }

  if (resolvedTheme === 'dark') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15.5 3.8a8.3 8.3 0 1 0 4.7 14.8A8 8 0 0 1 15.5 3.8Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  }

  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.8 5.8l2.1 2.1M16.1 16.1l2.1 2.1M18.2 5.8l-2.1 2.1M7.9 16.1l-2.1 2.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`;
};

const resolveTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'system') {
    return window.matchMedia(SYSTEM_DARK_QUERY).matches ? 'dark' : 'light';
  }
  return mode;
};

const applySceneTheme = () => {
  const surfaceAlt = getComputedStyle(document.documentElement).getPropertyValue('--surface-alt').trim();
  if (surfaceAlt) {
    scene.background = new THREE.Color(surfaceAlt);
  }
};

const getPreferredTheme = (): ThemeMode => {
  const storedTheme = window.localStorage.getItem(THEME_KEY);
  if (storedTheme === 'system' || storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }
  return 'system';
};

const setTheme = (themeMode: ThemeMode) => {
  const resolvedTheme = resolveTheme(themeMode);
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = themeMode;
  applySceneTheme();

  const label = themeMode.charAt(0).toUpperCase() + themeMode.slice(1);
  themeButton.innerHTML = `<span class="theme-icon">${getThemeIconSvg(themeMode, resolvedTheme)}</span><span>Theme: ${label}</span>`;

  if (resolvedTheme === 'dark') {
    statusChip.dataset.watch = 'night';
    statusChip.textContent = 'Bridge Console Night Watch';
    statusBuild.textContent = 'lamplight mode / victorian dark palette';
    scriptNote.textContent = 'captain\'s note: trim the lamps and hold a steady course';
    actionButton.textContent = 'Open Night Log';
  } else {
    statusChip.dataset.watch = 'day';
    statusChip.textContent = 'Bridge Console Day Watch';
    statusBuild.textContent = 'daylight mode / victorian paper palette';
    scriptNote.textContent = 'captain\'s note: mind the charts and catch the morning wind';
    actionButton.textContent = 'Open Day Log';
  }

  window.localStorage.setItem(THEME_KEY, themeMode);
};

let currentTheme: ThemeMode = getPreferredTheme();
setTheme(currentTheme);

themeButton.addEventListener('click', () => {
  const modeIndex = modeCycle.indexOf(currentTheme);
  const nextMode = modeCycle[(modeIndex + 1) % modeCycle.length] ?? 'system';
  currentTheme = nextMode;
  setTheme(currentTheme);
});

window.matchMedia(SYSTEM_DARK_QUERY).addEventListener('change', () => {
  if (currentTheme === 'system') {
    setTheme(currentTheme);
  }
});

const updatePixelScale = () => {
  const side = Math.max(1, Math.floor(Math.min(gameSquare.clientWidth, gameSquare.clientHeight)));
  const pixelScale = Math.max(1, Math.floor(side / 320));
  const rootFontPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const rowRem = side / 24 / rootFontPx;
  const textRem = Math.max(0.875, Math.min(1.5, rowRem * 0.92));
  gameSquare.style.setProperty('--u', `${pixelScale / rootFontPx}rem`);
  gameSquare.style.setProperty('--row', `${rowRem}rem`);
  gameSquare.style.setProperty('--text-size', `${textRem}rem`);
};

const resizeObserver = new ResizeObserver(() => {
  updatePixelScale();
});
resizeObserver.observe(gameSquare);
window.addEventListener('resize', updatePixelScale);
updatePixelScale();

let lastTime = performance.now();
const loop = (now: number) => {
  const delta = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  airship.rotation.y += delta * 0.6;
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

registerServiceWorker();
