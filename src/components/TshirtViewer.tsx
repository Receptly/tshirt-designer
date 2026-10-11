"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ARTWORK_BOARD, type ArtworkDragHandler, type ArtworkDragKey } from "@/lib/artworkDrag";
import type { GarmentArtworkSlot, GarmentType, ShirtSide } from "@/lib/configuration";

export interface CanvasBounds { left: number; top: number; width: number; height: number; }
export interface CanvasSource { element: HTMLCanvasElement | null; revision: number; json?: string; svg?: string; bounds?: CanvasBounds; }
interface ViewerProps { garmentType: GarmentType; color: string; side: ShirtSide; frontArtwork: CanvasSource; backArtwork: CanvasSource; frontMeshArtwork: Record<GarmentArtworkSlot, CanvasSource>; backMeshArtwork: Record<GarmentArtworkSlot, CanvasSource>; onArtworkDrag?: ArtworkDragHandler; onCaptureReady?: (capture: ((scale: number) => string | null) | null) => void; }

const MODEL_PATHS: Record<GarmentType, string> = {
  tshirt: "/models/02.glb",
  hoodie: "/models/premium_eco_hoodie.glb",
  pants: "/models/pants.glb",
};

function UVArtworkOverlay({ target, source, dragKey, flipY = false, flipX = false }: { target: THREE.Mesh; source: CanvasSource; dragKey: ArtworkDragKey; flipY?: boolean; flipX?: boolean }) {
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
    const uRange = Math.max(maxU - minU, 0.001);
    const vRange = Math.max(maxV - minV, 0.001);
    texture.repeat.set(flipX ? -1 / uRange : 1 / uRange, flipY ? -1 / vRange : 1 / vRange);
    texture.offset.set(flipX ? maxU / uRange : -minU * texture.repeat.x, flipY ? maxV / vRange : -minV * texture.repeat.y);
    texture.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false });
    const mesh = new THREE.Mesh(target.geometry, material);
    mesh.name = `${target.name}-artwork-overlay`;
    mesh.userData.artworkOverlay = true;
    mesh.userData.artworkKey = dragKey;
    mesh.userData.uvMap = { minU, minV, uRange, vRange, flipY, flipX };
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    return { mesh, texture, material };
  }, [dragKey, flipX, flipY, source.element, target]);

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
    if (garmentType === "hoodie") return [
      { mesh: meshes[3], slot: "body" as GarmentArtworkSlot },
      { mesh: meshes[9], slot: "leftArm" as GarmentArtworkSlot },
      { mesh: meshes[5], slot: "rightArm" as GarmentArtworkSlot },
      { mesh: meshes[6], slot: "hood" as GarmentArtworkSlot },
      { mesh: meshes[7], slot: "hood" as GarmentArtworkSlot },
    ].filter((target): target is { mesh: THREE.Mesh; slot: GarmentArtworkSlot } => Boolean(target.mesh));
    if (garmentType === "pants" && meshes[0]) return [
      { mesh: meshes[0], slot: "leftArm" as GarmentArtworkSlot },
      { mesh: meshes[0], slot: "rightArm" as GarmentArtworkSlot },
    ];
    return [];
  }, [garmentType, scene]);
  return <>{targets.map(({ mesh, slot }) => <UVArtworkOverlay key={`${mesh.uuid}-${slot}`} target={mesh} source={sources[slot]} dragKey={slot} flipY={slot !== "body"} />)}</>;
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
  const artworkPanels = useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    normalizedScene.traverse((object) => {
      if (object instanceof THREE.Mesh && !object.userData.artworkOverlay && object.geometry.getAttribute("uv")) meshes.push(object);
    });
    // 02.glb keeps the front and back fabric panels as separate sub-meshes.
    return { front: meshes.find((mesh) => mesh.name === "T-Shirt_2") ?? meshes[1] ?? meshes[0] ?? null, back: meshes.find((mesh) => mesh.name === "T-Shirt_3") ?? null };
  }, [normalizedScene]);
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
  return (
    <group ref={group}>
      <primitive object={normalizedScene} />
      {artworkPanels.front ? <UVArtworkOverlay target={artworkPanels.front} source={frontArtwork} dragKey="front" flipX /> : null}
      {artworkPanels.back ? <UVArtworkOverlay target={artworkPanels.back} source={backArtwork} dragKey="back" flipX /> : null}
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
        if ((garmentType === "hoodie" || garmentType === "pants") && material instanceof THREE.MeshStandardMaterial) {
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

type CaptureFunction = (scale: number) => string | null;

function boardPoint(hit: THREE.Intersection) {
  const overlay = hit.object.userData.artworkOverlay ? hit.object : hit.object.children.find((child) => child.userData.artworkOverlay);
  const map = overlay?.userData.uvMap as { minU: number; minV: number; uRange: number; vRange: number; flipY: boolean; flipX: boolean } | undefined;
  if (!overlay || !map || !hit.uv) return null;
  const u = (hit.uv.x - map.minU) / map.uRange;
  const v = (hit.uv.y - map.minV) / map.vRange;
  return { key: overlay.userData.artworkKey as ArtworkDragKey, overlay, x: (map.flipX ? 1 - u : u) * ARTWORK_BOARD.width, y: (map.flipY ? v : 1 - v) * ARTWORK_BOARD.height };
}

// Lets users drag artwork on the garment; pointer-downs that miss the artwork fall through to orbit controls.
function ArtworkDragLayer({ onDrag }: { onDrag: ArtworkDragHandler }) {
  const { gl, camera, scene } = useThree();
  const controls = useThree((state) => state.controls) as unknown as { enabled: boolean } | null;
  const handler = useRef(onDrag);
  useEffect(() => { handler.current = onDrag; }, [onDrag]);

  useEffect(() => {
    const element = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let drag: { key: ArtworkDragKey; overlay: THREE.Object3D; pointerId: number } | null = null;
    let latest: PointerEvent | null = null;
    let frame = 0;

    const locate = (event: PointerEvent, targets: THREE.Object3D[], recursive: boolean) => {
      const rect = element.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(targets, recursive)[0] ?? null;
    };
    const finish = () => {
      if (!drag) return;
      cancelAnimationFrame(frame); frame = 0;
      handler.current("end", drag.key, 0, 0);
      if (element.hasPointerCapture(drag.pointerId)) element.releasePointerCapture(drag.pointerId);
      drag = null;
      if (controls) controls.enabled = true;
      element.style.cursor = "";
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || drag) return;
      const hit = locate(event, scene.children, true);
      const grabbed = hit ? boardPoint(hit) : null;
      if (!grabbed || !handler.current("start", grabbed.key, grabbed.x, grabbed.y)) return;
      drag = { key: grabbed.key, overlay: grabbed.overlay, pointerId: event.pointerId };
      if (controls) controls.enabled = false;
      element.setPointerCapture(event.pointerId);
      element.style.cursor = "grabbing";
      event.stopPropagation();
    };
    const move = (event: PointerEvent) => {
      if (!drag) return;
      latest = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!drag || !latest) return;
        const hit = locate(latest, [drag.overlay], false);
        const point = hit ? boardPoint(hit) : null;
        if (point) handler.current("move", drag.key, point.x, point.y);
      });
    };

    element.addEventListener("pointerdown", down, true);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", finish);
    element.addEventListener("pointercancel", finish);
    return () => {
      finish();
      element.removeEventListener("pointerdown", down, true);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", finish);
      element.removeEventListener("pointercancel", finish);
    };
  }, [camera, controls, gl, scene]);
  return null;
}

