"""Original Sukhumvit boutique-hotel furnishings, authored in game Y-up metres."""
import sys, math, json
from mathutils import Matrix
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_landmarks import bpy, Vector, ROOT, MODELS, SOURCE, material, empty, box, mesh, beam, curve, bake_parts
from hotel_wall_craft import build_wall_craft
OUT=ROOT/'artifacts/blender-hotel'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for name,color,rough,metal in [
    ('Teak',(.27,.12,.052),.6,0),('Dark teak',(.10,.045,.021),.7,0),
    ('Honey cane',(.56,.36,.16),.82,0),('Cane shadow',(.22,.14,.065),.9,0),
    ('Brass',(.66,.43,.15),.31,.72),('Ivory linen',(.85,.80,.67),.96,0),
    ('Jade silk',(.075,.25,.22),.74,0),('Gold silk',(.64,.41,.15),.8,0),
    ('Celadon',(.19,.40,.32),.24,0),('Green stone',(.095,.19,.16),.3,.1),
    ('Paper',(.89,.82,.65),.87,0),('Ink',(.095,.15,.14),.9,0),
    ('Leaf',(.10,.25,.12),.8,0),('Petal',(.93,.84,.64),.6,0)]: material(name,color,rough,metal)

def rounded(name,w,d,y,h,r,at,mat,parent):
    ring=[]
    for cx,cz,a in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
        for i in range(7):
            angle=math.radians(a+i*15)
            ring.append((cx+r*math.cos(angle),cz+r*math.sin(angle)))
    n=len(ring); verts=[(at[0]+x,y+dy,at[1]+z) for dy in [-h/2,h/2] for x,z in ring]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,[tuple(reversed(face)) for face in faces],mat,parent)

def cushion(name,size,at,mat,parent):
    o=box(name,size,at,mat,parent,min(size)*.29)
    for mod in o.modifiers:
        if mod.type=='BEVEL': mod.segments=4
    # Sewn piping follows the actual cushion outline.
    x,y,z=at; w,h,d=size
    points=[(x-w*.44,y,z-d*.46),(x+w*.44,y,z-d*.46),(x+w*.48,y,z-d*.36),
            (x+w*.48,y,z+d*.36),(x+w*.44,y,z+d*.46),(x-w*.44,y,z+d*.46),
            (x-w*.48,y,z+d*.36),(x-w*.48,y,z-d*.36),(x-w*.44,y,z-d*.46)]
    curve(name+' piping',points,.009,'Ivory linen' if mat=='Ivory linen' else 'Gold silk',parent)
    return o

def lathe(name,profile,at,mat,parent,sides=24):
    verts=[(at[0]+r*math.cos(i*math.tau/sides),at[1]+h,at[2]+r*math.sin(i*math.tau/sides)) for r,h in profile for i in range(sides)]
    faces=[(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i) for j in range(len(profile)-1) for i in range(sides)]
    return mesh(name,verts,[tuple(reversed(face)) for face in faces],mat,parent,True)

root=empty('SukhumvitHotelFurnishings')
bed=empty('GuestBed',root); sofa=empty('LobbySofa',root); desk=empty('Reception',root); props=empty('ReceptionObjects',root)
# Origin (-54,0,29.5). Every solid stays in an existing furniture collision footprint.
bx,bz=-4,3
for x in [-1.65,1.65]:
    for z in [-1.18,1.18]:
        box('Bed foot',(.17,.33,.17),(bx+x,.255,bz+z),'Dark teak',bed,.025)
        box('Brass foot collar',(.18,.07,.18),(bx+x,.20,bz+z),'Brass',bed,.01)
rounded('Teak bed frame',3.94,2.94,.44,.25,.11,(bx,bz),'Teak',bed)
rounded('Bed frame bead',3.96,2.96,.52,.035,.11,(bx,bz),'Brass',bed)
cushion('Deep mattress',(3.78,.27,2.65),(bx,.69,bz-.05),'Ivory linen',bed)
cushion('Folded jade coverlet',(3.80,.09,1.17),(bx,.865,bz-.72),'Jade silk',bed)
for z in [-1.15,-1.03]: box('Silk woven border',(3.65,.01,.035),(bx,.914,bz+z),'Gold silk',bed,.002)
for x in [-.88,.88]:
    cushion('Linen pillow',(1.40,.25,.61),(bx+x,.94,bz+.85),'Ivory linen',bed)
    cushion('Jade accent cushion',(.55,.20,.45),(bx+x,1.02,bz+.46),'Jade silk',bed)
