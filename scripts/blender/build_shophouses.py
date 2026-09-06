"""Original street architecture. Run with Blender 4.2 --background --python this-file.
Five by three metre footprint, fixed 2.6m ground floor, independently scalable upper floors.
"""
import sys, json, math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_landmarks import bpy, Vector, ROOT, MODELS, SOURCE, MATS, material, empty, box, beam, curve, mesh, bake_parts

PREVIEW = ROOT / 'artifacts/blender-shophouses'
PREVIEW.mkdir(parents=True, exist_ok=True)

def colors(modern):
    MATS.clear()
    material('Plaster', (.30,.43,.43) if modern else (.64,.38,.21), .88)
    material('Ivory', (.72,.69,.54), .76)
    material('Stone', (.25,.29,.28), .9)
    material('Timber', (.075,.13,.12) if modern else (.12,.20,.15), .64)
    material('Glass', (.11,.22,.25), .28, .18)
    material('Iron', (.045,.08,.085), .52, .35)
    material('Brass', (.55,.34,.12), .42, .5)
    material('Awning', (.32,.41,.29) if modern else (.43,.085,.055), .72)

def framed_window(parent, x, y, z, rear=False, modern=False):
    facing=-1 if rear else 1
    # Recesses sit behind a raised stone surround, with shutters distinct from glass.
    box('Recess', (1.45,1.62,.06), (x,y,z), 'Iron',parent,0)
    box('Glazing', (1.2,1.4,.065), (x,y,z+facing*.045), 'Glass',parent,0)
    for dx in (-.76,.76): box('Window jamb',(.09,1.8,.13),(x+dx,y,z+facing*.08),'Ivory',parent,.012)
    for dy in (-.87,.87): box('Sill and lintel',(1.65,.1,.19),(x,y+dy,z+facing*.1),'Ivory',parent,.015)
    box('Meeting stile',(.055,1.5,.12),(x,y,z+facing*.1),'Timber',parent,0)
    if modern:
        for dx in (-.44, .44): box('Glass mullion',(.035,1.5,.11),(x+dx,y,z+facing*.08),'Brass',parent,0)
        box('Window transom',(1.3,.04,.1),(x,y+.35,z+facing*.08),'Brass',parent,0)
    else:
        for dx in (-.49,.49):
            box('Timber shutter',(.35,1.42,.1),(x+dx,y,z+facing*.13),'Timber',parent,.012)
            for j in range(8): box('Shutter louvre',(.29,.045,.045),(x+dx,y-.56+j*.16,z+facing*.2),'Ivory',parent,0)
        curve('Arched hood',[(x-.83,y+.87,z),(x-.6,y+1.05,z),(x,y+1.15,z),(x+.6,y+1.05,z),(x+.83,y+.87,z)],.045,'Ivory',parent)

