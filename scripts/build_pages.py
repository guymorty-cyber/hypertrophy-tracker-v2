"""Package a release with immutable scripts/styles and an atomic offline shell."""
from pathlib import Path
import argparse
import json
import os
import re
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('--output', default='dist')
parser.add_argument('--build', default=os.environ.get('GITHUB_SHA', ''))
args = parser.parse_args()
build = args.build
if not re.fullmatch(r'[a-f0-9]{40}', build):
    raise SystemExit('A full commit SHA is required')
out = Path(args.output)
# Remove stale packaging output, never a repository/source directory.
if out.resolve() == Path.cwd().resolve() or out.resolve() in Path.cwd().resolve().parents:
    raise SystemExit('Output must be a separate build directory')
if out.exists():
    if not (out / '.tracker-build').exists():
        raise SystemExit('Refusing to remove a directory not created by this builder')
    shutil.rmtree(out)
out.mkdir(parents=True)
(out / '.tracker-build').touch()
source = Path('index.html').read_text(encoding='utf-8')
scripts = re.findall(r'<script defer src="\./([^"]+)"', source)
if not scripts or len(scripts) != len(set(scripts)):
    raise SystemExit('App scripts must be present exactly once')
asset_paths = scripts + ['css/app.css']
for path in asset_paths:
    text = Path(path).read_text(encoding='utf-8')
    text = text.replace('__BUILD_SHA__', build)
    target = out / 'assets' / build / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')
    source = source.replace('./' + path, './assets/' + build + '/' + path)
for path in ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']:
    target = out / path
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, target)
(out / 'index.html').write_text(source, encoding='utf-8')
shell = './shell-' + build + '.html'
(out / shell[2:]).write_text(source, encoding='utf-8')
precache = [shell] + ['./assets/' + build + '/' + path for path in asset_paths] + [
    './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png']
worker = Path('sw.js').read_text(encoding='utf-8').replace('__BUILD_SHA__', build)
worker = worker.replace('__PRECACHE__', json.dumps(precache)).replace('__SHELL__', json.dumps(shell))
(out / 'sw.js').write_text(worker, encoding='utf-8')
(out / 'version.json').write_text(json.dumps({'build': build}), encoding='utf-8')
(out / '.nojekyll').touch()
(out / 'hypertrophy-trackernew.html').write_text(
    '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./">'
    '<title>Open Hypertrophy Tracker</title><a href="./">Open Hypertrophy Tracker</a>', encoding='utf-8')
print('Packaged Hypertrophy Tracker build ' + build)
