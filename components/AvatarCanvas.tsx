"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment, ContactShadows, Grid } from "@react-three/drei";
import { useRef, Suspense, useEffect } from "react";
import * as THREE from "three";

useGLTF.preload("/models/vroid_girl1.glb");

interface ModelProps { isTalking: boolean; }
interface AvatarProps { isTalking?: boolean; autoRotate?: boolean; }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Model({ isTalking }: ModelProps) {
  const { scene, animations } = useGLTF("/models/vroid_girl1.glb");
  const group = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  // Set up the idle animation from the GLB on first render
  useEffect(() => {
    if (!group.current || animations.length === 0) return;

    // Create mixer on the avatar group
    const mixer = new THREE.AnimationMixer(group.current);
    mixerRef.current = mixer;

    // Play the first animation (idle) — loop it forever
    const action = mixer.clipAction(animations[0]);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animations]);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;

    // Advance animation mixer every frame
    if (mixerRef.current) mixerRef.current.update(delta);

    // Subtle breathing on top of the animation
    group.current.position.y = -1.5 + Math.sin(clock.getElapsedTime() * 0.8) * 0.03;
  });

  return <primitive ref={group} object={scene} scale={2.5} position={[0, -1.5, 0]} />;
}

function Lights() {
  const pointRef1 = useRef<THREE.PointLight>(null);
  const pointRef2 = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (pointRef1.current) pointRef1.current.intensity = 0.6 + Math.sin(t * 1.5) * 0.2;
    if (pointRef2.current) pointRef2.current.intensity = 0.4 + Math.cos(t * 1.2) * 0.1;
  });

  return (
    <>
      <ambientLight color={0xffffff} intensity={1.5} />
      <directionalLight position={[3, 6, 4]} intensity={1.2} color={0xfff5ee} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.001} />
      <directionalLight position={[-4, 3, 2]} intensity={0.8} color={0xe8f4ff} />
      <directionalLight position={[0, 4, -5]} intensity={0.5} color={0xffffff} />
      <pointLight ref={pointRef1} position={[2, 2, 2]} color={0x88ccff} intensity={0.6} distance={8} />
      <pointLight ref={pointRef2} position={[-2, 1, -2]} color={0xffddcc} intensity={0.4} distance={8} />
    </>
  );
}

function Floor() {
  return (
    <>
      <Grid position={[0, -1.5, 0]} args={[20, 20]} cellSize={0.6} cellThickness={0.6} cellColor="#ccddee" sectionSize={3} sectionThickness={1} sectionColor="#aabbcc" fadeDistance={12} fadeStrength={1} infiniteGrid />
      <ContactShadows position={[0, -1.49, 0]} opacity={0.15} scale={4} blur={2} far={4} color="#334455" />
    </>
  );
}

function Loader() {
  return (
    <mesh>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshBasicMaterial color={0x3388ff} wireframe />
    </mesh>
  );
}

export default function Avatar({ isTalking = false, autoRotate = false }: AvatarProps) {
  return (
    // Full size wrapper
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      <Canvas
        camera={{ position: [0, 1, 4], fov: 60 }}
        shadows
        // ✅ This is the key — Canvas itself does NOT intercept pointer events
        // Only the OrbitControls area inside will handle them
        style={{ width: '100%', height: '100%' }}
        eventSource={typeof document !== 'undefined' ? document.body : undefined}
        eventPrefix="client"
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.3,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(0x0a0a0a);
          scene.fog = new THREE.FogExp2(0x0a0a0a, 0.03);
        }}
      >
        <Suspense fallback={<Loader />}>
          <Lights />
          <Floor />
          <Model isTalking={isTalking} />
          <Environment preset="dawn" />
          <OrbitControls
            enableZoom
            enablePan={false}
            minDistance={3.5}
            maxDistance={4}
            maxPolarAngle={Math.PI / 2}
            target={[0, 0, 0]}
            autoRotate={autoRotate}
            autoRotateSpeed={1.5}
            enableDamping
            dampingFactor={0.05}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}