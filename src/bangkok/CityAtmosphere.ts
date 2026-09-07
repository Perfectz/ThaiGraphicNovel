import * as T from 'three';

/** Invitations make the agreed morning arrive; browsing a reply never changes the city. */
export function cityMorning(flags: readonly string[]) {
  return (
    ['departed', 'reunion-tomorrow', 'reunion-mali', 'reunion-arun'].every((f) => flags.includes(f)) &&
    !flags.includes('reunion-evening')
  );
}

/** A camera-centred sky and shared daylight across every district, with no wall-clock deadline. */
export class CityAtmosphere {
  readonly sky: T.Mesh<T.SphereGeometry, T.ShaderMaterial>;
  private plate: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial> | null = null;
  private morning = false;
  private day = 0;
  private initialized = false;
  private colors = {
    duskSun: new T.Color('#ffca91'),
    morningSun: new T.Color('#fff0d2'),
    duskSky: new T.Color('#a8bad7'),
    morningSky: new T.Color('#bedde9'),
    duskGround: new T.Color('#594439'),
    morningGround: new T.Color('#7e8b70'),
    duskFog: new T.Color('#555a82'),
    morningFog: new T.Color('#c1d9df'),
  };
  constructor(privateScene: T.Scene, sun: T.DirectionalLight, ambient: T.HemisphereLight, skyline: T.Group) {
    this.scene = privateScene;
    this.sun = sun;
    this.ambient = ambient;
    this.skyline = skyline;
    this.sky = new T.Mesh(
      new T.SphereGeometry(150, 32, 16),
      new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        uniforms: {
          day: { value: 0 },
          high: { value: new T.Color('#659ebd') },
          low: { value: new T.Color('#d8e8e4') },
        },
        vertexShader:
          'varying vec3 direction; void main(){ direction = position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `varying vec3 direction; uniform float day; uniform vec3 high; uniform vec3 low;
        void main(){
          vec3 d=normalize(direction);
          float elevation=pow(clamp(d.y,0.0,1.0),0.55);
          vec3 daylight=mix(low,high,elevation);
          float sun=dot(d,normalize(vec3(-12.0,18.0,9.0)));
          daylight+=vec3(1.0,0.84,0.59)*(smoothstep(0.99935,0.99975,sun)*0.85+pow(max(sun,0.0),120.0)*0.12);
          vec3 dusk=mix(vec3(0.065,0.10,0.14),vec3(0.006,0.019,0.037),elevation);
          gl_FragColor=vec4(mix(dusk,daylight,day),1.0);
          #include <colorspace_fragment>
        }`,
      }),
    );
    this.sky.name = 'Bangkok story sky';
    this.sky.userData.animated = true;
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }
  private scene: T.Scene;
  private sun: T.DirectionalLight;
  private ambient: T.HemisphereLight;
  private skyline: T.Group;
  bindBackdrop(plate: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>) {
    this.plate = plate;
    plate.material.transparent = true;
    plate.material.depthWrite = false;
    this.apply();
  }
  sync(flags: readonly string[]) {
    this.morning = cityMorning(flags);
    if (!this.initialized) {
      this.day = Number(this.morning);
      this.initialized = true;
      this.apply();
    }
  }
  update(dt: number, camera: T.Camera, reduced: boolean) {
    this.sky.position.copy(camera.position);
    this.day = reduced
      ? Number(this.morning)
      : T.MathUtils.damp(this.day, Number(this.morning), 1.1, Math.min(dt, 0.2));
    if (Math.abs(this.day - Number(this.morning)) < 0.001) this.day = Number(this.morning);
    this.apply();
  }
  private apply() {
    const t = this.day,
      c = this.colors;
    this.sky.material.uniforms.day.value = t;
    this.sun.color.copy(c.duskSun).lerp(c.morningSun, t);
    this.sun.intensity = T.MathUtils.lerp(2.7, 3.2, t);
    this.ambient.color.copy(c.duskSky).lerp(c.morningSky, t);
    this.ambient.groundColor.copy(c.duskGround).lerp(c.morningGround, t);
    this.ambient.intensity = T.MathUtils.lerp(0.85, 1.65, t);
    if (this.scene.fog instanceof T.FogExp2) {
      this.scene.fog.color.copy(c.duskFog).lerp(c.morningFog, t);
      this.scene.fog.density = T.MathUtils.lerp(0.006, 0.0045, t);
    }
    if (this.plate) {
      this.plate.material.opacity = 1 - t;
      this.plate.visible = t < 0.999;
    }
    this.skyline.visible = !this.plate || t > 0.001;
  }
  snapshot() {
    return {
      period: this.morning ? 'morning' : 'evening',
      daylight: this.day,
      backdropVisible: this.plate?.visible ?? false,
      skylineVisible: this.skyline.visible,
      sky: this.sky.position.toArray(),
      sun: this.sun.color.getHexString(),
      ambient: this.ambient.intensity,
    };
  }
}
