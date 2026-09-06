"""Six original, story-specific exploration props. Coordinates use game Y-up helpers."""
import sys, math, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_landmarks import bpy, Vector, ROOT, MODELS, SOURCE, material, empty, box, mesh, beam, curve, bake_parts
OUT = ROOT/'artifacts/blender-discoveries'; OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for name, color, rough, metal in [
    ('Teak',(.23,.105,.045),.6,0), ('Dark',(.07,.105,.10),.8,0),
    ('Paper',(.84,.76,.56),.86,0), ('Jade',(.055,.26,.23),.4,0),
    ('Brass',(.61,.39,.12),.35,.65), ('Rattan',(.58,.36,.16),.85,0),
    ('Red',(.60,.055,.025),.55,0), ('Blue',(.13,.40,.51),.38,0),
    ('Leaf',(.15,.29,.095),.8,0), ('Stone',(.38,.40,.34),.85,0)]:
    material(name,color,rough,metal)
root = empty('CityMemories')
names = ['hotel-journal','soi-route','park-basket','market-recipe','river-keepsake','artisan-lantern']
parts = {name:empty(name,root) for name in names}

def lathe(name, profile, at, mat, parent, sides=16):
    verts=[(at[0]+r*math.cos(i*math.tau/sides),at[1]+y,at[2]+r*math.sin(i*math.tau/sides)) for r,y in profile for i in range(sides)]
    faces=[(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i) for j in range(len(profile)-1) for i in range(sides)]
    return mesh(name,verts,faces,mat,parent,True)

def table(p, height=.78):
    box('Rounded teak top',(1.02,.075,.70),(0,height,0),'Teak',p,.035)
    for x in (-.4,.4):
        for z in (-.25,.25): box('Tapered legs',(.075,height-.04,.075),(x,(height-.04)/2,z),'Teak',p,.01)
    box('Cross rail',(.84,.06,.06),(0,.22,-.25),'Brass',p,.008)

def board(p):
    for x in (-.49,.49):
        box('Upright',(.065,1.65,.065),(x,.825,0),'Teak',p)
        beam('Easel back leg',(x,.04,-.31),(x,1.2,0),.029,'Teak',p)
    box('Framed board',(1.19,.86,.105),(0,1.27,0),'Teak',p,.035)
    box('Inset paper',(1.06,.73,.025),(0,1.27,.065),'Paper',p,.008)
    for x in (-.48,.48):
        for y in (.96,1.58): beam('Brass pin',(x,y,.075),(x,y,.09),.015,'Brass',p)

# Open guest journal with curved pages, ribbon, pen and an envelope.
p=parts['hotel-journal'];table(p)
box('Leather cover',(.88,.045,.56),(0,.842,0),'Jade',p,.018)
for side in (-1,1):
    for layer in range(5):
        verts=[(side*x,.875+layer*.005+.065*(1-x/.42)**2,z) for z in (-.245,.245) for x in (0,.1,.22,.32,.42)]
        mesh('Curved journal pages',verts,[(i,i+1,i+6,i+5) for i in range(4)],'Paper',p)
    for row in range(6):
        curve('Ink handwriting',[(side*.08,.956,-.18+row*.055),(side*.18,.923,-.175+row*.055),(side*(.32-(row%2)*.035),.907,-.18+row*.055)],.003,'Dark',p)
curve('Silk bookmark',[(0,.968,-.24),(.025,.966,.2),(.05,.86,.30),(.08,.79,.37)],.009,'Red',p)
beam('Fountain pen',(.36,.89,-.21),(.45,.89,.19),.011,'Brass',p,12)
box('Travel envelope',(.22,.012,.16),(-.32,.91,.17),'Rattan',p,.006)

