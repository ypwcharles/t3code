#!/usr/bin/env python3
"""Verify portable patches against their pinned upstream base using an isolated index."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("repository", type=Path)
parser.add_argument("--only", choices=["all", "translation", "ssh"], default="all")
args = parser.parse_args()
kit = Path(__file__).resolve().parents[1]
patch_dir = kit / "patches" / "v0.1.0"
manifest = json.loads((patch_dir / "manifest.json").read_text())
repo = args.repository.resolve()

def git(*arguments, environment=None):
    result = subprocess.run(
        ["git", "-C", str(repo), *arguments], env=environment,
        capture_output=True, text=True,
    )
    if result.returncode:
        raise SystemExit(result.stderr.strip())
    return result.stdout.strip()

root = Path(git("rev-parse", "--show-toplevel")).resolve()
if root != repo:
    raise SystemExit("Pass the Git repository root.")
git("cat-file", "-e", manifest["baseCommit"] + "^{commit}")
patches = manifest["patches"]
if args.only == "translation":
    patches = patches[:1]
elif args.only == "ssh":
    patches = patches[1:]

with tempfile.TemporaryDirectory(prefix="t3code-patch-check-") as directory:
    environment = os.environ.copy()
    environment["GIT_INDEX_FILE"] = str(Path(directory) / "index")
    # The sparse clone may omit unrelated blob contents. None are needed here.
    environment["GIT_NO_LAZY_FETCH"] = "1"
    git("read-tree", manifest["baseCommit"], environment=environment)
    files = []
    for patch in patches:
        path = patch_dir / patch["file"]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != patch["sha256"]:
            raise SystemExit("Patch checksum mismatch: " + patch["file"])
        git("apply", "--cached", "--check", str(path), environment=environment)
        git("apply", "--cached", str(path), environment=environment)
        files.extend(patch["files"])
    staged = git("ls-files", "--stage", "--", *files, environment=environment)
    objects = {line.split("\t", 1)[1]: line.split()[1] for line in staged.splitlines()}
    expected = {name: manifest["testedSourceFiles"][name] for name in files}
    if objects != expected:
        raise SystemExit("Patched file contents differ from the accepted source.")
    tree = git("write-tree", "--missing-ok", environment=environment)
    if args.only != "ssh" and tree != patches[-1]["expectedTree"]:
        raise SystemExit("Unexpected changes outside the patch files.")
    print(json.dumps({
        "base": manifest["baseCommit"], "selection": args.only,
        "patches": len(patches), "files": len(files), "tree": tree,
        "sourceBytesMatchAcceptedBuild": True,
        "workingTreeAndIndexModified": False,
    }, indent=2))
