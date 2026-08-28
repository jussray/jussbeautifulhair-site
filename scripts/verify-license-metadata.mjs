import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const [packageText, lockText, license, notices, audit] = await Promise.all([
  read("package.json"),
  read("package-lock.json"),
  read("LICENSE"),
  read("THIRD_PARTY_NOTICES.md"),
  read("docs/legal/LICENSE_AUDIT_2026.md"),
]);

const packageJson = JSON.parse(packageText);
const packageLock = JSON.parse(lockText);
const rootLockPackage = packageLock.packages?.[""];

assert.equal(packageJson.private, true, "package.json must prevent accidental publication");
assert.equal(packageJson.license, "UNLICENSED", "package.json first-party license must be UNLICENSED");
assert.equal(rootLockPackage?.license, "UNLICENSED", "root lockfile package license must match package.json");
assert.deepEqual(
  rootLockPackage?.dependencies ?? {},
  packageJson.dependencies ?? {},
  "runtime dependency declarations must match between package.json and package-lock.json",
);
assert.deepEqual(
  rootLockPackage?.devDependencies ?? {},
  packageJson.devDependencies ?? {},
  "development dependency declarations must match between package.json and package-lock.json",
);

assert.match(license, /First-party materials/i);
assert.match(license, /Hosted storefront use/i);
assert.match(license, /Third-party components/i);
assert.doesNotMatch(license, /all associated files.*exclusive proprietary property/is);
assert.doesNotMatch(license, /all required third-party notices.*are preserved/is);
assert.doesNotMatch(license, /hello@jussbeautifulhair\.com/i);

assert.match(
  notices,
  /third-party software packages[\s\S]*governed by their own license\s*terms/i,
);
assert.match(notices, /not a representation that every transitive package's full license text/i);
assert.match(audit, /not legal advice/i);
assert.match(audit, /beauty-under-the-radar-2026\.md/);
assert.match(audit, /does not add:[\s\S]*investor access rights/i);

assert.equal(
  await exists("docs/industry-signals/beauty-under-the-radar-2026.md"),
  true,
  "canonical beauty-industry research brief must remain present",
);
assert.equal(
  await exists("INVESTMENT_EVALUATION_NOTICE.md"),
  false,
  "custom investment-evaluation terms are outside this focused metadata repair",
);

console.log("License metadata verified: package and lockfile agree, first-party and third-party boundaries are explicit, and no custom investment terms were introduced.");
