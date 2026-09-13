"""Exercise the Envoy review guard using temporary records and simulated masks."""
import importlib.util, json, hashlib
from pathlib import Path
import numpy as np
from PIL import Image
repo=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('art_gate',repo/'illustrated-src/verify-art.py')
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
qa_root=repo/'outputs/cyber-standard-trio/gate-probes'; folder=qa_root/'art-src/cyber-standard-trio/nacre';folder.mkdir(parents=True,exist_ok=True)
gate.ROOT=qa_root
paths={f'nacre-{b}-{i}.png':repo/f'docs/art/suits/nacre-{b}-{i}.png' for b in ('asc','desc') for i in range(1,10)}
record={'suit':'nacre','reference':'cyber','status':'PASS','outputHashes':{k:hashlib.sha256(p.read_bytes()).hexdigest() for k,p in paths.items()}}
hd_paths={name:repo/'docs/art/suits/hd'/name for name in paths}
record['hdOutputHashes']={name:hashlib.sha256(p.read_bytes()).hexdigest() for name,p in hd_paths.items()}
fixture=folder/'motion-review.json'
fixture.write_text(json.dumps(record))
assert gate.verify_nacre_reviewed_motion()==[], 'current geometry must pass the mechanical guard, without granting visual acceptance'
record['outputHashes']['nacre-asc-1.png']='0'*64;fixture.write_text(json.dumps(record))
assert any('changed after independent' in x for x in gate.verify_nacre_reviewed_motion())
record['outputHashes']['nacre-asc-1.png']=hashlib.sha256(paths['nacre-asc-1.png'].read_bytes()).hexdigest();fixture.write_text(json.dumps(record))
record['hdOutputHashes']['nacre-asc-1.png']='0'*64;fixture.write_text(json.dumps(record))
assert any('changed after independent' in x for x in gate.verify_nacre_reviewed_motion()), 'HD-only alteration must invalidate approval'
record['hdOutputHashes'].pop('nacre-asc-1.png');fixture.write_text(json.dumps(record))
assert any('18 HD companion' in x for x in gate.verify_nacre_reviewed_motion()), 'a partial HD review cannot clear the bank'
record['hdOutputHashes']['nacre-asc-1.png']=hashlib.sha256(hd_paths['nacre-asc-1.png'].read_bytes()).hexdigest();fixture.write_text(json.dumps(record))
real_open=Image.open
for part,region in [('body',(slice(95,210),slice(125,215))),('tail',(slice(None),slice(0,112)))]:
 def open_probe(path,*args,**kwargs):
  picture=real_open(path,*args,**kwargs)
  if Path(path).name.startswith('nacre-'):
   bank=Path(path).name.split('-')[1]
   pixels=np.array(picture.convert('RGBA'));neutral=np.array(real_open(paths[f'nacre-{bank}-1.png']).convert('RGBA'))
   pixels[...,3][region]=neutral[...,3][region]
   return Image.fromarray(pixels)
  return picture
 gate.Image.open=open_probe
 try:
  failures=gate.verify_nacre_reviewed_motion()
  assert any(f'{part} silhouette motion 0 ' in x for x in failures), failures
 finally: gate.Image.open=real_open
 print('PASS simulated frozen',part,'is rejected independently of the output-hash check')
print('PASS exact-set records, altered 256/512 hashes and missing HD approval rejected; no production fixture/artwork was changed')
