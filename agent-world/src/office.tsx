import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import { QuadraticBezierCurve3, Vector3, type Group, type Mesh } from "three";
import { AGENTS, CHIEF, CYCLE_SECONDS, TEAM_LIVE, type Station, type StationStatus } from "./snapshot.ts";

const STATUS_LABEL: Record<StationStatus, string> = {
  working: "đang làm",
  paused: "đang dừng",
  success: "xong bước này",
  error: "đang kẹt",
  idle: "đang chờ",
};

const MEET = new Vector3(0, 0, 1.55);
const _curve = new QuadraticBezierCurve3(new Vector3(), new Vector3(), new Vector3());
const _point = new Vector3();

export function beatAt(elapsed: number) {
  const index = Math.floor(elapsed / CYCLE_SECONDS) % AGENTS.length;
  const local = (elapsed % CYCLE_SECONDS) / CYCLE_SECONDS;
  return { index, local };
}

function travel(local: number) {
  if (local < 0.22) return local / 0.22;
  if (local < 0.72) return 1;
  if (local < 0.94) return 1 - (local - 0.72) / 0.22;
  return 0;
}

function smooth(value: number) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function RobotBody({ color, status }: { color: string; status: StationStatus }) {
  const dim = status === "idle";
  return (
    <>
      <mesh position={[0, 0.92, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.42, 6, 12]} />
        <meshStandardMaterial color={dim ? "#8b95a3" : "#d7dee8"} roughness={0.42} metalness={0.12} />
      </mesh>
      <mesh position={[0, 1.42, 0]} castShadow>
        <sphereGeometry args={[0.18, 18, 14]} />
        <meshStandardMaterial color="#eef2f7" roughness={0.32} />
      </mesh>
      <mesh position={[0, 1.42, 0.12]}>
        <boxGeometry args={[0.22, 0.07, 0.04]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={status === "error" ? 0.9 : 0.4} />
      </mesh>
      <group position={[-0.28, 1.05, 0]} name="arm-l">
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.05, 0.22, 4, 8]} />
          <meshStandardMaterial color="#c5ced8" />
        </mesh>
      </group>
      <group position={[0.28, 1.05, 0]} name="arm-r">
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.05, 0.22, 4, 8]} />
          <meshStandardMaterial color="#c5ced8" />
        </mesh>
      </group>
    </>
  );
}

function Agent({
  station,
  index,
  selected,
  onSelect,
}: {
  station: Station;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    const group = ref.current;
    if (!group || !TEAM_LIVE) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { index: focus, local } = beatAt(state.clock.elapsedTime);
    const active = focus === index;
    const along = reduced ? (active ? 1 : 0) : smooth(active ? travel(local) : 0);
    const home = station.home;
    group.position.set(
      home[0] + (MEET.x - home[0]) * along,
      0,
      home[2] + (MEET.z - home[2]) * along,
    );
    const faceX = along > 0.15 ? CHIEF.home[0] : 0;
    const faceZ = along > 0.15 ? CHIEF.home[2] : home[2] - 1;
    group.rotation.y = Math.atan2(faceX - group.position.x, faceZ - group.position.z);
    const walking = !reduced && active && (local < 0.22 || local > 0.72);
    const swing = walking ? Math.sin(state.clock.elapsedTime * 8) * 0.7 : station.status === "working" && !active ? Math.sin(state.clock.elapsedTime * 6) * 0.25 : 0;
    const left = group.getObjectByName("arm-l");
    const right = group.getObjectByName("arm-r");
    if (left) left.rotation.x = swing;
    if (right) right.rotation.x = -swing;
    group.rotation.z = station.status === "error" && along > 0.8 ? 0.12 : 0;
  });
  return (
    <group ref={ref} position={station.home}>
      <mesh
        position={[0, 0.9, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(station.id);
        }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "default"; }}
      >
        <cylinderGeometry args={[0.34, 0.34, 1.5, 10]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <RobotBody color={station.color} status={station.status} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.32, 0.4, 28]} />
        <meshBasicMaterial color={selected ? "#eef2f7" : station.color} />
      </mesh>
    </group>
  );
}

