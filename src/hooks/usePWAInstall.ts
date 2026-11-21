import { useEffect, useState } from 'react';
import {
  detectInstallPlatform,
  getPwaInstallSnapshot,
  initPwaInstallCapture,
  subscribePwaInstall,
  triggerNativePwaInstall,
  type InstallPlatform,
} from '../utils/pwaInstallUtils';

export function usePWAInstall() {
  const [snapshot, setSnapshot] = useState(() => {
    initPwaInstallCapture();
    return getPwaInstallSnapshot();
  });
  const [platform] = useState<InstallPlatform>(() => detectInstallPlatform());

  useEffect(() => {
    setSnapshot(getPwaInstallSnapshot());
    const unsub = subscribePwaInstall(() => {
      setSnapshot(getPwaInstallSnapshot());
    });
    return unsub;
  }, []);

  return {
    isInstallable: Boolean(snapshot.deferredPrompt),
    isInstalled: snapshot.isInstalled,
    platform,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isWindows: platform === 'windows',
    install: triggerNativePwaInstall,
  };
}
