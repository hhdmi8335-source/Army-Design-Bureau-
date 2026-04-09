import React, { useState } from 'react';
import { Search, BookOpen, Info, History, Shield, Zap, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';

interface KnowledgeBaseProps {
  detectedVehicle?: string | null;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ detectedVehicle }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentDetections, setRecentDetections] = useState<string[]>([]);
  const [vehicleInfo, setVehicleInfo] = useState<{
    name: string;
    country: string;
    type: string;
    specifications: {
      speed: string;
      armor: string;
      weight: string;
      engine: string;
      armament: string;
    };
    history: string;
    keyFeatures: string[];
  } | null>(null);

  const fetchVehicleInfo = async (vehicleName: string) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "undefined") {
      console.error("Gemini API key is missing. Please configure it in the Settings menu.");
      return;
    }

    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide detailed military specifications, history, and key features for the vehicle: ${vehicleName}. Ensure the response is accurate and technical.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              country: { type: Type.STRING },
              type: { type: Type.STRING },
              specifications: {
                type: Type.OBJECT,
                properties: {
                  speed: { type: Type.STRING },
                  armor: { type: Type.STRING },
                  weight: { type: Type.STRING },
                  engine: { type: Type.STRING },
                  armament: { type: Type.STRING }
                }
              },
              history: { type: Type.STRING },
              keyFeatures: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["name", "country", "type", "specifications", "history", "keyFeatures"]
          }
        }
      });

      const data = JSON.parse(response.text);
      setVehicleInfo(data);
      
      // Add to recent if not already there
      setRecentDetections(prev => {
        const filtered = prev.filter(v => v.toLowerCase() !== vehicleName.toLowerCase());
        return [vehicleName, ...filtered].slice(0, 5);
      });
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (detectedVehicle) {
      setQuery(detectedVehicle);
      fetchVehicleInfo(detectedVehicle);
    }
  }, [detectedVehicle]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    fetchVehicleInfo(query);
  };

  return (
    <section className="py-12 bg-tactical-dark/30 border-t border-tactical-muted">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-tactical-primary/10 rounded-lg border border-tactical-primary/20">
            <BookOpen className="w-6 h-6 text-tactical-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-mono tracking-tighter uppercase">Tactical Knowledge Base</h2>
            <p className="text-sm text-muted-foreground font-mono">AI-powered intelligence platform for vehicle specifications and history</p>
          </div>
        </div>

        <Card className="p-6 bg-tactical-dark/50 border-tactical-muted">
          <form onSubmit={handleSearch} className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vehicle name (e.g. T-90MS, Leopard 2A7, Bradley M2A3)..."
                className="pl-10 bg-black/40 border-tactical-muted font-mono text-sm"
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-tactical-primary text-black font-bold font-mono hover:bg-tactical-primary/90"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "INTEL SEARCH"}
            </Button>
          </form>

          {recentDetections.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              <span className="text-[10px] font-mono text-muted-foreground uppercase flex items-center mr-2">Recent:</span>
              {recentDetections.map((v, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(v); fetchVehicleInfo(v); }}
                  className="text-[10px] font-mono px-2 py-1 bg-tactical-primary/10 border border-tactical-primary/20 text-tactical-primary rounded hover:bg-tactical-primary/20 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-20 text-center"
              >
                <Loader2 className="w-12 h-12 text-tactical-primary animate-spin mx-auto mb-4" />
                <p className="text-sm font-mono text-muted-foreground animate-pulse">ACCESSING CLASSIFIED DATABASE...</p>
              </motion.div>
            ) : vehicleInfo ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                <div className="lg:col-span-1 space-y-6">
                  <div className="p-4 bg-black/40 rounded-lg border border-tactical-muted">
                    <h3 className="text-xl font-bold font-mono text-white mb-1 uppercase">{vehicleInfo.name}</h3>
                    <p className="text-xs font-mono text-tactical-primary uppercase tracking-widest mb-4">{vehicleInfo.country} | {vehicleInfo.type}</p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/5">
                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                          <Zap className="w-3 h-3" /> SPEED
                        </div>
                        <div className="text-xs font-mono font-bold text-white">{vehicleInfo.specifications.speed}</div>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/5">
                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                          <Shield className="w-3 h-3" /> ARMOR
                        </div>
                        <div className="text-xs font-mono font-bold text-white">{vehicleInfo.specifications.armor}</div>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/5">
                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                          <Info className="w-3 h-3" /> WEIGHT
                        </div>
                        <div className="text-xs font-mono font-bold text-white">{vehicleInfo.specifications.weight}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-black/40 rounded-lg border border-tactical-muted">
                    <h4 className="text-xs font-bold font-mono text-tactical-primary uppercase mb-3">Key Features</h4>
                    <ul className="space-y-2">
                      {vehicleInfo.keyFeatures.map((feature: string, i: number) => (
                        <li key={i} className="flex gap-2 text-[10px] font-mono text-muted-foreground">
                          <span className="text-tactical-primary">▶</span> {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="p-6 bg-black/40 rounded-lg border border-tactical-muted h-full">
                    <div className="flex items-center gap-2 mb-4">
                      <History className="w-4 h-4 text-tactical-primary" />
                      <h4 className="text-xs font-bold font-mono text-tactical-primary uppercase">Operational History</h4>
                    </div>
                    <p className="text-sm font-mono text-muted-foreground leading-relaxed">
                      {vehicleInfo.history}
                    </p>
                    
                    <div className="mt-8 grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/5 rounded border border-white/5">
                        <h5 className="text-[10px] font-bold font-mono text-muted-foreground uppercase mb-2">Engine</h5>
                        <p className="text-xs font-mono text-white">{vehicleInfo.specifications.engine}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded border border-white/5">
                        <h5 className="text-[10px] font-bold font-mono text-muted-foreground uppercase mb-2">Armament</h5>
                        <p className="text-xs font-mono text-white">{vehicleInfo.specifications.armament}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="py-20 text-center text-muted-foreground font-mono">
                <Info className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Enter a vehicle name to retrieve tactical intelligence</p>
              </div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </section>
  );
};

export default KnowledgeBase;
