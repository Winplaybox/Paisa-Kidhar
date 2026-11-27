import { useEffect, useRef } from 'react';

import { useI18n } from '@/i18n';
import { config } from '@/lib/config';

const CLIENT = 'ca-pub-2699537002342677';
let scriptReady: Promise<void> | undefined;

function loadAdSense() {
  if (!scriptReady) {
    scriptReady = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        scriptReady = undefined;
        reject(new Error('AdSense unavailable'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptReady;
}

export function WebAdSlot() {
  const { t } = useI18n();
  const slot = useRef<HTMLModElement>(null);
  const slotId = config.adsenseRegistrySlot;
  useEffect(() => {
    if (!slotId || !slot.current) return;
    const node = slot.current;
    let active = true;
    void loadAdSense().then(() => {
      if (!active || node.dataset.adRequested) return;
      node.dataset.adRequested = 'true';
      const adWindow = window as Window & { adsbygoogle?: object[] };
      (adWindow.adsbygoogle ??= []).push({});
    }).catch(() => {});
    return () => { active = false; };
  }, [slotId]);
  if (!slotId) return null;
  return <ins ref={slot} aria-label={t('cm_ad')} className="adsbygoogle" style={{ display: 'block' }}
    data-ad-client={CLIENT} data-ad-slot={slotId} data-ad-format="auto" data-full-width-responsive="true" />;
}