function Chief({ talking }: { talking: boolean }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    const group = ref.current;
    if (!group || !TEAM_LIVE) return;
    const { index } = beatAt(state.clock.elapsedTime);
    const target = AGENTS[index].home;
    group.position.set(CHIEF.home[0], 0, CHIEF.home[2]);
    group.rotation.y = Math.atan2(target[0] - CHIEF.home[0], target[2] - CHIEF.home[2]);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const arm = group.getObjectByName("arm-r");
    if (arm) arm.rotation.x = talking && !reduced ? -0.8 + Math.sin(state.clock.elapsedTime * 3) * 0.15 : 0;
  });
  return (
    <group ref={ref} position={CHIEF.home}>
      <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.55, 0.7, 40]} />
        <meshBasicMaterial color={CHIEF.color} transparent opacity={0.9} />
      </mesh>
      <RobotBody color={CHIEF.color} status={CHIEF.status} />
    </group>
  );
}

function CommArc() {
  const beads = useRef<Array<Mesh | null>>([]);
  const packet = useRef<Mesh>(null);
  useFrame((state) => {
    const { index, local } = beatAt(state.clock.elapsedTime);
    const agent = AGENTS[index];
    const along = smooth(travel(local));
    const ax = agent.home[0] + (MEET.x - agent.home[0]) * along;
    const az = agent.home[2] + (MEET.z - agent.home[2]) * along;
    _curve.v0.set(CHIEF.home[0], 1.35, CHIEF.home[2]);
    _curve.v2.set(ax, 1.25, az);
    _curve.v1.set((_curve.v0.x + _curve.v2.x) / 2, 2.35, (_curve.v0.z + _curve.v2.z) / 2);
    beads.current.forEach((bead, i) => {
      if (!bead) return;
      _curve.getPoint(i / 7, _point);
      bead.position.copy(_point);
    });
    const u = local < 0.72 ? local / 0.72 : 1;
    _curve.getPoint(u, _point);
    packet.current?.position.copy(_point);
    if (packet.current) packet.current.visible = local < 0.78;
  });
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} ref={(node) => { beads.current[i] = node; }}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshBasicMaterial color="#E8B04A" />
        </mesh>
      ))}
      <mesh ref={packet}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color="#fff6d8" />
      </mesh>
    </group>
  );
}

function Desk({ station }: { station: Station }) {
  const liveStatus = TEAM_LIVE ? station.status : station.status === "working" ? "paused" : station.status;
  const glow = liveStatus === "working" || liveStatus === "success" ? 0.65 : liveStatus === "error" ? 0.28 : 0.08;
  return (
    <group position={[station.home[0], 0, station.home[2] - 0.85]}>
      <RoundedBox args={[1.05, 0.08, 0.55]} position={[0, 0.72, 0]} radius={0.03} castShadow receiveShadow>
        <meshStandardMaterial color="#1a2230" />
      </RoundedBox>
      <mesh position={[0, 1.02, -0.16]}>
        <boxGeometry args={[0.62, 0.36, 0.04]} />
        <meshStandardMaterial color="#0b1018" emissive={station.color} emissiveIntensity={glow} />
      </mesh>
    </group>
  );
}

export function Office({
  selectedId,
  onSelect,
  onFocus,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
}) {
  const last = useRef(-1);
  useFrame((state) => {
    if (!TEAM_LIVE) return;
    const { index } = beatAt(state.clock.elapsedTime);
    if (index !== last.current) {
      last.current = index;
      onFocus(AGENTS[index].id);
    }
  });
  return (
    <>
      <color attach="background" args={["#1c2838"]} />
      <fog attach="fog" args={["#1c2838", 24, 52]} />
      <hemisphereLight args={["#c5d4ea", "#3a2a1c", 0.9]} />
      <directionalLight
        position={[4, 12, 6]}
        intensity={3.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0005}
        shadow-radius={3}
      />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[18, 14]} />
        <meshStandardMaterial color="#31445f" />
      </mesh>
      <mesh position={[0, 1.5, -4.6]}>
        <boxGeometry args={[12, 2.1, 0.08]} />
        <meshStandardMaterial color="#10161f" emissive="#7cc4d6" emissiveIntensity={0.16} />
      </mesh>
      {AGENTS.map((station) => <Desk key={station.id} station={station} />)}
      {TEAM_LIVE ? <CommArc /> : null}
      <Chief talking={TEAM_LIVE} />
      {AGENTS.map((station, index) => (
        <Agent
          key={station.id}
          station={station}
          index={index}
          selected={station.id === selectedId}
          onSelect={onSelect}
        />
      ))}
      <OrbitControls makeDefault target={[0, 0.7, 0.2]} maxPolarAngle={1.2} minDistance={5} maxDistance={20} />
    </>
  );
}

export function statusText(status: StationStatus) {
  return STATUS_LABEL[status];
}
