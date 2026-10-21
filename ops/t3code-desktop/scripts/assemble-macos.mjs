import * as NodeAssert from "node:assert/strict";
import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";

const root = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "../../..");
const { values } = NodeUtil.parseArgs({
  options: {
    "official-app": { type: "string" },
    "expected-asar-sha256": { type: "string" },
    output: { type: "string" },
    evidence: { type: "string" },
  },
});
for (const key of ["official-app", "expected-asar-sha256", "output", "evidence"]) {
  NodeAssert.ok(values[key], `Missing --${key}`);
}
const official = NodePath.resolve(values["official-app"]);
const output = NodePath.resolve(values.output);
const evidence = NodePath.resolve(values.evidence);
const stage = `${output}.stage`;
// The helper only assembles candidates. Installation must follow a separate clean quit.
for (const target of [output, evidence]) {
  NodeAssert.ok(
    target.startsWith(NodePath.join(root, "out") + NodePath.sep),
    "Outputs must stay in out/",
  );
}
for (const target of [output, stage])
  NodeAssert.ok(!NodeFS.existsSync(target), `Preserve existing ${target}`);
const desktopRequire = NodeModule.createRequire(NodePath.join(root, "apps/desktop/package.json"));
const builderRequire = NodeModule.createRequire(
  desktopRequire.resolve("electron-builder/package.json"),
);
const asar = NodeModule.createRequire(builderRequire.resolve("app-builder-lib/package.json"))(
  "@electron/asar",
);
const sha = (data) => NodeCrypto.createHash("sha256").update(data).digest("hex");
const digest = (file) => sha(NodeFS.readFileSync(file));
const originalArchive = NodePath.join(official, "Contents/Resources/app.asar");
NodeAssert.equal(digest(originalArchive), values["expected-asar-sha256"]);
const officialPackage = JSON.parse(asar.extractFile(originalArchive, "package.json"));
NodeAssert.equal(officialPackage.main, "apps/desktop/dist-electron/boot.cjs");

const replacements = [
  ["apps/desktop/dist-electron", "apps/desktop/dist-electron"],
  ["apps/web/dist", "apps/server/dist/client"],
];
for (const [from] of replacements)
  NodeAssert.ok(NodeFS.statSync(NodePath.join(root, from)).isDirectory());
NodeFS.mkdirSync(evidence, { recursive: true });
asar.extractAll(originalArchive, stage);
for (const [from, to] of replacements) {
  const target = NodePath.join(stage, to);
  NodeFS.rmSync(target, { recursive: true });
  NodeFS.cpSync(NodePath.join(root, from), target, {
    recursive: true,
    filter: (entry) => !entry.endsWith(".map"),
  });
}

