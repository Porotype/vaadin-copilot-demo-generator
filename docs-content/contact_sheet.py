"""A contact sheet of the cut walkthroughs: one HTML page with every step's poster (its last frame), light and dark
side by side, with the step's text from content.py. For reviewing a run's frames in a minute; each poster links to its
clip.

usage: python3 -I docs-content/contact_sheet.py . out/contact-sheet.html [scene…]
"""
import html
import json
import os
import re
import sys

here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
from content import PAGES  # noqa: E402

repo, out, only = sys.argv[1], sys.argv[2], set(sys.argv[3:])
out_dir = os.path.dirname(os.path.abspath(out))


def text(t):
    """content.py's markup as HTML: **bold**, [[what the clip outlines]], `code`."""
    t = html.escape(t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    return re.sub(r"\[\[([^\]]+)\]\]", r'<span class="look">\1</span>', t)


def steps_of(take):
    manifest = os.path.join(repo, "out", take, "steps", "steps.json")
    return json.load(open(manifest)) if os.path.exists(manifest) else None


def media(take, step):
    if not step:
        return '<div class="missing">not recorded</div>'
    rel = os.path.relpath(os.path.join(repo, "out", take, "steps"), out_dir)
    img = f'<img loading="lazy" src="{rel}/{step["still"]}" alt="">'
    return f'<a href="{rel}/{step["video"]}">{img}</a>' if step.get("video") else img


body = []
for page in PAGES:
    for w in page["walkthroughs"]:
        if only and w["scene"] not in only:
            continue
        light, dark = steps_of(w["scene"]), steps_of(w["scene"] + "-dark")
        recorded = {s["name"]: s for s in light or []}, {s["name"]: s for s in dark or []}
        body.append(f'<h2>{html.escape(w["title"])} <small>{w["scene"]} → {w.get("docs", "")}</small></h2>')
        for i, (name, words) in enumerate(w["steps"].items(), 1):
            body.append(
                f'<div class="step"><p><b>{i}. {name}</b><br>{text(words)}</p>'
                f'{media(w["scene"], recorded[0].get(name))}{media(w["scene"] + "-dark", recorded[1].get(name))}</div>'
            )

os.makedirs(out_dir, exist_ok=True)
with open(out, "w") as f:
    f.write(f"""<!doctype html>
<meta charset="utf-8">
<title>Walkthrough contact sheet</title>
<style>
  body {{ font: 14px/1.4 system-ui, sans-serif; margin: 16px; background: #f4f4f5; color: #18181b; }}
  h2 {{ margin: 32px 0 8px; font-size: 18px; }}
  h2 small {{ font-weight: normal; color: #71717a; }}
  .step {{ display: grid; grid-template-columns: minmax(200px, 1fr) 2fr 2fr; gap: 12px; margin-bottom: 12px; align-items: start; }}
  .step p {{ margin: 0; }}
  img {{ width: 100%; display: block; border: 1px solid #d4d4d8; }}
  .look {{ color: #ea580c; font-weight: 600; }}
  .missing {{ aspect-ratio: 16 / 10; display: grid; place-items: center; background: #fee2e2; color: #991b1b; }}
  code {{ background: #e4e4e7; padding: 0 3px; }}
</style>
<h1>Walkthrough contact sheet</h1>
<p>Each step's poster (its last frame), light and dark. Click a poster for its clip.</p>
{chr(10).join(body)}
""")
print(out)
