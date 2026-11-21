export type InstallPlatform = 'ios' | 'android' | 'windows' | 'desktop';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface InstallGuideContent {
  title: string;
  subtitle: string;
  steps: string[];
  note?: string;
}

export function detectInstallPlatform(
  userAgent?: string,
  maxTouchPoints?: number
): InstallPlatform {
  const ua = (
    userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  ).toLowerCase();
  const touchPoints =
    maxTouchPoints ??
    (typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0);

  // iPhone, iPad, iPod, and modern iPadOS reporting as Macintosh with multi-touch
  if (/iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && touchPoints > 1)) {
    return 'ios';
  }
  if (/android/.test(ua)) {
    return 'android';
  }
  if (/windows nt|win32|win64/.test(ua)) {
    return 'windows';
  }
  return 'desktop';
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const matchStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(matchStandalone || iosStandalone);
}

export function getInstallGuideContent(
  platform: InstallPlatform,
  isVi: boolean
): InstallGuideContent {
  if (platform === 'ios') {
    return isVi
      ? {
          title: 'Thêm TripMate vào Màn hình chính (iPhone / iPad)',
          subtitle: 'Mở nhanh như ứng dụng gốc trên iOS không cần tải qua App Store.',
          steps: [
            'Mở trang TripMate bằng trình duyệt Safari trên iPhone / iPad.',
            'Nhấn vào nút Chia sẻ (Share — biểu tượng ô vuông có mũi tên hướng lên) trên thanh công cụ.',
            'Cuộn xuống và chọn "Thêm vào Màn hình chính" (Add to Home Screen).',
            'Nhấn "Thêm" (Add) ở góc trên bên phải để ghim biểu tượng TripMate ra màn hình.',
          ],
          note: 'Nếu đang mở bằng liên kết trong Zalo/Facebook hoặc Chrome, hãy chọn "Mở bằng Safari" trước.',
        }
      : {
          title: 'Add TripMate to Home Screen (iPhone / iPad)',
          subtitle: 'Launch TripMate like a native iOS app directly from your Home Screen.',
          steps: [
            'Open TripMate in Safari on your iPhone or iPad.',
            'Tap the Share button (square with an upward arrow) in the Safari toolbar.',
            'Scroll down and tap "Add to Home Screen".',
            'Tap "Add" in the top-right corner to finish.',
          ],
          note: 'If opened inside an in-app browser, open the URL in Safari first.',
        };
  }

  if (platform === 'android') {
    return isVi
      ? {
          title: 'Thêm TripMate vào Màn hình chính (Android)',
          subtitle: 'Cài đặt nhanh trên Chrome, Edge hoặc Samsung Internet.',
          steps: [
            'Mở TripMate bằng trình duyệt Google Chrome hoặc Microsoft Edge.',
            'Nhấn biểu tượng Menu (3 chấm dọc ⋮) ở góc trên bên phải trình duyệt.',
            'Chọn "Cài đặt ứng dụng" (Install app) hoặc "Thêm vào Màn hình chính" (Add to Home screen).',
            'Nhấn "Cài đặt / Thêm" để tạo biểu tượng TripMate trên màn hình điện thoại.',
          ],
        }
      : {
          title: 'Add TripMate to Home Screen (Android)',
          subtitle: 'Quick install via Chrome, Edge, or Samsung Internet.',
          steps: [
            'Open TripMate in Google Chrome or Microsoft Edge.',
            'Tap the Menu icon (⋮) in the top-right corner.',
            'Tap "Install app" or "Add to Home screen".',
            'Confirm "Install / Add" to pin TripMate to your home screen.',
          ],
        };
  }

  // Windows Laptop / Desktop
  return isVi
    ? {
        title:
          platform === 'windows'
            ? 'Cài TripMate lên Laptop Windows'
            : 'Cài TripMate lên Máy tính / Desktop',
        subtitle: 'Chạy ở cửa sổ riêng và ghim trực tiếp lên Desktop / Taskbar.',
        steps: [
          'Mở TripMate trên trình duyệt Google Chrome hoặc Microsoft Edge.',
          'Nhìn ở góc phải thanh địa chỉ URL, nhấn vào biểu tượng "Cài đặt TripMate" (màn hình có mũi tên xuống / dấu +).',
          'Hoặc mở Menu (⋮ / ⋯) → Lưu và chia sẻ / Ứng dụng → "Cài đặt TripMate".',
          'Nhấn "Cài đặt" (Install) để thêm lối tắt ra Desktop và Taskbar.',
        ],
      }
    : {
        title:
          platform === 'windows'
            ? 'Install TripMate on Windows Laptop'
            : 'Install TripMate on Desktop',
        subtitle: 'Open in a standalone window and pin to your Desktop or Taskbar.',
        steps: [
          'Open TripMate in Google Chrome or Microsoft Edge.',
          'Click the "Install TripMate" icon on the right side of the URL address bar.',
          'Or open browser Menu (⋮ / ⋯) → Save and share / Apps → "Install TripMate".',
          'Click "Install" to pin the shortcut to your Desktop and Taskbar.',
        ],
      };
}

// Global singleton store so `beforeinstallprompt` fired on initial page load is captured even before Account Info opens
let capturedPrompt: BeforeInstallPromptEvent | null = null;
let capturedInstalled = false;
let initialized = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

export function initPwaInstallCapture() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  capturedInstalled = isStandaloneMode();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    capturedPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    capturedInstalled = true;
    capturedPrompt = null;
    notifyListeners();
  });
}

export function getPwaInstallSnapshot() {
  return {
    deferredPrompt: capturedPrompt,
    isInstalled: capturedInstalled || isStandaloneMode(),
  };
}

export function subscribePwaInstall(cb: () => void) {
  initPwaInstallCapture();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export async function triggerNativePwaInstall(): Promise<boolean> {
  if (!capturedPrompt) return false;
  try {
    await capturedPrompt.prompt();
    const { outcome } = await capturedPrompt.userChoice;
    if (outcome === 'accepted') {
      capturedInstalled = true;
      capturedPrompt = null;
      notifyListeners();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export type DeviceInstallResult = 'installed' | 'dismissed' | 'shared' | 'unavailable';

export async function triggerDeviceInstall(platform: InstallPlatform): Promise<DeviceInstallResult> {
  if (capturedPrompt) {
    try {
      await capturedPrompt.prompt();
      const { outcome } = await capturedPrompt.userChoice;
      if (outcome === 'accepted') {
        capturedInstalled = true;
        capturedPrompt = null;
        notifyListeners();
        return 'installed';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  }

  // On iOS Safari (no beforeinstallprompt), invoke the native iOS Share Sheet directly if available
  if (
    platform === 'ios' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof window !== 'undefined'
  ) {
    try {
      await navigator.share({
        title: 'TripMate',
        url: window.location.href,
      });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return 'dismissed';
      }
      return 'unavailable';
    }
  }

  return 'unavailable';
}
