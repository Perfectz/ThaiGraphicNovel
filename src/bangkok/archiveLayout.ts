import layout from './archive-layout.json' with { type: 'json' };
export const archiveRooms = layout.rooms;
export const archiveFloors = [...layout.rooms, ...layout.corridors];
export const archiveFurniture = [
  ...layout.furniture,
  ...[
    [70, 34],
    [70, 17],
    [84, 17],
    [84, 32],
  ].map(([x, z]) => ({ x: x - 0.75, z: z + 0.425, w: 1.5, d: 0.55 })),
];
export const archiveWalls = layout.rooms.flatMap((r) => {
  const walls: { x: number; z: number; w: number; d: number }[] = [];
  for (const side of ['n', 's', 'w', 'e']) {
    const horizontal = side === 'n' || side === 's',
      length = horizontal ? r.w : r.d;
    const spans = r.doors.includes(side)
      ? [
          [0, length / 2 - 2],
          [length / 2 + 2, length],
        ]
      : [[0, length]];
    for (const [start, end] of spans)
      walls.push(
        horizontal
          ? { x: r.x + start, z: side === 'n' ? r.z : r.z + r.d - 0.25, w: end - start, d: 0.25 }
          : { x: side === 'w' ? r.x : r.x + r.w - 0.25, z: r.z + start, w: 0.25, d: end - start },
      );
  }
  return walls;
});
export const archiveSites = [
  { id: 'archivist', name: 'Kanya · archivist', x: 56, z: 30, color: '#aac5b6' },
  { id: 'archive-cargo', name: 'The cargo record', x: 70, z: 34, color: '#dabb7b' },
  { id: 'archive-river', name: 'The river photograph', x: 70, z: 17, color: '#8ad0d2' },
  { id: 'archive-lantern', name: 'The lantern rubbing', x: 84, z: 17, color: '#efb477' },
  { id: 'archive-cabinet', name: 'The map cabinet', x: 84, z: 32, color: '#e0cc93' },
] as const;
export type ArchiveActor = (typeof archiveSites)[number]['id'];
export const archiveSite = (id: string) => archiveSites.find((a) => a.id === id);
