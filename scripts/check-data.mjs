import { readFileSync } from "node:fs";
import { validateData } from "../src/data.js";

const data = validateData(JSON.parse(readFileSync("public/data.json", "utf8")));
if (process.env.REQUIRE_LIVE_DATA === "1" && data.sourceMode !== "live")
  throw new Error("Deployment requires a fresh live import");
console.log(
  `Validated build data: ${data.teams.length} teams, ${data.matches.length} fixtures (${data.sourceMode})`,
);
