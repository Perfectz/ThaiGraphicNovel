import * as T from 'three';

/** Collect the authored north wall and its attached artwork, preserving the floor and furniture. */
export function groupHotelNorthWall(hotel: T.Group): T.Group {
  hotel.updateWorldMatrix(true, true);
  const attached: T.Object3D[] = [];
  hotel.traverse((object) => {
    if (!(object instanceof T.Mesh || object instanceof T.Sprite)) return;
    const bounds = new T.Box3().setFromObject(object);
    if (
      bounds.min.z >= 22.85 &&
      bounds.max.z <= 23.75 &&
      bounds.min.x >= -62.2 &&
      bounds.max.x <= -43.7 &&
      bounds.max.y > 0.3
    )
      attached.push(object);
  });
  const wall = new T.Group();
  wall.name = 'hotel-north-wall';
  hotel.add(wall);
  attached.forEach((object) => wall.attach(object));
  return wall;
}
