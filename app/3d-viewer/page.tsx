'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface SceneRefs {
  cube?: THREE.Mesh;
  material?: THREE.MeshStandardMaterial;
  edgeMat?: THREE.LineBasicMaterial;
  controls?: OrbitControls;
  renderer?: THREE.WebGLRenderer;
}

interface RotationInfo {
  x: string;
  y: string;
}

interface InfoState {
  fps: number;
  rotation: RotationInfo;
}

export default function ThreeScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRefs>({});

  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [info, setInfo] = useState<InfoState>({ fps: 0, rotation: { x: '0.0', y: '0.0' } });
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [color, setColor] = useState<string>('#00d4ff');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080c14);
    scene.fog = new THREE.FogExp2(0x080c14, 0.04);

    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(3, 2, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);

    const grid = new THREE.GridHelper(20, 30, 0x1a2a3a, 0x0d1926);
    grid.position.y = -1.5;
    scene.add(grid);

    const geometry = new THREE.BoxGeometry(2, 2, 2, 2, 2, 2);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: 0.4,
      roughness: 0.2,
      wireframe: false,
    });
    const cube = new THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>(geometry, material);
    cube.castShadow = true;
    scene.add(cube);

    // Subtle wireframe overlay
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.04,
    });
    cube.add(new THREE.Mesh(geometry, wireMat));

    // Edge highlight
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.6,
    });
    const edgeLines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMat);
    cube.add(edgeLines);

    const platformGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.05, 64);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x0d1926,
      metalness: 0.8,
      roughness: 0.2,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -1.5;
    platform.receiveShadow = true;
    scene.add(platform);

    scene.add(new THREE.AmbientLight(0x1a2a4a, 1.5));

    const keyLight = new THREE.DirectionalLight(0x00d4ff, 3);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);
 
    const fillLight = new THREE.DirectionalLight(0xff6b35, 1.5);
    fillLight.position.set(-5, 3, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(0, -3, -5);
    scene.add(rimLight);
 
    const pointLight1 = new THREE.PointLight(0x00d4ff, 2, 8);
    pointLight1.position.set(3, 2, 3);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff6b35, 1.5, 8);
    pointLight2.position.set(-3, -1, -3);
    scene.add(pointLight2);

    const particleCount = 300;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x4488aa,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    // scene.add(particles);

    const controls = new OrbitControls(camera, renderer.domElement);
    // controls.enableZoom = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI / 1.6;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;

    sceneRef.current = { cube, material, edgeMat, controls, renderer };

    let animId: number;
    let frameCount = 0;
    let lastTime = performance.now();

    const animate = (): void => {
      animId = requestAnimationFrame(animate);
      frameCount++;

      const now = performance.now();
      if (now - lastTime >= 500) {
        setInfo({
          fps: Math.round((frameCount * 1000) / (now - lastTime)),
          rotation: {
            x: ((cube.rotation.x * 180) / Math.PI).toFixed(1),
            y: ((cube.rotation.y * 180) / Math.PI).toFixed(1),
          },
        });
        frameCount = 0;
        lastTime = now;
      }

      const t = now * 0.001;
      pointLight1.intensity = 2 + Math.sin(t * 1.5) * 0.5;
      pointLight2.intensity = 1.5 + Math.cos(t * 1.2) * 0.4;
      particles.rotation.y += 0.0005;
      particles.rotation.x += 0.0002;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = (): void => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    setIsLoaded(true);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      wireMat.dispose();
      edgeMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      platformGeo.dispose();
      platformMat.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const { material, edgeMat, controls } = sceneRef.current;
    if (!material) return;
    material.color.set(color);
    material.wireframe = wireframe;
    if (edgeMat) edgeMat.color.set(color);
    if (controls) controls.autoRotate = autoRotate;
  }, [wireframe, autoRotate, color]);

  const stats: { label: string; value: string | number }[] = [
    { label: 'FPS',   value: info.fps },
    { label: 'ROT X', value: `${info.rotation.x}°` },
    { label: 'ROT Y', value: `${info.rotation.y}°` },
  ];

  return (
    <div className="relative w-full h-screen bg-[#080c14] overflow-hidden font-mono">

      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      <div className="absolute top-6 left-6 z-10 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">⬛</span>
          <span className="text-xl font-bold tracking-[0.25em] text-white">
            THREE<span className="text-[#00d4ff]">.JS</span>
          </span>
        </div>
        <span className="text-[10px] text-[#4488aa] tracking-[0.2em] uppercase border border-[#1a3a4a] px-2.5 py-1 rounded-sm">
          Next.js Integration Demo
        </span>
      </div>

      {isLoaded && (
        <div className="absolute top-6 right-6 z-10 bg-[#080c14]/80 border border-[#1a2a3a] rounded backdrop-blur-sm px-4 py-3 min-w-[120px]">
          {stats.map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-6 mb-1 last:mb-0">
              <span className="text-[10px] text-[#4488aa] tracking-widest">{label}</span>
              <span className="text-[11px] text-[#00d4ff] font-bold">{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-[#080c14]/85 border border-[#1a2a3a] rounded-md backdrop-blur-md px-7 py-5 flex flex-row flex-wrap items-center justify-center gap-7">

        <span className="text-[10px] text-[#4488aa] tracking-[0.3em] uppercase">Controls</span>

        <div className="flex items-center gap-2.5">
          <label className="text-[10px] text-[#4488aa] tracking-widest uppercase">Color</label>
          <input
            type="color"
            value={color}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(e.target.value)}
            className="w-9 h-7 rounded border border-[#1a3a4a] bg-transparent cursor-pointer p-0.5"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <label className="text-[10px] text-[#4488aa] tracking-widest uppercase">Wireframe</label>
          <button
            onClick={() => setWireframe((v) => !v)}
            className={`text-[10px] font-bold tracking-widest border border-[#00d4ff] rounded px-3 py-1 transition-all duration-200 cursor-pointer font-mono
              ${wireframe ? 'bg-[#00d4ff] text-[#080c14]' : 'bg-[#1a2a3a] text-[#00d4ff]'}`}
          >
            {wireframe ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="text-[10px] text-[#4488aa] tracking-widest uppercase">Auto Rotate</label>
          <button
            onClick={() => setAutoRotate((v) => !v)}
            className={`text-[10px] font-bold tracking-widest border border-[#00d4ff] rounded px-3 py-1 transition-all duration-200 cursor-pointer font-mono
              ${autoRotate ? 'bg-[#00d4ff] text-[#080c14]' : 'bg-[#1a2a3a] text-[#00d4ff]'}`}
          >
            {autoRotate ? 'ON' : 'OFF'}
          </button>
        </div>

        <span className="text-[10px] text-[#2a4a5a] tracking-wide">
          🖱 Drag to orbit · Scroll to zoom
        </span>
      </div>
    </div>
  );
}