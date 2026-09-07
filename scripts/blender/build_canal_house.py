"""Original timber canal house. Metre-scale kit; four runtime facades share one GLB."""
import sys, math, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from build_landmarks import bpy, Vector, MODELS, SOURCE, MATS, material, empty, box, beam, curve, mesh, bake_parts, vec
OUT=Path(__file__).resolve().parents[2]/'artifacts/blender-canal-house';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);MATS.clear()
for name,color in [
 ('Teak',(.30,.14,.061)),('AgedTimber',(.43,.24,.11)),('DarkTimber',(.12,.067,.035)),
 ('PaleTimber',(.60,.43,.24)),('ShutterPaint',(.10,.31,.40)),('Iron',(.08,.10,.11)),
 ('Glass',(.12,.20,.20)),('Terracotta',(.39,.12,.055)),('ClayLight',(.47,.18,.082)),('OchreCloth',(.65,.43,.19)),
]:material(name,color,.78 if name!='Glass' else .28,.18 if name=='Iron' else 0)
root=empty('CanalHouse')
parts={name:empty(name,root) for name in ['HouseBase','HouseFront','HouseBack','HouseEast','HouseWest','HouseRoof']}
base=parts['HouseBase']
box('Floor frame',(7.88,.22,4.88),(0,.10,0),'DarkTimber',base,.02)
for i in range(28):box('Floor board',(.277,.05,4.84),(-3.75+i*.278,.235,0),'AgedTimber' if i%4==0 else 'Teak',base,.003)
for x in [-3.7,-1.25,1.25,3.7]:
 for z in [-2.15,2.15]:
  beam('Stilt pile',(x,-1.35,z),(x,.12,z),.11,'DarkTimber',base,10)
for z in [-2.15,2.15]:
 for x in [-2.5,0,2.5]:
  beam('Underfloor diagonal',(x-.95,-1.0,z),(x+.95,.04,z),.052,'AgedTimber',base,8)
for z in [-2.32,2.32]:box('Edge beam',(7.8,.16,.14),(0,.13,z),'PaleTimber',base,.012)
# Small visible thresholds are contained within the existing blocked house footprint.
for side in [-1,1]:
 for i in range(2):box('Door threshold',(1.42,.10, .17),(0,.08+i*.09,side*(2.36-i*.14)),'AgedTimber',base,.014)

def shutter(parent,x,y,z):
 box('Window casing',(1.54,1.65,.11),(x,y,z),'PaleTimber',parent,.022)
 box('Window recess',(1.32,1.42,.055),(x,y,z+.075),'DarkTimber',parent,.009)
 box('Dark window glass',(.40,1.28,.018),(x,y,z+.108),'Glass',parent,0)
 for side in [-1,1]:
  sx=x+side*.43
  box('Painted shutter leaf',(.61,1.38,.065),(sx,y,z+.12),'ShutterPaint',parent,.014)
  for dx in [-.265,.265]:box('Shutter stile',(.055,1.41,.045),(sx+dx,y,z+.169),'ShutterPaint',parent,.006)
  for dy in [-.65,.65]:box('Shutter rail',(.59,.075,.045),(sx,y+dy,z+.169),'ShutterPaint',parent,.006)
  for i in range(9):
   slat=box('Louvred shutter',(.48,.09,.048),(sx,y-.51+i*.13,z+.17),'ShutterPaint',parent,.004);slat.rotation_euler.x=.22
  for dy in [-.44,.44]:box('Forged hinge',(.075,.12,.018),(sx+side*.27,y+dy,z+.198),'Iron',parent,.003)
  beam('Small shutter pull',(sx-side*.19,y-.08,z+.209),(sx-side*.19,y+.08,z+.209),.015,'Iron',parent,8)
 box('Projecting sill',(1.69,.10,.27),(x,y-.86,z+.10),'PaleTimber',parent,.014)
 # A ventilated transom is open geometric fretwork, not a pasted texture.
 for i in range(7):
  dx=(i-3)*.18
  beam('Transom diamond',(x+dx-.09,y+1.01,z),(x+dx,y+1.14,z),.016,'PaleTimber',parent,6)
  beam('Transom diamond',(x+dx,y+1.14,z),(x+dx+.09,y+1.01,z),.016,'PaleTimber',parent,6)

