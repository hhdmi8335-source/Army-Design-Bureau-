import React from 'react';
import { Tank, Car, Plane } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type DetectionCategory = 'MILITARY' | 'CIVILIAN' | 'AIRCRAFT';

interface CategoryToggleProps {
  categories: DetectionCategory[];
  onChange: (categories: DetectionCategory[]) => void;
}

const CategoryToggle: React.FC<CategoryToggleProps> = ({ categories, onChange }) => {
  return (
    <div className="flex flex-col gap-4 p-4 bg-tactical-dark/50 border border-tactical-muted rounded-lg">
      <h3 className="text-xs font-bold font-mono text-tactical-primary uppercase tracking-widest">Domain Filters</h3>
      <ToggleGroup 
        type="multiple" 
        value={categories} 
        onValueChange={(val) => val.length > 0 && onChange(val as DetectionCategory[])}
        className="justify-start gap-2"
      >
        <ToggleGroupItem 
          value="MILITARY" 
          aria-label="Toggle Military"
          className="flex-1 gap-2 font-mono text-[10px] border-tactical-muted data-[state=on]:bg-tactical-primary data-[state=on]:text-black"
        >
          <Tank className="w-4 h-4" />
          MILITARY
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="CIVILIAN" 
          aria-label="Toggle Civilian"
          className="flex-1 gap-2 font-mono text-[10px] border-tactical-muted data-[state=on]:bg-tactical-primary data-[state=on]:text-black"
        >
          <Car className="w-4 h-4" />
          CIVILIAN
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="AIRCRAFT" 
          aria-label="Toggle Aircraft"
          className="flex-1 gap-2 font-mono text-[10px] border-tactical-muted data-[state=on]:bg-tactical-primary data-[state=on]:text-black"
        >
          <Plane className="w-4 h-4" />
          AIRCRAFT
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};

// Mock Tank icon since lucide-react might not have it or it might be named differently
const Tank = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M2 11h20v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4z" />
    <path d="M6 7h12l-2-3H8l-2 3z" />
    <path d="M2 11l2-4" />
    <path d="M22 11l-2-4" />
    <path d="M12 4V2" />
    <path d="M12 17v5" />
    <path d="M7 22h10" />
  </svg>
);

export default CategoryToggle;
