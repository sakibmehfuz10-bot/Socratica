
import React, { useMemo } from 'react';
import * as math from 'mathjs';

interface MathGraphProps {
  expression: string;
  range?: [number, number];
  color?: string;
}

const MathGraph: React.FC<MathGraphProps> = ({ 
  expression, 
  range = [-5, 5], 
  color = '#6366f1' 
}) => {
  const data = useMemo(() => {
    const points: { x: number; y: number }[] = [];
    const steps = 120;
    const [minX, maxX] = range;
    const stepSize = (maxX - minX) / steps;

    try {
      const node = math.parse(expression);
      const code = node.compile();

      for (let i = 0; i <= steps; i++) {
        const x = minX + i * stepSize;
        try {
          const y = code.evaluate({ x });
          if (typeof y === 'number' && !isNaN(y) && isFinite(y)) {
            points.push({ x, y });
          }
        } catch (e) {
          // Skip undefined regions
        }
      }
      return { points, error: null };
    } catch (err: any) {
      return { points: [], error: err.message };
    }
  }, [expression, range]);

  if (data.error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-xl text-[11px] font-mono border border-red-100">
        Plotting Error: {data.error}
      </div>
    );
  }

  if (data.points.length < 2) return null;

  const width = 300;
  const height = 200;
  const padding = 25;

  const allY = data.points.map(p => p.y);
  const rawMinY = Math.min(...allY);
  const rawMaxY = Math.max(...allY);
  
  // Constrain Y to avoid extreme stretching, but include 0
  const minY = Math.max(Math.min(rawMinY, -0.5), -20);
  const maxY = Math.min(Math.max(rawMaxY, 0.5), 20);
  
  const [minX, maxX] = range;

  const mapX = (x: number) => padding + ((x - minX) / (maxX - minX)) * (width - 2 * padding);
  const mapY = (y: number) => {
    // Clamp Y for visualization
    const clampedY = Math.max(minY, Math.min(maxY, y));
    return height - padding - ((clampedY - minY) / (maxY - minY)) * (height - 2 * padding);
  };

  const pathData = data.points.reduce((acc, p, i) => {
    const x = mapX(p.x);
    const y = mapY(p.y);
    return acc + `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
  }, '');

  return (
    <div className="my-5 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Interactive Plot</span>
        </div>
        <code className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">$y = {expression}$</code>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {/* Grid lines (optional, kept simple for aesthetic) */}
        <line x1={mapX(minX)} y1={mapY(0)} x2={mapX(maxX)} y2={mapY(0)} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={mapX(0)} y1={mapY(minY)} x2={mapX(0)} y2={mapY(maxY)} stroke="#e2e8f0" strokeWidth="1" />
        
        {/* Axis Labels */}
        <text x={mapX(maxX) - 5} y={mapY(0) + 12} fontSize="9" fill="#94a3b8" textAnchor="end" fontWeight="bold">x</text>
        <text x={mapX(0) + 5} y={mapY(maxY) + 5} fontSize="9" fill="#94a3b8" fontWeight="bold">y</text>

        {/* Function Path */}
        <path 
          d={pathData} 
          fill="none" 
          stroke={color} 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="drop-shadow-sm"
        />
      </svg>
      <div className="mt-3 flex justify-center gap-4">
         <span className="text-[9px] font-bold text-slate-400">Range: [{minX}, {maxX}]</span>
      </div>
    </div>
  );
};

export default MathGraph;
