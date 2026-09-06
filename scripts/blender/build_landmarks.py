"""Author original Bangkok-inspired game landmarks in Blender; export editable scenes and GLBs.
Run: blender --background --python scripts/blender/build_landmarks.py
Game coordinates below are X/right, Y/up, Z/depth; Blender uses (X, -Z, Y).
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / 'public/bangkok/models'
SOURCE = ROOT / 'art/blender'
PREVIEW = ROOT / 'artifacts/blender-landmarks'
for directory in (MODELS, SOURCE, PREVIEW): directory.mkdir(parents=True, exist_ok=True)
MATS = {}

def vec(p): return Vector((p[0], -p[2], p[1]))
def material(name, color, rough=.6, metal=0, emission=0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = rough; shader.inputs['Metallic'].default_value = metal
    shader.inputs['Emission Color'].default_value = (*color, 1); shader.inputs['Emission Strength'].default_value = emission
    MATS[name] = m
    return m
def empty(name, parent=None):
    o = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(o); o.parent = parent; return o
def finish(o, name, mat, parent, bevel=0):
    o.name = name; o.data.materials.append(MATS[mat]); o.parent = parent
    if bevel:
        mod = o.modifiers.new('Crafted edges', 'BEVEL'); mod.width = bevel; mod.segments = 2
        mod = o.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL'); mod.keep_sharp = True
    return o
def box(name, size, at, mat, parent, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=vec(at)); o = bpy.context.object
    o.dimensions = (size[0], size[2], size[1]); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, mat, parent, bevel)
def mesh(name, vertices, faces, mat, parent, smooth=False):
    data = bpy.data.meshes.new(name); data.from_pydata([vec(p) for p in vertices], [], faces); data.update()
    o = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(o); finish(o, name, mat, parent)
    for p in data.polygons: p.use_smooth = smooth
    return o
def beam(name, a, b, radius, mat, parent, vertices=8):
    a, b = vec(a), vec(b); direction = b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=(a+b)/2)
    o=bpy.context.object; o.rotation_mode='QUATERNION'; o.rotation_quaternion=direction.to_track_quat('Z','Y')
    return finish(o,name,mat,parent)
def curve(name, points, radius, mat, parent):
    data=bpy.data.curves.new(name,'CURVE'); data.dimensions='3D'; data.resolution_u=6; data.bevel_depth=radius; data.bevel_resolution=1
    spline=data.splines.new('BEZIER'); spline.bezier_points.add(len(points)-1)
    for point, co in zip(spline.bezier_points, points): point.co=vec(co); point.handle_left_type=point.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.parent=parent; data.materials.append(MATS[mat]); return o
def leaf(name, cx, cy, z, angle, length, width, mat, parent):
    direction=(math.sin(angle),math.cos(angle)); cross=(math.cos(angle),-math.sin(angle))
    points=[(0,0),(-width,.42*length),(-width*.65,.72*length),(0,length),(width*.65,.72*length),(width,.42*length),(0,.48*length)]
    vertices=[(cx+cross[0]*u+direction[0]*v,cy+cross[1]*u+direction[1]*v,z+(.035 if i==6 else 0)) for i,(u,v) in enumerate(points)]
    mesh(name,vertices,[(i,(i+1)%6,6) for i in range(6)],mat,parent)
def rosette(x,y,z,scale,parent):
    for i in range(8): leaf('Gilt petal',x,y,z,i*math.tau/8,.42*scale,.085*scale,'Brass',parent)
    beam('Rosette boss',(x,y,z-.03),(x,y,z+.05),.09*scale,'Gold',parent,12)
def palette():
    material('Plaster',(.66,.59,.44),.9); material('Stone',(.38,.40,.35),.88)
    material('Ivory',(.81,.74,.56),.74); material('Teak',(.20,.078,.031),.58)
    material('Dark teak',(.085,.043,.022),.72); material('Brass',(.52,.31,.086),.38,.65)
    material('Gold',(.77,.53,.19),.33,.62); material('Lacquer',(.075,.19,.16),.4)
    material('Warm glass',(.42,.23,.077),.3,.12,.28)
    for i in range(6):
        material('Terra'+str(i),(.29+i*.018,.066+i*.008,.038+i*.005),.46)
        material('Jade'+str(i),(.048+i*.009,.145+i*.013,.11+i*.01),.38)

def roof(parent, name, half, depth, base, rise, palette_name, tier):
    """Curved ceramic roofs with overlapping courses, not one flat triangular prism."""
    def height(t): return base+rise*((1-t)**.83)+.14*(t**8)
    for side in (-1,1):
        steps=12
        vertices=[(side*half*j/steps,height(j/steps),z) for z in (-depth/2,depth/2) for j in range(steps+1)]
        faces=[(j,j+1,j+steps+2,j+steps+1) for j in range(steps)]
        mesh(name+' roof deck',vertices,faces,'Dark teak',parent)
        # Separate crowned tiles catch the light; deterministic variation keeps the roof coherent.
        columns=max(8,round(depth/.3)); rows=max(4,round(half/.38)); dz=depth/columns
        for row in range(rows):
            lo=row/rows; hi=min(1,(row+1.13)/rows)
            for column in range(columns):
                z0=-depth/2+column*dz; z1=z0+dz*.97
                verts=[]
                for t in (lo,hi):
                    for i in range(5):
                        u=i/4; verts.append((side*half*t,height(t)+.035+math.sin(u*math.pi)*.028,z0+(z1-z0)*u))
                mesh('Glazed tile',verts,[(i,i+1,i+6,i+5) for i in range(4)],palette_name+str((row*7+column*3+tier)%6),parent,True)
        for end in (-1,1):
            z=end*(depth/2+.045)
            points=[(side*half*j/steps,height(j/steps)+.055,z) for j in range(steps+1)]
            curve('Carved bargeboard',points,.065,'Brass',parent)
            curve('Upturned roof tip',[(side*half,height(1),z),(side*(half+.10),base+.27,z),(side*(half+.16),base+.52,z),(side*(half+.12),base+.66,z)],.045,'Gold',parent)
        beam('Eave fascia',(side*half,base+.10,-depth/2),(side*half,base+.10,depth/2),.075,'Dark teak',parent)
    beam('Ridge beam',(0,base+rise+.065,-depth/2-.12),(0,base+rise+.065,depth/2+.12),.082,'Gold',parent,12)
    # Filled gables and original floral reliefs, both sides visible from the city paths.
    for end in (-1,1):
        panel=empty('Gable panel',parent)
        z=end*(depth/2-.07)
        mesh('Lacquer gable',[(-half+.13,base+.12,z),(0,base+rise-.08,z),(half-.13,base+.12,z)],[(0,1,2)],'Lacquer',panel)
        # Artwork is authored front-facing then mirrored for the back gable.
        art=empty('Carved floral fan',panel)
        for i in range(-4,5):
            x=i*half*.18; limit=height(abs(x)/half)-base-.28
            if limit>.2: leaf('Gable leaf',x,base+.17,abs(z)+.08,i*.13,min(limit,.85),.075,'Gold',art)
        rosette(0,base+.43,abs(z)+.09,.75,art)
        if end<0: art.scale.y=-1
        curve('Ridge finial',[(0,base+rise-.04,end*depth/2),(0,base+rise+.25,end*(depth/2+.08)),(0,base+rise+.52,end*(depth/2+.03))],.05,'Gold',parent)

def window(parent,x,y,z,width=1,height=1.6):
    box('Window surround',(width+.15,height+.16,.12),(x,y,z),'Ivory',parent,.035)
    box('Recessed timber',(width,height,.065),(x,y,z+.072),'Dark teak',parent,.018)
    box('Amber inset',(width-.15,height-.17,.027),(x,y,z+.115),'Warm glass',parent,.01)
    for side in (-1,1): box('Gold jamb',(.04,height,.05),(x+side*(width/2-.07),y,z+.14),'Brass',parent,.007)
    for level in (-.4,0,.4): box('Transom',(width-.1,.035,.05),(x,y+height*level,z+.145),'Brass',parent,.004)
    for offset in (-.25,0,.25): box('Lattice upright',(.025,height-.15,.035),(x+offset*width,y,z+.14),'Brass',parent,.004)
    for offset in (-.28,.28):
        for direction in (-1,1): beam('Lattice diamond',(x+offset*width-.16,y-.18*direction,z+.165),(x+offset*width+.16,y+.18*direction,z+.165),.012,'Gold',parent,6)
    # Sculpted crown is above the walking head space, rather than a projecting ground obstacle.
    top=y+height/2+.13
    curve('Window crown',[(x-width*.57,top-.07,z+.10),(x-width*.34,top+.16,z+.12),(x,top+.39,z+.12),(x+width*.34,top+.16,z+.12),(x+width*.57,top-.07,z+.10)],.04,'Brass',parent)

def hall():
    root=empty('OldTownHall'); base=empty('HallBase',root); walls=empty('HallWalls',root); crown=empty('HallRoof',root)
    box('Stone footing',(8,.18,5),(0,.09,0),'Stone',base,.05)
    box('Ivory plinth',(7.9,.18,4.9),(0,.23,0),'Ivory',base,.035)
    box('Solid hall shell',(7.55,2.68,4.55),(0,1.63,0),'Plaster',walls,.04)
    for y,h,w,d,mat in ((.41,.13,7.82,4.82,'Brass'),(.59,.16,7.74,4.74,'Ivory'),(2.79,.16,7.82,4.82,'Ivory'),(2.94,.12,7.98,4.98,'Dark teak')):
        box('Continuous moulding',(w,h,d),(0,y,0),mat,walls,.02)
    # Four detailed elevations. Details remain within the eight-by-five collision footprint.
    for end in (-1,1):
        elevation=empty('North facade' if end<0 else 'South facade',walls)
        if end<0: elevation.rotation_euler.z=math.pi
        for x in (-3.65,-1.9,1.9,3.65):
            box('Fluted pilaster',(.19,2.15,.14),(x,1.69,2.31),'Ivory',elevation,.018)
            for dx in (-.043,.043): box('Pilaster flute',(.016,1.82,.014),(x+dx,1.69,2.387),'Brass',elevation,.002)
        for x in (-2.77,2.77): window(elevation,x,1.61,2.29,.98,1.49)
        box('Carved closed door',(2.1,2.03,.10),(0,1.48,2.315),'Dark teak',elevation,.035)
        for side in (-1,1):
            box('Teak door leaf',(.94,1.85,.05),(side*.51,1.47,2.39),'Teak',elevation,.025)
            for y in (.96,1.82):
                box('Door panel',(.72,.54,.022),(side*.51,y,2.429),'Lacquer',elevation,.025)
                rosette(side*.51,y,2.45,.55,elevation)
            beam('Door handle',(side*.14,1.37,2.435),(side*.14,1.61,2.435),.025,'Gold',elevation)
        box('Door lintel',(2.4,.14,.10),(0,2.55,2.34),'Brass',elevation,.03)
        for i in range(-5,6): rosette(i*.58,.73,2.39,.26,elevation)
    for side in (-1,1):
        elevation=empty('Side windows',walls); elevation.rotation_euler.z=side*math.pi/2
        # Local +Z maps to the long side after rotation; narrower row keeps corners clear.
        for x in (-1.3,0,1.3): window(elevation,x,1.65,3.79,.82,1.50)
    for tier,half,depth,base_y,rise,color in ((0,4.48,5.9,3.0,1.58,'Terra'),(1,3.26,4.8,3.91,1.35,'Jade'),(2,2.06,3.7,4.77,1.13,'Terra')):
        roof(crown,'Hall tier '+str(tier),half,depth,base_y,rise,color,tier)
    return root

def pavilion():
    root=empty('LumphiniPavilion'); base=empty('PavilionBase',root); supports=empty('PavilionSupports',root); crown=empty('PavilionRoof',root)
    box('Raised foundation',(3,.14,2.4),(0,.13,0),'Stone',base,.025)
    for i in range(12): box('Teak deck board',(.244,.06,2.36),(-1.37+i*.249,.23,0),'Teak' if i%3 else 'Dark teak',base,.006)
    for x in (-1.5,1.5):
        for z in (-1,1):
            beam('Timber post',(x,.2,z),(x,2.60,z),.088,'Teak',supports,12)
            for y in (.33,2.30,2.5): beam('Brass post collar',(x,y-.025,z),(x,y+.025,z),.093,'Brass',supports,12)
            # Head-height braces leave the same open routes as the previous four posts.
            curve('Curved timber brace',[(x,2.25,z),(x*.88,2.43,z),(x*.63,2.56,z)],.05,'Teak',crown)
    for z in (-1,1): box('Open pavilion beam',(3.2,.13,.12),(0,2.56,z),'Dark teak',crown,.025)
    for x in (-1.5,1.5): box('Open pavilion side beam',(.12,.13,2.2),(x,2.56,0),'Dark teak',crown,.025)
    roof(crown,'Park canopy',1.85,3.08,2.61,1.02,'Jade',0)
    return root

def bake_parts(root):
    """Apply crafted edges and join by structural part, keeping independent runtime cutaways."""
    for part in list(root.children):
        members=[o for o in part.children_recursive if o.type in {'MESH','CURVE'}]
        if not members: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in members: o.select_set(True)
        bpy.context.view_layer.objects.active=members[0]; bpy.ops.object.convert(target='MESH')
        bpy.ops.object.join(); merged=bpy.context.object; merged.name=part.name+'Mesh'; merged.parent=part
        # Convert bakes modifiers; empty former subgroups can stay as editable organization.
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)

def render_and_export(name, builder):
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False); MATS.clear(); palette()
    root=builder(); bake_parts(root)
    # The exported asset contains only architecture, in metres. Presentation lights stay in .blend.
    bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
    for o in root.children_recursive: o.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(MODELS/(name+'.glb')), export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_materials='EXPORT')
    vertices=sum(len(o.data.vertices) for o in root.children_recursive if o.type=='MESH')
    triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
    box('Studio floor',(80,.1,80),(0,-.12,0),'Stone',None,0)
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24; scene.cycles.use_denoising=True
    scene.world.color=(.22,.22,.22)
    for location,power,size in (((-5,-7,11),1700,7),((7,2,8),1200,6),((-2,6,10),1600,5)):
        bpy.ops.object.light_add(type='AREA',location=location); light=bpy.context.object; light.data.energy=power; light.data.shape='DISK'; light.data.size=size
        light.rotation_euler=(Vector((0,0,2))-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(11,-13,9) if name=='oldtown-hall' else (6,-7,5)); camera=bpy.context.object
    target=Vector((0,0,2.7 if name=='oldtown-hall' else 1.6)); camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'; camera.data.ortho_scale=13 if name=='oldtown-hall' else 6.5; scene.camera=camera
    scene.render.resolution_x=1200; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.render.filepath=str(PREVIEW/(name+'.png'))
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'.blend')))
    bpy.ops.render.render(write_still=True)
    return {'name':name,'vertices':vertices,'triangles':triangles,'glbBytes':(MODELS/(name+'.glb')).stat().st_size}

if __name__ == '__main__':
    report=[render_and_export('oldtown-hall',hall),render_and_export('lumphini-pavilion',pavilion)]
    (PREVIEW/'manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('LANDMARKS_EXPORTED', json.dumps(report))
