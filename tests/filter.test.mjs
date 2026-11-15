import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMessage } from "../netlify/functions/lib/filter.mjs";

const ok = (message, extra = {}) => checkMessage({ name: "Sam", place: "Alford", message, ...extra });

test("accepts kind messages", () => {
  for (const m of [
    "Good luck Oli, the whole of Alford is behind you!",
    "Safe travels both of you. Can't wait to follow the ride.",
    "Hope you have the best time in Turkey 🏍️",
    "Scunthorpe is cheering you on", // place names that contain rude substrings
    "Ride hard, come home safe",
  ]) {
    assert.equal(ok(m).ok, true, m);
  }
});

test("blocks swearing, including disguised spellings", () => {
  for (const m of ["you are a fucking idiot", "f u c k this", "sh1t ride", "what a b1tch"]) {
    assert.equal(ok(m).ok, false, m);
  }
});

test("blocks harassment without swear words", () => {
  for (const m of ["kys", "hope you crash in the first week", "you will crash", "nobody cares about this"]) {
    assert.equal(ok(m).ok, false, m);
  }
});

test("blocks links and junk", () => {
  assert.equal(ok("cheap bikes at www.spam.com").ok, false);
  assert.equal(ok("visit https://x.io now").ok, false);
  assert.equal(ok("!!!!!!!!!!!!").ok, false);
  assert.equal(ok("heyyyyyyyyyyyyyy").ok, false);
});

test("checks the name field too", () => {
  assert.equal(ok("Good luck", { name: "shithead" }).ok, false);
});

test("enforces lengths", () => {
  assert.equal(ok("x".repeat(281)).ok, false);
  assert.equal(ok("hi").ok, false);
  assert.equal(checkMessage({ name: "", message: "Good luck" }).ok, false);
});
