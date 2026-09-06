"""Original articulated river-fantasy creatures. Blender 4.2; game metres and Y-up."""
import sys,math,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_landmarks import bpy,Vector,ROOT,MODELS,SOURCE,material,empty,mesh,box,beam,curve,bake_parts,vec,finish
OUT=ROOT/'artifacts/blender-river-spirits';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for name,color,rough,metal in [
    ('Midnight silk',(.025,.068,.092),.84,.03),('Jade enamel',(.046,.25,.22),.34,.32),
    ('Celadon ceramic',(.34,.54,.47),.48,.12),('Old gold',(.68,.43,.16),.38,.68),
    ('Dark bronze',(.18,.095,.034),.61,.55),('Deep mask recess',(.008,.025,.025),.85,0)]:material(name,color,rough,metal)
material('River light',(.36,.80,.64),.3,.1,1.7)
root=empty('RiverSpirits');keeper=empty('RiverKeeper',root);echo=empty('LanternEcho',root)
torso=empty('KeeperTorso',keeper);head=empty('KeeperMask',keeper);skirt=empty('KeeperMantle',keeper)
left=empty('KeeperLeftArm',keeper);right=empty('KeeperRightArm',keeper);halo=empty('KeeperHalo',keeper)
cage=empty('EchoCage',echo);petals=empty('EchoPetals',echo)

def stroke(name,points,r,mat,parent):
    c=curve(name,points,r,mat,parent);c.data.resolution_u=3;c.data.bevel_resolution=1;return c
def ellipsoid(name,at,size,mat,parent,segments=20,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=vec(at));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,name,mat,parent)
    for p in o.data.polygons:p.use_smooth=True
    return o
def shell(name,profiles,mat,parent,n=24):
    # Elliptical vertical profiles: (height, X radius, Z radius).
    vs=[(rx*math.cos(i*math.tau/n),y,rz*math.sin(i*math.tau/n)) for y,rx,rz in profiles for i in range(n)]
    fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profiles)-1) for i in range(n)]
    fs.extend([tuple(range(n-1,-1,-1)),tuple((len(profiles)-1)*n+i for i in range(n))]);return mesh(name,vs,fs,mat,parent,True)
def blade(name,points,width,mat,parent):
    # A sculpted closed ribbon with a raised central ridge and tapered ends.
    vs=[]
    for i,(x,y,z) in enumerate(points):
        w=width*math.sin(math.pi*i/(len(points)-1))+.006
        vs.extend([(x,y,z-w),(x-.055,y+.012,z),(x,y,z+w),(x+.035,y,z)])
    fs=[]
    for i in range(len(points)-1):
        for k in range(4):fs.append((4*i+k,4*i+(k+1)%4,4*(i+1)+(k+1)%4,4*(i+1)+k))
    fs.extend([(3,2,1,0),tuple(4*(len(points)-1)+k for k in range(4))]);return mesh(name,vs,fs,mat,parent,True)

# The hollow silhouette is built around an open light-bearing chest, not a cone.
shell('Fitted dark cuirass',[(1.55,.27,.30),(1.88,.39,.43),(2.22,.32,.52),(2.37,.20,.28)],'Midnight silk',torso)
shell('Layered bronze collar',[(2.27,.25,.39),(2.36,.34,.49),(2.45,.18,.26)],'Old gold',torso)
shell('Jade waist clasp',[(1.48,.31,.34),(1.59,.35,.39),(1.67,.29,.32)],'Jade enamel',torso)
ellipsoid('Lantern heart',(-.37,2.02,0),(.13,.22,.17),'River light',torso)
for side in [-1,1]:
    blade('Swept chest leaf',[(-.21,2.36,side*.20),(-.42,2.23,side*.33),(-.45,1.99,side*.30),(-.32,1.68,side*.07)],.10,'Old gold',torso)
    stroke('Chest scroll',[(-.43,2.22,side*.23),(-.49,2.16,side*.27),(-.49,2.02,side*.25),(-.42,1.91,side*.18)],.018,'Celadon ceramic',torso)