function CaptureBridge({ onReady }: { onReady: (capture: CaptureFunction | null) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    onReady((scale) => {
      const previous = gl.getPixelRatio();
      gl.setPixelRatio(scale);
      gl.render(scene, camera);
      const image = gl.domElement.toDataURL("image/png");
      gl.setPixelRatio(previous);
      return image;
    });
    return () => onReady(null);
  }, [camera, gl, onReady, scene]);
  return null;
}

export default function TshirtViewer({ garmentType, color, side, frontArtwork, backArtwork, frontMeshArtwork, backMeshArtwork, onArtworkDrag, onCaptureReady }: ViewerProps) {
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
        <OrbitControls makeDefault enablePan={false} minDistance={1.7} maxDistance={7.2} minPolarAngle={Math.PI / 2.5} maxPolarAngle={Math.PI / 1.8} enableDamping dampingFactor={0.08} />
        {onArtworkDrag ? <ArtworkDragLayer onDrag={onArtworkDrag} /> : null}
        {onCaptureReady ? <CaptureBridge onReady={onCaptureReady} /> : null}
      </Canvas>
      {loadError ? <div className="model-load-error">Could not load the 3D {garmentType} model.</div> : null}
      <div className="viewer-hint"><span className="drag-icon">↔</span> Drag to rotate <span>·</span> Scroll to zoom <span>·</span> Drag artwork to move it</div><div className="model-badge"><span /> Studio preview</div>
    </div>
  );
}