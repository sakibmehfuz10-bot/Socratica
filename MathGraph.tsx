
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
    const steps = 150;
    const [minX, maxX] = range;
    const stepSize = (maxX - minX) / steps;

    try {
      // Clean expression for mathjs
      const cleanExpr = expression
        .replace(/\\cdot/g, '*')
        .replace(/\\times/g, '*')
        .replace(/{/g, '(')
        .replace(/}/g, ')');
        
      const node = math.parse(cleanExpr);
      const code = node.compile();

      for (let i = 0; i <= steps; i++) {
        const x = minX + i * stepSize;
        try {
          const y = code.evaluate({ x });
          if (typeof y === 'number' && !isNaN(y) && isFinite(y)) {
            points.push({ x, y });
          }
        } catch (e) { /* Skip poles/undefined */ }
      }
      return { points, error: null };
    } catch (err: any) {
      return { points: [], error: err.message };
    }
  }, [expression, range]);

  if (data.error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-xl text-[10px] font-mono border border-red-100 my-4">
        Plotting Insight: {data.error}
      </div>
    );
  }

  if (data.points.length < 2) return null;

  const width = 400;
  const height = 250;
  const padding = 30;

  const allY = data.points.map(p => p.y);
  const minY = Math.max(Math.min(...allY, -1), -15);
  const maxY = Math.min(Math.max(...allY, 1), 15);
  const [minX, maxX] = range;

  const mapX = (x: number) => padding + ((x - minX) / (maxX - minX)) * (width - 2 * padding);
  const mapY = (y: number) => {
    const clampedY = Math.max(minY, Math.min(maxY, y));
    return height - padding - ((clampedY - minY) / (maxY - minY)) * (height - 2 * padding);
  };

  const pathData = data.points.reduce<string>((acc, p, i) => {
    const x = mapX(p.x);
    const y = mapY(p.y);
    return acc + `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
  }, '');

  return (
    <div className="my-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-md animate-in zoom-in-95 duration-700">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visual Discovery</span>
        </div>
        <div className="px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
          <code className="text-xs font-bold text-indigo-700">y = {expression}</code>
        </div>
      </div>
      
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible drop-shadow-sm">
        {/* Axes */}
        <line x1={mapX(minX)} y1={mapY(0)} x2={mapX(maxX)} y2={mapY(0)} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 2" />
        <line x1={mapX(0)} y1={mapY(minY)} x2={mapX(0)} y2={mapY(maxY)} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 2" />
        
        {/* Labels */}
        <text x={mapX(maxX)} y={mapY(0) + 15} fontSize="10" fill="#94a3b8" textAnchor="end" fontWeight="bold">x</text>
        <text x={mapX(0) + 10} y={mapY(maxY) + 10} fontSize="10" fill="#94a3b8" fontWeight="bold">y</text>
        
        <path 
          d={pathData} 
          fill="none" 
          stroke={color} 
          strokeWidth="3.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
      
      <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between">
         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Horizontal Domain: {minX} to {maxX}</span>
         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Zoomed Perspective</span>
      </div>
    </div>
  );
};

export default MathGraph;
