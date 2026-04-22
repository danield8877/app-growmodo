// @ts-nocheck
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { useTheme } from '../contexts/ThemeContext';

interface RubikCubeProps {
  size?: number;
  enableHover?: boolean;
  className?: string;
}

export default function RubikCube({ size = 120, enableHover = true, className = '' }: RubikCubeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    if (window.innerWidth < 768 && size > 200) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(size > 200 ? 7 : 4, size > 200 ? 7 : 4, size > 200 ? 12 : 6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(size, size);

    const isDark = theme === 'dark';

    const keyIntensity = isDark ? 1.6 : 1.3;
    const fillIntensity = isDark ? 0.6 : 0.35;
    const rimIntensity = isDark ? 0.9 : 0.7;

    const key = new THREE.DirectionalLight(0xffffff, keyIntensity);
    key.position.set(5, 5, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, fillIntensity);
    fill.position.set(-5, -2, 3);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(isDark ? 0xffffff : 0x88aaff, rimIntensity);
    rim.position.set(-3, 5, -5);
    scene.add(rim);

    const matteColor = isDark ? 0xf2f2f2 : 0x111111;
    const glossyColor = isDark ? 0xffffff : 0x000000;

    const matte = new THREE.MeshStandardMaterial({
      color: matteColor,
      roughness: isDark ? 0.75 : 0.85,
      metalness: isDark ? 0.05 : 0.1
    });

    const glossy = new THREE.MeshPhysicalMaterial({
      color: glossyColor,
      roughness: isDark ? 0.18 : 0.22,
      metalness: isDark ? 0.25 : 0.65,
      clearcoat: isDark ? 0.6 : 0.45,
      clearcoatRoughness: 0.08
    });

    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);

    const spacing = 1.05;
    const cubes: Array<{ mesh: THREE.Mesh; x: number; y: number; z: number }> = [];

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const geo = new THREE.BoxGeometry(1, 1, 1);
          const mat = Math.random() > 0.5 ? matte : glossy;
          const mesh = new THREE.Mesh(geo, mat);

          mesh.position.set(x * spacing, y * spacing, z * spacing);
          cubeGroup.add(mesh);

          cubes.push({ mesh, x, y, z });
        }
      }
    }

    function rotateLayer(axis: 'x' | 'y' | 'z', index: number, angle: number, duration: number) {
      const group = new THREE.Group();
      cubeGroup.add(group);

      const selected = cubes.filter(c => c[axis] === index);
      selected.forEach(c => group.add(c.mesh));

      gsap.to(group.rotation, {
        [axis]: angle,
        duration,
        ease: 'expo.inOut',
        onComplete: () => {
          group.updateMatrixWorld();
          selected.forEach(c => {
            c.mesh.applyMatrix4(group.matrix);
            cubeGroup.add(c.mesh);
          });
          cubeGroup.remove(group);
        }
      });
    }

    let isHover = false;
    let chaosTimeline: gsap.core.Timeline | null = null;

    function rand<T>(arr: T[]): T {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function generateSequence() {
      const seq = gsap.timeline();
      const moves = 2 + Math.floor(Math.random() * 2);

      for (let i = 0; i < moves; i++) {
        const axis = Math.random() < 0.65 ? rand(['x', 'y'] as const) : 'z' as const;
        const layer = Math.random() < 0.75 ? rand([-1, 1]) : 0;
        const dir = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
        const duration = 0.5 + Math.random() * 0.8;

        seq.add(() => rotateLayer(axis, layer, dir, duration));
      }

      return seq;
    }

    function startRubikBrain() {
      if (chaosTimeline) chaosTimeline.kill();

      function loop() {
        if (isHover) return;

        chaosTimeline = generateSequence();
        chaosTimeline.eventCallback('onComplete', () => {
          gsap.delayedCall(0.8 + Math.random() * 1.2, loop);
        });
      }

      loop();
    }

    startRubikBrain();

    gsap.to(cubeGroup.rotation, {
      x: '+=6.283',
      y: '+=6.283',
      z: '+=6.283',
      duration: size > 200 ? 40 : 28,
      repeat: -1,
      ease: 'none'
    });

    function snapPerfectCube() {
      if (chaosTimeline) chaosTimeline.kill();

      // 1 fois sur 3 = parfait, 2 fois sur 3 = avec erreurs
      const isPerfect = Math.random() < 0.33;

      // Sauvegarder la rotation actuelle du groupe
      const currentRotation = {
        x: cubeGroup.rotation.x,
        y: cubeGroup.rotation.y,
        z: cubeGroup.rotation.z
      };

      // Calculer la rotation cible la plus proche (multiple de 90°)
      const targetRotation = {
        x: Math.round(currentRotation.x / (Math.PI / 2)) * (Math.PI / 2),
        y: Math.round(currentRotation.y / (Math.PI / 2)) * (Math.PI / 2),
        z: Math.round(currentRotation.z / (Math.PI / 2)) * (Math.PI / 2)
      };

      if (isPerfect) {
        // Cube parfait : tous les cubes reviennent à leur position d'origine
        cubes.forEach(c => {
          gsap.to(c.mesh.position, {
            x: c.x * spacing,
            y: c.y * spacing,
            z: c.z * spacing,
            duration: 0.6,
            ease: 'expo.out'
          });
        });
      } else {
        // Cube avec erreurs : quelques cubes sont décalés
        const errorCount = 3 + Math.floor(Math.random() * 5); // 3-7 cubes mal placés
        const shuffled = [...cubes].sort(() => Math.random() - 0.5);
        const errorCubes = shuffled.slice(0, errorCount);
        
        cubes.forEach(c => {
          if (errorCubes.includes(c)) {
            // Cube mal placé : petit décalage aléatoire
            const offset = 0.3 + Math.random() * 0.4; // 0.3-0.7
            const direction = Math.random() > 0.5 ? 1 : -1;
            const axis = rand(['x', 'y', 'z'] as const);
            
            gsap.to(c.mesh.position, {
              [axis]: c[axis] * spacing + (offset * direction),
              duration: 0.6,
              ease: 'expo.out'
            });
          } else {
            // Cube bien placé
            gsap.to(c.mesh.position, {
              x: c.x * spacing,
              y: c.y * spacing,
              z: c.z * spacing,
              duration: 0.6,
              ease: 'expo.out'
            });
          }
        });
      }

      // Rotation fluide vers l'angle le plus proche (pas de saccade)
      gsap.to(cubeGroup.rotation, {
        x: targetRotation.x,
        y: targetRotation.y,
        z: targetRotation.z,
        duration: 0.6,
        ease: 'expo.out'
      });
    }

    const handleMouseEnter = () => {
      if (enableHover) {
        isHover = true;
        snapPerfectCube();
      }
    };

    const handleMouseLeave = () => {
      if (enableHover) {
        isHover = false;
        startRubikBrain();
      }
    };

    if (enableHover) {
      container.addEventListener('mouseenter', handleMouseEnter);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }

    const animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      if (enableHover) {
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      if (chaosTimeline) chaosTimeline.kill();
      renderer.dispose();
      scene.clear();
    };
  }, [size, enableHover, theme]);

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
    </div>
  );
}