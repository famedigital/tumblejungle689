"use client";

import { useEffect, useRef } from "react";

const LETTERS = ["h", "l", "s", "n"] as const;
export type AltLetter = (typeof LETTERS)[number];

const alt = { held: false, fired: false, until: 0 };

/** Glyphs Windows and macOS type for these chords when altKey never arrives. */
const GLYPHS: Record<AltLetter, readonly string[]> = {
  h: ["ħ"],
  l: ["¬", "ﬂ", "Ò", "ł"],
  s: ["ß", "∫", "Í"],
  n: ["ñ", "ń", "ŉ"],
};

const CODE: Record<AltLetter, string> = { h: "KeyH", l: "KeyL", s: "KeyS", n: "KeyN" };

function isAltKey(event: KeyboardEvent): boolean {
  return event.key === "Alt" || event.code === "AltLeft" || event.code === "AltRight" || event.key === "AltGraph";
}

function glyphLetter(key: string): AltLetter | null {
  for (const letter of LETTERS) {
    if (GLYPHS[letter].includes(key)) return letter;
  }
  return null;
}

function letterOf(event: KeyboardEvent): AltLetter | null {
  const fromGlyph = glyphLetter(event.key);
  if (fromGlyph) return fromGlyph;
  for (const letter of LETTERS) {
    if (event.code === CODE[letter]) return letter;
    if (event.key.length === 1 && event.key.toLowerCase() === letter) return letter;
  }
  return null;
}

function altDown(event: KeyboardEvent): boolean {
  return (
    event.altKey ||
    alt.held ||
    performance.now() < alt.until ||
    Boolean(event.getModifierState?.("Alt") || event.getModifierState?.("AltGraph"))
  );
}

/**
 * One Alt/Option chord. Windows often delivers the letter on keyup, after Alt
 * is already up, or as a glyph with altKey false. Call from keydown and keyup.
 */
export function takeAlt(event: KeyboardEvent): AltLetter | null {
  if (event.repeat || event.metaKey) return null;
  if (event.isComposing && !(event.altKey && letterOf(event))) return null;
  if (event.ctrlKey && !altDown(event)) return null;

  if (isAltKey(event)) {
    event.preventDefault();
    if (event.type === "keydown") {
      alt.held = true;
      alt.fired = false;
      alt.until = 0;
    } else if (!alt.fired) {
      alt.until = performance.now() + 400;
      alt.held = false;
    } else {
      alt.held = false;
    }
    return null;
  }

  const letter = letterOf(event);
  if (!letter) return null;
  const remapped = event.key.length === 1 && event.key.toLowerCase() !== letter && event.code === CODE[letter];
  if (!altDown(event) && !glyphLetter(event.key) && !remapped) return null;
  if (alt.fired) return null;
  alt.fired = true;
  alt.until = 0;
  event.preventDefault();
  return letter;
}

/** Mac and some Windows layouts insert the glyph into the focused field instead of a chord. */
export function takeAltText(data: string): AltLetter | null {
  if (alt.fired) return null;
  for (const letter of LETTERS) {
    if (GLYPHS[letter].some((glyph) => data.includes(glyph))) {
      alt.fired = true;
      return letter;
    }
  }
  return null;
}

export function useTillHotkeys(onLetter: (letter: AltLetter) => void) {
  const handler = useRef(onLetter);
  handler.current = onLetter;
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const letter = takeAlt(event);
      if (letter) handler.current(letter);
    }
    function onBefore(event: InputEvent) {
      const letter = takeAltText(event.data ?? "");
      if (!letter) return;
      event.preventDefault();
      handler.current(letter);
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("beforeinput", onBefore, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("beforeinput", onBefore, true);
    };
  }, []);
}

export function submitOpenTender() {
  const form = document.querySelector("[data-till-tender]");
  if (!(form instanceof HTMLFormElement)) return;
  const button = form.querySelector('button[type="submit"]');
  if (button instanceof HTMLButtonElement && button.disabled) return;
  form.requestSubmit();
}
