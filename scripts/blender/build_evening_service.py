"""Visible consequences for the companion outing; Blender 4.2, metre-scale GLB."""
import sys, math, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_landmarks import bpy, Vector, ROOT, MODELS, SOURCE, MATS, material, empty, box, mesh, beam, curve, bake_parts
OUT=ROOT/'artifacts/evening-service'; OUT.mkdir(parents=True,exist_ok=True)

def lathe(name, profile, at, mat, parent, sides=24):
    vertices=[(at[0]+r*math.cos(i*math.tau/sides),at[1]+y,at[2]+r*math.sin(i*math.tau/sides)) for r,y in profile for i in range(sides)]
    faces=[(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i) for j in range(len(profile)-1) for i in range(sides)]
    return mesh(name,vertices,faces,mat,parent,True)

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for name,color,rough,metal in [
    ('Celadon',(.30,.54,.43),.3,0),('Ivory',(.84,.77,.58),.48,0),('Teak',(.22,.09,.035),.67,0),
    ('Brass',(.56,.34,.1),.38,.55),('Broth',(.33,.14,.035),.28,0),('Noodles',(.78,.62,.30),.62,0),
    ('Chilli',(.58,.035,.012),.45,0),('Greens',(.09,.25,.055),.68,0),('Water',(.19,.47,.54),.21,.15),
    ('Tea',(.50,.20,.045),.25,0),('Steel',(.46,.51,.48),.3,.72)]: material(name,color,rough,metal)
root=empty('EveningService')
parts={name:empty(name,root) for name in ['MealBase','MealContents','ChilliAdded','ChilliAside','ParkTable','WaterSet','TeaSet']}
base=parts['MealBase']; food=parts['MealContents']; added=parts['ChilliAdded']; aside=parts['ChilliAside']
box('Serving board',(1.75,.045,.68),(0,.03,0),'Teak',base,.025)
for x in (-.49,.49):
    lathe('Celadon bowl',[(.09,0),(.105,.045),(.19,.08),(.25,.20),(.265,.24),(.25,.25),(.23,.20),(.17,.09),(.0,.065)],(x,.055,0),'Celadon',base)
    lathe('Glazed lip',[(.253,.23),(.269,.245),(.26,.26),(.247,.245)],(x,.055,0),'Ivory',base)
    lathe('Soup',[(0,.205),(.225,.205)],(x,.055,0),'Broth',food)
    for n in range(5):
        curve('Curled noodles',[(x-.13+n*.05,.268,-.13),(x-.15+n*.055,.28,-.045),(x+.12-n*.045,.273,.07),(x+.12-n*.05,.27,.13)],.009,'Noodles',food)
    for n in range(4):
        leaf=box('Fresh greens',(.085,.013,.032),(x-.12+n*.055,.284,.075-(n%2)*.15),'Greens',food,.005); leaf.rotation_euler.z=n*.55
    for n in range(6):
        pepper=box('Red chilli slice',(.026,.012,.018),(x-.11+n*.043,.29,-.10+(n%3)*.08),'Chilli',added,.003);pepper.rotation_euler.z=n
    for offset in (-.017,.017): beam('Chopstick',(x-.21,.32,-.08+offset),(x+.25,.32,.14+offset),.008,'Teak',base,8)
lathe('Chilli saucer',[(0,0),(.10,0),(.13,.035),(.12,.05),(.0,.04)],(0,.055,.16),'Ivory',aside)
for n in range(7): box('Chilli set aside',(.035,.025,.016),(-.07+n*.022,.105,.15+(n%2)*.02),'Chilli',aside,.003)

table=parts['ParkTable']
box('Pavilion serving table',(1.2,.08,.5),(0,.84,0),'Teak',table,.025)
for x in (-.52,.52):
    for z in (-.18,.18): box('Table leg',(.085,.81,.085),(x,.415,z),'Teak',table,.012)
box('Table stretcher',(1.08,.08,.07),(0,.24,0),'Teak',table,.012)
for name,liquid in [('WaterSet','Water'),('TeaSet','Tea')]:
    group=parts[name]
    box('Small serving tray',(.49,.025,.43),(0,.02,0),'Brass',group,.025)
    if name=='WaterSet':
        lathe('Water pitcher',[(0,0),(.10,0),(.12,.055),(.10,.29),(.075,.34),(.065,.33),(.085,.29),(.095,.06),(0,.035)],(0,.035,-.075),'Celadon',group)
        curve('Pitcher handle',[(.095,.10,-.075),(.18,.13,-.075),(.18,.25,-.075),(.09,.29,-.075)],.015,'Celadon',group)
        lathe('Visible cool water',[(0,.285),(.083,.285)],(0,.035,-.075),'Water',group)
    else:
        lathe('Tea flask',[(0,0),(.10,0),(.105,.04),(.105,.32),(.075,.35),(.075,.39),(0,.39)],(0,.035,-.075),'Steel',group)
        lathe('Flask grip',[(.106,.10),(.107,.24)],(0,.035,-.075),'Teak',group)
        lathe('Flask cap',[(0,.39),(.084,.39),(.084,.42),(0,.42)],(0,.035,-.075),'Brass',group)
    for x in (-.15,.15):
        lathe('Two drinking cups',[(0,0),(.052,0),(.065,.11),(.06,.125),(.052,.11),(.045,.025),(0,.025)],(x,.035,.11),'Ivory',group,16)
        lathe('Drink in cup',[(0,.095),(.054,.095)],(x,.035,.11),liquid,group,16)

bake_parts(root)
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(MODELS/'evening-service.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
# Studio arrangement is saved after export; only presentation offsets differ from the game asset.
for name in ['MealBase','MealContents','ChilliAdded','ChilliAside']:parts[name].location.x=-1.25
parts['ParkTable'].location.x=.9
for name,x in [('WaterSet',.62),('TeaSet',1.18)]:parts[name].location=(x,0,.88)
box('Studio floor',(20,.05,20),(0,-.04,0),'Ivory',None,0)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.world.color=(.3,.3,.3)
for pos,power,size in [((-3,-4,6),650,5),((4,1,4),500,4)]:
    bpy.ops.object.light_add(type='AREA',location=pos);lamp=bpy.context.object;lamp.data.energy=power;lamp.data.size=size;lamp.rotation_euler=(Vector((0,0,.4))-lamp.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-5,4));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.35))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=4.6;scene.camera=camera
scene.render.resolution_x=1400;scene.render.resolution_y=950;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'service-models.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'evening-service.blend'));bpy.ops.render.render(write_still=True)
report={'triangles':triangles,'bytes':(MODELS/'evening-service.glb').stat().st_size,'parts':list(parts)}
(OUT/'manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print('EVENING_SERVICE_EXPORTED',json.dumps(report))
