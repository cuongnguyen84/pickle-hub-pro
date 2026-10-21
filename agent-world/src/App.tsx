import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Office, statusText } from "./office.tsx";
import { AGENTS, CHIEF, STOPPED_NOTE, TAKEN_AT, TEAM_LIVE, type StationStatus } from "./snapshot.ts";

const EVERYONE = [CHIEF, ...AGENTS];

function shownStatus(status: StationStatus): StationStatus {
  if (!TEAM_LIVE && status === "working") return "paused";
  return status;
}

export function App() {
  const [selectedId, setSelectedId] = useState(CHIEF.id);
  const [focusId, setFocusId] = useState(AGENTS[0].id);
  const selected = EVERYONE.find((station) => station.id === selectedId) ?? CHIEF;
  const focus = AGENTS.find((station) => station.id === focusId) ?? AGENTS[0];
  return (
    <div className="app">
      <div className="stage">
        <header className="topbar">
          <div>
            <p className="eyebrow">{TEAM_LIVE ? "Đội 3D đang giao việc" : "Đội đang nằm im"}</p>
            <h1>{TEAM_LIVE ? "Điều phối giao việc cho 8 vai trò" : "Không ai đang được giao việc"}</h1>
          </div>
          <p className="stamp">{TAKEN_AT}</p>
        </header>
        <p className="speech">
          {TEAM_LIVE ? <><b>Điều phối → {focus.name}.</b> {focus.order}</> : STOPPED_NOTE}
        </p>
        <Canvas
          frameloop={TEAM_LIVE ? "always" : "demand"}
          shadows="percentage"
          dpr={[1, 1.75]}
          camera={{ position: [0, 8.4, 10.6], fov: 40, near: 0.1, far: 80 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <Office selectedId={selectedId} onSelect={setSelectedId} onFocus={setFocusId} />
        </Canvas>
      </div>
      <aside className="panel">
        <p className="eyebrow">{selected.id === CHIEF.id ? "Điều phối" : "Vai trò"}</p>
        <h2>{selected.name}</h2>
        <p className="role">{selected.role} · {statusText(shownStatus(selected.status))}</p>
        <p className="detail">{selected.detail}</p>
        <div className="list">
          {EVERYONE.map((station) => (
            <button
              key={station.id}
              className={station.id === selectedId ? "card selected" : "card"}
              onClick={() => setSelectedId(station.id)}
              type="button"
            >
              <b><i className="dot" style={{ background: station.color }} />{station.name}</b>
              <span>{station.activity}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
