"use client";

import { useEffect, useRef } from "react";

export function Waveform({ url, height = 44 }: { url: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    let cancelled = false;

    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((buffer) => context.decodeAudioData(buffer))
      .then((audioBuffer) => {
        if (cancelled) return;
        const data = audioBuffer.getChannelData(0);
        const width = canvas.width;
        const step = Math.ceil(data.length / width);
        const amp = height / 2;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#22d3ee";
        for (let i = 0; i < width; i++) {
          let min = 1.0;
          let max = -1.0;
          for (let j = 0; j < step; j++) {
            const datum = data[i * step + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
          }
          ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }
      })
      .catch(() => {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, height);
          ctx.fillStyle = "#4b5563";
          ctx.fillRect(0, height / 2 - 1, canvas.width, 2);
        }
      });

    return () => {
      cancelled = true;
      context.close();
    };
  }, [url, height]);

  return <canvas ref={canvasRef} width={600} height={height} style={{ width: "100%", height }} />;
}
