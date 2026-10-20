"""Package the checked-in app without mutating its runtime code."""
from pathlib import Path
import json
import os
import re

build = os.environ.get('GITHUB_SHA', '')
if not re.fullmatch(r'[a-f0-9]{40}', build):
    raise SystemExit('GITHUB_SHA must be a full commit SHA')
source = Path('index.html').read_text(encoding='utf-8')
if source.count('__BUILD_SHA__') != 1:
    raise SystemExit('Expected exactly one build version placeholder')
out = Path('dist')
out.mkdir(exist_ok=True)
(out / 'index.html').write_text(source.replace('__BUILD_SHA__', build), encoding='utf-8')
(out / 'version.json').write_text(json.dumps({'build': build}), encoding='utf-8')
(out / '.nojekyll').touch()
(out / 'hypertrophy-trackernew.html').write_text(
    '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./?v='
    + build + '"><title>Open Hypertrophy Tracker</title>'
    + '<a href="./?v=' + build + '">Open Hypertrophy Tracker</a>',
    encoding='utf-8')
print('Packaged Hypertrophy Tracker build ' + build)
