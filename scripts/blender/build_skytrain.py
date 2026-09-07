"""Original Bangkok-inspired elevated railway. Geometry is authored at game origins."""
import sys, math, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_landmarks import bpy,Vector,ROOT,MODELS,SOURCE,material,empty,box,mesh,beam,curve,bake_parts
OUT=ROOT/'artifacts/blender-skytrain';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for name,color,rough,metal in [
 ('Porcelain white',(.73,.77,.72),.36,.25),('Metro red',(.48,.035,.028),.35,.3),
 ('Metro blue',(.035,.09,.16),.42,.25),('Window glass',(.027,.09,.12),.19,.35),
 ('Window highlight',(.16,.32,.35),.22,.4),('Running gear',(.035,.045,.052),.6,.6),
 ('Brushed steel',(.32,.38,.39),.4,.75),('Concrete',(.38,.43,.41),.86,0),
 ('Pier recess',(.23,.29,.29),.86,0),('Rail bed',(.24,.29,.29),.9,0)]:material(name,color,rough,metal)
material('Cab lamp',(.98,.77,.37),.3,.2,1.2)
root=empty('SukhumvitRailway');train=empty('Skytrain',root);guide=empty('Guideway',root)
carBodies=empty('CarBodies',train);glazing=empty('CabGlazing',train);gear=empty('BogieFrames',train)
def shell(name,cx):
    # Eight-sided carriage section, with chamfered roof and lower skirt.
    section=[(-.65,.34),(-.80,.48),(-.80,1.21),(-.61,1.43),(.61,1.43),(.80,1.21),(.80,.48),(.65,.34)]
    vertices=[(cx+x,y,z*scale) for x,scale in [(-1.98,.91),(-1.77,1),(1.77,1),(1.98,.91)] for z,y in section]
    faces=[tuple(reversed(range(8))),tuple(range(24,32))]+[(r*8+i,r*8+(i+1)%8,(r+1)*8+(i+1)%8,(r+1)*8+i) for r in range(3) for i in range(8)]
    return mesh(name,vertices,faces,'Porcelain white',carBodies)
for cx in [-2.1,2.1]:
    shell('Chamfered metro carriage',cx)
    for side in [-1,1]:
        box('Red waist stripe',(3.82,.19,.022),(cx,.53,side*.795),'Metro red',carBodies,.007)
        box('Blue lower stripe',(3.78,.08,.025),(cx,.39,side*.747),'Metro blue',carBodies,.008)
        for dx in [-.86,.86]:
            box('Twin sliding door frame',(.62,.80,.025),(cx+dx,.85,side*.806),'Brushed steel',carBodies,.015)
            for half in [-1,1]:
                box('Door leaf',(.28,.74,.029),(cx+dx+half*.15,.85,side*.826),'Porcelain white',carBodies,.008)
                box('Door glazing',(.20,.37,.014),(cx+dx+half*.15,1.01,side*.85),'Window glass',glazing,.016)
                box('Door lower red stripe',(.28,.17,.015),(cx+dx+half*.15,.54,side*.848),'Metro red',carBodies,.003)
            box('Door safety sill',(.65,.04,.09),(cx+dx,.43,side*.79),'Brushed steel',carBodies,.008)
        for dx,width in [(-1.53,.42),(0,.78),(1.53,.42)]:
            box('Dark window gasket',(width+.065,.52,.035),(cx+dx,.99,side*.805),'Running gear',glazing,.035)
            box('Passenger window',(width,.455,.028),(cx+dx,1,side*.83),'Window glass',glazing,.024)
            box('Window reflection',(width*.83,.035,.008),(cx+dx,1.16,side*.847),'Window highlight',glazing,.002)
        for axle in [-1.38,1.38]:
            box('Bogie side frame',(.78,.16,.17),(cx+axle,.20,side*.62),'Running gear',gear,.035)
            for dx in [-.23,.23]:beam('Steel wheel',(cx+axle+dx,.14,side*.56),(cx+axle+dx,.14,side*.73),.14,'Running gear',gear,16)
            for dx in [-.18,.18]:box('Suspension block',(.14,.09,.18),(cx+axle+dx,.31,side*.6),'Brushed steel',gear,.02)
    box('Undercarriage',(3.65,.16,1.18),(cx,.31,0),'Running gear',gear,.035)
    box('Roof air conditioning',(1.55,.17,1.1),(cx,1.47,0),'Brushed steel',carBodies,.035)
    for dx in range(10):box('Roof vent fin',(.033,.019,.85),(cx-.62+dx*.137,1.565,0),'Running gear',carBodies,.002)
