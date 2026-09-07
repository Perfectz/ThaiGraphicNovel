"""Render the game's actual authored environment assets for the showcase."""
import bpy, math
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'videos/bangkok-rift-showcase/assets'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.render.resolution_x=1920; scene.render.resolution_y=720; scene.render.resolution_percentage=100
scene.world.color=(.025,.045,.052)
for name,x in [('yaowarat-shophouse',-7),('sukhumvit-railway',0),('river-longtail',7)]:
    previous=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/bangkok/models'/f'{name}.glb'))
    objects=[o for o in bpy.data.objects if o not in previous]
    if name == 'sukhumvit-railway':
        for o in objects:
            if o.name == 'Skytrain': o.location.z=4.62
        bpy.context.view_layer.update()
    root=bpy.data.objects.new(name,None);scene.collection.objects.link(root)
    points=[o.matrix_world @ Vector(c) for o in objects if o.type=='MESH' for c in o.bound_box]
    low=Vector([min(p[i] for p in points) for i in range(3)]);high=Vector([max(p[i] for p in points) for i in range(3)])
    scale=7/max(high-low); center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
    for o in objects:
        if o.parent not in objects:
            o.parent=root
    root.scale=(scale,)*3;root.location=Vector((x,0,.16))-center*scale
    root.rotation_euler[2]=math.radians(-10 if x==-7 else 0)
mat=bpy.data.materials.new('Midnight studio');mat.diffuse_color=(.026,.075,.087,1)
bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(mat)
for loc,power,color,size in [((0,-8,16),3000,(1,.78,.43),12),((-12,4,12),2500,(.34,.74,1),10),((12,8,14),3500,(1,.62,.26),8)]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.color=color;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(Vector((0,0,2))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(18,-28,17));cam=bpy.context.object;scene.camera=cam
cam.rotation_euler=(Vector((0,0,2.8))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=36
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'asset-showcase.blend'))
scene.render.filepath=str(OUT/'models.png');bpy.ops.render.render(write_still=True)
