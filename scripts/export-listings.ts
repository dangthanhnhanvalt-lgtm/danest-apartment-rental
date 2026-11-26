
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { SAMPLE_LISTINGS_WITH_OPS } from "../src/data/listings";

const outputDir = resolve(process.cwd(), "exports");
mkdirSync(outputDir, { recursive: true });

const outputFile = resolve(outputDir, "listings.json");

writeFileSync(
  outputFile,
  JSON.stringify(SAMPLE_LISTINGS_WITH_OPS, null, 2),
  "utf-8"
);

console.log(
  `Đã xuất ${SAMPLE_LISTINGS_WITH_OPS.length} căn hộ vào ${outputFile}`
);
