import { LucideIcon, Shield, Target, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type OperationalMode = 'SURVEILLANCE' | 'TRAINING' | 'ANALYSIS';

interface ModeSelectorProps {
  currentMode: OperationalMode;
  onModeChange: (mode: OperationalMode) => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onModeChange }) => {
  const modes: { id: OperationalMode; label: string; icon: LucideIcon; description: string }[] = [
    { 
      id: 'SURVEILLANCE', 
      label: 'Surveillance', 
      icon: Shield, 
      description: 'Real-time monitoring and threat detection' 
    },
    { 
      id: 'TRAINING', 
      label: 'Training', 
      icon: Target, 
      description: 'Simulation and target identification practice' 
    },
    { 
      id: 'ANALYSIS', 
      label: 'Analysis', 
      icon: Activity, 
      description: 'Post-mission data review and reporting' 
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 bg-tactical-dark/50 border border-tactical-muted rounded-lg">
      <h3 className="text-xs font-bold font-mono text-tactical-primary uppercase tracking-widest">Operational Mode</h3>
      <div className="grid grid-cols-1 gap-2">
        {modes.map((mode) => (
          <Button
            key={mode.id}
            variant={currentMode === mode.id ? 'default' : 'outline'}
            onClick={() => onModeChange(mode.id)}
            className={`justify-start gap-3 h-auto py-3 px-4 border-tactical-muted transition-all ${
              currentMode === mode.id 
                ? 'bg-tactical-primary text-black hover:bg-tactical-primary/90' 
                : 'bg-transparent text-muted-foreground hover:text-white hover:bg-white/5'
            }`}
          >
            <mode.icon className={`w-5 h-5 ${currentMode === mode.id ? 'text-black' : 'text-tactical-primary'}`} />
            <div className="text-left">
              <div className="text-sm font-bold font-mono uppercase tracking-tight">{mode.label}</div>
              <div className="text-[10px] opacity-70 font-mono leading-tight">{mode.description}</div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default ModeSelector;