# A route diagram with a train, three shops and a continuous red walking route.
p=parts['soi-route'];board(p)
for y in (1.44,1.48): beam('Rail line',(-.43,y,.091),(.43,y,.091),.007,'Dark',p)
box('Train carriage',(.32,.105,.025),(.23,1.51,.11),'Jade',p,.02)
for x in (.125,.205,.285):box('Train window',(.048,.044,.01),(x,1.526,.13),'Paper',p,.004)
for x in (.13,.33):beam('Train wheel',(x,1.444,.12),(x,1.444,.14),.02,'Dark',p,12)
for x,y in [(-.35,1.11),(-.07,1.30),(.30,1.13)]:
    box('Map shop',(.12,.09,.02),(x,y,.10),'Blue',p,.004)
    mesh('Shop roof',[(x-.08,y+.045,.12),(x,y+.11,.12),(x+.08,y+.045,.12)],[(0,1,2)],'Red',p)
curve('Route from soi to station',[(-.35,.99,.13),(-.19,1.10,.13),(.10,1.10,.13),(.1,1.32,.13),(.23,1.39,.13)],.014,'Red',p)
beam('You are here pin',(-.35,.99,.12),(-.35,.99,.15),.025,'Jade',p,12)
mesh('Route arrow',[(.23,1.43,.15),(.17,1.37,.15),(.29,1.37,.15)],[(0,1,2)],'Red',p)

# An open woven basket: crossing strips, curved handle, bottled water and a note.
p=parts['park-basket']
box('Basket base',(.83,.05,.58),(0,.055,0),'Teak',p,.04)
for row in range(8):
    y=.09+row*.043
    for z in (-.29,.29):box('Horizontal weave',(.84,.018,.024),(0,y,z),'Rattan',p,.006)
    for x in (-.41,.41):box('Side weave',(.024,.018,.58),(x,y,0),'Rattan',p,.006)
for x in [-.38+i*.063 for i in range(13)]:
    for z in (-.295,.295):curve('Vertical woven cane',[(x,.06,z),(x+.008,.20,z+.008),(x,.40,z)],.01,'Rattan',p)
for z in [-.25+i*.063 for i in range(9)]:
    for x in (-.415,.415):beam('End cane',(x,.06,z),(x,.40,z),.01,'Rattan',p)
curve('Basket handle',[(-.40,.33,0),(-.32,.68,0),(0,.79,0),(.32,.68,0),(.40,.33,0)],.027,'Teak',p)
for x,z in [(-.22,-.08),(.08,-.10),(.26,.08)]:
    lathe('Water bottle',[(0,0),(.071,0),(.075,.25),(.035,.30),(.035,.36),(0,.36)],(x,.08,z),'Blue',p)
    lathe('Bottle cap',[(0,0),(.039,0),(.039,.04),(0,.04)],(x,.44,z),'Paper',p)
    lathe('Bottle label',[(.076,.10),(.076,.19)],(x,.08,z),'Paper',p)
box('Volunteer note',(.24,.17,.018),(-.12,.29,.32),'Paper',p,.008)

# The recipe board has a bowl, separate chilli jar and a serving shelf.
p=parts['market-recipe'];board(p)
box('Serving shelf',(1.12,.055,.42),(0,.69,.12),'Teak',p,.02)
lathe('Rice bowl',[(0,0),(.08,0),(.17,.13),(.18,.16),(.16,.17),(0,.08)],(-.25,.72,.15),'Jade',p)
lathe('Rice mound',[(0,.10),(.15,.10),(.11,.18),(0,.21)],(-.25,.72,.15),'Paper',p)
lathe('Chilli jar',[(0,0),(.095,0),(.10,.20),(.085,.22),(0,.22)],(.28,.72,.13),'Red',p)
lathe('Jar lid',[(0,0),(.105,0),(.105,.035),(0,.035)],(.28,.94,.13),'Brass',p)
for row in range(4):
    beam('Recipe line',(-.36,1.50-row*.10,.098),(.30-(row%2)*.12,1.50-row*.10,.098),.008,'Dark',p)
