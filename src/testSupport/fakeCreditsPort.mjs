/**
 * @module testSupport/fakeCreditsPort
 * @description A credits port over a test viewer's fake `creditDisplay`,
 * for tests of code that adds credits through the port and checks what the
 * display was given. Credits are kept as the contract's plain data, and
 * each is shown to the fake display as Cesium-shaped markup (`html` and
 * `showOnScreen`), which is what the old display-reading tests assert on.
 */
import { bindRenderer, rendererOf } from '../render/rendererOf.js';
import {
  LINK_SCHEMES,
  LOGO_SCHEMES,
  safeUrl,
  splitLink,
} from '../render/creditMarkup.js';

const CREDIT_KEYS = new Set(['text', 'href', 'linkText', 'logoUrl', 'inline']);

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );

/** A credit's markup for a Cesium-shaped display. */
export function creditMarkup(credit) {
  const logo = credit.logoUrl && safeUrl(credit.logoUrl, LOGO_SCHEMES);
  const body = [
    logo &&
      `<img src="${escape(logo)}" alt="" style="max-height:1.5em;vertical-align:middle">`,
    credit.text && escape(credit.text),
  ]
    .filter(Boolean)
    .join(' ');
  const href = credit.href && safeUrl(credit.href, LINK_SCHEMES);
  if (href && !logo && credit.linkText) {
    const [before, words, after] = splitLink(credit);
    return `<span>${escape(before)}<a href="${escape(href)}" target="_blank" rel="noopener">${escape(words)}</a>${escape(after)}</span>`;
  }
  return href
    ? `<a href="${escape(href)}" target="_blank" rel="noopener">${body}</a>`
    : `<span>${body}</span>`;
}

function copyCredit(credit) {
  if (typeof credit?.text !== 'string')
    throw new TypeError('A credit needs its text');
  const copy = {};
  for (const [key, value] of Object.entries(credit))
    if (CREDIT_KEYS.has(key) && value !== undefined) copy[key] = value;
  return copy;
}

/**
 * @param {{creditDisplay?: object, scene?: object}} viewer
 * @returns {import('../render/contract/credits').CreditsPort}
 */
export function fakeCesiumCredits(viewer) {
  const listeners = new Set();
  const added = [];
  /** The fake display's own entries, by the markup shown. */
  const shown = new Map();

  const displayLive = () =>
    Boolean(viewer.creditDisplay) && !viewer.creditDisplay.isDestroyed?.();

  const list = () => added.map((entry) => ({ ...entry.credit }));

  const changed = () => {
    const credits = list();
    for (const listener of [...listeners]) listener(credits);
  };

  const show = (markup, inline) => {
    const key = `${inline ? 'inline' : 'listed'}:${markup}`;
    let entry = shown.get(key);
    if (!entry) {
      entry = {
        credit: {
          html: markup,
          showOnScreen: inline,
          id: key,
          isIon: () => false,
        },
        count: 0,
      };
      shown.set(key, entry);
      displayLive() && viewer.creditDisplay.addStaticCredit(entry.credit);
    }
    entry.count += 1;
    return key;
  };

  const hide = (key) => {
    const entry = shown.get(key);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count > 0) return;
    shown.delete(key);
    displayLive() && viewer.creditDisplay.removeStaticCredit(entry.credit);
  };

  return {
    addStatic(credit) {
      const entry = { credit: copyCredit(credit), key: null };
      added.push(entry);
      entry.key = show(
        creditMarkup(entry.credit),
        Boolean(entry.credit.inline),
      );
      viewer.scene?.requestRender?.();
      changed();
      return () => {
        const i = added.indexOf(entry);
        if (i < 0) return;
        added.splice(i, 1);
        if (entry.key !== null) hide(entry.key);
        viewer.scene?.requestRender?.();
        changed();
      };
    },
    list,
    on(event, cb) {
      if (event !== 'change') return () => {};
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/**
 * Bind a renderer with just that port to `viewer`; a viewer already bound
 * keeps its renderer. Returns the viewer.
 * @template V
 * @param {V} viewer
 * @returns {V}
 */
export function bindFakeCesiumCredits(viewer) {
  if (!rendererOf(viewer))
    bindRenderer(viewer, { credits: fakeCesiumCredits(viewer) });
  return viewer;
}
