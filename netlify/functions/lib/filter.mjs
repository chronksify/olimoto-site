// Checks a supporter message before it is stored.
// Layer 1 (here): block swearing, slurs, threats, links and junk automatically.
// Layer 2 (moderate.mjs): nothing goes public until Joe approves it.
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

// Harassment the word list misses because no single word is rude.
const HARMFUL = [
  /\bkys\b/i,
  /\bkill\s*(your|ur|yo)\s*sel(f|ves)\b/i,
  /\bhope\s+(you|u|ya|he|they|oli|joe|both)\b.{0,20}\b(crash|crashes|die|dies|dead|hurt|killed)\b/i,
  /\b(you|u)\s+(will|gonna|are going to)\s+(crash|die)\b/i,
  /\bnobody\s+cares\b/i,
];

// Links are the main spam route, so the wall accepts none.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|net|org|co|uk|io|ru|xyz|info|biz|top|site|online|link|click)\b)/i;

export const LIMITS = { name: 40, place: 40, message: 280, minMessage: 3 };

function tidy(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁤﻿]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "f u c k" or "s.h.i.t": join runs of single letters so the word list sees them.
const squash = (text) => text.replace(/(?<=\b\p{L})[\s._*-]+(?=\p{L}\b)/gu, "");

function isNasty(text) {
  return [text, squash(text)].some((t) => matcher.hasMatch(t) || HARMFUL.some((re) => re.test(t)));
}

/**
 * @returns {{ok: true, clean: {name: string, place: string, message: string}} | {ok: false, field: string, error: string}}
 */
export function checkMessage(input) {
  const clean = {
    name: tidy(input?.name),
    place: tidy(input?.place),
    message: tidy(input?.message),
  };

  if (!clean.name) return { ok: false, field: "name", error: "Add your name so Oli and Joe know who it's from." };
  if (clean.name.length > LIMITS.name) return { ok: false, field: "name", error: `Keep your name under ${LIMITS.name} characters.` };
  if (clean.place.length > LIMITS.place) return { ok: false, field: "place", error: `Keep the place under ${LIMITS.place} characters.` };
  if (clean.message.length < LIMITS.minMessage) return { ok: false, field: "message", error: "Write a message first." };
  if (clean.message.length > LIMITS.message) return { ok: false, field: "message", error: `Messages can be up to ${LIMITS.message} characters.` };

  for (const field of ["name", "place", "message"]) {
    if (LINK.test(clean[field])) return { ok: false, field, error: "Messages can't include links or web addresses." };
  }
  for (const field of ["name", "place", "message"]) {
    if (isNasty(clean[field])) return { ok: false, field, error: "That message can't go on the wall. Please keep it kind." };
  }
  // Same character repeated 8+ times, or no letters at all, is almost always junk.
  if (/(.)\1{7,}/u.test(clean.message) || !/\p{L}/u.test(clean.message)) {
    return { ok: false, field: "message", error: "That doesn't look like a message. Try writing it again." };
  }
  return { ok: true, clean };
}
