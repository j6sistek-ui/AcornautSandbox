"""tiny glTF-binary reader/writer for the rig3d prep scripts (numpy only)"""
import json,struct,numpy as np
CT={5126:np.float32,5125:np.uint32,5123:np.uint16,5121:np.uint8}; NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(p):
    d=open(p,'rb').read(); n=struct.unpack('<I',d[12:16])[0]; j=json.loads(d[20:20+n]); b=d[20+n+8:20+n+8+j['buffers'][0]['byteLength']]
    return j,b
def acc(j,b,i):
    a=j['accessors'][i]; v=j['bufferViews'][a['bufferView']]; o=v.get('byteOffset',0)+a.get('byteOffset',0)
    t=CT[a['componentType']]; c=NC[a['type']]
    return np.frombuffer(b,dtype=t,count=a['count']*c,offset=o).reshape(a['count'],c) if c>1 else np.frombuffer(b,dtype=t,count=a['count'],offset=o)
def with_tris(j,b,keep_tris,out):
    """write a copy whose only change is the triangle list (index buffer appended)"""
    import copy
    j=copy.deepcopy(j); pr=j['meshes'][0]['primitives'][0]
    idx=np.ascontiguousarray(keep_tris.astype(np.uint32)).tobytes()
    pad=lambda x:x+b'\0'*(-len(x)%4)
    b=pad(bytes(b)); off=len(b); b=b+pad(idx)
    j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(idx),'target':34963})
    j['accessors'].append({'bufferView':len(j['bufferViews'])-1,'componentType':5125,'count':int(keep_tris.size),'type':'SCALAR'})
    pr['indices']=len(j['accessors'])-1; j['buffers'][0]['byteLength']=len(b)
    js=json.dumps(j).encode(); js+=b' '*(-len(js)%4)
    open(out,'wb').write(b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(b))+struct.pack('<I',len(js))+b'JSON'+js+struct.pack('<I',len(b))+b'BIN\0'+b)
def compact(j,b,tris,out):
    """write a copy keeping only vertices the triangles use; every vertex attribute is re-packed"""
    import copy
    j=copy.deepcopy(j); pr=j['meshes'][0]['primitives'][0]
    used=np.unique(tris); remap=np.full(int(tris.max())+1,-1,np.int64); remap[used]=np.arange(len(used))
    pad=lambda x:x+b'\0'*(-len(x)%4); b=pad(bytes(b))
    def add(arr,ctype,typ,target,minmax=False):
        nonlocal b
        raw=np.ascontiguousarray(arr).tobytes(); off=len(b); b=b+pad(raw)
        j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(raw),**({'target':target} if target else {})})
        a={'bufferView':len(j['bufferViews'])-1,'componentType':ctype,'count':int(len(arr)),'type':typ}
        if minmax: a['min']=arr.min(0).tolist(); a['max']=arr.max(0).tolist()
        j['accessors'].append(a); return len(j['accessors'])-1
    for k,i in list(pr['attributes'].items()):
        a=j['accessors'][i]; arr=acc(j,b,i)[used]
        pr['attributes'][k]=add(arr,a['componentType'],a['type'],34962,k=='POSITION')
        if a.get('normalized'): j['accessors'][-1]['normalized']=True
    pr['indices']=add(remap[tris].astype(np.uint32).ravel(),5125,'SCALAR',34963)
    j['buffers'][0]['byteLength']=len(b)
    js=json.dumps(j).encode(); js+=b' '*(-len(js)%4)
    open(out,'wb').write(b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(b))+struct.pack('<I',len(js))+b'JSON'+js+struct.pack('<I',len(b))+b'BIN\0'+b)
    return len(used)
