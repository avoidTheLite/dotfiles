#!/usr/bin/env python3
"""
sync_templates.py

Pulls canonical template files from a source directory (in practice: a
checkout of the dotfiles repo where these templates live) into each
skill's own skills/<name>/references/templates/ directory, per
manifest.json.

Each skill ships fully self-contained — this script just refreshes a
skill's local copy from the canonical source. If a skill has hand-edited
its local copy of a template for its own purposes, re-running sync will
overwrite that file with the canonical version, so check the manifest
before syncing a skill you've intentionally diverged.

Layout this script expects (relative to the agent-skills/ package root):
    agent-skills/
      skills/<skill-name>/references/templates/
      tools/template-sync/manifest.json
      tools/template-sync/scripts/sync_templates.py   <- this file

Usage:
    python sync_templates.py --source /path/to/dotfiles/spec-templates
    python sync_templates.py --source /path/to/dotfiles/spec-templates --skill idea-to-prd
    python sync_templates.py --source /path/to/dotfiles/spec-templates --dry-run
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

# scripts/ -> template-sync/ -> tools/ -> agent-skills/
PACKAGE_ROOT = Path(__file__).resolve().parents[3]
SKILLS_DIR = PACKAGE_ROOT / "skills"
MANIFEST_PATH = Path(__file__).resolve().parent.parent / "manifest.json"


def load_manifest() -> dict:
    with open(MANIFEST_PATH) as f:
        return json.load(f)


def sync(source_dir: Path, only_skill: str | None, dry_run: bool) -> int:
    manifest = load_manifest()
    if only_skill and only_skill not in manifest:
        print(f"Unknown skill '{only_skill}'. Known skills: {', '.join(manifest)}")
        return 1

    skills = {only_skill: manifest[only_skill]} if only_skill else manifest
    changed = 0

    for skill_name, template_files in skills.items():
        skill_dir = SKILLS_DIR / skill_name
        dest_dir = skill_dir / "references" / "templates"
        if not skill_dir.is_dir():
            print(f"  ! skipping '{skill_name}': no such skill directory at {skill_dir}")
            continue
        dest_dir.mkdir(parents=True, exist_ok=True)

        for filename in template_files:
            src = source_dir / filename
            dst = dest_dir / filename
            if not src.is_file():
                print(f"  ! {skill_name}: missing source template '{filename}' in {source_dir}")
                continue

            src_bytes = src.read_bytes()
            if dst.is_file() and dst.read_bytes() == src_bytes:
                print(f"    {skill_name}/{filename} — already up to date")
                continue

            print(f"  → {skill_name}/{filename} — {'would update' if dry_run else 'updating'}")
            if not dry_run:
                shutil.copyfile(src, dst)
            changed += 1

    print(f"\n{'Would sync' if dry_run else 'Synced'} {changed} template file(s) from {source_dir}")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", required=True, type=Path, help="Path to canonical templates directory (e.g. your dotfiles checkout)")
    parser.add_argument("--skill", default=None, help="Only sync this one skill (default: all skills in manifest.json)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would change without writing")
    args = parser.parse_args()

    if not args.source.is_dir():
        print(f"Source directory not found: {args.source}")
        sys.exit(1)

    sys.exit(sync(args.source, args.skill, args.dry_run))


if __name__ == "__main__":
    main()
