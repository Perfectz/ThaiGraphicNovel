import * as T from 'three';

/** Build a resting pose from this character's own rig, never another model's bind pose. */
export class ResidentPose {
  private joints: { bone: T.Bone; rotation: T.Quaternion; position: T.Vector3 }[] = [];
  private rotation = new T.Quaternion();
  private axis = new T.Vector3(1, 0, 0);
  constructor(body: T.Object3D, clip?: T.AnimationClip) {
    const bones: T.Bone[] = [];
    body.traverse((node) => {
      if (node instanceof T.Bone) bones.push(node);
    });
    if (clip) {
      const mixer = new T.AnimationMixer(body);
      mixer.clipAction(clip).play();
      // Opposing strides cancel into a planted stance while retaining the rig's arm posture.
      for (let sample = 0; sample < 16; sample++) {
        mixer.setTime((clip.duration * sample) / 16);
        bones.forEach((bone, i) => {
          if (sample === 0)
            this.joints.push({ bone, rotation: bone.quaternion.clone(), position: bone.position.clone() });
          else {
            this.joints[i].rotation.slerp(bone.quaternion, 1 / (sample + 1));
            this.joints[i].position.lerp(bone.position, 1 / (sample + 1));
          }
        });
      }
      mixer.stopAllAction();
      mixer.uncacheRoot(body);
    } else
      this.joints = bones.map((bone) => ({
        bone,
        rotation: bone.quaternion.clone(),
        position: bone.position.clone(),
      }));
    this.update(0, false, true);
  }
  update(time: number, engaged: boolean, reducedMotion: boolean) {
    for (const { bone, rotation, position } of this.joints) {
      bone.quaternion.copy(rotation);
      bone.position.copy(position);
      if (reducedMotion) continue;
      let angle = 0;
      if (bone.name === 'Spine02') angle = Math.sin(time * 1.65) * 0.012;
      if (bone.name === 'Head') {
        angle = Math.sin(time * 0.7) * 0.017;
        if (engaged) angle += Math.sin(time * 2.2) * 0.035 * Math.max(0, Math.sin(time * 0.55));
      }
      if (bone.name === 'RightForeArm' && engaged) angle = Math.max(0, Math.sin(time * 0.8)) * 0.09;
      if (angle) bone.quaternion.multiply(this.rotation.setFromAxisAngle(this.axis, angle));
    }
  }
}
