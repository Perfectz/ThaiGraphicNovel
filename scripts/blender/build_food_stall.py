"""Original Yaowarat street-food cart; game origin (35, 0, 17.45), Y-up metres."""
import sys, math, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_landmarks import bpy, Vector, ROOT, MODELS, SOURCE, material, empty, box, mesh, beam, curve, bake_parts

OUT = ROOT / 'artifacts/blender-food-stall'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for name, color, rough, metal in [
    ('Steel', (.43,.49,.47), .34,.72), ('Dark steel', (.075,.105,.10), .48,.65),
    ('Red enamel', (.40,.045,.025), .42,.15), ('Canvas red', (.52,.075,.038), .9,0),
    ('Canvas cream', (.81,.72,.50), .9,0), ('Rubber', (.023,.029,.026), .94,0),
    ('Brass', (.55,.34,.10), .36,.6), ('Celadon', (.21,.45,.34), .3,0),
    ('Timber', (.22,.10,.045), .7,0), ('Broth', (.24,.12,.04), .3,0),
    ('Glass', (.12,.27,.27), .23,.15), ('Chilli', (.55,.04,.012), .7,0),
    ('Greens', (.10,.26,.045), .82,0)]: material(name,color,rough,metal)
material('Warm bulb', (.95,.66,.25), .35,0,2)

def lathe(name, profile, at, mat, parent, sides=24):
    points=[(at[0]+r*math.cos(i*math.tau/sides),at[1]+y,at[2]+r*math.sin(i*math.tau/sides)) for r,y in profile for i in range(sides)]
    faces=[(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i) for j in range(len(profile)-1) for i in range(sides)]
    return mesh(name,points,faces,mat,parent,True)

root=empty('LekFoodStall')
counter=empty('Counter',root); equipment=empty('Equipment',root); canopy=empty('Canopy',root)
# The eastern edge stops at X=35.95 in game coordinates, leaving the Old Town passage open.
box('Steel counter top',(3.20,.07,.94),(-.65,1.075,0),'Steel',counter,.018)
box('Red enamel cabinet',(3.08,.63,.82),(-.65,.69,0),'Red enamel',counter,.045)
for y in (.38,.98): box('Cabinet edge',(3.12,.035,.85),(-.65,y,0),'Steel',counter,.008)
for x in (-1.67,-.65,.37):
    box('Inset drawer',(.90,.47,.025),(x,.69,-.424),'Dark steel',counter,.017)
    box('Drawer face',(.85,.42,.022),(x,.69,-.445),'Steel',counter,.018)
    curve('Drawer pull',[(x-.14,.77,-.46),(x-.11,.80,-.475),(x+.11,.80,-.475),(x+.14,.77,-.46)],.013,'Brass',counter)
    for dx in (-.36,.36):
        for y in (.52,.85): beam('Rivet',(x+dx,y,-.461),(x+dx,y,-.467),.012,'Dark steel',counter,8)
    for i in range(5): box('Vent slot',(.43,.013,.006),(x,.58+i*.034,.421),'Dark steel',counter,0)
for x in (-1.94,.66):
    for z in (-.30,.30):
        beam('Wheel fork',(x,.35,z),(x,.21,z),.038,'Steel',counter)
        beam('Rubber wheel',(x-.075,.21,z),(x+.075,.21,z),.13,'Rubber',counter,24)
        for dx in (-.08,.08): beam('Wheel hub',(x+dx,.21,z),(x+dx+.005,.21,z),.05,'Steel',counter,16)
# Posts remain inside the cart collision footprint. The canopy may project above head height.
for x in (-2.05,.82):
    for z in (-.38,.38):
        beam('Awning upright',(x,.95,z),(x,2.61,z),.025,'Dark steel',counter)
        beam('Post brass sleeve',(x,1.01,z),(x,1.18,z),.029,'Brass',counter)
