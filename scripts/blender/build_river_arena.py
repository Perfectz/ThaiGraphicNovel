"""Original Bangkok river-fantasy arena. Run with Blender 4.2, not system Python."""
import sys, math, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_landmarks import bpy, Vector, ROOT, MODELS, SOURCE, material, empty, box, mesh, beam, curve, bake_parts

OUT=ROOT/'artifacts/blender-river-arena'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for name,color,rough,metal in [
    ('River basalt',(.072,.115,.13),.87,.05),('Worn limestone',(.28,.33,.30),.82,0),
    ('Blue slate',(.12,.21,.23),.78,.08),('Pale slate',(.20,.29,.29),.8,.04),
    ('Aged brass',(.57,.36,.12),.38,.65),('Teak',(.17,.073,.034),.68,0),
    ('Glazed jade',(.045,.22,.18),.3,.15),('Patina',(.075,.25,.23),.65,.25)]: material(name,color,rough,metal)
material('Lantern silk',(.96,.49,.14),.65,0,1.1)
root=empty('RiverArena'); floor=empty('StonePlatform',root); lamps=empty('LanternGallery',root); rails=empty('RiverBalustrade',root)

def sector(name,r0,r1,a0,a1,y0,y1,mat,parent,steps=5):
    vs=[]
    for y in [y0,y1]:
        for r in [r0,r1]:
            vs.extend((math.sin(a0+(a1-a0)*i/steps)*r,y,math.cos(a0+(a1-a0)*i/steps)*r) for i in range(steps+1))
    n=steps+1; fs=[]
    for i in range(steps):
        fs.extend([(i,i+1,n+i+1,n+i),(2*n+i,3*n+i,3*n+i+1,2*n+i+1),
                   (i,2*n+i,2*n+i+1,i+1),(n+i,n+i+1,3*n+i+1,3*n+i)])
    fs.extend([(0,n,3*n,2*n),(steps,2*n+steps,3*n+steps,n+steps)])
    return mesh(name,vs,fs,mat,parent)

# All walkable surfaces end below the existing targeting ring at Y=.05.
beam('Submerged stepped footing',(0,-.47,0),(0,-.24,0),8.06,'River basalt',floor,96)
beam('Carved platform drum',(0,-.25,0),(0,-.07,0),7.84,'Worn limestone',floor,96)
beam('Dark grout bed',(0,-.08,0),(0,-.025,0),7.65,'River basalt',floor,96)
beam('Quiet central stone',(0,-.025,0),(0,.006,0),2.53,'Blue slate',floor,64)
for row,(r0,r1,count) in enumerate([(2.57,4.6,24),(4.64,6.35,32),(6.39,7.6,40)]):
    for i in range(count):
        a=(i+(row%2)*.5)*math.tau/count
        sector('Hand set radial paving',r0,r1,a+.002,a+math.tau/count-.002,-.024,.006,'Pale slate' if (i+row)%5==0 else 'Blue slate',floor)
for r in [2.54,4.62,6.37,7.64]: sector('Flush brass circle',r-.012,r+.012,0,math.tau,.008,.016,'Aged brass',floor,96)
# A large, restrained lotus mosaic, visible between the combatants.
for i in range(12):
    a=i*math.tau/12
    pts=[(0,.02,0),(.46*math.sin(a-.34),.02,.46*math.cos(a-.34)),(1.52*math.sin(a-.18),.02,1.52*math.cos(a-.18)),(2.18*math.sin(a),.02,2.18*math.cos(a)),(1.52*math.sin(a+.18),.02,1.52*math.cos(a+.18)),(.46*math.sin(a+.34),.02,.46*math.cos(a+.34))]
    mesh('Inlaid lotus petal',pts,[(0,1,2,3,4,5)],'Patina' if i%2 else 'Aged brass',floor)
for i in range(48):
    a=i*math.tau/48
    sector('Foundation brass dentil',7.83,7.88,a+.012,a+.07,-.20,-.105,'Aged brass',floor,2)

def ring(name,x,y,z,r,mat,parent):
    points=[(x+math.cos(i*math.tau/16)*r,y,z+math.sin(i*math.tau/16)*r) for i in range(17)]
    c=curve(name,points,.023,mat,parent); c.data.resolution_u=2; c.data.bevel_resolution=0