box('Carved headboard',(3.94,1.24,.12),(bx,.82,bz+1.41),'Teak',bed,.045)
for x in [-1.01,1.01]:
    box('Woven headboard inset',(1.68,.60,.035),(bx+x,1.04,bz+1.33),'Cane shadow',bed,.025)
    for i in range(16):
        xx=bx+x-.76+i*.10
        beam('Fine cane upright',(xx,.76,bz+1.304),(xx,1.32,bz+1.304),.012,'Honey cane',bed,6)
    for y in [.79,.91,1.03,1.15,1.27]: beam('Cane cross weave',(bx+x-.80,y,bz+1.29),(bx+x+.80,y,bz+1.29),.009,'Honey cane',bed,6)
    for edge in [-.86,.86]: box('Inset gold edge',(.028,.66,.025),(bx+x+edge,1.04,bz+1.30),'Brass',bed,.004)
curve('Headboard crown',[(bx-1.92,1.44,bz+1.41),(bx-1,1.52,bz+1.41),(bx,1.57,bz+1.41),(bx+1,1.52,bz+1.41),(bx+1.92,1.44,bz+1.41)],.04,'Teak',bed)
# Low woven settee with a sculpted rail and three soft seats.
sx,sz=3.5,2.5
for x in [-1.26,1.26]:
    for z in [-.68,.68]: beam('Sofa tapered leg',(sx+x,.09,sz+z),(sx+x*.96,.45,sz+z*.94),.055,'Teak',sofa,12)
rounded('Settee seat rail',2.86,1.70,.41,.18,.09,(sx,sz),'Teak',sofa)
box('Settee back',(2.82,.69,.10),(sx,.87,sz+.83),'Cane shadow',sofa,.025)
for i in range(25):
    x=sx-1.30+i*.108
    beam('Woven back upright',(x,.58,sz+.766),(x,1.16,sz+.766),.014,'Honey cane',sofa,6)
for y in [.61,.72,.83,.94,1.05,1.16]: beam('Woven back strand',(sx-1.34,y,sz+.75),(sx+1.34,y,sz+.75),.009,'Honey cane',sofa,6)
rail=curve('Swept settee top rail',[(sx-1.40,.89,sz-.58),(sx-1.40,1.12,sz+.64),(sx-1.25,1.23,sz+.83),(sx,1.27,sz+.85),(sx+1.25,1.23,sz+.83),(sx+1.40,1.12,sz+.64),(sx+1.40,.89,sz-.58)],.044,'Teak',sofa)
for x in [-1.40,1.40]:
    for z in [-.55,.46]: beam('Settee arm upright',(sx+x,.46,sz+z),(sx+x,.87,sz+z),.032,'Teak',sofa)
for x in [-.89,0,.89]:
    cushion('Jade seat',(.85,.23,1.31),(sx+x,.62,sz-.06),'Jade silk',sofa)
    cushion('Back cushion',(.84,.53,.24),(sx+x,.95,sz+.53),'Jade silk',sofa)
cushion('Ochre throw pillow',(.46,.38,.28),(sx-.95,.88,sz+.15),'Gold silk',sofa)
# Rounded green-stone reception with fluted teak, inset woven panels and gold bands.
dx,dz=5,-4.95
rounded('Recessed toe kick',5.68,.84,.20,.22,.18,(dx,dz),'Dark teak',desk)
rounded('Curved teak cabinet',5.84,.96,.69,.87,.26,(dx,dz),'Teak',desk)
rounded('Counter lower bead',5.94,1.02,1.11,.035,.26,(dx,dz),'Brass',desk)
rounded('Polished green stone',5.96,1.08,1.175,.095,.28,(dx,dz),'Green stone',desk)
for x in [dx-1.8,dx,dx+1.8]:
    box('Recessed cane panel',(1.63,.64,.02),(x,.68,dz+.485),'Cane shadow',desk,.015)
    for i in range(16):
        xx=x-.74+i*.098
        beam('Panel vertical cane',(xx,.385,dz+.502),(xx,.965,dz+.502),.013,'Honey cane',desk,6)
    for y in [.43,.55,.67,.79,.91]: beam('Panel woven band',(x-.79,y,dz+.52),(x+.79,y,dz+.52),.008,'Honey cane',desk,6)
    for xx in [x-.85,x+.85]: box('Panel brass stile',(.028,.70,.02),(xx,.68,dz+.526),'Brass',desk,.005)
for y in [.31,1.04]: box('Continuous gold reveal',(5.22,.028,.02),(dx,y,dz+.505),'Brass',desk,.004)
for x in [-2.57,-1.02,1.02,2.57]: box('Fluted teak pier',(.10,.77,.045),(dx+x,.69,dz+.505),'Teak',desk,.024)
for x in [-1.9,0,1.9]:
    box('Staff drawer',(1.64,.45,.03),(dx+x,.77,dz-.485),'Dark teak',desk,.012)
    curve('Drawer handle',[(dx+x-.13,.86,dz-.495),(dx+x-.1,.89,dz-.51),(dx+x+.1,.89,dz-.51),(dx+x+.13,.86,dz-.495)],.012,'Brass',desk)
