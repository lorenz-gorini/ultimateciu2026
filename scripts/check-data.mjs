import { readFileSync } from "node:fs";
import { validateData } from "../src/data.js";
import { DIVISIONS } from "../src/divisions.js";

for (const [id, division] of Object.entries(DIVISIONS)) {
  const data = validateData(JSON.parse(readFileSync(`public/${division.dataFile}`, "utf8")), id);
  if (process.env.REQUIRE_LIVE_DATA === "1" && data.sourceMode !== "live")
    throw new Error(`Deployment requires a fresh live import: ${division.label}`);
  console.log(`Validated ${division.label}: ${data.teams.length} teams, ${data.matches.length} fixtures (${data.sourceMode})`);
}
