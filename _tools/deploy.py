"""Build, check, then mirror site-next/ into the deployed repo ../site/.

  python3 _tools/deploy.py            build + check + show what would change (dry run)
  python3 _tools/deploy.py --apply    ... and copy the files
  python3 _tools/deploy.py --commit   ... and amend the repo's single "site" commit
Never pushes: after --commit, run  git -C ../site push -f  (see ../site/commandes.txt).
"""
import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT.parent / "site"
TOOLS = Path(__file__).resolve().parent
# Sources and tooling stay here; the repo's own files there are never touched.
EXCLUDE = ["_src/", "_tools/", "__pycache__/", ".git/", "commandes.txt", "README.md", ".DS_Store"]


def run(cmd, **kw):
    print("$", " ".join(str(c) for c in cmd))
    return subprocess.run(cmd, check=True, **kw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--commit", action="store_true")
    a = ap.parse_args()
    if not (DEST / ".git").is_dir():
        sys.exit(f"{DEST} is not the deployed git repo")

    run([sys.executable, TOOLS / "build.py"])
    run([sys.executable, TOOLS / "check.py"])

    rsync = ["rsync", "-a", "--delete", "--itemize-changes", "--checksum"]
    rsync += [f"--exclude={e}" for e in EXCLUDE]
    if not (a.apply or a.commit):
        rsync.append("--dry-run")
    run(rsync + [f"{ROOT}/", f"{DEST}/"])
    if not (a.apply or a.commit):
        print("dry run: nothing copied. --apply to copy, --commit to copy and amend.")
        return

    if a.commit:
        run(["git", "-C", DEST, "add", "-A"])
        if subprocess.run(["git", "-C", DEST, "diff", "--cached", "--quiet"]).returncode == 0:
            print("no change to commit")
            return
        run(["git", "-C", DEST, "commit", "--amend", "--no-edit"])
        print(f"committed. Publish with:  git -C '{DEST}' push -f")


if __name__ == "__main__":
    main()
