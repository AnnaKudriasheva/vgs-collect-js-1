import { trackEvent } from './trackEvent';
import { getConfig } from './config';
import {
  SESSION_ID,
  MAIN_SCRIPT_DOMAIN,
  BACKUP_SCRIPT_DOMAIN,
  ANALYTICS_EVENTS,
  ERROR_MESSAGE,
} from '../constants';
import { appendElement } from './appendElement';
import { isVersionGreater } from './parseVersion';

let scriptURL = MAIN_SCRIPT_DOMAIN;

const scriptExists = () => {
  try {
    const scripts = document.querySelectorAll<HTMLScriptElement>(
      `script[src^="${scriptURL}/vgs-collect/"]`
    );
    return scripts.length > 0;
  } catch (e) {
    return false;
  }
};

const appendScript = (): HTMLScriptElement => {
  const { vaultId, environment, version, integrity, crossorigin } = getConfig();
  const script = document.createElement('script');

  script.src = `${scriptURL}/vgs-collect/${version}/vgs-collect.js?sessionId=${SESSION_ID}&tenantId=${vaultId}&env=${environment}`;

  if (integrity) {
    script.integrity = integrity;
  }

  if (typeof crossorigin === 'string') {
    script.crossOrigin = crossorigin;
  }

  appendElement(script);

  return script;
};

const loadScript = (loadMainCDN: boolean = true) => {
  const collectPromise = new Promise((resolve, reject) => {
    const { version } = getConfig();

    if (scriptExists() && window.VGSCollect) {
      resolve(window.VGSCollect);
    }

    // Fastly fallback CDN is available starting Collect.js version 2.3.0
    if (!loadMainCDN && isVersionGreater(version, '2.3.0')) {
      scriptURL = BACKUP_SCRIPT_DOMAIN;
    }

    if (!window.VGSCollect) {
      const script = appendScript();
      if (script) {
        script.onload = () => {
          if (!window.VGSCollect) {
            trackEvent({
              type: ANALYTICS_EVENTS.INSTANCE_UNDEFINED,
              status: 'OK',
              mainCDN: loadMainCDN,
            });
            reject(ERROR_MESSAGE.IS_UNDEFINED('VGS Collect'));
          }
          trackEvent({
            type: ANALYTICS_EVENTS.SCRIPT_LOAD,
            status: 'OK',
            mainCDN: loadMainCDN,
          });
          resolve(window.VGSCollect);
        };

        script.onerror = () => {
          trackEvent({
            type: ANALYTICS_EVENTS.SCRIPT_LOAD,
            status: 'Failed',
            mainCDN: loadMainCDN,
          });
          if (loadMainCDN) {
            // Load script from backup CDN
            resolve(loadScript(false));
          } else {
            reject(ERROR_MESSAGE.SCRIPT_WAS_NOT_LOADED);
          }
        };
      }
    }
  });
  return collectPromise;
};

export { loadScript, appendScript, scriptExists };
