import { useMemo, useState } from 'react';
import {
  cityAreas,
  cityRoads,
  cityObstacles,
  riverPier,
  riversideFloors,
  riversideBenches,
  type CityArea,
  type CityPoint,
} from './city';
import { archiveFloors } from './archiveLayout';
import { atlasBounds, atlasRoute, atlasView } from './cityAtlas';
import type { AdventureSave } from './adventure';
import './cityAtlas.css';
import { thonburiFloors } from './thonburi';

export default function CityTravelMap({
  save,
  area,
  selectArea,
  walk,
}: {
  save: AdventureSave;
  area: CityArea;
  selectArea: (id: CityArea) => void;
  walk: (point: CityPoint) => void;
}) {
  const [overview, setOverview] = useState(false);
  const [target, setTarget] = useState(cityAreas.find((a) => a.id === area)!.center);
  const route = useMemo(() => atlasRoute(save.position, target), [save.position, target]);
  const view = atlasView(area, overview);
  const visited = new Set(save.visited);
  const pick = (p: CityPoint) => setTarget({ x: Math.round(p.x * 2) / 2, z: Math.round(p.z * 2) / 2 });
  const selected = cityAreas.find((a) => a.id === area)!;
  return (
    <div className="city-map city-atlas">
      <div className="atlas-heading">
        <div>
          <small>SU’S CITY CHART</small>
          <strong>{overview ? 'The connected city' : selected.name}</strong>
        </div>
        <button onClick={() => setOverview((v) => !v)}>{overview ? 'District detail' : 'Whole city'}</button>
      </div>
      <div className="atlas-districts" aria-label="Choose a district">
        {cityAreas.map((a) => (
          <button
            key={a.id}
            data-area={a.id}
            aria-pressed={a.id === area}
            onClick={() => {
              selectArea(a.id);
              setTarget(a.center);
            }}
          >
            <span aria-hidden="true">{visited.has(a.id) ? '◆' : '◇'}</span> {a.name}
          </button>
        ))}
      </div>
      <div className="atlas-chart">
        <svg
          viewBox={`${view.x} ${view.z} ${view.w} ${view.d}`}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          tabIndex={0}
          aria-label="Choose a walking destination on the city chart"
          aria-describedby="atlas-instructions"
          data-route-status={route.status}
          data-target={`${route.end.x},${route.end.z}`}
          onClick={(event) => {
            const matrix = event.currentTarget.getScreenCTM();
            if (!matrix) return;
            const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
            pick({ x: p.x, z: p.y });
          }}
          onKeyDown={(event) => {
            const directions: Record<string, [number, number]> = {
              ArrowLeft: [-0.5, 0],
              ArrowRight: [0.5, 0],
              ArrowUp: [0, -0.5],
              ArrowDown: [0, 0.5],
            };
            const d = directions[event.key];
            if (!d) return;
            event.preventDefault();
            const step = event.shiftKey ? 4 : 1;
            pick({
              x: Math.max(atlasBounds.x, Math.min(atlasBounds.x + atlasBounds.w, target.x + d[0] * step)),
              z: Math.max(atlasBounds.z, Math.min(atlasBounds.z + atlasBounds.d, target.z + d[1] * step)),
            });
          }}
        >
          <title>Bangkok Rift walking chart</title>
          <rect x={-200} y={-100} width={500} height={250} fill="#142e34" />
          <rect x={-70} y={-79} width={170} height={72.5} fill="#275765" />
          <rect x={-47} y={41.4} width={97} height={3.3} fill="#275765" />
          <text x={-9} y={-10} className="atlas-water">
            CHAO PHRAYA
          </text>
          <text x={-5} y={44} className="atlas-water">
            SOUTHERN CANAL
          </text>
          {cityAreas
            .filter((a) => a.id !== 'archive' && a.id !== 'riverside' && a.id !== 'thonburi')
            .map((a) => (
              <rect
                key={a.id}
                x={a.bounds.x}
                y={a.bounds.z}
                width={a.bounds.w}
                height={a.bounds.d}
                fill={visited.has(a.id) ? a.color : '#70837a'}
                fillOpacity={visited.has(a.id) ? 0.32 : 0.16}
                stroke={a.color}
                strokeOpacity={0.25}
                strokeWidth={0.15}
              />
            ))}
          {[...cityRoads, ...riversideFloors, ...thonburiFloors].map((r, i) => (
            <rect
              key={`road-${i}`}
              x={r.x}
              y={r.z}
              width={r.w}
              height={r.d}
              fill="#b6b49a"
              fillOpacity={0.4}
            />
          ))}
          {archiveFloors.map((r, i) => (
            <rect
              key={`room-${i}`}
              x={r.x}
              y={r.z}
              width={r.w}
              height={r.d}
              fill="#aab79a"
              fillOpacity={visited.has('archive') ? 0.36 : 0.18}
            />
          ))}
          <rect x={riverPier.x} y={riverPier.z} width={riverPier.w} height={riverPier.d} fill="#b3a681" />
          {cityObstacles.map((r, i) => (
            <rect
              key={`solid-${i}`}
              x={r.x}
              y={r.z}
              width={r.w}
              height={r.d}
              fill={r.kind === 'pond' ? '#367786' : '#13282d'}
              stroke="#d5c99f"
              strokeWidth={0.13}
              strokeOpacity={0.38}
            />
          ))}
          {riversideBenches.map(([x1, x2, z1, z2], i) => (
            <rect
              key={`bench-${i}`}
              x={x1}
              y={z1}
              width={x2 - x1}
              height={z2 - z1}
              fill="#13282d"
              stroke="#d5c99f"
              strokeWidth={0.13}
            />
          ))}
          {overview &&
            cityAreas.map((a) => (
              <text
                key={a.id}
                x={a.id === 'archive' ? 76 : a.center.x}
                y={a.id === 'archive' ? 25 : a.center.z}
                className="atlas-place"
              >
                {a.id === 'hotel' ? 'HOTEL' : a.id === 'riverside' ? 'RIVERSIDE' : a.id.toUpperCase()}
              </text>
            ))}
          {(route.status === 'ready' || route.status === 'ferry') && (
            <polyline
              data-testid="walking-route"
              points={route.points.map((p) => `${p.x},${p.z}`).join(' ')}
              fill="none"
              stroke="#ffe4a2"
              strokeWidth={0.42}
              strokeLinejoin="round"
            />
          )}
          <circle
            cx={save.position.x}
            cy={save.position.z}
            r={0.8}
            fill="#faffeb"
            stroke="#12383d"
            strokeWidth={0.3}
          >
            <title>Your party</title>
          </circle>
          <g
            transform={`translate(${route.end.x} ${route.end.z})`}
            stroke={route.status === 'blocked' ? '#ee9b83' : '#ffe4a2'}
            strokeWidth={0.3}
            fill="none"
          >
            <circle r={1.1} />
            <path d="M-1.7 0H1.7M0-1.7V1.7" />
            <title>Selected destination</title>
          </g>
        </svg>
        <span className="atlas-orientation">N ↑</span>
      </div>
      <div className="atlas-key">
        <span>● Your party</span>
        <span>◎ Destination</span>
        <span>━ Walking route</span>
        <span>◇ Not yet visited</span>
      </div>
      <p id="atlas-instructions">
        Choose a district or tap an open street to plan your own walk. Keyboard: focus the chart and use arrow
        keys; Shift moves farther.
      </p>
      <div className="atlas-departure">
        <p role="status">
          {route.status === 'ready'
            ? 'A route through the streets is ready.'
            : route.status === 'ferry'
              ? save.flags.includes('keeper')
                ? 'This destination is across the river. Walk to the landing and take the ferry.'
                : 'Restore the last ferry in the main story to reach the other bank.'
              : route.status === 'arrived'
                ? 'Your party is already here.'
                : 'That point is blocked. Choose an open path or doorway.'}
        </p>
        <button
          disabled={route.status !== 'ready' && route.status !== 'ferry'}
          onClick={() => walk(route.end)}
        >
          {route.status === 'ferry' ? 'Walk to the ferry →' : 'Walk this route →'}
        </button>
      </div>
    </div>
  );
}
