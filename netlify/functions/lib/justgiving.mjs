// Reads the raised total and target out of a public JustGiving fundraising page.
// The page embeds its data as JSON, sometimes with escaped quotes, so both forms are matched.
export function parseJustGiving(html) {
  const num = (re) => { const m = html.match(re); return m ? Number(m[1]) : null; };
  const raised = num(/\\?"donationSummary\\?"\s*:\s*\{\s*\\?"totalAmount\\?"\s*:\s*([0-9]+(?:\.[0-9]+)?)/);
  const target = num(/\\?"targetAmount\\?"\s*:\s*([0-9]+(?:\.[0-9]+)?)/);
  if (raised === null || !Number.isFinite(raised)) return null;
  return { raised: Math.round(raised), target: target && Number.isFinite(target) ? Math.round(target) : null };
}
