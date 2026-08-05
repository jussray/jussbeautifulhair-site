import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

async function loadParser() {
  const source = await readFile(
    path.join(process.cwd(), "client", "src", "lib", "checkoutSuccess.ts"),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const encoded = Buffer.from(outputText, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("checkout success parser prefers the router search string", async () => {
  const { getCheckoutSessionId } = await loadParser();
  assert.equal(
    getCheckoutSessionId("?session_id=cs_search", "#/success?session_id=cs_hash"),
    "cs_search",
  );
});

test("checkout success parser falls back to the hash query", async () => {
  const { getCheckoutSessionId } = await loadParser();
  assert.equal(
    getCheckoutSessionId("", "#/success?session_id=cs_hash"),
    "cs_hash",
  );
});

test("checkout success parser safely handles a missing reference", async () => {
  const { getCheckoutSessionId } = await loadParser();
  assert.equal(getCheckoutSessionId("", "#/success"), undefined);
});