# Original objects make the check-in desk a place with a purpose.
lathe('Reception bell',[(0,0),(.14,0),(.15,.035),(.13,.055),(.12,.10),(.075,.16),(0,.175)],(dx+.82,1.225,dz+.17),'Brass',props)
beam('Bell plunger',(dx+.82,1.38,dz+.17),(dx+.82,1.435,dz+.17),.017,'Brass',props,16)
lathe('Bell button',[(0,0),(.04,0),(.045,.015),(0,.027)],(dx+.82,1.432,dz+.17),'Brass',props,16)
box('Guest book cover',(.74,.027,.43),(dx-.43,1.237,dz+.03),'Jade silk',props,.02)
for side in [-1,1]:
    mesh('Open guest book pages',[(dx-.43,1.27,dz-.16),(dx-.43+side*.33,1.29,dz-.16),(dx-.43+side*.33,1.29,dz+.22),(dx-.43,1.27,dz+.22)],[(0,1,2,3),(3,2,1,0)],'Paper',props)
    for i in range(5): box('Guest book ruling',(.24,.004,.007),(dx-.43+side*.17,1.293,dz-.09+i*.055),'Ink',props,0)
beam('Reception pen',(dx+.08,1.24,dz+.23),(dx+.20,1.24,dz-.05),.009,'Brass',props,10)
lathe('Celadon flower vase',[(0,0),(.14,0),(.18,.08),(.15,.23),(.065,.34),(.065,.39),(.045,.39),(.045,.31)],(dx+2.23,1.225,dz),'Celadon',props)
for i in range(3):
    x=dx+2.23+(i-1)*.13; z=dz+(i%2)*.10; y=1.92+(i%2)*.12
    curve('Flower stem',[(dx+2.23,1.54,dz),(x+.06,1.78,z),(x,y,z)],.008,'Leaf',props)
    for k in range(5):
        a=k*math.tau/5
        verts=[(x,y,z),(x+.08*math.cos(a-.5),y+.035,z+.08*math.sin(a-.5)),(x+.13*math.cos(a),y+.015,z+.13*math.sin(a)),(x+.08*math.cos(a+.5),y+.035,z+.08*math.sin(a+.5))]
        mesh('Cream flower petal',verts,[(0,1,2,3),(3,2,1,0)],'Petal',props,True)
    lathe('Golden flower heart',[(0,0),(.025,.015),(0,.035)],(x,y+.015,z),'Gold silk',props,12)
lathe('Celadon welcome tray',[(0,0),(.26,0),(.28,.025),(.27,.045),(.245,.028),(0,.025)],(dx-2.1,1.225,dz),'Celadon',props)
for x in [-.11,.11]: lathe('Welcome tea cup',[(0,0),(.055,0),(.065,.10),(.052,.105),(.047,.04),(0,.035)],(dx-2.1+x,1.255,dz),'Celadon',props,16)

# Face the bed and settee into the open camera side of the cutaway hotel.
for part,x,z in [(bed,bx,bz),(sofa,sx,sz)]:
    width=Matrix.Diagonal((.97 if part==sofa else 1,1,1,1))
    transform=Matrix.Translation((x,-z,0)) @ Matrix.Rotation(math.pi,4,'Z') @ width @ Matrix.Translation((-x,z,0))
    for child in part.children: child.matrix_world=transform @ child.matrix_world
build_wall_craft(root)
bake_parts(root)
bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
for o in root.children_recursive: o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(MODELS/'hotel-furnishings.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
material('Studio',(.16,.20,.19),.95); box('Studio floor',(30,.04,26),(0,.04,0),'Studio',None,0)
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True; scene.world.color=(.23,.23,.23)
for pos,power,size in [((0,-3,11),2400,10),((-8,7,8),2200,8)]:
    bpy.ops.object.light_add(type='AREA',location=pos); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.rotation_euler=(Vector((0,0,.5))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(13,-17,15)); camera=bpy.context.object; camera.rotation_euler=(Vector((.8,0,.5))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=21; scene.camera=camera
scene.render.resolution_x=1500; scene.render.resolution_y=1100; scene.render.resolution_percentage=100; scene.view_settings.view_transform='AgX'; scene.render.filepath=str(OUT/'hotel-furnishings.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'hotel-furnishings.blend')); bpy.ops.render.render(write_still=True)
(OUT/'manifest.json').write_text(json.dumps({'triangles':triangles,'bytes':(MODELS/'hotel-furnishings.glb').stat().st_size,'parts':['GuestBed','LobbySofa','Reception','ReceptionObjects','BedroomWallCraft']},indent=2))
# A second studio view makes the relief depth and open lantern cages reviewable.
camera.location=(1,-.8,5)
camera.rotation_euler=(Vector((-7.6,-1.55,2.15))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.ortho_scale=9.5
scene.render.filepath=str(OUT/'hotel-wall-craft.png')
bpy.ops.render.render(write_still=True)
print('HOTEL_FURNISHINGS_EXPORTED',triangles)