def elevation(name,back=False):
 p=parts[name]
 # Wall boards and trim sit behind the shutter hardware, all within Z +/-2.5.
 for i in range(12):box('Horizontal weatherboard',(7.68,.215,.14),(0,.39+i*.215,2.15),'AgedTimber' if i%4==0 else 'Teak',p,.007)
 for x in [-3.79,-1.0,1.0,3.79]:box('Mortised wall post',(.14,2.72,.18),(x,1.58,2.18),'DarkTimber',p,.011)
 for x in [-2.35,2.35]:shutter(p,x,1.47,2.20)
 box('Door surround',(1.74,2.31,.14),(0,1.43,2.22),'PaleTimber',p,.02)
 for side in [-1,1]:
  box('Painted door leaf',(.73,2.09,.06),(side*.395,1.41,2.32),'ShutterPaint',p,.012)
  for y in [.84,1.86]:box('Recessed door panel',(.54,.67,.019),(side*.395,y,2.36),'Teak',p,.007)
  for y in [.84,1.86]:
   for dx in [-.27,.27]:box('Door panel upright',(.035,.71,.025),(side*.395+dx,y,2.375),'PaleTimber',p,.003)
  beam('Door pull',(side*.11,1.2,2.39),(side*.11,1.47,2.39),.018,'Iron',p,8)
 for x in [-3.5,3.5]:
  # Posts and braces support the shaded frontage without extending into the walking lane.
  box('Porch support',(.12,2.64,.12),(x,1.56,2.40),'AgedTimber',p,.015)
  curve('Curved corner brace',[(x,2.40,2.40),(x*.92,2.67,2.40),(x*.80,2.80,2.40)],.038,'PaleTimber',p)
 box('Frontage beam',(7.9,.15,.14),(0,2.84,2.38),'DarkTimber',p,.013)
 if back:p.rotation_euler.z=math.pi
elevation('HouseFront');elevation('HouseBack',True)
for name,side in [('HouseEast',1),('HouseWest',-1)]:
 p=parts[name]
 for i in range(12):box('End weatherboard',(.14,.215,4.30),(side*3.80,.39+i*.215,0),'AgedTimber' if i%4==0 else 'Teak',p,.006)
 for z in [-1.95,0,1.95]:box('Side wall upright',(.18,2.72,.14),(side*3.79,1.58,z),'DarkTimber',p,.01)
 # Small side louvers preserve a quiet domestic silhouette.
 box('Side window surround',(.10,1.18,1.30),(side*3.89,1.51,0),'PaleTimber',p,.013)
 for i in range(7):box('Painted side louvre',(.055,.12,1.13),(side*3.95,1.04+i*.155,0),'ShutterPaint',p,.006)
roof=parts['HouseRoof']
half,depth,baseY,rise=4.43,5.70,2.92,1.68
def roofY(t):return baseY+rise*(1-t)+.09*t**6
for side in [-1,1]:
 mesh('Roof soffit',[(0,baseY+rise,z) for z in [-depth/2,depth/2]]+[(side*half,roofY(1),z) for z in [depth/2,-depth/2]],[(0,1,2,3)],'DarkTimber',roof)
 for row in range(11):
  lo,hi=row/11,min(1,(row+1.13)/11)
  for col in range(20):
   z0=-depth/2+col*depth/20;z1=z0+depth/20*.98
   verts=[(side*half*t,roofY(t)+.035+.035*math.sin(u*math.pi),z0+(z1-z0)*u) for t in [lo,hi] for u in [0,.25,.5,.75,1]]
   mesh('Clay roof tile',verts,[(i,i+1,i+6,i+5) for i in range(4)],'ClayLight' if (row+col*3)%7==0 else 'Terracotta',roof,True)
 for z in [-depth/2,depth/2]:
  beam('Simple carved bargeboard',(0,baseY+rise+.07,z),(side*half,roofY(1)+.08,z),.055,'PaleTimber',roof,8)
  for i in range(14):
   t=(i+.5)/14;x=side*half*t;y=roofY(t)-.06
   mesh('Scalloped fascia',[(x-.09,y,z),(x+.09,y,z),(x+.065,y-.13,z),(x,y-.20,z),(x-.065,y-.13,z)],[(0,1,2,3,4)],'PaleTimber',roof)
 beam('Eave rafter',(side*half,roofY(1),-depth/2),(side*half,roofY(1),depth/2),.066,'DarkTimber',roof,10)
for z in [-2.14,2.14]:
 mesh('Timber gable',[(-3.80,2.92,z),(3.80,2.92,z),(0,4.43,z)],[(0,1,2)],'Teak',roof)
 for i in range(9):
  x=(i-4)*.28;h=.70-abs(i-4)*.10
  box('Gable ventilation',(.075,h,.035),(x,3.24+h/2,z+.02),'DarkTimber',roof,.006)
beam('Ridge cap',(0,4.69,-2.94),(0,4.69,2.94),.08,'PaleTimber',roof,12)
bake_parts(root)
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(MODELS/'thonburi-canal-house.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
(OUT/'manifest.json').write_text(json.dumps({'triangles':triangles,'bytes':(MODELS/'thonburi-canal-house.glb').stat().st_size,'parts':list(parts)},indent=2))
material('Studio',(.10,.16,.17),.9);box('Studio floor',(30,.06,30),(0,-1.4,0),'Studio',None,0)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.world.color=(.22,.24,.26)
for p,power,size in [((3,-6,10),1600,7),((-7,-2,6),1000,6),((2,5,9),1600,5)]:
 bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,1.8))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(10,-13,8));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1.7))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=12;scene.camera=camera
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'thonburi-canal-house.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'thonburi-canal-house.blend'));bpy.ops.render.render(write_still=True)
print('THONBURI_CANAL_HOUSE_EXPORTED',triangles)
