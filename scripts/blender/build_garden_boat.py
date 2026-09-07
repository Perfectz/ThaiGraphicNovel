"""Original small canal workboat and reusable marigold tray, game metres/Y-up."""
import sys, math, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from build_landmarks import bpy, Vector, MODELS, SOURCE, MATS, material, empty, box, beam, curve, mesh, bake_parts
OUT=Path(__file__).resolve().parents[2]/'artifacts/blender-garden-boat';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);MATS.clear()
for n,c in [('Teak',(.24,.11,.047)),('Rib',(.43,.24,.09)),('Jade',(.06,.28,.23)),('Cream',(.75,.60,.34)),('Soil',(.065,.044,.023)),('Leaf',(.07,.29,.10)),('GoldPetal',(.94,.43,.03)),('OrangePetal',(.82,.20,.018)),('Iron',(.10,.11,.105))]:material(n,c,.8)
boat=empty('GardenBoat');hull=empty('BoatHull',boat)
# Rounded cross-sections create an open, thin-walled hull with a lifted pointed bow.
sections=[(-1.65,.03,.25),(-1.4,.37,.10),(-.9,.53,0),(.9,.53,0),(1.45,.29,.17),(1.8,.018,.45)]
for side in [-1,1]:
 for course in range(4):
  lo=course/4;hi=(course+1)/4
  v=[]
  for x,w,lift in sections:
   for t in [lo,hi]:v.append((x,-.25+lift+t*.64,side*w*(.54+.46*t)))
  o=mesh('Caulked hull plank',v,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(sections)-1)],'Jade' if course==3 else 'Teak',hull,True)
  mod=o.modifiers.new('Plank thickness','SOLIDIFY');mod.thickness=.035
 curve('Rounded gunwale',[(x,.4+lift,side*w) for x,w,lift in sections],.033,'Cream',hull)
 for x in [-1.1,-.5,.1,.7,1.2]:
  w=.48 if abs(x)<1 else .38
  curve('Bent timber rib',[(x,.32,-w),(x,-.15,-w*.57),(x,-.21,0),(x,-.15,w*.57),(x,.32,w)],.022,'Rib',hull)
for z in [-.22,0,.22]:box('Floorboard',(2.4,.055,.20),(0,-.15,z),'Rib',hull,.012)
for x in [-1.04,.91]:box('Cross seat',(.23,.07,.93),(x,.23,0),'Teak',hull,.018)
for x in [-1.47,1.52]:beam('Mooring eye',(x,.47,-.065),(x,.47,.065),.03,'Iron',hull,10)
pole=empty('BoatPole',boat)
beam('Push pole',(-.95,-.2,-.72),(-.62,1.38,-.43),.025,'Rib',pole,10)
box('Pole foot',(.12,.27,.045),(-.99,-.18,-.74),'Teak',pole,.025)
tray=empty('FlowerTray')
box('Tray base',(.62,.10,.42),(0,.05,0),'Teak',tray,.014)
for side in [-1,1]:
 box('Tray rim',(.67,.11,.035),(0,.13,side*.22),'Rib',tray,.008)
 box('Tray handle',(.035,.17,.44),(side*.32,.16,0),'Rib',tray,.01)
box('Dark soil',(.59,.018,.39),(0,.105,0),'Soil',tray,0)
for i,(x,z,h) in enumerate([(-.2,-.09,.35),(0,.08,.42),(.2,-.07,.37)]):
 beam('Marigold stem',(x,.1,z),(x,h,z),.012,'Leaf',tray,6)
 for a in [0,2.5,4.5]:
  mesh('Serrated leaf',[(x,h*.6,z),(x+math.cos(a)*.14,h*.6+.06,z+math.sin(a)*.14),(x+math.cos(a+.5)*.065,h*.6+.025,z+math.sin(a+.5)*.065)],[(0,1,2)],'Leaf',tray)
 for ring in range(2):
  for j in range(9):
   a=j*math.tau/9+ring*.23;r=.052 if ring else .081
   bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,location=(x+math.cos(a)*r,-z-math.sin(a)*r,h+ring*.035))
   o=bpy.context.object;o.name='Ruffled marigold petal';o.scale=(.045,.035,.031);o.parent=tray;o.data.materials.append(MATS['GoldPetal' if i%2 else 'OrangePetal'])
root=empty('GardenDeliveryPack');boat.parent=root;tray.parent=root;bake_parts(root)
# Keep named structural groups; the runtime positions/clones the tray separately.
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(MODELS/'canal-garden-boat.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
(OUT/'manifest.json').write_text(json.dumps({'triangles':triangles,'bytes':(MODELS/'canal-garden-boat.glb').stat().st_size},indent=2))
tray.location=(.15,0,.12)
material('Studio',(.09,.15,.16),.9);box('Studio floor',(14,.05,14),(0,-.35,0),'Studio',None,0)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.world.color=(.24,.26,.28)
for p,power,size in [((2,-4,7),1100,6),((-4,3,5),900,5)]:
 bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,.3))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(4,-5,4));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.3))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=5;scene.camera=camera
scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'canal-garden-boat.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'canal-garden-boat.blend'));bpy.ops.render.render(write_still=True)
print('CANAL_GARDEN_BOAT_EXPORTED',triangles)
