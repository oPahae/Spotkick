import { forwardRef, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const Marker = forwardRef(function Marker({ visible = true, color = "#ffb020" }, ref) {
  const mesh = useRef();
  const geometry = useMemo(() => new THREE.ConeGeometry(0.17, 0.3, 3), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false }), [color]);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);
  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.position.y = Math.sin(clock.elapsedTime * 3) * 0.05;
      mesh.current.rotation.y = clock.elapsedTime * 1.6;
    }
  });
  return (
    <group ref={ref} visible={visible}>
      <mesh ref={mesh} geometry={geometry} material={material} rotation={[Math.PI, 0, 0]} />
    </group>
  );
});

export default Marker;
