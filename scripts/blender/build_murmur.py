"""Original wind-wisp anatomy for the Lumphini encounter. Imported by build_river_spirits.py."""
import math
from build_landmarks import bpy,material,empty,mesh,beam,curve,vec,finish

def build_murmur(root):
    material('Mist porcelain',(.40,.70,.62),.28,.08,.15)
    material('Mist folds',(.16,.39,.38),.5,.08)
    material('Mist gold',(.70,.48,.20),.35,.55)
    material('Mist spark',(.68,.88,.60),.3,.05,.65)
    material('Mist eyes',(.009,.034,.040),.72)
    wisp=empty('MurmurWisp',root)
    face=empty('MurmurFace',wisp);veils=empty('MurmurVeils',wisp);orbit=empty('MurmurOrbit',wisp)
    body=empty('MurmurBody',wisp)
    def sphere(name,at,size,mat,parent):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=1,location=vec(at));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,name,mat,parent)
        for p in o.data.polygons:p.use_smooth=True
        return o
    sphere('Living porcelain cloud',(0,1.9,0),(.57,.67,.68),'Mist porcelain',body)
    # Inset eye patches face the party (-X); no humanoid mask or crown.
    for side in [-1,1]:
        sphere('Deep wisp eye',(-.535,1.99,side*.22),(.06,.10,.07),'Mist eyes',face)
        sphere('Catchlight',(-.586,2.02,side*.225),(.012,.021,.020),'Mist spark',face)
        sphere('Porcelain cheek',(-.465,1.79,side*.39),(.055,.067,.11),'Mist folds',face)
    curve('Small quiet mouth',[(-.573,1.77,-.065),(-.596,1.75,0),(-.573,1.77,.065)],.015,'Mist eyes',face)
    # Folded, tapered streamers make a light floating silhouette rather than a robed person.
    for i in range(7):
        a=i*math.tau/7;vertices=[]
        for j in range(13):
            t=j/12;r=.43+.38*math.sin(t*math.pi)+.2*t;y=1.77-1.1*t+.1*math.sin(i)
            angle=a+.65*t;w=.21*math.sin(math.pi*t)+.024
            for k in [-1,0,1]:vertices.append((math.cos(angle)*r-math.sin(angle)*w*k,y+(.065 if k==0 else 0),math.sin(angle)*r+math.cos(angle)*w*k))
        o=mesh('Windfold ribbon',vertices,[(j*3+k,j*3+k+1,(j+1)*3+k+1,(j+1)*3+k) for j in range(12) for k in range(2)],'Mist porcelain' if i%2 else 'Mist folds',veils,True)
        mod=o.modifiers.new('Fold edge','SOLIDIFY');mod.thickness=.018
        c=curve('Fine gilt fold',[vertices[j*3+1] for j in range(13)],.012,'Mist gold',veils);c.data.resolution_u=3
    for side in [-1,1]:
        vs=[(.0,2.25,side*.40),(.0,2.50,side*.70),(.1,2.75,side*.92),(.18,2.68,side*.73),(.12,2.35,side*.45)]
        o=mesh('Swept paper crest',vs,[(0,1,2),(0,2,3),(0,3,4)],'Mist folds',body,True);mod=o.modifiers.new('Paper thickness','SOLIDIFY');mod.thickness=.025
        curve('Gold crest edge',[vs[0],vs[1],vs[2]],.017,'Mist gold',body)
    # Three broken breeze arcs surround the stolen spark; open space keeps the face readable.
    for i in range(3):
        angle=i*math.tau/3
        points=[(.25+math.sin(t)*.15,1.9+math.sin(angle+t)*1.0,math.cos(angle+t)*1.0) for t in [j*.08 for j in range(17)]]
        c=curve('Breeze arc',points,.018,'Mist gold',orbit);c.data.resolution_u=3
        sphere('Lantern spark',points[-1],(.075,.075,.075),'Mist spark',orbit)
    return wisp,veils,orbit