curve('Chilli drawing',[(.23,1.14,.11),(.28,1.07,.11),(.40,1.01,.11)],.033,'Red',p)
curve('Chilli stem',[(.23,1.14,.11),(.21,1.19,.11),(.25,1.21,.11)],.012,'Leaf',p)

# Hollow carved long-tail keepsake on a chamfered stone plinth.
p=parts['river-keepsake']
box('Stone plinth',(.64,.66,.50),(0,.33,0),'Stone',p,.055)
box('Plinth cap',(.79,.075,.62),(0,.70,0),'Teak',p,.025)
stations=[(-.52,.015,.93),(-.38,.16,.83),(0,.20,.79),(.37,.14,.85),(.54,.012,1.04)]
verts=[]
for x,w,y in stations: verts.extend([(x,y,-w),(x,y-.14,0),(x,y,w)])
faces=[(j*3+k,(j+1)*3+k,(j+1)*3+k+1,j*3+k+1) for j in range(4) for k in range(2)]
hull=mesh('Carved hull',verts,faces,'Teak',p);solid=hull.modifiers.new('Wood hull thickness','SOLIDIFY');solid.thickness=.025
for side in (-1,1):curve('Golden gunwale',[(x,y,side*w) for x,w,y in stations],.015,'Brass',p)
for x in (-.26,0,.25):box('Boat seat',(.085,.025,.29),(x,.83,0),'Jade',p,.007)
curve('Raised prow',[(.43,.91,0),(.54,1.05,0),(.59,1.23,0)],.025,'Teak',p)
beam('Long tail shaft',(-.34,.88,0),(-.68,.79,.13),.011,'Brass',p)
box('Visitors note',(.24,.15,.018),(0,.49,.26),'Paper',p,.006)

# An unfinished bamboo lantern and paper samples on a work table.
p=parts['artisan-lantern'];table(p,.64)
for y in (.72,1.27):
    for z in (-.22,.22):beam('Bamboo rim',(-.22,y,z),(.22,y,z),.018,'Rattan',p)
    for x in (-.22,.22):beam('Bamboo rim',(x,y,-.22),(x,y,.22),.018,'Rattan',p)
for x in (-.22,.22):
    for z in (-.22,.22):beam('Bamboo frame',(x,.71,z),(x,1.28,z),.018,'Rattan',p)
for z in (-.22,.22):
    beam('Diagonal brace',(-.22,.73,z),(.22,1.26,z),.009,'Rattan',p)
box('Half fitted paper',(.40,.47,.012),(0,.99,-.225),'Paper',p,.002)
curve('Hanging loop',[(-.08,1.28,0),(-.07,1.43,0),(.07,1.43,0),(.08,1.28,0)],.012,'Brass',p)
for x in (.32,.38,.44):beam('Spare bamboo strip',(x,.69,-.21),(x-.04,.69,.23),.01,'Rattan',p)
box('Paper sample',(.24,.012,.23),(-.35,.69,.08),'Paper',p,.006)

bake_parts(root)
bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(MODELS/'city-memories.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
triangles=sum(sum(len(poly.vertices)-2 for poly in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
# Export origins coincide with existing world interaction points. Only the studio layout is offset.
for i,p in enumerate(parts.values()):p.location.x=(i%3-1)*1.65;p.location.y=(i//3)*-2.15
box('Studio floor',(16,.06,16),(0,-.05,0),'Paper',None,0)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.world.color=(.3,.3,.3)
for pos,power,size in [((-3,-5,7),950,5),((5,3,5),850,4)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,-1,0.5))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-7,6));camera=bpy.context.object;camera.rotation_euler=(Vector((0,-1,.5))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=6.3;scene.camera=camera
scene.render.resolution_x=1500;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'city-memories.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'city-memories.blend'));bpy.ops.render.render(write_still=True)
report={'triangles':triangles,'bytes':(MODELS/'city-memories.glb').stat().st_size,'parts':names}
(OUT/'manifest.json').write_text(json.dumps(report,indent=2));print('CITY_MEMORIES_EXPORTED',json.dumps(report))
