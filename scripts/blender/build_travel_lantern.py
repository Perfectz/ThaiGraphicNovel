"""Original carved and paper travel lamps for Arun's negotiation encounter."""
import sys, math, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_landmarks import bpy, Vector, ROOT, MODELS, SOURCE, material, empty, box, mesh, beam, curve, bake_parts
OUT=ROOT/'artifacts/travel-lantern';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
material('Teak',(.19,.07,.025),.65);material('Brass',(.62,.38,.105),.35,.65)
material('Paper',(.89,.69,.33),.8,0,.5);material('Glass',(.95,.43,.08),.4,0,1.5)
material('Bamboo',(.54,.34,.13),.8);material('Jade',(.05,.24,.19),.4)
root=empty('TravelLanterns');parts={name:empty(name,root) for name in ['Carved','Paper']}
for name,p in parts.items():
    carved=name=='Carved';frame='Teak' if carved else 'Bamboo'
    for y in (.035,.47):
        box('Frame cap',(.34,.055,.34),(0,y,0),frame,p,.018)
        if carved:box('Brass lip',(.365,.012,.365),(0,y+.03,0),'Brass',p,.01)
    for x in (-.145,.145):
        for z in (-.145,.145):beam('Lamp upright',(x,.05,z),(x,.49,z),.018,frame,p,8)
    for x in (-.133,.133):box('Warm side',(.014,.37,.26),(x,.25,0),'Glass' if carved else 'Paper',p,.002)
    for z in (-.133,.133):box('Warm face',(.26,.37,.014),(0,.25,z),'Glass' if carved else 'Paper',p,.002)
    if carved:
        for z in (-.15,.15):
            for x in (-.09,0,.09):
                curve('Carved petal',[(x,.09,z),(x-.026,.24,z),(x,.40,z),(x+.026,.24,z),(x,.09,z)],.007,'Brass',p)
        for x in (-.15,.15):
            for z in (-.085,0,.085):beam('Lattice bar',(x,.08,z),(x,.44,z),.006,'Brass',p)
        box('Jade crown',(.22,.045,.22),(0,.525,0),'Jade',p,.015)
    else:
        for y in (.12,.21,.30,.39):
            for z in (-.144,.144):beam('Paper rib',(-.14,y,z),(.14,y,z),.005,'Bamboo',p)
    curve('Carrying handle',[(-.12,.50,0),(-.12,.68,0),(0,.73,0),(.12,.68,0),(.12,.50,0)],.012,'Brass' if carved else 'Bamboo',p)
bake_parts(root)
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(MODELS/'travel-lanterns.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
parts['Carved'].location.x=-.38;parts['Paper'].location.x=.38
material('Studio',(.22,.26,.24),.9);box('Studio floor',(8,.05,8),(0,-.04,0),'Studio',None,0)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.world.color=(.2,.2,.2)
for pos,power,size in [((-2,-3,4),250,3),((3,1,3),180,2)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,.3))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(1.5,-3,1.7));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.32))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=1.7;scene.camera=camera
scene.render.resolution_x=1200;scene.render.resolution_y=950;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'lanterns.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'travel-lanterns.blend'));bpy.ops.render.render(write_still=True)
report={'triangles':triangles,'bytes':(MODELS/'travel-lanterns.glb').stat().st_size,'parts':list(parts)}
(OUT/'manifest.json').write_text(json.dumps(report,indent=2));print('TRAVEL_LANTERNS_EXPORTED',json.dumps(report))
