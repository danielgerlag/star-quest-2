const drawings: Readonly<Record<string, string>> = {
  tool: '<path d="M11 1v4H7V1L4 4v4l3 2v5h4v-5l3-2V4Z"/>',
  coupling: '<path d="M2 4h12v8H2ZM5 2v12M11 2v12"/>',
  "nav-chip": '<path d="M4 3h8v10H4ZM6 5h4v6H6M1 5h3M1 8h3M1 11h3M12 5h3M12 8h3M12 11h3"/>',
  probe: '<path d="m8 1 3 4v7H5V5ZM5 8l-3 5h3M11 8l3 5h-3M7 14v1M9 14v1"/>',
  decoy: '<path d="m8 3 3 4v6H5V7ZM3 2l2 2M13 2l-2 2M1 7h3M12 7h3M7 15h2"/><circle cx="8" cy="9" r="1"/>',
  "service-form": '<path d="M3 1h7l3 3v11H3ZM10 1v4h3M5 7h6M5 10h6M5 13h4"/>',
  voucher: '<path d="M2 3h12v10H2ZM4 5h5M4 8h3M9 10l1 1 3-4"/>',
  transceiver: '<path d="M2 6h12v8H2ZM4 6V2M12 6V1M4 9h3v3H4M9 9h3M9 12h2"/>',
  "flight-log": '<path d="M3 1h9l2 2v12H3ZM5 1v5h6V1M5 9h6v4H5M7 10v2"/>',
  "logic-module": '<path d="M4 4h8v8H4ZM6 6h4v4H6M5 1v3M8 1v3M11 1v3M5 12v3M8 12v3M11 12v3M1 5h3M12 5h3M1 11h3M12 11h3"/>',
  inverter: '<path d="M2 3h3v10H2ZM11 3h3v10h-3M5 5h6M5 8h6M5 11h6M7 2l2 2-2 2M9 10l-2 2 2 2"/>',
  "containment-plan": '<path d="M2 1h12v14H2ZM4 3h8M4 12h8M5 7l3 3 3-3"/><circle cx="5" cy="6" r="1"/><circle cx="11" cy="6" r="1"/>',
};

export function itemDrawing(id: string): string {
  const drawing = drawings[id];
  if (!drawing) throw new Error(`Missing inventory artwork: ${id}`);
  return drawing;
}

export function itemImage(id: string, color: number): string {
  const tint = `#${color.toString(16).padStart(6, "0")}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><g fill="#132238" stroke="${tint}" stroke-width="1.2" stroke-linejoin="round">${itemDrawing(id)}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
