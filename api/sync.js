const CREATOR_SHEET = "https://docs.google.com/spreadsheets/d/1Gdt-ZJP4ivhD2TrbkOn0hv358dUyXFYx/export?format=csv";
const UGC_SHEET = "https://docs.google.com/spreadsheets/d/1YSc0U9SoEK0tIpidP8l7uzWUKLVt-_RZBGaIGpd9x54/export?format=csv";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (const character of text) {
    if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if (character === "\n" && !quoted) {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

function normalizeCreators(csv) {
  return parseCsv(csv).slice(1).filter((row) => row[0]).map((row) => {
    const rawStatus = (row[5] || "Outreach").toLowerCase();
    const status = rawStatus.includes("completed") ? "Completed" : rawStatus.includes("ship") ? "Package Shipped" : rawStatus.includes("pending") ? "Content Pending" : rawStatus.includes("negotiat") ? "Negotiating" : "Outreach";
    const handle = (row[3] || "").match(/@[^?\s/]+/)?.[0] || "@profile";
    const deliverable = (row[7] || "").toLowerCase().includes("ig") ? "IG Collab Reel" : "TikTok Post";
    return {
      name: row[0],
      handle,
      followers: row[1] ? Math.round(Number(row[1]) * 1000) : 0,
      platform: (row[3] || "").toLowerCase().includes("instagram") || (row[7] || "").toLowerCase().includes("ig") ? "Instagram" : "TikTok",
      deliverable,
      status,
      rate: Number(String(row[8] || "0").replace(/[^0-9.]/g, "")) || 0,
      payment: status === "Completed" ? "Paid via Zelle" : "Pending",
      tracking: row[10] || "",
      address: row[9] || "",
      contents: row[6] || "",
      concept: row[4] || row[7] || "Creator content",
      raw: row,
    };
  });
}

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Read-only endpoint. GET only." });
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
  try {
    const [creatorResponse, ugcResponse] = await Promise.all([fetch(CREATOR_SHEET), fetch(UGC_SHEET)]);
    if (!creatorResponse.ok || !ugcResponse.ok) throw new Error("Google Sheet export unavailable");
    const [creatorCsv, ugcCsv] = await Promise.all([creatorResponse.text(), ugcResponse.text()]);
    return response.status(200).json({ syncedAt: new Date().toISOString(), creators: normalizeCreators(creatorCsv), ugc: parseCsv(ugcCsv), readOnly: true });
  } catch (error) {
    console.error("Read-only Google Sheets sync failed", error);
    return response.status(502).json({ error: "Unable to sync Google Sheets", readOnly: true });
  }
}