def shop(modern):
    root=empty('SukhumvitShophouse' if modern else 'YaowaratShophouse')
    lower=empty('ShopLower',root); upper=empty('ShopUpper',root)
    # Upper geometry is authored in local coordinates, then raised to the ground-floor seam.
    box('Ground-floor shell',(4.84,2.6,2.82),(0,1.3,0),'Plaster',lower,.025)
    for x in (-2.39,2.39): box('Stone pier',(.19,2.55,2.94),(x,1.3,0),'Ivory',lower,.018)
    box('Shop fascia',(4.7,.30,.10),(0,2.38,1.43),'Awning',lower,.025)
    for x in (-1.48,1.48):
        box('Display recess',(1.36,1.7,.055),(x,1.17,1.44),'Iron',lower,0)
        box('Display glass',(1.18,1.5,.04),(x,1.17,1.475),'Glass',lower,0)
        for dx in (-.65,.65): box('Display frame',(.05,1.75,.06),(x+dx,1.17,1.465),'Brass',lower,0)
        for y in (.34,1.24,2.02): box('Display shelf',(1.31,.04,.06),(x,y,1.465),'Ivory',lower,0)
    box('Door recess',(1.08,2.12,.05),(0,1.1,1.44),'Iron',lower,0)
    for x in (-.245,.245):
        box('Door leaf',(.46,2.02,.045),(x,1.08,1.472),'Timber',lower,0)
        box('Door glass',(.33,1.18,.015),(x,1.35,1.498),'Glass',lower,0)
        box('Door kickplate',(.34,.37,.015),(x,.43,1.498),'Brass',lower,0)
    # Door handles are inside the collision footprint, as are all sub-head-height details.
    box('Rear service door',(.9,1.98,.07),(.8,1.08,-1.44),'Timber',lower,.012)
    for x in (-1.5,-.9): box('Rear vent',(.45,.5,.06),(x,1.73,-1.445),'Iron',lower,0)
    for j in range(10):
        box('Striped canopy',(.46,.07,.62),(-2.07+j*.46,2.55,1.66),'Ivory' if j%2 else 'Awning',lower,.006)
    # Two upper storeys with genuine balcony depth and a worked skyline.
    box('Upper shell',(4.84,4.3,2.82),(0,2.15,0),'Plaster',upper,.025)
    for y in (.03,2.2,4.28): box('String course',(4.96,.12,2.98),(0,y,0),'Ivory',upper,.018)
    for x in (-2.36,0,2.36): box('Facade pilaster',(.16,4.28,.12),(x,2.15,1.43),'Ivory',upper,.014)
    for y in (1.05,3.15):
        for x in (-1.16,1.16): framed_window(upper,x,y,1.45,modern=modern)
        for x in (-1.15,1.15): framed_window(upper,x,y,-1.45,rear=True,modern=True)
        # Side elevations retain visible construction instead of blank cubes.
        for x in (-2.445,2.445):
            for z in (-.63,.63):
                box('Side window',(.035,1.3,.74),(x,y,z),'Glass',upper,0)
                for dy in (-.7,.7): box('Side sill',(.08,.07,.89),(x,y+dy,z),'Ivory',upper,.008)
        if modern:
            box('Balcony slab',(4.6,.10,.60),(0,y-.8,1.67),'Ivory',upper,.02)
            for rail_y in (y-.42,y-.05): box('Balcony rail',(4.56,.045,.045),(0,rail_y,1.93),'Iron',upper,0)
            for i in range(16): box('Balcony baluster',(.025,.75,.035),(-2.2+i*.293,y-.43,1.93),'Iron',upper,0)
            for x in (-2.11,2.11):
                for j in range(4): box('Vertical sun screen',(.055,1.48,.4),(x+j*.085*(1 if x<0 else -1),y,1.68),'Timber',upper,0)
        else:
            for x in (-1.16,1.16):
                box('Flower box',(1.48,.23,.32),(x,y-.7,1.65),'Timber',upper,.018)
                for j in range(5):
                    beam('Foliage spray',(x-.53+j*.265,y-.58,1.65),(x-.57+j*.27,y-.35+(j%2)*.09,1.65),.08,'Awning',upper,5)
    # Cornice, corner caps and relief give each district a recognisable skyline.
    box('Coping',(5.04,.14,3.08),(0,4.4,0),'Ivory',upper,.025)
    for x in (-2.27,2.27): box('Parapet return',(.16,.28,2.94),(x,4.58,0),'Plaster',upper,.015)
    box('Parapet face',(4.7,.32,.15),(0,4.6,1.43),'Plaster',upper,.02)
    if not modern:
        curve('Sculpted pediment',[(-1.2,4.72,1.43),(-.8,4.78,1.43),(0,5.04,1.43),(.8,4.78,1.43),(1.2,4.72,1.43)],.065,'Ivory',upper)
        for x in (-2.28,2.28):
            box('Capital',(.35,.13,.36),(x,4.81,1.35),'Ivory',upper,.025)
            beam('Finial',(x,4.86,1.35),(x,5.05,1.35),.10,'Brass',upper,8)
    else:
        box('Roof utility',(1.12,.42,.77),(.9,4.56,-.7),'Stone',upper,.025)
        for j in range(6): box('Condenser grille',(.82,.035,.025),(.9,4.43+j*.055,-.3),'Iron',upper,0)
    upper.location.z=2.6
    return root

def export(modern):
    name='sukhumvit-shophouse' if modern else 'yaowarat-shophouse'
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    colors(modern); root=shop(modern); bake_parts(root)
    bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
    for o in root.children_recursive: o.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(MODELS/(name+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
    triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
    box('Studio floor',(40,.1,40),(0,-.08,0),'Stone',None,0)
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=20; scene.cycles.use_denoising=True; scene.world.color=(.25,.25,.25)
    for location,power,size in (((-5,-7,11),1800,7),((7,2,8),1500,6)):
        bpy.ops.object.light_add(type='AREA',location=location); lamp=bpy.context.object; lamp.data.energy=power;lamp.data.size=size
        lamp.rotation_euler=(Vector((0,0,3))-lamp.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(10,-14,10)); camera=bpy.context.object; camera.rotation_euler=(Vector((0,0,3.5))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=11;scene.camera=camera
    scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.filepath=str(PREVIEW/(name+'.png'))
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'.blend')));bpy.ops.render.render(write_still=True)
    return {'name':name,'triangles':triangles,'bytes':(MODELS/(name+'.glb')).stat().st_size}

if __name__=='__main__':
    result=[export(True),export(False)]
    (PREVIEW/'manifest.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print('SHOPHOUSES_EXPORTED',json.dumps(result))
