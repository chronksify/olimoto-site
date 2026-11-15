import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJustGiving } from "../netlify/functions/lib/justgiving.mjs";

test("reads the total and target from escaped page data", () => {
  const html = String.raw`...\"targetAmount\":20000,...\"donationSummary\":{\"totalAmount\":3040,\"aggregatedDonationsCount\":3}...`;
  assert.deepEqual(parseJustGiving(html), { raised: 3040, target: 20000 });
});

test("reads plain JSON too, and rounds pence", () => {
  assert.deepEqual(parseJustGiving('{"donationSummary":{"totalAmount":3512.5},"targetAmount":20000}'), { raised: 3513, target: 20000 });
});

test("gives up cleanly when the page changes", () => {
  assert.equal(parseJustGiving("<html>no data here</html>"), null);
});
