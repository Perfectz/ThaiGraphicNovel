import * as T from 'three';

/** Release resources owned by a retired world or an unused model load. */
export function disposeWorldObject(root: T.Object3D, extraTextures: Iterable<T.Texture> = []) {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const textures = new Set(extraTextures);
  const skeletons = new Set<T.Skeleton>();
  const shadows = new Set<T.LightShadow>();
  root.traverse((object) => {
    if (object instanceof T.Mesh || object instanceof T.Points || object instanceof T.Line) {
      geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach((material) => materials.add(material));
    }
    // Three owns the shared sprite quad; this world owns its material and maps.
    if (object instanceof T.Sprite) materials.add(object.material);
    if (object instanceof T.SkinnedMesh) skeletons.add(object.skeleton);
    if (object instanceof T.InstancedMesh) object.dispose();
    if (
      object instanceof T.DirectionalLight ||
      object instanceof T.PointLight ||
      object instanceof T.SpotLight
    )
      shadows.add(object.shadow);
  });
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value instanceof T.Texture) textures.add(value);
    });
  });
  skeletons.forEach((skeleton) => skeleton.dispose());
  shadows.forEach((shadow) => shadow.dispose());
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}
