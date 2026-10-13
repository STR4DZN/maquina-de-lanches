"""Build the installable Foundry release; no network or credentials required."""
from pathlib import Path
import argparse, hashlib, json, re, zipfile
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--repository',default='STR4DZN/maquina-de-lanches')
parser.add_argument('--output',type=Path,default=ROOT/'dist')
args=parser.parse_args()
assert re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',args.repository),'Invalid GitHub repository'
manifest=json.loads((ROOT/'module.json').read_text())
assert re.fullmatch(r'\d+\.\d+\.\d+',manifest['version']),'Version must be SemVer'
assert manifest['compatibility']=={'minimum':'13','maximum':'13'}
tag='v'+manifest['version']
url='https://github.com/'+args.repository
manifest.update(url=url,manifest=url+'/releases/latest/download/module.json',download=url+'/releases/download/'+tag+'/module.zip')
args.output.mkdir(parents=True,exist_ok=True)
manifest_bytes=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()
(args.output/'module.json').write_bytes(manifest_bytes)
files=[ROOT/'README.md',ROOT/'LICENSE',ROOT/'CHANGELOG.md']+sorted((ROOT/'scripts').glob('*.js'))+sorted((ROOT/'styles').glob('*.css'))
for path in manifest['esmodules']+manifest['styles']:assert (ROOT/path).is_file(),path
with zipfile.ZipFile(args.output/'module.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
    z.writestr('module.json',manifest_bytes)
    for file in files:z.write(file,str(file.relative_to(ROOT)))
with zipfile.ZipFile(args.output/'module.zip') as z:
    assert z.testzip() is None
    assert z.read('module.json')==manifest_bytes
    assert set(z.namelist())=={'module.json',*(str(p.relative_to(ROOT)) for p in files)}
    assert all(not name.startswith(('dist/','.git/','docs/')) for name in z.namelist())
    for file in files:assert z.read(str(file.relative_to(ROOT)))==file.read_bytes()
notes=ROOT/'docs/release-notes.md'
(args.output/'release-notes.md').write_bytes(notes.read_bytes())
artifacts=['module.json','module.zip']
(args.output/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256((args.output/name).read_bytes()).hexdigest()+'  '+name+'\n' for name in artifacts))
print(json.dumps({'version':manifest['version'],'tag':tag,'repository':args.repository,'output':str(args.output),'files':artifacts,'zip_bytes':(args.output/'module.zip').stat().st_size},indent=2))
