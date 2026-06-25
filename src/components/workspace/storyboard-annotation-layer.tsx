"use client";

import { useMemo } from "react";
import { Layer, Rect, Stage, Text } from "react-konva";

type StoryboardAnnotationLayerProps = {
  imageUrl: string | null;
  shotLabel: string;
  annotations: unknown[];
};

export default function StoryboardAnnotationLayer({
  imageUrl,
  shotLabel,
  annotations,
}: StoryboardAnnotationLayerProps) {
  const normalizedAnnotations = useMemo(() => normalizeAnnotations(annotations), [annotations]);

  return (
    <div className="rounded-[3px] border border-white/20 bg-black/25 p-3 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Konva 批注层 · {shotLabel}</p>
          <p className="mt-1 text-[11px] leading-4 text-white/65">
            用于后续圈选、标注和图层批注增强；当前仅展示已持久化批注和安全预览，不把未保存批注伪装成已保存。
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[11px]">{imageUrl ? "图片已加载" : "等待分镜图"}</span>
      </div>
      <div className="mt-3 overflow-hidden rounded-[3px] bg-white/10">
        <Stage width={620} height={150} className="max-w-full">
          <Layer>
            <Rect x={0} y={0} width={620} height={150} fill="#111827" opacity={0.36} />
            <Text x={18} y={18} text="Annotation Layer" fill="#ffffff" fontSize={16} fontStyle="bold" />
            <Text
              x={18}
              y={45}
              width={260}
              text={imageUrl ? "已连接当前分镜图，可用于圈选批注。" : "生成并确认分镜图后，可在这里叠加批注。"}
              fill="rgba(255,255,255,0.72)"
              fontSize={12}
              lineHeight={1.45}
            />
            {normalizedAnnotations.length === 0 ? (
              <Rect x={370} y={38} width={170} height={72} stroke="#93c5fd" dash={[8, 6]} cornerRadius={10} />
            ) : (
              normalizedAnnotations.map((annotation, index) => (
                <Rect
                  key={`${annotation.x}-${annotation.y}-${index}`}
                  x={annotation.x}
                  y={annotation.y}
                  width={annotation.width}
                  height={annotation.height}
                  stroke={annotation.color}
                  strokeWidth={2}
                  dash={annotation.dashed ? [8, 6] : undefined}
                  cornerRadius={8}
                />
              ))
            )}
            <Text
              x={382}
              y={118}
              text={normalizedAnnotations.length === 0 ? "示例圈选框" : `${normalizedAnnotations.length} 条已保存批注`}
              fill="rgba(255,255,255,0.78)"
              fontSize={11}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

function normalizeAnnotations(annotations: unknown[]) {
  return annotations
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const x = toFiniteNumber(record.x);
      const y = toFiniteNumber(record.y);
      const width = toFiniteNumber(record.width);
      const height = toFiniteNumber(record.height);
      if (x === null || y === null || width === null || height === null) return null;
      return {
        x,
        y,
        width,
        height,
        color: typeof record.color === "string" ? record.color : "#fde68a",
        dashed: record.dashed !== false,
      };
    })
    .filter((item): item is { x: number; y: number; width: number; height: number; color: string; dashed: boolean } => Boolean(item));
}

function toFiniteNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}
