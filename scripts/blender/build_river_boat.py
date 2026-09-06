"""Original stylised Bangkok long-tail passenger boat, authored in Blender, game Y-up."""
import sys, math, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_landmarks import bpy, Vector, ROOT, MODELS, SOURCE, material, empty, box, mesh, beam, curve, bake_parts

OUT=ROOT/'artifacts/blender-river-boat'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for name,color,rough,metal in [
    ('Teak',(.30,.13,.055),.67,0),('Pale teak',(.49,.28,.12),.73,0),
    ('Dark timber',(.095,.04,.017),.8,0),('River blue',(.025,.23,.31),.43,.12),
    ('Vermilion',(.63,.08,.027),.49,0),('Cream canvas',(.86,.73,.46),.94,0),
    ('Blue canvas',(.035,.22,.28),.94,0),('Brass',(.62,.38,.09),.38,.65),
    ('Iron',(.07,.10,.095),.6,.62),('Steel',(.43,.49,.47),.34,.8),
    ('Rubber',(.02,.025,.022),.97,0),('Saffron cloth',(.93,.38,.018),.94,0),
    ('Rose cloth',(.75,.065,.14),.93,0)]: material(name,color,rough,metal)
root=empty('RiverLongtail'); hull=empty('Hull',root); cabin=empty('PassengerCabin',root); engine=empty('LongtailEngine',root); canopy=empty('Canopy',root)
# Lofted open hull: keel, chine, flared sides, thick gunwales and an interior floor.
sections=[(-2.85,.38,.04,.53),(-2.4,.61,-.05,.53),(-1.6,.76,-.12,.51),
          (0,.80,-.14,.52),(1.5,.65,-.06,.64),(2.65,.35,.15,.83),(3.65,.035,.61,1.18)]
for side in (-1,1):
    for strip in range(5):
        vertices=[]
        for x,w,k,top in sections:
            for level in [strip/5,(strip+1)/5]:
                y=k+(top-k)*level
                z=side*w*(.40+.60*level**.65)
                vertices.append((x,y,z))
        mesh('Curved outer plank',vertices,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(sections)-1)],
             'River blue' if strip<2 else 'Vermilion' if strip==3 else 'Teak',hull)
    outside=[(x,top,side*w) for x,w,k,top in sections]
    inside=[(x,top-.045,side*max(.015,w-.055)) for x,w,k,top in sections]
    mesh('Gunwale lip',outside+inside,[(i,i+1,i+1+len(sections),i+len(sections)) for i in range(len(sections)-1)],'Pale teak',hull)
    mesh('Inner hull',inside+[(x,k+.07,side*w*.40) for x,w,k,top in sections],
         [(i,i+1,i+1+len(sections),i+len(sections)) for i in range(len(sections)-1)],'Teak',hull)
    curve('Raised sheer rail',[(x,top+.02,side*w) for x,w,k,top in sections],.035,'Pale teak',hull)
    curve('Painted pinstripe',[(x,k+(top-k)*.73,side*w*(.40+.60*.73**.65)+side*.003) for x,w,k,top in sections],.012,'Cream canvas',hull)
mesh('Keel',[(x,k,s*w*.40) for s in (-1,1) for x,w,k,top in sections],
     [(i,i+1,i+1+len(sections),i+len(sections)) for i in range(len(sections)-1)],'Dark timber',hull)
x,w,k,top=sections[0]
mesh('Stern transom',[(x,k,-w*.4),(x,k,w*.4),(x,top,w),(x,top,-w)],[(0,1,2,3)],'Teak',hull)
for x in [-2.2,-1.5,-.8,-.1,.6,1.3,2.0]:
    a,b=next((a,b) for a,b in zip(sections,sections[1:]) if a[0]<=x<=b[0])
    f=(x-a[0])/(b[0]-a[0]); w,k,top=[a[i]+(b[i]-a[i])*f for i in [1,2,3]]
    inner=lambda q,side:(x,k+.085+(top-k-.13)*q,side*(max(.02,w-.095)*(.40+.60*q)))
    points=[inner(1,-1),inner(.5,-1),inner(0,-1),(x,k+.085,0),inner(0,1),inner(.5,1),inner(1,1)]
    for a,b in zip(points,points[1:]): beam('Internal rib',a,b,.014,'Pale teak',hull)
for i in range(7): box('Slatted passenger floor',(3.45,.035,.10),(-.35,.13,(i-3)*.107),'Pale teak' if i%2 else 'Teak',cabin,.007)
for x in [-1.65,-.65,.35,1.35]:
    box('Passenger bench',(.32,.075,1.14),(x,.45,0),'Pale teak',cabin,.015)
    for z in [-.40,.40]: box('Bench support',(.08,.30,.08),(x,.28,z),'Dark timber',cabin,.006)
    # Low backrests leave the boat visibly open.
    box('Seat back',(.055,.22,1.1),(x-.15,.62,0),'Teak',cabin,.012)
for x in [-2.05,.0,1.75]:
    for side in [-1,1]: beam('Canopy support',(x,.48,side*.62),(x,1.81,side*.64),.024,'Steel',cabin,12)
    curve('Arched roof bow',[(x,1.81,-.72),(x,1.99,-.4),(x,2.06,0),(x,1.99,.4),(x,1.81,.72)],.025,'Steel',canopy)