for i in range(7):
    x=(i-3)*3.4; z=-6-abs(i-3)*.35
    box('Stone lantern foot',(1.08,.18,1.08),(x,-.05,z),'River basalt',lamps,.04)
    box('Stepped lantern plinth',(.88,.15,.88),(x,.11,z),'Worn limestone',lamps,.025)
    beam('Octagonal carved pier',(x,.17,z),(x,2.17,z),.27,'Worn limestone',lamps,8)
    for y,r in [(.28,.35),(.43,.29),(1.93,.31),(2.13,.37)]:
        beam('Pier moulding',(x,y-.05,z),(x,y+.05,z),r,'Aged brass' if y==.43 else 'River basalt',lamps,8)
    for side in [-1,1]:
        box('Vertical jade inset',(.085,1.32,.024),(x+side*.13,1.14,z+.254),'Patina',lamps,.006)
    box('Lantern teak sill',(.89,.12,.89),(x,2.24,z),'Teak',lamps,.018)
    box('Amber silk light chamber',(.55,.67,.55),(x,2.63,z),'Lantern silk',lamps,.025)
    for dx in [-.36,.36]:
        for dz in [-.36,.36]:
            beam('Open cage corner',(x+dx,2.29,z+dz),(x+dx,3.03,z+dz),.037,'Teak',lamps,8)
    for side in [-1,1]:
        for dx in [-.18,0,.18]:
            beam('Fine lantern lattice',(x+dx,2.35,z+side*.36),(x+dx,2.92,z+side*.36),.012,'Aged brass',lamps,6)
            beam('Fine side lattice',(x+side*.36,2.35,z+dx),(x+side*.36,2.92,z+dx),.012,'Aged brass',lamps,6)
    box('Lantern upper frame',(.88,.1,.88),(x,3,z),'Teak',lamps,.018)
    # Two swept hip-roof tiers with raised corners, built as closed surfaces.
    for base,radius,height in [(3.02,.66,.43),(3.40,.40,.30)]:
        vs=[]
        for r,y in [(radius,base+.06),(radius*.62,base+.13),(.045,base+height)]:
            for k in range(4):
                a=math.pi/4+k*math.pi/2
                vs.append((x+math.cos(a)*r,y,z+math.sin(a)*r))
        fs=[]
        for row in range(2):
            for k in range(4): fs.append((row*4+k,row*4+(k+1)%4,(row+1)*4+(k+1)%4,(row+1)*4+k))
        fs.extend([(0,3,2,1),(8,9,10,11)])
        mesh('Swept glazed lantern roof',vs,fs,'Glazed jade',lamps)
        for k in range(4):
            a=math.pi/4+k*math.pi/2
            c=curve('Raised gilded hip',[(x,base+height+.012,z),(x+math.cos(a)*radius*.62,base+.15,z+math.sin(a)*radius*.62),(x+math.cos(a)*radius,base+.085,z+math.sin(a)*radius),(x+math.cos(a)*radius*1.10,base+.20,z+math.sin(a)*radius*1.10)],.018,'Aged brass',lamps)
            c.data.resolution_u=2; c.data.bevel_resolution=0
    beam('Roof finial',(x,3.68,z),(x,3.91,z),.035,'Aged brass',lamps,10)
    ring('Finial crown',x,3.77,z,.095,'Aged brass',lamps)
    # Low river wall lives entirely behind the party and target positions.
    if i<6:
        nx=x+3.4; nz=-6-abs(i-2)*.35
        box('Distant quay footing',(3.45,.30,1.05),(x+1.7,-.25,(z+nz)/2),'River basalt',rails,.025)
        for j in range(1,7):
            t=j/7; px=x+3.4*t; pz=z+(nz-z)*t
            beam('Turned baluster',(px,.10,pz),(px,.88,pz),.064,'Worn limestone',rails,8)
            beam('Baluster belly',(px,.37,pz),(px,.55,pz),.115,'Patina',rails,8)
        for y in [.1,.93]:
            beam('Continuous river rail',(x,y,z),(nx,y,nz),.09,'Worn limestone',rails,8)

# Recalculate outward normals after converting all curves and crafted edges.
bake_parts(root)
for o in root.children_recursive:
    if o.type=='MESH':
        bpy.context.view_layer.objects.active=o; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
for o in root.children_recursive: o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(MODELS/'river-arena.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
(OUT/'manifest.json').write_text(json.dumps({'triangles':triangles,'bytes':(MODELS/'river-arena.glb').stat().st_size,'parts':['StonePlatform','LanternGallery','RiverBalustrade']},indent=2))
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24; scene.cycles.use_denoising=True; scene.world.color=(.20,.23,.27)
for at,power,size in [((-3,-3,11),2400,10),((7,6,8),2000,8)]:
    bpy.ops.object.light_add(type='AREA',location=at); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(-13,-19,15)); camera=bpy.context.object; camera.rotation_euler=(Vector((0,1,0))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=26; scene.camera=camera
scene.render.resolution_x=1500; scene.render.resolution_y=1050; scene.render.resolution_percentage=100; scene.view_settings.view_transform='AgX'; scene.render.filepath=str(OUT/'river-arena.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'river-arena.blend')); bpy.ops.render.render(write_still=True)
print('RIVER_ARENA_EXPORTED',triangles)
