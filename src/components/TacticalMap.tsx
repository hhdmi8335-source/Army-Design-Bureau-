import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Threat {
  id: string;
  x: number;
  y: number;
  type: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  trackingId?: string;
  reliability?: string;
}

interface TacticalMapProps {
  threats: Threat[];
}

const TacticalMap: React.FC<TacticalMapProps> = ({ threats }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = 600;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    svg.selectAll("*").remove();

    // Background grid
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain([0, 100]).range([0, width - margin.left - margin.right]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([height - margin.top - margin.bottom, 0]);

    // Draw grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("stroke", "#1a1a1a")
      .attr("stroke-opacity", 0.3)
      .call(d3.axisBottom(xScale).ticks(10).tickSize(height - margin.top - margin.bottom).tickFormat(() => ""));

    g.append("g")
      .attr("class", "grid")
      .attr("stroke", "#1a1a1a")
      .attr("stroke-opacity", 0.3)
      .call(d3.axisLeft(yScale).ticks(10).tickSize(-(width - margin.left - margin.right)).tickFormat(() => ""));

    // Draw threats
    const threatNodes = g.selectAll(".threat")
      .data(threats)
      .enter()
      .append("g")
      .attr("class", "threat")
      .attr("transform", d => `translate(${xScale(d.x)},${yScale(d.y)})`);

    // Outer tracking ring
    threatNodes.append("circle")
      .attr("r", 15)
      .attr("fill", "none")
      .attr("stroke", d => {
        switch (d.threatLevel) {
          case 'critical': return '#ef4444';
          case 'high': return '#f97316';
          case 'medium': return '#eab308';
          default: return '#22c55e';
        }
      })
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,2")
      .append("animateTransform")
      .attr("attributeName", "transform")
      .attr("type", "rotate")
      .attr("from", "0 0 0")
      .attr("to", "360 0 0")
      .attr("dur", "10s")
      .attr("repeatCount", "indefinite");

    threatNodes.append("circle")
      .attr("r", 6)
      .attr("fill", d => {
        switch (d.threatLevel) {
          case 'critical': return '#ef4444';
          case 'high': return '#f97316';
          case 'medium': return '#eab308';
          default: return '#22c55e';
        }
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    threatNodes.append("text")
      .attr("dy", -20)
      .attr("text-anchor", "middle")
      .attr("fill", "#fff")
      .attr("font-size", "9px")
      .attr("font-family", "monospace")
      .attr("font-weight", "bold")
      .text(d => d.trackingId || d.label);

    threatNodes.append("text")
      .attr("dy", 25)
      .attr("text-anchor", "middle")
      .attr("fill", d => d.reliability === 'LOW' ? '#ef4444' : '#9ca3af')
      .attr("font-size", "7px")
      .attr("font-family", "monospace")
      .text(d => d.reliability ? `REL: ${d.reliability}` : '');

    // Add radar sweep effect
    const sweep = g.append("line")
      .attr("x1", xScale(50))
      .attr("y1", yScale(50))
      .attr("x2", xScale(50))
      .attr("y2", 0)
      .attr("stroke", "#22c55e")
      .attr("stroke-width", 2)
      .attr("opacity", 0.5);

    const rotate = () => {
      sweep.transition()
        .duration(4000)
        .ease(d3.easeLinear)
        .attrTween("transform", () => {
          return (t) => `rotate(${t * 360}, ${xScale(50)}, ${yScale(50)})`;
        })
        .on("end", rotate);
    };
    rotate();

  }, [threats]);

  return (
    <div className="relative w-full aspect-[3/2] bg-[#050505] border border-tactical-muted rounded-lg overflow-hidden shadow-2xl">
      <div className="absolute top-2 left-2 z-10 bg-black/50 px-2 py-1 rounded border border-tactical-muted">
        <span className="text-[10px] font-mono text-tactical-primary uppercase tracking-widest">Tactical Overlay v2.4</span>
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 600 400"
        className="w-full h-full"
      />
      <div className="absolute bottom-2 right-2 flex gap-4 text-[10px] font-mono text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" /> Critical
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-orange-500" /> High
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" /> Medium
        </div>
      </div>
    </div>
  );
};

export default TacticalMap;