for i in range(16):
    x=-2.2+i*.265
    vs=[(xx,1.81+.26*math.cos(z/.76*math.pi/2),z) for xx in [x,x+.267] for z in [-.76,-.50,-.25,0,.25,.50,.76]]
    fs=[(j,j+1,j+8,j+7) for j in range(6)]
    mesh('Striped canvas canopy',vs,fs,'Cream canvas' if i%3 else 'Blue canvas',canopy)
    for side in [-1,1]: box('Canvas hanging edge',(.267,.12,.022),(x+.133,1.765,side*.76),'Cream canvas' if i%3 else 'Blue canvas',canopy,.003)
# Engine has a visible flywheel, exhaust, fuel line, mounting cradle and long propeller shaft.
for z in [-.24,.24]: beam('Engine mount',(-2.75,.50,z),(-2.16,.50,z),.035,'Iron',engine)
box('Engine block',(.54,.38,.42),(-2.43,.76,0),'Iron',engine,.045)
for i in range(5): box('Cylinder cooling fin',(.44,.022,.45),(-2.43,.72+i*.048,0),'Steel',engine,.005)
beam('Flywheel',(-2.76,.74,0),(-2.65,.74,0),.23,'Iron',engine,24)
beam('Flywheel centre',(-2.78,.74,0),(-2.75,.74,0),.07,'Brass',engine,16)
curve('Exhaust pipe',[(-2.35,.89,.2),(-2.18,.94,.24),(-2.10,1.23,.24),(-2.33,1.26,.24)],.032,'Iron',engine)
box('Fuel tank',(.33,.20,.36),(-1.97,.29,0),'Vermilion',engine,.04)
curve('Fuel hose',[(-1.97,.40,.12),(-2.18,.48,.23),(-2.30,.65,.19)],.012,'Rubber',engine)
beam('Long propeller shaft',(-2.6,.66,0),(-4.60,-.24,0),.029,'Steel',engine,16)
beam('Shaft guard',(-2.65,.64,0),(-3.05,.48,0),.055,'Iron',engine,16)
beam('Propeller hub',(-4.58,-.23,0),(-4.69,-.28,0),.065,'Brass',engine,16)
for a in [0,math.tau/3,math.tau*2/3]:
    y,z=math.cos(a),math.sin(a)
    mesh('Propeller blade',[(-4.64,-.25,0),(-4.52,-.25+y*.23,z*.23),(-4.68,-.25+y*.28,z*.28),(-4.73,-.25+y*.08,z*.08)],[(0,1,2,3)],'Brass',engine)
beam('Steering handle',(-2.25,.75,.12),(-1.65,.95,.42),.025,'Steel',engine)
beam('Rubber handgrip',(-1.79,.90,.35),(-1.65,.95,.42),.035,'Rubber',engine)
for side in [-1,1]:
    for x in [-1.7,.8]:
        curve('Fender rope',[(x,.60,side*.72),(x,.45,side*.87),(x,.18,side*.9)],.01,'Cream canvas',hull)
        # Small ring fenders, each with a genuinely hollow centre.
        points=[(x+.14*math.cos(a),.19+.14*math.sin(a),side*.9) for a in [i*math.tau/24 for i in range(25)]]
        curve('Rubber ring fender',points,.037,'Rubber',hull)
for i,mat in enumerate(['Saffron cloth','Rose cloth','Blue canvas']):
    curve('Bow cloth wrap',[(3.15,.84,-.13+i*.03),(3.3,.94,0),(3.15,.84,.13-i*.03)],.027,mat,hull)
    mesh('Trailing bow ribbon',[(3.16,.83,i*.035),(2.98,.58,i*.035+.025),(3.08,.40,i*.035),(3.20,.62,i*.035-.025)],[(0,1,2,3)],mat,hull)

# Flat panels are deliberately double-sided; thin canvas/hull sheets must render from inside.
for mat in bpy.data.materials: mat.use_backface_culling=False
bake_parts(root)
bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
for o in root.children_recursive: o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(MODELS/'river-longtail.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
material('Studio',(.16,.22,.23),.93); box('Studio floor',(30,.04,20),(0,-.58,0),'Studio',None,0)
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24; scene.cycles.use_denoising=True; scene.world.color=(.2,.2,.2)
for pos,power,size in [((3,5,8),1700,6),((-5,-4,5),1500,5)]:
    bpy.ops.object.light_add(type='AREA',location=pos); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.rotation_euler=(Vector((0,0,.5))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(8,11,7)); camera=bpy.context.object; camera.rotation_euler=(Vector((-.4,0,.6))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=10.5; scene.camera=camera
scene.render.resolution_x=1400; scene.render.resolution_y=900; scene.render.resolution_percentage=100; scene.view_settings.view_transform='AgX'; scene.render.filepath=str(OUT/'river-longtail.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'river-longtail.blend')); bpy.ops.render.render(write_still=True)
(OUT/'manifest.json').write_text(json.dumps({'triangles':triangles,'bytes':(MODELS/'river-longtail.glb').stat().st_size,'parts':['Hull','PassengerCabin','LongtailEngine','Canopy']},indent=2))
print('RIVER_BOAT_EXPORTED',triangles)
