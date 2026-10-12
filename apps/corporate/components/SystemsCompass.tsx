import React from 'react';

export function SystemsCompass({ className = '' }: { className?: string }) {
  return (
    <div className={`relative w-full max-w-lg mx-auto aspect-square ${className}`} aria-label="Jakuraa systems topology diagram">
      <svg viewBox="0 0 400 400" className="w-full h-full overflow-visible font-sans text-[11px]" aria-hidden="true">
        <defs>
          <radialGradient id="compass-center-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--green, #1f4d3a)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--green, #1f4d3a)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Orbit reference paths - static clean dashed lines */}
        <circle cx="200" cy="200" r="75" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-25" />
        <circle cx="200" cy="200" r="140" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="opacity-20" />

        {/* Connection rays from center to verticals */}
        <line x1="200" y1="200" x2="200" y2="60" stroke="currentColor" strokeWidth="1" className="opacity-20" />
        <line x1="200" y1="200" x2="340" y2="200" stroke="currentColor" strokeWidth="1" className="opacity-20" />
        <line x1="200" y1="200" x2="200" y2="340" stroke="currentColor" strokeWidth="1" className="opacity-20" />
        <line x1="200" y1="200" x2="60" y2="200" stroke="currentColor" strokeWidth="1" className="opacity-20" />

        {/* Center Node: Jakuraa Core */}
        <g>
          <circle cx="200" cy="200" r="38" fill="url(#compass-center-glow)" />
          <circle cx="200" cy="200" r="6" fill="var(--green, #1f4d3a)" />
          <text x="200" y="222" textAnchor="middle" fill="currentColor" className="font-semibold text-xs tracking-wider">
            JAKURAA
          </text>
          <text x="200" y="235" textAnchor="middle" fill="currentColor" className="text-[9px] font-mono opacity-60">
            SYSTEMS CORE
          </text>
        </g>

        {/* Flagship Node: Satelink Machine Commerce Rail (75px orbit) */}
        <g transform="translate(255, 150)">
          <line x1="-55" y1="50" x2="0" y2="0" stroke="var(--green, #1f4d3a)" strokeWidth="1.5" className="opacity-60" />
          <circle cx="0" cy="0" r="8" fill="var(--green, #1f4d3a)" stroke="var(--ivory, #faf8f3)" strokeWidth="2" />
          <text x="14" y="4" textAnchor="start" fill="currentColor" className="font-medium text-xs">
            Satelink Protocol
          </text>
          <text x="14" y="16" textAnchor="start" fill="currentColor" className="text-[9px] font-mono opacity-70">
            Flagship Rail
          </text>
        </g>

        {/* Outer Nodes: Registered Operating Verticals */}
        {/* Node 1: Trading & Distribution */}
        <g transform="translate(200, 60)">
          <circle cx="0" cy="0" r="5" fill="currentColor" className="opacity-60" />
          <text x="0" y="-12" textAnchor="middle" fill="currentColor" className="font-medium">
            Trading & Distribution
          </text>
          <text x="0" y="16" textAnchor="middle" fill="currentColor" className="text-[9px] font-mono opacity-50">
            MoA 3(a)
          </text>
        </g>

        {/* Node 2: International Trade */}
        <g transform="translate(340, 200)">
          <circle cx="0" cy="0" r="5" fill="currentColor" className="opacity-60" />
          <text x="0" y="18" textAnchor="middle" fill="currentColor" className="font-medium">
            International Trade
          </text>
          <text x="0" y="30" textAnchor="middle" fill="currentColor" className="text-[9px] font-mono opacity-50">
            IEC Registered
          </text>
        </g>

        {/* Node 3: Industrial Manufacturing */}
        <g transform="translate(200, 340)">
          <circle cx="0" cy="0" r="5" fill="currentColor" className="opacity-60" />
          <text x="0" y="20" textAnchor="middle" fill="currentColor" className="font-medium">
            Industrial Manufacturing
          </text>
          <text x="0" y="32" textAnchor="middle" fill="currentColor" className="text-[9px] font-mono opacity-50">
            Udyam NIC 28199
          </text>
        </g>

        {/* Node 4: Publishing & Research */}
        <g transform="translate(60, 200)">
          <circle cx="0" cy="0" r="5" fill="currentColor" className="opacity-60" />
          <text x="0" y="18" textAnchor="middle" fill="currentColor" className="font-medium">
            Publishing & Research
          </text>
          <text x="0" y="30" textAnchor="middle" fill="currentColor" className="text-[9px] font-mono opacity-50">
            Working Papers
          </text>
        </g>
      </svg>
    </div>
  );
}
