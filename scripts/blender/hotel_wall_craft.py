"""Original sculpted wall collection, in the hotel's local Y-up coordinates."""
import math
from build_landmarks import bpy, material, empty, box, mesh, beam, curve


def build_wall_craft(root):
    part = empty('BedroomWallCraft', root)
    material('Relief jade', (.048, .16, .125), .64)
    material('Carved gold', (.72, .48, .19), .43, .42)
    material('Lantern silk', (.92, .70, .38), .8, 0, .55)

    # Face the open room (+X). The complete collection stays within 0.6 m of the wall.
    def point(u, v, depth, center):
        return (-7.76 + depth, 2.22 + v, center + u)

    def arch(width, bottom, shoulder, rise):
        return [(-width, bottom), (width, bottom), (width, shoulder)] + [
            (width * math.cos(i * math.pi / 16), shoulder + rise * math.sin(i * math.pi / 16))
            for i in range(1, 17)
        ]

    def plaque(name, outline, center, depth, thickness, mat):
        n = len(outline)
        verts = [point(u, v, d, center) for d in (depth, depth + thickness) for u, v in outline]
        faces = [tuple(range(n)), tuple(reversed(range(n, 2*n)))]
        faces += [(i, i+n, (i+1)%n+n, (i+1)%n) for i in range(n)]
        return mesh(name, verts, faces, mat, part)

    def petal(center, u, v, angle, length, width, depth, mat):
        # Curved cross-sections create actual relief, including a raised central vein.
        verts = []
        for i in range(9):
            t = i / 8
            w = width * max(.025, math.sin(math.pi * t) ** .8)
            for side in (-1, 0, 1):
                along = t * length
                across = side * w
                uu = u + math.sin(angle) * along + math.cos(angle) * across
                vv = v + math.cos(angle) * along - math.sin(angle) * across
                relief = math.sin(math.pi*t) * (.055 if side == 0 else .008)
                verts.append(point(uu, vv, depth + relief, center))
        faces = [(i*3+j, (i+1)*3+j, (i+1)*3+j+1, i*3+j+1) for i in range(8) for j in range(2)]
        o = mesh('Sculpted botanical petal', verts, faces, mat, part, True)
        shell = o.modifiers.new('Carved thickness', 'SOLIDIFY')
        shell.thickness = .012
        spine = [point(u + math.sin(angle)*t*length, v + math.cos(angle)*t*length,
                       depth + math.sin(math.pi*t)*.055 + .008, center) for t in (0, .25, .5, .75, 1)]
        curve('Fine carved vein', spine, .006, 'Brass', part)

    for variant, center in enumerate((1.65, 2.95, 4.25)):
        outline = arch(.56, -.80, .47, .40)
        plaque('Arched teak relief frame', outline, center, -.065, .105, 'Teak')
        plaque('Recessed jade field', arch(.49, -.72, .45, .34), center, .042, .012, 'Relief jade')
        for inset, radius in ((1, .022), (.90, .008)):
            points = [point(u*inset, v*inset, .077, center) for u, v in outline]
            # Polyline cylinders retain sharp lower corners and a genuinely arched crown.
            for a, b in zip(points, points[1:] + points[:1]):
                beam('Brass arch bead', a, b, radius, 'Brass', part, 8)
        if variant == 1:
            for layer, (length, width, depth) in enumerate(((.67, .125, .084), (.51, .12, .12))):
                for angle in (-.95, -.48, 0, .48, .95):
                    petal(center, 0, -.37 + layer*.03, angle, length, width, depth, 'Carved gold')
            curve('Lotus stem', [point(0, -.67, .09, center), point(.06, -.52, .10, center), point(0, -.33, .10, center)], .014, 'Brass', part)
        else:
            sign = 1 if variant == 0 else -1
            curve('Curved botanical stem', [point(0, -.64, .095, center), point(-sign*.10, -.16, .11, center), point(sign*.06, .42, .10, center)], .013, 'Brass', part)
            for i in range(6):
                side = -1 if i % 2 else 1
                petal(center, -.02, -.53 + i*.145, side*(.78 + i*.035), .34-i*.018, .09, .10,
                      'Carved gold' if i % 3 == 0 else 'Celadon')
        for u in (-.34, .34):
            beam('Frame brass pin', point(u, -.66, .076, center), point(u, -.66, .091, center), .017, 'Brass', part, 10)

    # Two open woven lanterns replace the rectangular procedural sconces.
    for z in (-2.3, 5.4):
        box('Lantern wall plate', (.07, .61, .24), (-7.76, 2.05, z), 'Dark teak', part, .03)
        curve('Swept brass bracket', [(-7.72, 2.29, z), (-7.47, 2.37, z), (-7.37, 2.29, z)], .019, 'Brass', part)
        beam('Lantern suspension', (-7.37, 2.29, z), (-7.37, 2.22, z), .012, 'Brass', part, 10)
        # Compact hourglass silhouette, silk diffuser inside a separate woven cage.
        x = -7.37
        box('Warm silk diffuser', (.21, .34, .21), (x, 2.02, z), 'Lantern silk', part, .06)
        for i in range(16):
            a = i*math.tau/16
            points = [(x+r*math.cos(a), y, z+r*math.sin(a)) for y, r in ((1.77,.13),(1.84,.19),(2.04,.20),(2.20,.13))]
            curve('Bent rattan lantern rib', points, .008, 'Honey cane', part)
        for y, r in ((1.77,.13),(1.84,.19),(1.94,.20),(2.04,.20),(2.14,.16),(2.20,.13)):
            points = [(x+r*math.cos(i*math.tau/16),y,z+r*math.sin(i*math.tau/16)) for i in range(17)]
            curve('Woven lantern ring', points, .009 if y in (1.77,2.20) else .006, 'Brass' if y in (1.77,2.20) else 'Honey cane', part)
        beam('Lantern lower finial', (x,1.73,z), (x,1.77,z), .025, 'Brass', part, 12)
    # Consistently outward normals on closed reliefs after coordinate conversion.
    for o in part.children:
        if o.type == 'CURVE':
            # Small decorative strands need four sides, not the studio default tube density.
            o.data.resolution_u = 2
            o.data.bevel_resolution = 0
        if o.type == 'MESH':
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
            bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    return part
