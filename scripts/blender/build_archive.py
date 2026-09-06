import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_landmarks as craft
ROOT=Path(__file__).resolve().parents[2]
layout=json.loads((ROOT/'src/bangkok/archive-layout.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
craft.MATS.clear();craft.palette()
craft.material('Paper',(.80,.73,.52),.93)
craft.material('Ink',(.08,.16,.19),.85)
craft.material('Water',(.08,.30,.29),.43)
craft.material('Leaf',(.17,.32,.14),.78)
root=craft.empty('Archive')
base=craft.empty('ArchiveBase',root)
furniture=craft.empty('ArchiveFurniture',root)
parts=['ArchiveBase','ArchiveFurniture']
cutaways=[]
for r in layout['rooms']:
    x,z,w,d=r['x'],r['z'],r['w'],r['d'];cx,cz=x+w/2,z+d/2
    craft.box(r['id']+' stone footing',(w,.14,d),(cx,.01,cz),'Stone',base)
    for i in range(int(w/.4)):
        craft.box('Teak floorboard',(.39,.055,d-.3),(x+.2+i*.4,.11,cz),'Teak' if i%3 else 'Dark teak',base,.003)
    walls=craft.empty(r['id']+'Walls',root);roof=craft.empty(r['id']+'Roof',root)
    parts.extend([walls.name,roof.name]);cutaways.extend([walls.name,roof.name])
    for side in ['n','s','w','e']:
        horizontal=side in ['n','s'];length=w if horizontal else d
        spans=[(0,length/2-2),(length/2+2,length)] if side in r['doors'] else [(0,length)]
        for lo,hi in spans:
            sx=x+(lo+hi)/2 if horizontal else x+(.125 if side=='w' else w-.125)
            sz=z+(.125 if side=='n' else d-.125) if horizontal else z+(lo+hi)/2
            craft.box('Plaster sill',(hi-lo,.72,.25) if horizontal else (.25,.72,hi-lo),(sx,.48,sz),'Plaster',base)
            craft.box('Teak wall',(hi-lo,1.9,.18) if horizontal else (.18,1.9,hi-lo),(sx,1.72,sz),'Teak',walls)
            for t in range(int((hi-lo)/.42)):
                tx=x+lo+.2+t*.42 if horizontal else sx;tz=sz if horizontal else z+lo+.2+t*.42
                craft.box('Slatted shutter',(.04,1.35,.28) if horizontal else (.28,1.35,.04),(tx,1.72,tz),'Brass',walls,.005)
        if side in r['doors']:
            for offset in [-2,2]:
                px=cx+offset if horizontal else x+(.125 if side=='w' else w-.125)
                pz=z+(.125 if side=='n' else d-.125) if horizontal else cz+offset
                craft.box('Door jamb',(.16,2.85,.16),(px,1.5,pz),'Dark teak',walls)
            craft.box('Carved door lintel',(4.2,.25,.35) if horizontal else (.35,.25,4.2),(cx,2.84,z+(.125 if side=='n' else d-.125)) if horizontal else (x+(.125 if side=='w' else w-.125),2.84,cz),'Brass',walls)
    craft.roof(roof,'Archive ceramic',w/2+.28,d+.55,3.05,1.6,'Terra',0)
    roof.location=craft.vec((cx,0,cz))
    for px,pz in [(x+.25,z+.25),(x+w-.25,z+.25),(x+.25,z+d-.25),(x+w-.25,z+d-.25)]:
        craft.beam('Corner post',(px,.18,pz),(px,3.05,pz),.11,'Dark teak',walls)
for c in layout['corridors']:
    craft.box('Covered gallery path',(c['w'],.15,c['d']),(c['x']+c['w']/2,.025,c['z']+c['d']/2),'Ivory',base)
    for i in range(int(c['w'])):
        craft.box('Walkway inset',(.025,.01,c['d']),(c['x']+i+.5,.108,c['z']+c['d']/2),'Brass',base,0)
for f in layout['furniture']:
    x,z=f['x']+f['w']/2,f['z']+f['d']/2
    craft.box('Collection cabinet',(f['w'],1.9,f['d']),(x,1.04,z),'Dark teak',furniture)
    for row in range(4):
        craft.box('Cabinet shelf',(f['w']+.04,.05,f['d']+.04),(x,.32+row*.45,z),'Brass',furniture)
        for j in range(int(f['w']/.17)):
            craft.box('Bound community volume',(.11,.30,.30),(f['x']+.12+j*.17,.51+row*.45,z+.15),'Paper' if j%3==0 else 'Lacquer',furniture,.005)
# Display furniture is offset behind the interaction marks, keeping the approach clear.
for name,x,z in [('Cargo',70,34),('River',70,17),('Lantern',84,17),('Maps',84,32)]:
    craft.box(name+' exhibit plinth',(1.5,.8,.55),(x,.53,z+.7),'Teak',furniture)
    craft.box(name+' velvet',(1.4,.035,.48),(x,.955,z+.7),'Lacquer',furniture)
    craft.box(name+' paper record',(.8,.035,.35),(x,.99,z+.7),'Paper',furniture)
    if name=='River':
        craft.mesh('River boat relief',[(x-.6,1.04,z+.6),(x+.6,1.04,z+.6),(x+.4,1.2,z+.6),(x-.4,1.2,z+.6)],[(0,1,2,3)],'Teak',furniture)
    elif name=='Lantern':
        craft.beam('Old paper lantern',(x,1,z+.7),(x,1.55,z+.7),.24,'Paper',furniture,8)
        for i in range(8):
            a=i*math.tau/8;craft.beam('Bamboo rib',(x+.24*math.cos(a),1,z+.7+.24*math.sin(a)),(x+.24*math.cos(a),1.55,z+.7+.24*math.sin(a)),.013,'Teak',furniture,6)
    else:
        for i in range(5):craft.box('Ledger ink line',(.5,.007,.013),(x,1.013,z+.57+i*.055),'Ink',furniture,0)
# Open-air courtyard: a low lotus basin, potted frangipani, and shaded galleries.
craft.box('Courtyard earth',(7,.08,6),(78.5,-.03,25),'Stone',base)
craft.box('Lotus basin',(3,.35,3),(78.5,.15,25),'Ivory',furniture)
craft.box('Still water',(2.7,.025,2.7),(78.5,.34,25),'Water',furniture)
for i in range(7):
    a=i*2.4;x=78.5+math.cos(a)*.8;z=25+math.sin(a)*.8
    craft.beam('Lotus leaf',(x,.36,z),(x,.38,z),.22,'Leaf',furniture,10)
craft.bake_parts(root)
model=ROOT/'public/bangkok/models/oldtown-archive.glb'
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(model),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
# Editor-ready overview, with roof groups individually toggleable.
for p in root.children:
    if p.name.endswith('Roof'):
        for obj in [p,*p.children_recursive]:obj.hide_render=True
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.world.color=(.3,.3,.3)
bpy.ops.object.light_add(type='AREA',location=craft.vec((67,25,18)));light=bpy.context.object;light.data.energy=16000;light.data.shape='DISK';light.data.size=25
light.rotation_euler=(craft.vec((71,0,26))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=craft.vec((97,33,61)));camera=bpy.context.object;camera.rotation_euler=(craft.vec((71,0,25))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=46;scene.camera=camera
scene.render.resolution_x=1400;scene.render.resolution_y=950;scene.render.resolution_percentage=100
out=ROOT/'artifacts/archive';out.mkdir(parents=True,exist_ok=True);scene.render.filepath=str(out/'blender-overview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/oldtown-archive.blend'))
bpy.ops.render.render(write_still=True)
(out/'model.json').write_text(json.dumps({'parts':parts,'cutaways':cutaways,'bytes':model.stat().st_size,'rooms':len(layout['rooms'])},indent=2))
print('ARCHIVE_EXPORTED',model.stat().st_size)
