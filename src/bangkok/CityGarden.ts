import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Opaque, individually shaped foliage: no alpha cards or per-leaf draw calls. */
export class CityGarden {
  private bark = new T.MeshStandardMaterial({ color: '#796650', roughness: 1 });
  private greens = ['#31584a', '#47734e', '#64834e', '#83945a'].map(
    (color) => new T.MeshStandardMaterial({ color, roughness: 0.86, side: T.DoubleSide }),
  );
  private stone = new T.MeshStandardMaterial({ color: '#a49b7e', roughness: 1 });
  private petals = new T.MeshStandardMaterial({ color: '#f2b9bb', roughness: 0.7, side: T.DoubleSide });
  private heart = new T.MeshStandardMaterial({ color: '#e8c178', roughness: 0.8 });

  private add(root: T.Group, geometry: T.BufferGeometry, material: T.Material, position = new T.Vector3()) {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }

  private branch(root: T.Group, points: T.Vector3[], radius: number) {
    return this.add(root, new T.TubeGeometry(new T.CatmullRomCurve3(points), 7, radius, 6, false), this.bark);
  }

  private leaf(length: number, width: number) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      'position',
      new T.Float32BufferAttribute(
        [
          0,
          0,
          0,
          -width,
          length * 0.38,
          0.015,
          0,
          length * 0.47,
          0.08,
          0,
          0,
          0,
          0,
          length * 0.47,
          0.08,
          width,
          length * 0.38,
          0.015,
          -width,
          length * 0.38,
          0.015,
          -width * 0.65,
          length * 0.72,
          0.04,
          0,
          length * 0.47,
          0.08,
          width,
          length * 0.38,
          0.015,
          0,
          length * 0.47,
          0.08,
          width * 0.65,
          length * 0.72,
          0.04,
          -width * 0.65,
          length * 0.72,
          0.04,
          0,
          length,
          0.14,
          0,
          length * 0.47,
          0.08,
          width * 0.65,
          length * 0.72,
          0.04,
          0,
          length * 0.47,
          0.08,
          0,
          length,
          0.14,
        ],
        3,
      ),
    );
    const positions = geometry.getAttribute('position');
    const uv = new Float32Array(positions.count * 2);
    for (let i = 0; i < positions.count; i++) {
      uv[i * 2] = positions.getX(i) / (width * 2) + 0.5;
      uv[i * 2 + 1] = positions.getY(i) / length;
    }
    geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    return geometry;
  }

  tree(root: T.Group, x: number, z: number, scale: number, cutaway: (object: T.Object3D) => void) {
    const tree = new T.Group();
    tree.name = 'Layered shade tree';
    tree.position.set(x, 0.08, z);
    tree.scale.setScalar(scale);
    root.add(tree);
    this.branch(
      tree,
      [
        new T.Vector3(),
        new T.Vector3(0.06, 0.9, 0),
        new T.Vector3(-0.07, 1.8, 0.08),
        new T.Vector3(0.14, 2.9, 0),
      ],
      0.12,
    );
    // Buttress roots are small enough to fit the original tree's ground footprint.
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 0.4;
      this.branch(
        tree,
        [
          new T.Vector3(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3),
          new T.Vector3(0, 0.25, 0),
          new T.Vector3(0, 0.45, 0),
        ],
        0.055,
      );
    }
    const leaves: T.BufferGeometry[][] = this.greens.map(() => []);
    for (let b = 0; b < 10; b++) {
      const a = b * 2.39996 + x * 0.13,
        spread = b < 7 ? 0.9 : 0.35;
      const end = new T.Vector3(Math.cos(a) * spread, 2.25 + (b % 4) * 0.31, Math.sin(a) * spread);
      this.branch(
        tree,
        [
          new T.Vector3(0, 1.1 + (b % 3) * 0.3, 0),
          end.clone().multiply(new T.Vector3(0.55, 0.82, 0.55)),
          end,
        ],
        0.04,
      );
      for (let l = 0; l < 55; l++) {
        const az = l * 2.39996 + b,
          height = 1 - (2 * (l + 0.5)) / 55;
        const radius = Math.sqrt(1 - height * height);
        const p = end
          .clone()
          .add(new T.Vector3(Math.cos(az) * radius * 0.65, height * 0.47, Math.sin(az) * radius * 0.65));
        const leaf = this.leaf(0.28 + (l % 5) * 0.045, 0.09 + (l % 3) * 0.017);
        const transform = new T.Matrix4().compose(
          p,
          new T.Quaternion().setFromEuler(new T.Euler(0.4 + height * 1.5, az, -0.8 + (l % 4) * 0.5)),
          new T.Vector3(1, 1, 1),
        );
        leaf.applyMatrix4(transform);
        leaves[(l + b) % leaves.length].push(leaf);
      }
    }
    leaves.forEach((parts, i) => {
      this.add(tree, mergeGeometries(parts)!, this.greens[i]);
      parts.forEach((part) => part.dispose());
    });
    // Remove the complete silhouette when it blocks the party, including the trunk.
    cutaway(tree);
  }

  lakeside(root: T.Group) {
    const planting = new T.Group();
    planting.name = 'Lumphini planted lake banks';
    root.add(planting);
    // Stone edging remains inside the existing impassable pond footprint.
    for (let i = 0; i < 34; i++) {
      const horizontal = i < 22,
        n = horizontal ? i % 11 : (i - 22) % 6;
      const x = horizontal ? -27.65 + n * 0.93 : i < 28 ? -27.75 : -18.25;
      const z = horizontal ? (i < 11 ? 29.25 : 33.75) : 29.3 + n * 0.88;
      const rock = this.add(
        planting,
        new T.IcosahedronGeometry(0.32, 1),
        this.stone,
        new T.Vector3(x, 0.12, z),
      );
      rock.scale.set(1.5, 0.5 + (i % 3) * 0.12, 0.85);
      rock.rotation.y = i * 1.7;
    }
    for (let tuft = 0; tuft < 18; tuft++) {
      const x = -27.4 + (tuft % 9) * 1.08,
        z = tuft < 9 ? 29.43 : 33.5;
      for (let blade = 0; blade < 7; blade++) {
        const mesh = this.add(
          planting,
          this.leaf(0.35 + (blade % 4) * 0.14, 0.035),
          this.greens[blade % 4],
          new T.Vector3(x + Math.sin(blade * 3) * 0.14, 0.17, z + Math.cos(blade * 3) * 0.12),
        );
        mesh.rotation.set(0.2, blade * 2.4, Math.sin(blade) * 0.55);
      }
    }
    for (let i = 0; i < 14; i++) {
      const x = -26.8 + (i % 5) * 1.65,
        z = 30 + (i % 3) * 1.1;
      const pad = this.add(
        planting,
        new T.CircleGeometry(0.25 + (i % 3) * 0.05, 18, 0.15, Math.PI * 2 - 0.3),
        this.greens[(i % 2) + 1],
        new T.Vector3(x, 0.185, z),
      );
      pad.rotation.set(-Math.PI / 2, 0, i * 2.4);
      if (i % 3 !== 0) continue;
      for (let petal = 0; petal < 9; petal++) {
        const a = (petal * Math.PI * 2) / 9;
        const flower = this.add(planting, this.leaf(0.19, 0.065), this.petals, new T.Vector3(x, 0.21, z));
        flower.rotation.set(Math.sin(a) * 0.9, a, Math.cos(a) * 0.9);
      }
      this.add(planting, new T.SphereGeometry(0.065, 8, 5), this.heart, new T.Vector3(x, 0.29, z));
    }
  }
}
