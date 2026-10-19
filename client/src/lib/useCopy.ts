import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Copy to the clipboard and say so for a moment.
 *
 * `navigator.clipboard` needs a secure context, which a phone on the LAN
 * hitting a plain-HTTP dev server is not, so there is a fallback through a
 * hidden textarea. Either way a failure is reported rather than silently
 * looking like it worked.
 */
export function useCopy(resetMs = 1800) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      const ok = await writeClipboard(text);
      setCopied(ok);
      setFailed(!ok);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setCopied(false);
        setFailed(false);
      }, resetMs);
      return ok;
    },
    [resetMs],
  );

  return { copied, failed, copy };
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the old way */
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