function files(archive) {
  return asar.listPackage(archive).flatMap((name) => {
    const relative = name.replace(/^\//, "");
    const stat = asar.statFile(archive, relative);
    return stat.files ? [] : [{ relative, stat }];
  });
}
const originalFiles = files(originalArchive);
const unpacked = (entries) =>
  entries
    .filter(({ stat }) => stat.unpacked)
    .map(({ relative }) => relative)
    .sort();
const unpackedDirectories = [];
function visit(header, prefix = "") {
  for (const [name, entry] of Object.entries(header.files ?? {})) {
    const relative = prefix ? `${prefix}/${name}` : name;
    if (!entry.files) continue;
    if (entry.unpacked && !unpackedDirectories.some((dir) => relative.startsWith(dir + "/"))) {
      unpackedDirectories.push(relative);
    }
    visit(entry, relative);
  }
}
visit(asar.getRawHeader(originalArchive).header);
NodeAssert.ok(
  unpackedDirectories.length > 0,
  "Inspect a changed upstream unpack layout before packaging",
);
NodeFS.mkdirSync(NodePath.dirname(output), { recursive: true });
NodeChildProcess.execFileSync("/usr/bin/ditto", [official, output]);
const archive = NodePath.join(output, "Contents/Resources/app.asar");
await asar.createPackageWithOptions(stage, archive, {
  unpackDir: `{${unpackedDirectories.join(",")}}`,
});
asar.uncacheAll();
const newFiles = files(archive);
NodeAssert.deepEqual(unpacked(newFiles), unpacked(originalFiles));
const wasmDigests = (archivePath, entries) =>
  entries
    .filter(
      ({ relative }) =>
        relative.startsWith("apps/server/dist/client/") && relative.endsWith(".wasm"),
    )
    .map(({ relative }) => sha(asar.extractFile(archivePath, relative)))
    .sort();
NodeAssert.deepEqual(wasmDigests(archive, newFiles), wasmDigests(originalArchive, originalFiles));
const changed = (relative) => replacements.some(([, to]) => relative.startsWith(to + "/"));
const unchanged = (entries) => entries.filter(({ relative }) => !changed(relative));
NodeAssert.deepEqual(
  unchanged(newFiles)
    .map(({ relative }) => relative)
    .sort(),
  unchanged(originalFiles)
    .map(({ relative }) => relative)
    .sort(),
);
let originalRuntimeFilesVerified = 0;
for (const { relative, stat } of unchanged(originalFiles)) {
  if (stat.link) {
    NodeAssert.equal(asar.statFile(archive, relative).link, stat.link);
  } else {
    NodeAssert.equal(
      sha(asar.extractFile(archive, relative)),
      sha(asar.extractFile(originalArchive, relative)),
      relative,
    );
    originalRuntimeFilesVerified++;
  }
}
const integrityHash = sha(asar.getRawHeader(archive).headerString);
NodeChildProcess.execFileSync("/usr/bin/python3", [
  "-c",
  [
    "import plistlib,sys",
    "p=sys.argv[1]",
    "with open(p,'rb') as f: d=plistlib.load(f)",
    "d['ElectronAsarIntegrity']['Resources/app.asar']['hash']=sys.argv[2]",
    "with open(p,'wb') as f: plistlib.dump(d,f,fmt=plistlib.FMT_XML,sort_keys=False)",
  ].join("\n"),
  NodePath.join(output, "Contents/Info.plist"),
  integrityHash,
]);
const entitlements = NodePath.join(evidence, "local-signing-entitlements.plist");
NodeFS.writeFileSync(
  entitlements,
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>com.apple.security.cs.allow-jit</key><true/><key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/><key>com.apple.security.cs.disable-library-validation</key><true/></dict></plist>
`,
);
NodeChildProcess.execFileSync("/usr/bin/codesign", [
  "--force",
  "--sign",
  "-",
  "--options",
  "runtime",
  "--entitlements",
  entitlements,
  output,
]);
NodeChildProcess.execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", output]);

let externalRuntimeFilesVerified = 0;
function compareDirectory(relative = "") {
  for (const entry of NodeFS.readdirSync(NodePath.join(official, relative), {
    withFileTypes: true,
  })) {
    const name = NodePath.join(relative, entry.name);
    if (
      name === "Contents/Info.plist" ||
      name === "Contents/Resources/app.asar" ||
      name === "Contents/_CodeSignature"
    )
      continue;
    const before = NodePath.join(official, name);
    const after = NodePath.join(output, name);
    if (entry.isSymbolicLink())
      NodeAssert.equal(NodeFS.readlinkSync(after), NodeFS.readlinkSync(before), name);
    else if (entry.isDirectory()) compareDirectory(name);
    else {
      NodeAssert.equal(digest(after), digest(before), name);
      externalRuntimeFilesVerified++;
    }
  }
}
compareDirectory();
NodeAssert.equal(digest(originalArchive), values["expected-asar-sha256"]);
const report = {
  version: officialPackage.version,
  artifact: output,
  sourceCommit: NodeChildProcess.execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  originalApp: official,
  originalAsarSha256: digest(originalArchive),
  artifactAsarSha256: digest(archive),
  artifactAsarHeaderSha256: integrityHash,
  originalRuntimeFilesVerified,
  externalRuntimeFilesVerified,
  unpackedNativeFilesPreserved: unpacked(newFiles).length,
  webAssemblyFilesVerified: wasmDigests(archive, newFiles).length,
  replacedDirectories: replacements.map(([, to]) => to),
  signing: "local ad-hoc; codesign --verify --deep --strict passed",
  installedOrLaunched: false,
};
NodeFS.writeFileSync(
  NodePath.join(evidence, "artifact-verification.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