# Twelve hanging mantle panels with different hems and raised gold seams.
for i in range(12):
    a=i*math.tau/12; hem=.38+.18*(i%3); vs=[]
    for j in range(7):
        t=j/6;y=1.63*(1-t)+hem*t;r=.32+.45*t+.08*math.sin(t*math.pi)
        for k in range(5):
            u=(k/4-.5)*.49;angle=a+u
            bulge=math.sin(k/4*math.pi)*.055
            vs.append(((r+bulge)*math.cos(angle)*.75,y-.10*math.sin(k/4*math.pi)*t,(r+bulge)*math.sin(angle)))
    fs=[(j*5+k,j*5+k+1,(j+1)*5+k+1,(j+1)*5+k) for j in range(6) for k in range(4)]
    panel=mesh('Woven mantle lobe',vs,fs,'Jade enamel' if i%3==0 else 'Midnight silk',skirt,True)
    solid=panel.modifiers.new('Cloth edge thickness','SOLIDIFY');solid.thickness=.022
    edge=[vs[j*5] for j in range(7)]
    stroke('Golden mantle seam',edge,.012,'Old gold',skirt)
    if i%2==0:
        tip=vs[-3];ellipsoid('Hem river bead',(tip[0],tip[1]-.05,tip[2]),(.038,.064,.038),'Old gold',skirt,12,8)

# Carved mask faces the party at negative X. Recessed sockets and brows read at game distance.
ellipsoid('Carved celadon face',(0,2.80,0),(.29,.40,.32),'Celadon ceramic',head)
ellipsoid('Bronze face surround',(.06,2.82,0),(.27,.43,.35),'Dark bronze',head)
blade('Raised forehead crest',[(-.18,3.12,0),(-.29,3.07,0),(-.32,2.98,0)],.21,'Old gold',head)
for side in [-1,1]:
    ellipsoid('Recessed eye socket',(-.269,2.85,side*.16),(.045,.083,.115),'Deep mask recess',head,16,10)
    ellipsoid('Slender river eye',(-.305,2.855,side*.165),(.028,.027,.08),'River light',head,16,8)
    stroke('Sculpted brow',[(-.29,2.94,side*.06),(-.315,2.97,side*.16),(-.23,2.99,side*.29)],.034,'Old gold',head)
    stroke('Cheek engraving',[(-.255,2.78,side*.25),(-.28,2.69,side*.19),(-.26,2.60,side*.075)],.015,'Old gold',head)
    ellipsoid('Hanging ear seal',(.0,2.69,side*.38),(.065,.18,.075),'Old gold',head,16,10)
    blade('Crown side petal',[(.04,3.02,side*.25),(.06,3.20,side*.43),(.08,3.46,side*.42),(.11,3.70,side*.25)],.09,'Jade enamel',head)
    stroke('Crown gilded tip',[(.10,3.20,side*.43),(.10,3.45,side*.43),(.12,3.70,side*.25)],.021,'Old gold',head)
ellipsoid('Mask nose',(-.31,2.76,0),(.085,.13,.047),'Celadon ceramic',head,16,10)
stroke('Quiet mouth',[(-.25,2.61,-.09),(-.292,2.59,0),(-.25,2.61,.09)],.014,'Deep mask recess',head)
blade('Central crown leaf',[(.10,3.08,0),(.10,3.34,0),(.12,3.61,0),(.16,3.91,0)],.16,'Old gold',head)

# Floating pauldrons and articulated forearms retain the original attack footprint.
for side,parent in [(-1,left),(1,right)]:
    ellipsoid('Jade shoulder',(.02,2.29,side*.63),(.22,.20,.26),'Jade enamel',parent)
    blade('Shoulder flare',[(.0,2.29,side*.43),(.04,2.48,side*.62),(.10,2.44,side*.83),(.16,2.28,side*.94)],.09,'Old gold',parent)
    beam('Upper arm',(.0,2.21,side*.72),(-.08,1.96,side*.91),.095,'Dark bronze',parent,12)
    ellipsoid('Elbow bead',(-.08,1.94,side*.91),(.105,.11,.105),'River light',parent,12,8)
    ellipsoid('Layered forearm',(-.19,1.81,side*1.01),(.16,.23,.14),'Jade enamel',parent)
    for y in [1.67,1.84,1.97]:
        stroke('Brass vambrace band',[(-.31,y,side*.94),(-.35,y,side*1.03),(-.26,y,side*1.15)],.021,'Old gold',parent)
    ellipsoid('Carved palm',(-.24,1.57,side*1.08),(.12,.14,.115),'Celadon ceramic',parent)
    for f in range(3):stroke('Tapered fingers',[(-.32,1.54,side*(1.01+f*.064)),(-.38,1.44,side*(1.01+f*.064)),(-.35,1.39,side*(1.01+f*.064))],.024,'Celadon ceramic',parent)