for z in (-.45,.45): beam('Canopy crossbar',(-2.12,2.60,z),(1.75,2.60,z),.033,'Steel',canopy)
for x in (-2.1,.82,1.70): beam('Canopy side spar',(x,2.58,-.85),(x,2.72,.45),.025,'Steel',canopy)
for i in range(15):
    x=-2.01+i*.27; mat='Canvas cream' if i%2 else 'Canvas red'
    strip=box('Striped canvas',(.274,.045,1.32),(x,2.68,-.22),mat,canopy,.007)
    strip.rotation_euler.x=-.075
    # A shallow scalloped valance gives the canopy a fabric silhouette.
    points=[(x-.137,2.60,-.89),(x+.137,2.60,-.89),(x+.137,2.47,-.89),
            (x+.08,2.42,-.89),(x,2.40,-.89),(x-.08,2.42,-.89),(x-.137,2.47,-.89)]
    mesh('Canvas valance',points,[tuple(range(7)),tuple(reversed(range(7)))],mat,canopy)
for x in (-1.2,.3):
    beam('Lamp cable',(x,2.59,0),(x,2.43,0),.007,'Dark steel',canopy)
    lathe('Enamel lamp shade',[(.14,0),(.12,.05),(.04,.09)],(x,2.33,0),'Red enamel',canopy)
    lathe('Warm work light',[(0,0),(.035,.015),(.042,.05),(.025,.075),(0,.08)],(x,2.28,0),'Warm bulb',canopy,16)
# Keep the existing two-bowl serving board clear at local X=0, Y=1.12, Z=0.
lathe('Stock pot',[(0,0),(.25,0),(.27,.04),(.27,.33),(.285,.35),(.27,.37),(.245,.35),(.24,.055),(0,.045)],(-1.52,1.11,-.09),'Steel',equipment)
lathe('Simmering broth',[(0,.29),(.244,.29)],(-1.52,1.11,-.09),'Broth',equipment)
for x in (-1.83,-1.21): curve('Pot handle',[(x,1.30,-.16),(x-.035,1.37,-.16),(x-.035,1.37,.02),(x,1.30,.02)],.018,'Dark steel',equipment)
beam('Ladle handle',(-1.48,1.44,-.03),(-1.36,1.78,.06),.011,'Timber',equipment)
lathe('Ladle bowl',[(0,0),(.07,.02),(.085,.055)],(-1.48,1.42,-.03),'Steel',equipment,16)
box('Raised ingredient shelf',(.99,.035,.28),(-1.58,1.79,.25),'Steel',equipment,.01)
for x in (-2.06,-1.1): beam('Shelf riser',(x,1.11,.34),(x,1.98,.34),.015,'Steel',equipment)
box('Shelf back panel',(.98,.78,.015),(-1.58,1.55,.37),'Glass',equipment,.007)
for x in (-1.88,-1.54,-1.2):
    lathe('Condiment crock',[(0,0),(.095,0),(.11,.12),(.10,.15),(.085,.14),(.08,.03),(0,.03)],(x,1.81,.24),'Celadon',equipment,16)
    lathe('Chilli and greens',[(0,0),(.084,0)],(x,1.94,.24),'Chilli' if x<-1.7 else 'Greens',equipment,16)
for i in range(4):
    lathe('Stacked spare bowls',[(.08,0),(.12,.06),(.135,.10),(.12,.11),(.10,.06)],(-2.04,1.12+i*.04,-.14),'Celadon',equipment,16)
box('Preparation board',(.30,.025,.31),(-1.12,1.12,-.22),'Timber',equipment,.016)

bake_parts(root)
bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
for o in root.children_recursive: o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(MODELS/'lek-food-stall.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
material('Studio',(.19,.23,.22),.95); box('Studio floor',(25,.06,25),(0,.025,0),'Studio',None,0)
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24; scene.cycles.use_denoising=True; scene.world.color=(.2,.2,.2)
for pos,power,size in [((2,5,7),1100,5),((-5,-3,5),900,4)]:
    bpy.ops.object.light_add(type='AREA',location=pos); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.rotation_euler=(Vector((-.5,0,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(5,8,5)); camera=bpy.context.object; camera.rotation_euler=(Vector((-.35,0,1.4))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=5.7; scene.camera=camera
scene.render.resolution_x=1200; scene.render.resolution_y=1000; scene.render.resolution_percentage=100; scene.view_settings.view_transform='AgX'; scene.render.filepath=str(OUT/'lek-food-stall.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'lek-food-stall.blend')); bpy.ops.render.render(write_still=True)
report={'triangles':triangles,'bytes':(MODELS/'lek-food-stall.glb').stat().st_size,'parts':['Counter','Equipment','Canopy']}
(OUT/'manifest.json').write_text(json.dumps(report,indent=2)); print('FOOD_STALL_EXPORTED',json.dumps(report))
