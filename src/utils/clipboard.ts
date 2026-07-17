/**
 * Copy text to the clipboard, working in both secure (https/localhost) and
 * non-secure (http LAN, e.g. accessing the dev server from a phone) contexts.
 *
 * `navigator.clipboard` is only available in secure contexts, so we fall back
 * to a hidden <textarea> + document.execCommand('copy') when it's missing.
 *
 * @returns true if the copy succeeded, false otherwise.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    // Keep it out of the viewport and unfocusable visually, but still selectable.
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
