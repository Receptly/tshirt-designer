"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GarmentArtworkSlot, GarmentType, ShirtSide } from "@/lib/configuration";

export interface CanvasSource { element: HTMLCanvasElement | null; revision: number; }
interface ViewerProps { garmentType: GarmentType; color: string; side: ShirtSide; frontArtwork: CanvasSource; backArtwork: CanvasSource; frontMeshArtwork: Record<GarmentArtworkSlot, CanvasSource>; backMeshArtwork: Record<GarmentArtworkSlot, CanvasSource>; }

const MODEL_PATHS: Record<GarmentType, string> = {
  tshirt: "/models/02.glb",
  hoodie: "/models/hoodie.glb",
  pants: "/models/pants.glb",
};

function UVArtworkOverlay({ target, source }: { target: THREE.Mesh; source: CanvasSource }) {
  const overlayRef = useRef<{ mesh: THREE.Mesh; texture: THREE.CanvasTexture; material: THREE.MeshBasicMaterial } | null>(null);
  const overlay = useMemo(() => {
    if (!source.element) return null;
    const uv = target.geometry.getAttribute("uv");
    if (!uv) return null;
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (let index = 0; index < uv.count; index += 1) {
      minU = Math.min(minU, uv.getX(index)); minV = Math.min(minV, uv.getY(index));
      maxU = Math.max(maxU, uv.getX(index)); maxV = Math.max(maxV, uv.getY(index));
    }
    const texture = new THREE.CanvasTexture(source.element);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1 / Math.max(maxU - minU, 0.001), 1 / Math.max(maxV - minV, 0.001));
    texture.offset.set(-minU * texture.repeat.x, -minV * texture.repeat.y);
    texture.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, toneMapped: false });
    const mesh = new THREE.Mesh(target.geometry, material);
    mesh.name = `${target.name}-artwork-overlay`;
    mesh.userData.artworkOverlay = true;
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    return { mesh, texture, material };
  }, [source.element, target]);

  useEffect(() => {
    if (!overlay) return;
    overlayRef.current = overlay;
    target.add(overlay.mesh);
    return () => {
      target.remove(overlay.mesh);
      overlayRef.current = null;
      overlay.texture.dispose();
      overlay.material.dispose();
    };
  }, [overlay, target]);

  useEffect(() => {
    if (overlayRef.current) overlayRef.current.texture.needsUpdate = true;
  }, [source.revision]);
  return null;
}

function GarmentArtworkOverlays({ garmentType, scene, sources }: { garmentType: GarmentType; scene: THREE.Group; sources: Record<GarmentArtworkSlot, CanvasSource> }) {
  const targets = useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.visible && object.geometry.getAttribute("uv")) meshes.push(object);
    });
    if (garmentType === "hoodie") return meshes.slice(1, 4);
    return [];
  }, [garmentType, scene]);
  const slots: GarmentArtworkSlot[] = ["body", "leftArm", "rightArm"];
  return <>{targets.map((target, index) => <UVArtworkOverlay key={target.uuid} target={target} source={sources[slots[index]]} />)}</>;
}

function Shirt({ color, side, frontArtwork, backArtwork, sourceScene }: Pick<ViewerProps, "color" | "side" | "frontArtwork" | "backArtwork"> & { sourceScene: THREE.Group }) {
  const normalizedScene = useMemo(() => {
    sourceScene.updateMatrixWorld(true);
    const clone = sourceScene.clone(true);
    clone.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.visible = true;
      object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
      bounds.expandByObject(object);
    });
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fitScale = 2.8 / Math.max(size.x, size.y, size.z, 0.001);
    clone.scale.setScalar(fitScale);
    clone.position.set(-center.x * fitScale, -center.y * fitScale, -center.z * fitScale);
    clone.updateMatrixWorld(true);
    return clone;
  }, [sourceScene]);
  const group = useRef<THREE.Group>(null);
  const targetRotation = side === "front" ? 0 : Math.PI;
  useFrame((_, delta) => {
    if (!group.current) return;
    const difference = targetRotation - group.current.rotation.y;
    const shortest = Math.atan2(Math.sin(difference), Math.cos(difference));
    group.current.rotation.y += shortest * Math.min(delta * 5, 1);
  });
  normalizedScene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.visible || object.userData.artworkOverlay) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if ("color" in material && material.color instanceof THREE.Color) material.color.set(color);
    });
  });
  const artworkTarget = useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    normalizedScene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry.getAttribute("uv")) meshes.push(object);
    });
    return meshes[1] ?? meshes[0] ?? null;
  }, [normalizedScene]);
  return (
    <group ref={group}>
      <primitive object={normalizedScene} />
      {artworkTarget ? <UVArtworkOverlay target={artworkTarget} source={side === "front" ? frontArtwork : backArtwork} /> : null}
    </group>
  );
}