# Recessed cab glazing and paired lamps on the two outer ends.
for side in [-1,1]:
    x=side*4.087
    box('Cab windscreen',(.019,.43,1.03),(x,1.01,0),'Window glass',glazing,.018)
    box('Destination display',(.022,.095,.53),(x,1.29,0),'Metro blue',glazing,.01)
    box('Amber route display',(.024,.025,.28),(x+side*.009,1.29,0),'Cab lamp',glazing,.003)
    for z in [-.49,.49]:box('Twin cab headlamp',(.032,.085,.15),(x+side*.009,.57,z),'Cab lamp',glazing,.02)
    beam('Windscreen wiper',(x+side*.015,.82,-.12),(x+side*.018,1.12,.18),.011,'Brushed steel',glazing,6)
box('Flexible gangway',(.25,.76,1.35),(0,.79,0),'Running gear',gear,.025)
for x in [-.08,-.04,0,.04,.08]:box('Gangway fold',(.018,.80,1.39),(x,.79,0),'Brushed steel',gear,.003)
# The five existing piers retain their original footprint; only the caps spread above head height.
guideRoot=guide
guide=empty('CivilStructure',guideRoot)
for x in [-14,-7,0,7,14]:
    box('Concrete pier',(.50,3.96,.80),(x,1.98,0),'Concrete',guide,.055)
    for z in [-.395,.395]:box('Pier recessed strip',(.22,3.25,.006),(x,1.85,z),'Pier recess',guide,0)
    box('Cantilever pier cap',(1.25,.30,2.48),(x,3.96,0),'Concrete',guide,.08)
    for z in [-.68,.68]:box('Bridge bearing',(.62,.12,.5),(x,4.14,z),'Running gear',guide,.015)
box('Precast track deck',(30,.28,2.7),(0,4.31,0),'Concrete',guide,.025)
box('Track bed',(30,.06,2.2),(0,4.48,0),'Rail bed',guide,.006)
for x in range(-29,30):box('Concrete sleeper',(.17,.055,2.05),(x*.5,4.51,0),'Concrete',guide,0)
for z in [-.7,.7]:
    box('Rail web',(30,.09,.055),(0,4.56,z),'Brushed steel',guide,.005)
    box('Rail running surface',(30,.035,.12),(0,4.6025,z),'Brushed steel',guide,.006)
for z in [-1.27,1.27]:
    box('Walkway edge',(30,.21,.12),(0,4.49,z),'Concrete',guide,.015)
    for y in [4.79,5.08]:beam('Maintenance handrail',(-15,y,z),(15,y,z),.024,'Brushed steel',guide,8)
    for x in range(-15,16,2):beam('Rail upright',(x,4.55,z),(x,5.08,z),.019,'Brushed steel',guide,8)
for parent in [train,guideRoot]:bake_parts(parent)
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(MODELS/'sukhumvit-railway.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
(OUT/'manifest.json').write_text(json.dumps({'triangles':triangles,'bytes':(MODELS/'sukhumvit-railway.glb').stat().st_size,'parts':['Skytrain','Guideway','CarBodies','CabGlazing','BogieFrames']},indent=2))
# The source scene presents the car on the guideway. Runtime uses the separately exported origins.
train.location.z=4.62
material('Studio',(.09,.14,.15),.95);box('Studio floor',(45,.05,18),(0,-.04,0),'Studio',None,0)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.world.color=(.18,.2,.22)
for p,power,size in [((2,5,13),2400,8),((-7,-4,9),1800,7)]:
 bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,3))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(10,-15,10));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,4))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=13;scene.camera=camera
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'sukhumvit-railway.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'sukhumvit-railway.blend'));bpy.ops.render.render(write_still=True)
print('SUKHUMVIT_RAILWAY_EXPORTED',triangles)
