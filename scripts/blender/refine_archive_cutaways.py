import bpy,bmesh,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/blender/oldtown-archive.blend'))
root=bpy.data.objects['Archive'];base=bpy.data.objects['ArchiveBase']
for part in list(root.children):
    if not part.name.endswith('Walls'):continue
    for obj in list(part.children_recursive):
        if obj.type!='MESH':continue
        indices=[i for i,m in enumerate(obj.data.materials) if m.name=='Plaster']
        if not indices or not any(p.material_index in indices for p in obj.data.polygons):continue
        data=obj.data.copy();sill=bpy.data.objects.new(part.name+'Sill',data);bpy.context.collection.objects.link(sill);sill.parent=base;sill.matrix_world=obj.matrix_world.copy()
        for mesh,keep in [(data,True),(obj.data,False)]:
            bm=bmesh.new();bm.from_mesh(mesh);remove=[f for f in bm.faces if (f.material_index in indices)!=keep];bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(mesh);bm.free();mesh.update()
# Export only the architectural root, preserving the authored per-room hierarchy.
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for obj in root.children_recursive:obj.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/bangkok/models/oldtown-archive.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
# The editor preview shows the cutaway interior; this does not alter the exported full roof.
for part in root.children:
    if part.name.endswith('Roof'):
        for obj in [part,*part.children_recursive]:obj.hide_render=True
bpy.context.scene.render.filepath=str(ROOT/'artifacts/archive/blender-interior.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/oldtown-archive.blend'))
bpy.ops.render.render(write_still=True)
print('ARCHIVE_SILLS_PRESERVED')
