"""Modèles 3D du site. Régénérer :
blender --background --factory-startup --python art/build_phone.py
"""
import math
import os

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, D, R = 1.0, 2.17, 0.105, 0.155  # corps du téléphone
SW, SH, SR = 0.936, 2.088, 0.125  # écran (rapport 1280 x 2856)


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, metallic=0.0, roughness=0.5, coat=0.0, emission=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = roughness
    if 'Coat Weight' in b.inputs:
        b.inputs['Coat Weight'].default_value = coat
    if emission:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = 1
    return m


def outline(w, h, r, steps=14):
    pts = []
    for cx, cy, start in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
                          (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(steps + 1):
            a = math.radians(start + 90 * i / steps)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def slab(name, w, h, d, r, mat, bevel=0.0, z=0.0, x=0.0, y=0.0, segments=4):
    bm = bmesh.new()
    face = bm.faces.new([bm.verts.new((px + x, py + y, z - d / 2)) for px, py in outline(w, h, r)])
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, vec=(0, 0, d), verts=[v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(mat)
    if bevel:
        b = ob.modifiers.new('Bevel', 'BEVEL')
        b.width, b.segments, b.limit_method = bevel, segments, 'ANGLE'
        b.angle_limit = math.radians(50)
    for p in me.polygons:
        p.use_smooth = True
    ob.modifiers.new('Normals', 'WEIGHTED_NORMAL').keep_sharp = True
    return ob


def screen(mat):
    """Écran plat à coins ronds, UV plein cadre."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    f = bm.faces.new([bm.verts.new((x, y, D / 2 + 0.0035)) for x, y in outline(SW, SH, SR)])
    for l in f.loops:
        l[uv].uv = (l.vert.co.x / SW + 0.5, l.vert.co.y / SH + 0.5)
    bmesh.ops.triangulate(bm, faces=[f])
    me = bpy.data.meshes.new('Screen')
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new('Screen', me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


def lens(x, y, r, mat, ring):
    out = []
    for radius, depth, m, z in ((r, 0.03, ring, -D / 2 - 0.028), (r * 0.72, 0.034, mat, -D / 2 - 0.030)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=depth, location=(x, y, z))
        ob = bpy.context.object
        ob.data.materials.append(m)
        b = ob.modifiers.new('Bevel', 'BEVEL')
        b.width, b.segments = 0.006, 2
        for p in ob.data.polygons:
            p.use_smooth = True
        ob.modifiers.new('Normals', 'WEIGHTED_NORMAL')
        out.append(ob)
    return out


def phone():
    frame = material('Frame', (0.42, 0.56, 0.49), metallic=0.95, roughness=0.28)
    back = material('Back', (0.045, 0.2, 0.135), roughness=0.38, coat=0.5)
    bezel = material('Bezel', (0.004, 0.005, 0.005), roughness=0.16, coat=1)
    scr = material('Screen', (1, 1, 1), roughness=0.2)
    glass = material('Lens', (0.008, 0.012, 0.016), metallic=0.4, roughness=0.06, coat=1)
    parts = [
        slab('Frame', W, H, D, R, frame, bevel=0.034, segments=5),
        slab('Back', W - 0.045, H - 0.045, 0.012, R - 0.022, back, bevel=0.005, z=-D / 2 - 0.001, segments=2),
        slab('Bezel', W - 0.026, H - 0.026, 0.012, R - 0.013, bezel, bevel=0.005, z=D / 2 - 0.003, segments=2),
        slab('Camera', 0.40, 0.40, 0.034, 0.12, back, bevel=0.012, z=-D / 2 - 0.014, x=0.235, y=0.79),
        slab('Power', 0.03, 0.24, 0.036, 0.012, frame, bevel=0.006, x=W / 2 + 0.002, y=0.30, segments=2),
        slab('Volume', 0.03, 0.40, 0.036, 0.012, frame, bevel=0.006, x=W / 2 + 0.002, y=0.70, segments=2),
        screen(scr),
    ]
    parts += lens(0.145, 0.88, 0.075, glass, frame)
    parts += lens(0.325, 0.70, 0.075, glass, frame)
    # Pastille de la caméra avant, comme sur l'appareil des captures.
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.026, depth=0.002,
                                        location=(0, SH / 2 - 0.062, D / 2 + 0.0045))
    bpy.context.object.data.materials.append(bezel)
    parts.append(bpy.context.object)
    root = bpy.data.objects.new('Phone', None)
    bpy.context.collection.objects.link(root)
    for p in parts:
        p.parent = root
    return root, scr


def export(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_animations=False, export_cameras=False, export_lights=False)


def light(kind, loc, energy, size, color=(1, 1, 1), target=(0, 0, 0)):
    d = bpy.data.lights.new('L', kind)
    d.energy, d.color = energy, color
    if kind == 'AREA':
        d.size = size
    o = bpy.data.objects.new('L', d)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.collection.objects.link(o)


def setup_render(w, h, transparent=True):
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.samples = 96
    s.cycles.use_denoising = True
    s.cycles.device = 'CPU'
    s.render.resolution_x, s.render.resolution_y = w, h
    s.render.film_transparent = transparent
    s.view_settings.view_transform = 'Standard'
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA'
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.82, 0.92, 0.95, 1)
    bg.inputs[1].default_value = 0.4
    s.world = world


def camera(loc, target, lens_mm=70, ortho=None):
    c = bpy.data.cameras.new('C')
    c.lens = lens_mm
    if ortho:
        c.type, c.ortho_scale = 'ORTHO', ortho
    o = bpy.data.objects.new('C', c)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.collection.objects.link(o)
    bpy.context.scene.camera = o


def still(root, scr, image, path):
    """Image de secours quand le navigateur n'a pas WebGL."""
    nt = scr.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(image)
    nt.links.new(tex.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Specular IOR Level'].default_value = 0.0
    b.inputs['Emission Strength'].default_value = 1
    b.inputs['Base Color'].default_value = (0, 0, 0, 1)
    root.rotation_euler = (math.radians(-6), math.radians(24), math.radians(5))
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def van():
    """Petit van vu de dessus, qui suit la route."""
    body = material('VanBody', (0.96, 0.98, 0.96), roughness=0.35, coat=0.6)
    roof = material('VanRoof', (0.03, 0.2, 0.11), roughness=0.4, coat=0.4)
    glass = material('VanGlass', (0.03, 0.07, 0.1), roughness=0.08, coat=1)
    tyre = material('VanTyre', (0.01, 0.01, 0.01), roughness=0.8)
    orange = material('VanStripe', (0.68, 0.13, 0.03), roughness=0.5)
    lamp = material('VanLamp', (1, 0.85, 0.4), roughness=0.3)
    for x in (-0.42, 0.42):
        for y in (-0.58, 0.62):
            slab('Tyre', 0.14, 0.36, 0.2, 0.05, tyre, bevel=0.03, x=x, y=y, z=0.1)
    slab('Body', 0.92, 2.0, 0.55, 0.2, body, bevel=0.09, z=0.45)
    slab('Roof', 0.74, 1.28, 0.16, 0.14, roof, bevel=0.05, y=-0.22, z=0.78)
    slab('Stripe', 0.5, 0.07, 0.02, 0.02, orange, y=-0.02, z=0.87)
    slab('Stripe', 0.5, 0.07, 0.02, 0.02, orange, y=-0.16, z=0.87)
    slab('Solar', 0.46, 0.4, 0.03, 0.03, glass, bevel=0.008, y=-0.52, z=0.875)
    slab('Wind', 0.7, 0.2, 0.06, 0.07, glass, bevel=0.02, y=0.58, z=0.71)
    for x in (-0.3, 0.3):
        slab('Lamp', 0.16, 0.08, 0.06, 0.03, lamp, bevel=0.015, x=x, y=0.97, z=0.52)


# --- téléphone
clear()
root, scr = phone()
bpy.context.view_layer.update()
export(os.path.join(ROOT, 'public', 'models', 'phone.glb'))
setup_render(900, 1500)
light('AREA', (-3.2, 2.6, 4.2), 85, 3)
light('AREA', (3.6, 1.2, 2.4), 45, 2.4, (0.78, 1, 0.9))
light('AREA', (0.5, -3.2, -2.2), 40, 2.5, (0.7, 0.85, 1))
camera((0, 0.0, 7.2), (0, 0, 0), 85)
tmp = os.environ.get('LVM_SHOTS', '')
for mode in ('light', 'dark'):
    shot = os.path.join(tmp, f'map-{mode}.png')
    if os.path.exists(shot):
        still(root, scr, shot, os.path.join(tmp, f'phone-{mode}.png'))
root.rotation_euler = (0, 0, 0)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'art', 'phone.blend'))

# --- van
clear()
van()
setup_render(360, 720)
light('AREA', (-2.4, 2.5, 5), 110, 2.5)
light('AREA', (2.6, -1, 4), 40, 2.5)
camera((0, 0, 8), (0, 0, 0), ortho=2.5)
bpy.context.scene.render.filepath = os.path.join(tmp, 'van.png')
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'art', 'van.blend'))
print('LVM_DONE')