# A broken ornamental halo: deliberate negative space, no opaque disk behind the face.
for segment in range(8):
    a=segment*math.tau/8
    points=[(.32,2.17+math.sin(a+.055+j*.084)*1.42,math.cos(a+.055+j*.084)*1.42) for j in range(9)]
    stroke('Broken gilt halo',points,.027,'Old gold',halo)
    ellipsoid('Halo light pearl',points[0],(.044,.044,.044),'River light',halo,12,8)

# The companion is a floating open lantern, with a distinct flowerlike silhouette.
ellipsoid('Echo living light',(0,1.50,0),(.28,.34,.28),'River light',cage)
for i in range(8):
    a=i*math.tau/8
    points=[(math.cos(a)*r,y,math.sin(a)*r) for y,r in [(.94,.17),(1.13,.40),(1.5,.47),(1.88,.40),(2.08,.16)]]
    stroke('Curved bronze lantern rib',points,.034,'Old gold',cage)
for y,r in [(1.06,.31),(1.91,.33)]:
    stroke('Woven cage band',[(math.cos(i*math.tau/24)*r,y,math.sin(i*math.tau/24)*r) for i in range(25)],.032,'Jade enamel',cage)
shell('Lotus lantern crown',[(2.02,.16,.16),(2.12,.29,.29),(2.20,.14,.14),(2.33,.015,.015)],'Old gold',cage,16)
shell('Hanging lantern pendant',[(.61,.015,.015),(.78,.17,.17),(.99,.13,.13)],'Old gold',cage,16)
for i in range(6):
    a=i*math.tau/6;vs=[]
    for j in range(7):
        t=j/6;r=.35+.58*math.sin(t*math.pi/2);y=1.26+1.18*t;w=.22*math.sin(math.pi*t)+.008
        for k in [-1,0,1]:vs.append((math.cos(a)*r-math.sin(a)*w*k,y-(.05 if k==0 else 0),math.sin(a)*r+math.cos(a)*w*k))
    petal=mesh('Floating celadon petal',vs,[(j*3+k,j*3+k+1,(j+1)*3+k+1,(j+1)*3+k) for j in range(6) for k in range(2)],'Celadon ceramic' if i%2 else 'Jade enamel',petals,True)
    mod=petal.modifiers.new('Petal thickness','SOLIDIFY');mod.thickness=.025
    stroke('Petal luminous vein',[vs[j*3+1] for j in range(7)],.014,'River light',petals)

for parent in [keeper,echo]:bake_parts(parent)
# Set actual motion pivots after applying geometry modifiers and material batching.
for part,pivot in [(left,(0,2.29,-.63)),(right,(0,2.29,.63)),(halo,(.32,2.17,0)),(petals,(0,1.5,0))]:
    matrices={o:o.matrix_world.copy() for o in part.children};part.location=vec(pivot);bpy.context.view_layer.update()
    for o,matrix in matrices.items():o.matrix_world=matrix
for o in root.children_recursive:
    if o.type=='MESH':
        bpy.context.view_layer.objects.active=o;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(MODELS/'river-spirits.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
(OUT/'manifest.json').write_text(json.dumps({'triangles':triangles,'bytes':(MODELS/'river-spirits.glb').stat().st_size,'models':['RiverKeeper','LanternEcho'],'articulatedParts':['KeeperLeftArm','KeeperRightArm','KeeperHalo','EchoPetals']},indent=2))
# Studio arrangement is saved only after the origin-aligned game export.
keeper.location.x=1.2;echo.location.x=-1.5
material('Studio',(.10,.14,.15),.92);box('Studio floor',(20,.06,20),(0,.0,0),'Studio',None,0)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.world.color=(.18,.20,.23)
for at,power,size in [((-5,-5,8),1500,6),((5,1,7),1300,5)]:
    bpy.ops.object.light_add(type='AREA',location=at);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(-9,-10,6));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,2))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=7.2;scene.camera=camera
scene.render.resolution_x=1400;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'river-spirits.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'river-spirits.blend'));bpy.ops.render.render(write_still=True)
print('RIVER_SPIRITS_EXPORTED',triangles)