function GarmentModel({ garmentType, color, side, frontMeshArtwork, backMeshArtwork, sourceScene }: Pick<ViewerProps, "garmentType" | "color" | "side" | "frontMeshArtwork" | "backMeshArtwork"> & { sourceScene: THREE.Group }) {
  const normalizedScene = useMemo(() => {
    const clone = sourceScene.clone(true);
    clone.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
      object.castShadow = true;
      object.receiveShadow = true;
      bounds.expandByObject(object);
    });
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fitScale = 2.8 / Math.max(size.x, size.y, size.z, 0.001);
    clone.scale.setScalar(fitScale);
    clone.position.set(-center.x * fitScale, -center.y * fitScale, -center.z * fitScale);
    clone.updateMatrixWorld(true);
    return clone;
  }, [sourceScene]);
  const group = useRef<THREE.Group>(null);
  const targetRotation = side === "front" ? 0 : Math.PI;
  useEffect(() => {
    normalizedScene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (garmentType === "pants" && material instanceof THREE.MeshStandardMaterial) {
          material.map = null;
          material.needsUpdate = true;
        }
        if ("color" in material && material.color instanceof THREE.Color) material.color.set(color);
      });
    });
  }, [color, garmentType, normalizedScene]);
  useEffect(() => () => {
    normalizedScene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
  }, [normalizedScene]);
  useFrame((_, delta) => {
    if (!group.current) return;
    const difference = targetRotation - group.current.rotation.y;
    const shortest = Math.atan2(Math.sin(difference), Math.cos(difference));
    group.current.rotation.y += shortest * Math.min(delta * 5, 1);
  });
  return <group ref={group}><primitive object={normalizedScene} /><GarmentArtworkOverlays garmentType={garmentType} scene={normalizedScene} sources={side === "front" ? frontMeshArtwork : backMeshArtwork} /></group>;
}

export default function TshirtViewer({ garmentType, color, side, frontArtwork, backArtwork, frontMeshArtwork, backMeshArtwork }: ViewerProps) {
  const [sourceScene, setSourceScene] = useState<THREE.Group | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    new GLTFLoader().load(MODEL_PATHS[garmentType], (gltf) => { if (active) setSourceScene(gltf.scene); }, undefined, () => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [garmentType]);
  return (
    <div className="viewer-canvas" aria-label={`3D ${garmentType} preview, ${side} selected`}>
      <Canvas camera={{ position: [0, 0.25, 5.6], fov: 32 }} dpr={1} gl={{ antialias: false, powerPreference: "low-power" }}>
        <color attach="background" args={["#e3e0d7"]} /><ambientLight intensity={1.25} /><directionalLight position={[3, 5, 4]} intensity={3.1} /><directionalLight position={[-4, 2, -2]} intensity={0.65} /><hemisphereLight args={["#fffdf5", "#77756d", 0.9]} />
        {sourceScene ? (garmentType === "tshirt" ? <Shirt color={color} side={side} frontArtwork={frontArtwork} backArtwork={backArtwork} sourceScene={sourceScene} /> : <GarmentModel garmentType={garmentType} color={color} side={side} frontMeshArtwork={frontMeshArtwork} backMeshArtwork={backMeshArtwork} sourceScene={sourceScene} />) : <mesh><boxGeometry args={[1, 1.5, 0.4]} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.38, 0]}><planeGeometry args={[10, 10]} /><meshStandardMaterial color="#d4d1c8" roughness={1} /></mesh>
        <OrbitControls enablePan={false} minDistance={4.2} maxDistance={7.2} minPolarAngle={Math.PI / 2.5} maxPolarAngle={Math.PI / 1.8} enableDamping dampingFactor={0.08} />
      </Canvas>
      {loadError ? <div className="model-load-error">Could not load the 3D {garmentType} model.</div> : null}
      <div className="viewer-hint"><span className="drag-icon">↔</span> Drag to rotate <span>·</span> Scroll to zoom</div><div className="model-badge"><span /> Studio preview</div>
    </div>
  );
}