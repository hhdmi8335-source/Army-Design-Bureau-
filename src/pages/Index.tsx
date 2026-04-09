import { useState, useEffect } from "react";
import { FileText, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import DetectionTabs from "@/components/DetectionTabs";
import AnalysisReportView from "@/components/AnalysisReport";
import Dashboard from "@/components/Dashboard";
import KnowledgeBase from "@/components/KnowledgeBase";
import { voiceAlerts } from "@/services/voiceAlerts";

interface AnalysisReport {
  report_title: string;
  overall_threat_level: string;
  confidence_score: number;
  executive_summary: string;
  findings: Array<{
    finding_number: number;
    title: string;
    description: string;
    threat_type: string;
    threat_level: string;
    confidence: number;
    frame_index: number;
    tactical_significance: string;
    speed?: string;
    armor_type?: string;
    country_of_origin?: string;
    tracking_id?: string;
    reliability_level?: string;
  }>;
  terrain_assessment: string;
  recommended_actions: string[];
  engagement_priority: Array<{
    priority: number;
    target: string;
    justification: string;
  }>;
}

const Index = () => {
  const navigate = useNavigate();
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [frameCaptures, setFrameCaptures] = useState<string[]>([]);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [lastDetectedVehicle, setLastDetectedVehicle] = useState<string | null>(null);

  const handleReportGenerated = (newReport: AnalysisReport, frames: string[]) => {
    setReport(newReport);
    setFrameCaptures(frames);

    // Extract vehicle names for Knowledge Base
    if (newReport.findings.length > 0) {
      const vehicleNames = newReport.findings.map(f => f.title);
      if (vehicleNames.length > 0) {
        setLastDetectedVehicle(vehicleNames[0]);
      }
    }

    // Voice announcement
    if (isVoiceEnabled && newReport.findings.length > 0) {
      const highestThreat = newReport.findings.reduce((prev, current) => {
        const levels = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        return (levels[current.threat_level.toLowerCase() as keyof typeof levels] || 0) > 
               (levels[prev.threat_level.toLowerCase() as keyof typeof levels] || 0) ? current : prev;
      });
      
      const confidenceText = highestThreat.confidence > 80 ? "high confidence" : "moderate confidence";
      voiceAlerts.speak(`${highestThreat.title} detected with ${confidenceText}.`);
    }

    setTimeout(() => {
      document.getElementById('report')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <Button
          onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
          variant="outline"
          className="w-10 h-10 p-0 border-tactical-muted"
        >
          {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
        <Button 
          onClick={() => navigate('/documentation')}
          variant="outline"
          className="gap-2 font-mono"
        >
          <FileText className="w-4 h-4" />
          Documentation
        </Button>
      </div>

      <Hero />
      <Features />
      
      <DetectionTabs onReportGenerated={handleReportGenerated} />
      {report && <AnalysisReportView report={report} frameCaptures={frameCaptures} />}
      <KnowledgeBase detectedVehicle={lastDetectedVehicle} />
      <Dashboard />
      
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground font-mono text-sm">
            ARMY DESIGN BUREAU | AI-BASED TARGET DETECTION SYSTEM | AUTHORIZED PERSONNEL ONLY
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
