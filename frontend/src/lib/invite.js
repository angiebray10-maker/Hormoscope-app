// Partner invite sharing helpers (v46, Angelita, Oct 26, 2026).
//
// APP_INSTALL_LINK is the ONE place the app install link lives, so it
// can be swapped for the public Play listing link at launch. Today it
// is the internal testing link.
export const APP_INSTALL_LINK = 'https://play.google.com/apps/internaltest/4701064432006721163';

// The read-only partner view lives on the backend (it is a web page,
// not an app screen), so its URL is built from the backend origin.
export function partnerViewUrl(token) {
  const base = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');
  return `${base}/partner/view/${token}`;
}

// Share text through the native share sheet where the platform offers
// one (in the Android shell, navigator.share is backed by Capacitor's
// share bridge), falling back to copying the text to the clipboard.
// Resolves to 'shared', 'copied', or 'failed' so the UI can confirm
// what actually happened.
export async function shareInviteText(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (err) {
      // A dismissed share sheet is not an error to report; anything
      // else falls through to the clipboard.
      if (err && err.name === 'AbortError') return 'shared';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (err) {
    return 'failed';
  }
}

export function syncInviteMessage(code, firstName) {
  const from = firstName ? ` from ${firstName}` : '';
  return `Hi, I would love for you to join me on HORMOscope${from}, so we can follow my cycle together. Get the app here: ${APP_INSTALL_LINK} Then open the Attunement tab and enter my code: ${code}`;
}

export function viewInviteMessage(url, firstName) {
  const from = firstName ? ` from ${firstName}` : '';
  return `Hi, I am sharing my HORMOscope cycle with you${from}. This link shows you the parts of my cycle I chose to share: ${url}`;
}
