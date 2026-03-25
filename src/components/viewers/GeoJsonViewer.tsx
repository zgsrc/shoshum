"use client";

import { useMemo } from "react";
import PreviewMessage from "./PreviewMessage";

interface GeoJsonViewerProps {
  content: string;
  name: string;
}

type Position = [number, number];

interface ParsedFeature {
  key: string;
  type: string;
  properties: Record<string, unknown> | null;
  positions: Position[][];
  points: Position[];
}

export default function GeoJsonViewer({ content, name }: GeoJsonViewerProps) {
  const parsed = useMemo(() => {
    try {
      const data = JSON.parse(content) as Record<string, unknown>;
      if (data.type === "Topology") {
        return {
          error: "TopoJSON files are detected, but only GeoJSON geometries are currently rendered in display view.",
          features: [] as ParsedFeature[],
        };
      }
      const features = extractFeatures(data);
      return { error: null as string | null, features };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Could not parse this GeoJSON document.",
        features: [] as ParsedFeature[],
      };
    }
  }, [content]);

  if (parsed.error) {
    return <PreviewMessage title="Map preview unavailable" body={parsed.error} />;
  }

  if (parsed.features.length === 0) {
    return (
      <PreviewMessage
        title="Map preview unavailable"
        body="This GeoJSON file does not contain any drawable geometry."
      />
    );
  }

  const bounds = calculateBounds(parsed.features);
  if (!bounds) {
    return (
      <PreviewMessage
        title="Map preview unavailable"
        body="This GeoJSON file does not contain valid coordinates."
      />
    );
  }

  const featureCount = parsed.features.length;
  const pointCount = parsed.features.reduce((sum, feature) => sum + feature.points.length, 0);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--sh-bg)" }}>
      <div
        className="flex h-10 items-center gap-3 px-3 text-xs font-mono"
        style={{
          backgroundColor: "var(--sh-bg2)",
          borderBottom: "1px solid var(--sh-border)",
          color: "var(--sh-text2)",
        }}
      >
        <span className="truncate" title={name}>
          {name}
        </span>
        <span>{featureCount.toLocaleString()} feature{featureCount === 1 ? "" : "s"}</span>
        <span>{pointCount.toLocaleString()} point{pointCount === 1 ? "" : "s"}</span>
        <span className="ml-auto">
          {bounds.minX.toFixed(2)}, {bounds.minY.toFixed(2)} to {bounds.maxX.toFixed(2)}, {bounds.maxY.toFixed(2)}
        </span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[2fr_1fr]">
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: "var(--sh-bg2)",
              border: "1px solid var(--sh-border)",
            }}
          >
            <svg viewBox="0 0 1000 700" className="h-full min-h-[420px] w-full rounded-lg" style={{ backgroundColor: "var(--sh-bg)" }}>
              <rect x="0" y="0" width="1000" height="700" fill="transparent" />
              {parsed.features.map((feature) => (
                <g key={feature.key}>
                  {feature.positions.map((line, index) => (
                    <polyline
                      key={`${feature.key}-line-${index}`}
                      fill={feature.type.includes("Polygon") ? "rgba(88, 166, 255, 0.18)" : "none"}
                      stroke="var(--sh-accent-blue)"
                      strokeWidth={feature.type.includes("Polygon") ? 2 : 3}
                      points={line.map((position) => project(position, bounds)).join(" ")}
                    />
                  ))}
                  {feature.points.map((point, index) => {
                    const [x, y] = projectPoint(point, bounds);
                    return (
                      <circle
                        key={`${feature.key}-point-${index}`}
                        cx={x}
                        cy={y}
                        r="5"
                        fill="var(--sh-accent-green)"
                        stroke="var(--sh-bg)"
                        strokeWidth="2"
                      />
                    );
                  })}
                </g>
              ))}
            </svg>
          </div>
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: "var(--sh-bg2)",
              border: "1px solid var(--sh-border)",
            }}
          >
            <div className="mb-3 text-xs font-mono uppercase tracking-wide" style={{ color: "var(--sh-text2)" }}>
              Feature summary
            </div>
            <div className="flex flex-col gap-2">
              {parsed.features.slice(0, 25).map((feature) => (
                <div
                  key={`${feature.key}-summary`}
                  className="rounded-lg px-3 py-2"
                  style={{
                    backgroundColor: "var(--sh-bg)",
                    border: "1px solid var(--sh-border)",
                  }}
                >
                  <div className="text-sm font-medium" style={{ color: "var(--sh-text)" }}>
                    {(feature.properties?.name as string) || feature.type}
                  </div>
                  <div className="mt-1 text-xs font-mono" style={{ color: "var(--sh-text2)" }}>
                    {feature.type}
                  </div>
                </div>
              ))}
              {parsed.features.length > 25 && (
                <div className="text-xs font-mono" style={{ color: "var(--sh-text2)" }}>
                  Showing the first 25 features in the sidebar.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function extractFeatures(value: Record<string, unknown>): ParsedFeature[] {
  if (value.type === "FeatureCollection" && Array.isArray(value.features)) {
    return value.features.flatMap((feature, index) =>
      buildFeature(`feature-${index}`, feature as Record<string, unknown>)
    );
  }

  if (value.type === "Feature") {
    return buildFeature("feature-0", value);
  }

  return buildGeometryFeatures("geometry-0", value, null);
}

function buildFeature(key: string, value: Record<string, unknown>): ParsedFeature[] {
  return buildGeometryFeatures(
    key,
    value.geometry as Record<string, unknown> | null,
    (value.properties as Record<string, unknown>) ?? null
  );
}

function buildGeometryFeatures(
  key: string,
  geometry: Record<string, unknown> | null,
  properties: Record<string, unknown> | null
): ParsedFeature[] {
  if (!geometry || typeof geometry !== "object") return [];

  const type = String(geometry.type ?? "");
  const coordinates = geometry.coordinates;

  if (type === "Point") {
    const point = normalizePoint(coordinates);
    return point ? [{ key, type, properties, positions: [], points: [point] }] : [];
  }

  if (type === "MultiPoint") {
    const points = normalizePoints(coordinates);
    return points.length ? [{ key, type, properties, positions: [], points }] : [];
  }

  if (type === "LineString") {
    const line = normalizeLine(coordinates);
    return line.length ? [{ key, type, properties, positions: [line], points: [] }] : [];
  }

  if (type === "MultiLineString") {
    const lines = normalizeLines(coordinates);
    return lines.length ? [{ key, type, properties, positions: lines, points: [] }] : [];
  }

  if (type === "Polygon") {
    const rings = normalizeLines(coordinates);
    return rings.length ? [{ key, type, properties, positions: rings, points: [] }] : [];
  }

  if (type === "MultiPolygon") {
    const polygons = Array.isArray(coordinates) ? coordinates : [];
    const lines = polygons.flatMap((polygon) => normalizeLines(polygon));
    return lines.length ? [{ key, type, properties, positions: lines, points: [] }] : [];
  }

  if (type === "GeometryCollection" && Array.isArray(geometry.geometries)) {
    return geometry.geometries.flatMap((entry, index) =>
      buildGeometryFeatures(`${key}-${index}`, entry as Record<string, unknown>, properties)
    );
  }

  return [];
}

function normalizePoint(value: unknown): Position | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = Number(value[0]);
  const y = Number(value[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x, y];
}

function normalizePoints(value: unknown): Position[] {
  return Array.isArray(value)
    ? value.map((entry) => normalizePoint(entry)).filter((entry): entry is Position => entry !== null)
    : [];
}

function normalizeLine(value: unknown): Position[] {
  return normalizePoints(value);
}

function normalizeLines(value: unknown): Position[][] {
  return Array.isArray(value)
    ? value
        .map((entry) => normalizeLine(entry))
        .filter((entry) => entry.length > 0)
    : [];
}

function calculateBounds(features: ParsedFeature[]) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const feature of features) {
    for (const point of feature.points) {
      [minX, minY, maxX, maxY] = expandBounds(point, minX, minY, maxX, maxY);
    }
    for (const line of feature.positions) {
      for (const point of line) {
        [minX, minY, maxX, maxY] = expandBounds(point, minX, minY, maxX, maxY);
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  if (minX === maxX) {
    minX -= 0.5;
    maxX += 0.5;
  }
  if (minY === maxY) {
    minY -= 0.5;
    maxY += 0.5;
  }

  return { minX, minY, maxX, maxY };
}

function expandBounds(
  point: Position,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): [number, number, number, number] {
  return [
    Math.min(minX, point[0]),
    Math.min(minY, point[1]),
    Math.max(maxX, point[0]),
    Math.max(maxY, point[1]),
  ];
}

function project(point: Position, bounds: { minX: number; minY: number; maxX: number; maxY: number }) {
  const [x, y] = projectPoint(point, bounds);
  return `${x},${y}`;
}

function projectPoint(
  point: Position,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): [number, number] {
  const padding = 40;
  const width = 1000 - padding * 2;
  const height = 700 - padding * 2;
  const scaleX = width / (bounds.maxX - bounds.minX);
  const scaleY = height / (bounds.maxY - bounds.minY);
  const scale = Math.min(scaleX, scaleY);
  const offsetX = padding + (width - (bounds.maxX - bounds.minX) * scale) / 2;
  const offsetY = padding + (height - (bounds.maxY - bounds.minY) * scale) / 2;

  const x = offsetX + (point[0] - bounds.minX) * scale;
  const y = 700 - (offsetY + (point[1] - bounds.minY) * scale);
  return [x, y];
}
