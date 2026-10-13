"use client";

import { useEffect, useRef } from "react";

type Tick = (now: number) => void;

const ticks = new Set<Tick>();
let raf = 0;

function loop() {
  const now = Date.now();
  ticks.forEach((tick) => tick(now));
  raf = requestAnimationFrame(loop);
}

function onTick(tick: Tick) {
  ticks.add(tick);
  if (ticks.size === 1) raf = requestAnimationFrame(loop);
  return () => {
    ticks.delete(tick);
    if (ticks.size === 0) cancelAnimationFrame(raf);
  };
}

export function playSpanMinutes(blocks: { minutes: number }[]) {
  return blocks[blocks.length - 1]?.minutes || 60;
}

function clockText(leftMs: number) {
  const sign = leftMs < 0 ? "+" : "";
  const total = Math.floor(Math.abs(leftMs) / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return hours > 0 ? `${sign}${days}d ${hours}h` : `${sign}${days}d`;
  if (hours > 0) return `${sign}${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${sign}${minutes}:${String(seconds).padStart(2, "0")}`;
}

function paintClock(node: HTMLElement, leftMs: number) {
  const text = clockText(leftMs);
  node.textContent = text;
  node.dataset.over = leftMs < 0 ? "1" : "0";
  node.dataset.wide = text.length > 5 ? "1" : "0";
}

export function MiniRing({ end, spanMin }: { end: string; spanMin: number }) {
  const arc = useRef<SVGCircleElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const endMs = new Date(end).getTime();
    const span = Math.max(spanMin, 1) * 60_000;
    const length = 2 * Math.PI * 16;
    return onTick((now) => {
      const left = endMs - now;
      const remain = left < 0 ? 1 : Math.min(1, Math.max(0, left / span));
      const phase = left < 0 ? "over" : left <= 120_000 ? "warn" : "ok";
      arc.current?.setAttribute("stroke-dashoffset", String(length * (1 - remain)));
      arc.current?.setAttribute("data-over", left < 0 ? "1" : "0");
      arc.current?.setAttribute("data-soon", phase === "warn" ? "1" : "0");
      if (label.current) {
        paintClock(label.current, left);
        const host = label.current.closest("[data-hold]");
        if (host instanceof HTMLElement && host.dataset.alarm !== phase) host.dataset.alarm = phase;
      }
    });
  }, [end, spanMin]);

  return (
    <span className="live-mini">
      <svg width="28" height="28" viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r="16" className="live-track" />
        <circle ref={arc} cx="20" cy="20" r="16" className="live-arc" strokeDasharray={`${2 * Math.PI * 16} ${2 * Math.PI * 16}`} />
      </svg>
      <span ref={label} className="live-mini-time">0:00</span>
    </span>
  );
}

const HERO_VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FIELD_FRAG = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_urgent;
uniform float u_over;
out vec4 frag;
void main() {
  vec2 p = (gl_FragCoord.xy / u_res) * 2.0 - 1.0;
  p.x *= u_res.x / max(u_res.y, 1.0);
  float wave = 0.5 + 0.5 * sin(p.x * 3.2 + u_time * 0.55);
  float tide = 0.5 + 0.5 * sin(p.x * 1.3 - u_time * 0.22 + p.y);
  vec3 pine = vec3(0.080, 0.620, 0.580);
  vec3 saffron = vec3(0.920, 0.680, 0.160);
  vec3 danger = vec3(0.760, 0.270, 0.220);
  vec3 col = mix(pine, saffron, clamp(u_urgent, 0.0, 1.0) * wave);
  if (u_over > 0.5) col = mix(col, danger, 0.35 + 0.25 * sin(u_time * 2.6));
  float alpha = 0.10 + 0.06 * tide;
  frag = vec4(col, alpha);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function program(gl: WebGL2RenderingContext, fragment: string) {
  const vert = compile(gl, gl.VERTEX_SHADER, HERO_VERT);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragment);
  if (!vert || !frag) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  return prog;
}

function fit(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(2, Math.floor(rect.width * dpr));
  const height = Math.max(2, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}

const HERO_R = 52;
const HERO_C = 2 * Math.PI * HERO_R;

function phaseOf(leftMs: number): "ok" | "warn" | "over" {
  if (leftMs < 0) return "over";
  if (leftMs <= 120_000) return "warn";
  return "ok";
}

export function GlowTimer({ end, spanMin, until }: { end: string; spanMin: number; until?: string }) {
  const ringRef = useRef<SVGCircleElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const endMs = new Date(end).getTime();
    const span = Math.max(spanMin, 1) * 60_000;
    return onTick((now) => {
      const left = endMs - now;
      const phase = phaseOf(left);
      const remain = phase === "over" ? 1 : Math.min(1, Math.max(0, left / span));
      const ring = ringRef.current;
      if (ring) {
        ring.style.strokeDashoffset = String(HERO_C * (1 - remain));
        ring.dataset.phase = phase;
      }
      if (labelRef.current) paintClock(labelRef.current, left);
      if (captionRef.current) captionRef.current.textContent = phase === "over" ? "Overtime" : phase === "warn" ? "Ending" : "On time";
      if (wrapRef.current) wrapRef.current.dataset.phase = phase;
    });
  }, [end, spanMin]);

  return (
    <div className="live-hero" ref={wrapRef} data-phase="ok">
      <div className="live-hero-face">
        <svg viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r={HERO_R} className="live-hero-track" />
          <circle
            ref={ringRef}
            cx="60"
            cy="60"
            r={HERO_R}
            className="live-hero-arc"
            data-phase="ok"
            transform="rotate(-90 60 60)"
            strokeDasharray={`${HERO_C} ${HERO_C}`}
            strokeDashoffset={HERO_C}
          />
        </svg>
        <span ref={labelRef}>0:00</span>
      </div>
      <p className="live-hero-caption">
        <em ref={captionRef}>On time</em>
        {until ? <small>until {until}</small> : null}
      </p>
    </div>
  );
}

export function FloorField({ soonestEnd }: { soonestEnd: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: true });
    if (!gl) return;
    const prog = program(gl, FIELD_FRAG);
    if (!prog) return;
    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uUrgent = gl.getUniformLocation(prog, "u_urgent");
    const uOver = gl.getUniformLocation(prog, "u_over");
    const endMs = soonestEnd ? new Date(soonestEnd).getTime() : null;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const stop = onTick((now) => {
      const leftMin = endMs == null ? 30 : (endMs - now) / 60000;
      fit(canvas, gl);
      gl.useProgram(prog);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, now / 1000);
      gl.uniform1f(uUrgent, endMs == null ? 0.2 : Math.min(1, Math.max(0, (20 - Math.min(leftMin, 20)) / 20)));
      gl.uniform1f(uOver, leftMin < 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
    return () => {
      stop();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [soonestEnd]);

  return <canvas ref={canvasRef} className="live-field" aria-hidden />;
}
