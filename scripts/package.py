"""Build a load-unpacked ZIP from an explicit list of public project files."""
from pathlib import Path
import argparse
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    version = manifest["version"]
    folder = f"Threadmark-{version}"
    args.output.mkdir(parents=True, exist_ok=True)
    archive = args.output / f"{folder}.zip"
    files = [ROOT / name for name in ("manifest.json", "background.js", "LICENSE", "README.md", "TESTING.md", "CHANGELOG.md")]
    for directory in ("src", "icons", "preview", "docs"):
        files.extend(file for file in (ROOT / directory).rglob("*") if file.is_file() and not file.is_symlink())
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as package:
        for file in sorted(files):
            if file.exists():
                package.write(file, f"{folder}/{file.relative_to(ROOT).as_posix()}")
    with zipfile.ZipFile(archive) as package:
        assert package.testzip() is None
        assets = [manifest["background"]["service_worker"], *manifest["icons"].values()]
        assets.extend(asset for entry in manifest["content_scripts"] for asset in entry["js"])
        for asset in assets:
            assert f"{folder}/{asset}" in package.namelist(), asset
        assert not any("/.git/" in name or "/node_modules/" in name for name in package.namelist())
    print(f"Built {archive} ({archive.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
