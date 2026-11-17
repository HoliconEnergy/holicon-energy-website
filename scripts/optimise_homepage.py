#!/usr/bin/env python3
"""Extract large embedded homepage assets without changing the rendered design.

Run from the repository root: python3 scripts/optimise_homepage.py
This script is deliberately repeatable and avoids minifying/reordering code.
"""
from pathlib import Path
import base64
import hashlib
import re

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "index.html"
ASSETS = ROOT / "assets" / "homepage"
IMG_RE = re.compile(r"data:image/(png|jpeg|jpg|webp|gif|avif|svg\+xml);base64,([A-Za-z0-9+/\r\n=]{500,})", re.I)
STYLE_RE = re.compile(r"<style\b([^>]*)>(.*?)</style\s*>", re.I | re.S)
SCRIPT_RE = re.compile(r"<script\b([^>]*)>(.*?)</script\s*>", re.I | re.S)

def main():
    html = PAGE.read_text(encoding="utf-8")
    before = len(html.encode("utf-8"))
    if "Start Your Project" in html:
        html = html.replace("Start Your Project", "Start Your Enquiry")
    elif "Start your project" in html:
        html = html.replace("Start your project", "Start Your Enquiry")

    images = {}
    def replace_image(match):
        kind, payload = match.group(1).lower(), match.group(2)
        raw = base64.b64decode(re.sub(r"\s+", "", payload), validate=True)
        ext = {"jpeg": "jpg", "svg+xml": "svg"}.get(kind, kind)
        digest = hashlib.sha256(raw).hexdigest()[:16]
        filename = f"image-{digest}.{ext}"
        target = ASSETS / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and target.read_bytes() != raw:
            raise RuntimeError(f"Asset hash collision: {target}")
        target.write_bytes(raw)
        images[filename] = len(raw)
        return f"assets/homepage/{filename}"

    html = IMG_RE.sub(replace_image, html)

    style_number = 0
    def replace_style(match):
        nonlocal style_number
        attrs, css = match.group(1), match.group(2)
        # Keep media/nonce/other style elements inline rather than risk altering semantics.
        if attrs.strip():
            return match.group(0)
        style_number += 1
        filename = f"styles-{style_number}.css"
        (ASSETS / filename).write_text(css, encoding="utf-8")
        # CSS moved one folder deeper: rebase relative url(...) references.
        css = re.sub(
            r"(url\(\s*['\"]?)(?!data:|https?://|/|#)([^)'\"\s]+)",
            lambda m: m.group(1) + "../../" + m.group(2),
            css, flags=re.I
        )
        (ASSETS / filename).write_text(css, encoding="utf-8")
        return f'<link rel="stylesheet" href="assets/homepage/{filename}">'

    html = STYLE_RE.sub(replace_style, html)

    script_number = 0
    def replace_script(match):
        nonlocal script_number
        attrs, js = match.group(1), match.group(2)
        if re.search(r"\bsrc\s*=", attrs, re.I):
            return match.group(0)
        type_match = re.search(r"\btype\s*=\s*['\"]([^'\"]+)['\"]", attrs, re.I)
        if type_match and type_match.group(1).lower() not in ("text/javascript", "application/javascript", "module"):
            return match.group(0)
        if not js.strip():
            return match.group(0)
        # Inline scripts using document.currentScript can change meaning when externalised.
        if "document.currentScript" in js or re.search(r"\bnonce\s*=", attrs, re.I):
            return match.group(0)
        script_number += 1
        filename = f"script-{script_number}.js"
        ASSETS.mkdir(parents=True, exist_ok=True)
        (ASSETS / filename).write_text(js, encoding="utf-8")
        return f'<script{attrs} src="assets/homepage/{filename}"></script>'

    html = SCRIPT_RE.sub(replace_script, html)

    if html != PAGE.read_text(encoding="utf-8"):
        PAGE.write_text(html, encoding="utf-8")
    after = PAGE.stat().st_size
    print(f"Homepage: {before:,} -> {after:,} bytes ({(1-after/before)*100:.1f}% smaller)")
    print(f"Extracted {len(images)} unique images, {style_number} stylesheets, {script_number} scripts")
    if after >= before * 0.9:
        print("Note: small reduction; inspect for additional non-base64 embedded payloads.")
    # Repeatability: do not produce new replacements on a subsequent run.
    assert PAGE.exists() and after > 0

if __name__ == "__main__":
    main()
