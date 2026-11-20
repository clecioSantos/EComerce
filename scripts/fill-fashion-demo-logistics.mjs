import "dotenv/config";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import pg from "pg";

// Test-only estimates authorized for the premium fashion demonstration catalog.
// Never use these values as measurements of actual merchandise.
const catalog = JSON.parse(
  await readFile(new URL("./catalogs/premium-fashion.json", import.meta.url), "utf8"),
);
const profiles = {
  vestidos: [0.6, 30, 6, 25],
  "alfaiataria-feminina": [1, 35, 10, 30],
  blusas: [0.3, 30, 4, 25],
  "saias-femininas": [0.5, 30, 5, 25],
  "tricos-femininos": [0.7, 30, 8, 25],
  "calcas-femininas": [0.8, 30, 7, 25],
  "camisas-masculinas": [0.4, 30, 5, 25],
  "alfaiataria-masculina": [1.2, 35, 10, 30],
  "casacos-masculinos": [1, 35, 10, 30],
};
const fields = ["weight", "width", "height", "length"];
const apply = process.argv.includes("--apply");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be configured");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
let transaction = false;

try {
  await client.connect();
  await client.query("BEGIN");
  transaction = true;
  const { rows } = await client.query(
    `
    SELECT v.id, v.sku, v.weight, v.width, v.height, v.length, v.metadata, p.slug
    FROM product_variants v JOIN products p ON p.id = v."productId"
    WHERE p."storeId" = 'legacy-store' AND p.status = 'ACTIVE' AND v."isActive" = true
      AND p.slug = ANY($1::text[]) AND p.metadata->>'demoCollection' = $2
      AND p.metadata->>'illustrative' = 'true'
    ORDER BY p.slug, v.sku FOR UPDATE OF v
  `,
    [catalog.products.map((product) => product.slug), catalog.collection],
  );
  const changes = rows.flatMap((row) => {
    const missing = fields.filter(
      (field) => row[field] == null || Number(row[field]) <= 0,
    );
    if (missing.length === 0) return [];
    const product = catalog.products.find((product) => product.slug === row.slug);
    const profile = profiles[product.category];
    if (!profile) throw new Error(`No test shipping profile for ${product.category}`);
    const values = Object.fromEntries(
      fields.map((field, index) => [
        field,
        missing.includes(field) ? profile[index] : Number(row[field]),
      ]),
    );
    return [{ row, missing, values }];
  });

  if (!apply) {
    console.log(
      JSON.stringify({
        mode: "dry-run",
        collection: catalog.collection,
        matched: rows.length,
        variantsToUpdate: changes.length,
        profiles,
        units: "kg, cm",
        preservedExistingValues: true,
      }),
    );
    await client.query("ROLLBACK");
    transaction = false;
  } else {
    // Keep a local snapshot before any writes, so the exact previous values exist.
    const backupDir = new URL("../artifacts/shipping-demo/", import.meta.url);
    await mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(":", "-");
    const backup = new URL(`before-${stamp}.json`, backupDir);
    await writeFile(
      backup,
      JSON.stringify(
        changes.map(({ row }) => row),
        null,
        2,
      ),
      { flag: "wx" },
    );
    for (const { row, missing, values } of changes) {
      const metadata = {
        ...(row.metadata ?? {}),
        shippingDemoEstimate: {
          collection: catalog.collection,
          testOnly: true,
          estimatedFields: missing,
          units: { weight: "kg", dimensions: "cm" },
          appliedAt: new Date().toISOString(),
        },
      };
      await client.query(
        `UPDATE product_variants SET weight=$2, width=$3, height=$4, length=$5, metadata=$6::jsonb, "updatedAt"=now() WHERE id=$1`,
        [
          row.id,
          values.weight,
          values.width,
          values.height,
          values.length,
          JSON.stringify(metadata),
        ],
      );
    }
    await client.query("COMMIT");
    transaction = false;
    console.log(
      JSON.stringify({
        mode: "applied",
        updated: changes.length,
        collection: catalog.collection,
        testOnly: true,
        backup: backup.pathname,
      }),
    );
  }
} catch (error) {
  if (transaction) await client.query("ROLLBACK");
  console.error("Demo logistics update failed:", error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await client.end();
}
