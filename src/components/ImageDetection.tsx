import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Upload, Loader2, Crosshair, AlertTriangle, SkipForward, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { analyzeImage as geminiAnalyzeImage, analyzeImages as geminiAnalyzeImages, AnalysisResult, AnalysisReport, Detection } from "@/services/geminiAnalysis";

interface ImageDetectionProps {
  onReportGenerated: (report: AnalysisReport, frameCaptures: string[]) => void;
}

const ImageDetection = ({ onReportGenerated }: ImageDetectionProps) => {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSendingAlert, setIsSendingAlert] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [sceneSummary, setSceneSummary] = useState("");
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [batchResults, setBatchResults] = useState<{ index: number; data: AnalysisResult }[]>([]);
  const [batchProgress, setBatchProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
      toast({ title: "Invalid Files", description: "Please upload image files (JPG, PNG, etc).", variant: "destructive" });
      return;
    }

    setImageFiles(validFiles);
    setCurrentImageIndex(0);
    setDetections([]);
    setAnalysisComplete(false);
    setSceneSummary("");
    setBatchResults([]);
    setBatchProgress(0);

    const urls = validFiles.map(file => URL.createObjectURL(file));
    setImageUrls(urls);

    // Convert all to base64 (or just the first one for now to avoid memory issues)
    const dataUrls: string[] = [];
    let loadedCount = 0;

    validFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        dataUrls[index] = reader.result as string;
        loadedCount++;
        if (loadedCount === validFiles.length) {
          setImageDataUrls(dataUrls);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  const analyzeImage = async () => {
    if (imageDataUrls.length === 0) return;
    
    if (imageFiles.length > 1) {
      // Batch analysis
      setIsAnalyzing(true);
      setBatchResults([]);
      setBatchProgress(0);
      
      const results = [];
      for (let i = 0; i < imageDataUrls.length; i++) {
        try {
          setCurrentImageIndex(i);
          const startTime = Date.now();
          const data = await geminiAnalyzeImage(imageDataUrls[i], 'full') as AnalysisResult;
          const processingTime = Date.now() - startTime;
          results.push({ index: i, data });
          
          // Log to database
          const newDetections = data.detections || [];
          const avgConfidence = newDetections.length > 0
            ? newDetections.reduce((s: number, d: Detection) => s + d.confidence, 0) / newDetections.length
            : 0;
          const maxThreat = newDetections.reduce((max: string, d: Detection) => {
            const levels: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
            return (levels[d.threat_level] || 0) > (levels[max] || 0) ? d.threat_level : max;
          }, 'NONE');

          const isPlaceholder = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder');
          if (isPlaceholder) {
            console.warn("Supabase not configured, skipping database log.");
            setBatchProgress(((i + 1) / imageDataUrls.length) * 100);
            continue;
          }

          const { error: logError } = await supabase.from('detection_logs').insert([{
            analysis_result: JSON.stringify({ detections: newDetections, scene_summary: data.scene_summary }),
            threat_level: maxThreat.toLowerCase(),
            detected_objects: JSON.parse(JSON.stringify(newDetections)),
            confidence_score: avgConfidence,
            processing_time_ms: processingTime,
            source_type: 'image',
            session_id: 'session-' + Date.now(),
            metadata: JSON.parse(JSON.stringify({ 
              filename: imageFiles[i].name,
              detection_count: newDetections.length,
              batch_id: 'batch-' + Date.now(),
              report: data.report
            }))
          }]);

          if (logError) {
            console.error("Database log error:", logError);
            toast({ 
              title: "Log Failed", 
              description: `Failed to save analysis for ${imageFiles[i].name}: ${logError.message}`, 
              variant: "destructive" 
            });
          }

          setBatchProgress(((i + 1) / imageDataUrls.length) * 100);
        } catch (err) {
          console.error(`Error analyzing image ${i}:`, err);
        }
      }
      
      setBatchResults(results);
      setIsAnalyzing(false);
      setAnalysisComplete(true);
      toast({ title: "Batch Analysis Complete", description: `Processed ${results.length} images.` });
      
      // Set the last one as current view
      const lastResult = results[results.length - 1];
      if (lastResult) {
        setDetections(lastResult.data.detections || []);
        setSceneSummary(lastResult.data.scene_summary || "");
      }
    } else {
      // Single analysis
      const currentDataUrl = imageDataUrls[currentImageIndex];
      if (!currentDataUrl) return;
      
      setIsAnalyzing(true);
      setDetections([]);

      try {
        const startTime = Date.now();
        const data = await geminiAnalyzeImage(currentDataUrl, 'full') as AnalysisResult;
        const processingTime = Date.now() - startTime;
        
        const newDetections = data.detections || [];
        setDetections(newDetections);
        setSceneSummary(data.scene_summary || "");
        setAnalysisComplete(true);

        // Log to database
        const avgConfidence = newDetections.length > 0
          ? newDetections.reduce((s: number, d: Detection) => s + d.confidence, 0) / newDetections.length
          : 0;
        const maxThreat = newDetections.reduce((max: string, d: Detection) => {
          const levels: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
          return (levels[d.threat_level] || 0) > (levels[max] || 0) ? d.threat_level : max;
        }, 'NONE');

        const isPlaceholder = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder');
        if (isPlaceholder) {
          console.warn("Supabase not configured, skipping database log.");
          toast({ title: "Analysis Complete", description: `Detected ${newDetections.length} potential threat(s). (Database not configured)` });
          return;
        }

        try {
          const { error: logError } = await supabase.from('detection_logs').insert([{
            analysis_result: JSON.stringify({ detections: newDetections, scene_summary: data.scene_summary }),
            threat_level: maxThreat.toLowerCase(),
            detected_objects: JSON.parse(JSON.stringify(newDetections)),
            confidence_score: avgConfidence,
            processing_time_ms: processingTime,
            source_type: 'image',
            session_id: 'session-' + Date.now(),
            metadata: JSON.parse(JSON.stringify({ 
              filename: imageFiles[currentImageIndex].name,
              detection_count: newDetections.length,
              report: data.report
            }))
          }]);

          if (logError) {
            console.error("Database log error:", logError);
            toast({ 
              title: "Log Failed", 
              description: `Failed to save analysis to database: ${logError.message}`, 
              variant: "destructive" 
            });
          }
        } catch (e) {
          console.error("Logging error:", e);
          toast({ 
            title: "Log Error", 
            description: "An unexpected error occurred while saving to database.", 
            variant: "destructive" 
          });
        }

        // Auto-send Telegram alert if HIGH or CRITICAL threat detected
        if (newDetections.length > 0 && (maxThreat === 'CRITICAL' || maxThreat === 'HIGH')) {
          sendTelegramAlert(newDetections, data.scene_summary || "", maxThreat);
        }

        toast({ title: "Analysis Complete", description: `Detected ${newDetections.length} potential threat(s).` });
      } catch (err) {
        toast({ title: "Analysis Failed", description: err instanceof Error ? err.message : "Failed to analyze image", variant: "destructive" });
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const generateReport = async () => {
    if (imageDataUrls.length === 0) return;
    setIsGeneratingReport(true);

    try {
      if (imageFiles.length > 1) {
        // Aggregate report for batch using multiple images
        const data = await geminiAnalyzeImages(imageDataUrls, 'report') as AnalysisReport;
        onReportGenerated(data, imageDataUrls);
      } else {
        const data = await geminiAnalyzeImage(imageDataUrls[currentImageIndex], 'report') as AnalysisReport;
        onReportGenerated(data, [imageDataUrls[currentImageIndex]]);
      }
      toast({ title: "Report Generated", description: "Scroll down to view the detailed analysis report." });
    } catch (err) {
      toast({ title: "Report Failed", description: err instanceof Error ? err.message : "Failed to generate report", variant: "destructive" });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const sendTelegramAlert = async (dets?: Detection[], summary?: string, threatLvl?: string) => {
    const alertDetections = dets || detections;
    const alertSummary = summary || sceneSummary;
    const alertThreat = threatLvl || alertDetections.reduce((max: string, d: Detection) => {
      const levels: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
      return (levels[d.threat_level] || 0) > (levels[max] || 0) ? d.threat_level : max;
    }, 'NONE');

    setIsSendingAlert(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-telegram-alert', {
        body: {
          chat_id: TELEGRAM_CHAT_ID,
          threat_level: alertThreat,
          detections: alertDetections,
          scene_summary: alertSummary,
          image_base64: imageDataUrls[currentImageIndex],
          source_type: 'image'
        }
      });
      if (error) throw error;
      toast({ title: "Alert Sent ✅", description: "Threat notification sent to Telegram successfully." });
    } catch (err) {
      toast({ title: "Alert Failed", description: err instanceof Error ? err.message : "Failed to send Telegram alert", variant: "destructive" });
    } finally {
      setIsSendingAlert(false);
    }
  };

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'hsl(0, 70%, 50%)';
      case 'HIGH': return 'hsl(25, 90%, 55%)';
      case 'MEDIUM': return 'hsl(45, 100%, 55%)';
      case 'LOW': return 'hsl(120, 50%, 45%)';
      default: return 'hsl(210, 10%, 50%)';
    }
  };

  const getThreatBadgeVariant = (level: string): "default" | "secondary" | "destructive" | "outline" => {
    if (level === 'CRITICAL' || level === 'HIGH') return 'destructive';
    if (level === 'MEDIUM') return 'secondary';
    return 'outline';
  };

  return (
    <div id="image-detection">
      <div className="container mx-auto px-4">

        <div className="grid lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Image Viewer with Overlay */}
          <Card className="lg:col-span-2 p-4 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground font-mono">IMAGE FEED</h3>
              {isAnalyzing && (
                <Badge className="bg-tactical-amber text-tactical-dark font-mono">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Analyzing...
                </Badge>
              )}
            </div>

            <div className="relative aspect-video bg-tactical-dark border border-border rounded-xl overflow-hidden">
              {imageUrls.length > 0 ? (
                <>
                  <img
                    src={imageUrls[currentImageIndex]}
                    alt={`Uploaded surveillance image ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                  {/* Batch Progress Overlay */}
                  {isAnalyzing && imageFiles.length > 1 && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
                      <Loader2 className="w-12 h-12 text-tactical-amber animate-spin mb-4" />
                      <p className="text-xl font-mono text-white mb-2">BATCH PROCESSING</p>
                      <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-tactical-amber transition-all duration-300" 
                          style={{ width: `${batchProgress}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm font-mono text-muted-foreground">
                        Image {currentImageIndex + 1} of {imageFiles.length}
                      </p>
                    </div>
                  )}
                  {/* Detection Overlays */}
                  <div className="absolute inset-0 pointer-events-none">
                    {detections.map((det, i) => (
                      <div
                        key={i}
                        className="absolute flex flex-col items-center"
                        style={{
                          left: `${det.x_percent}%`,
                          top: `${det.y_percent}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        {/* Targeting circle */}
                        <div
                          className="rounded-full border-2 animate-pulse"
                          style={{
                            width: '60px',
                            height: '60px',
                            borderColor: getThreatColor(det.threat_level),
                            boxShadow: `0 0 12px ${getThreatColor(det.threat_level)}`,
                          }}
                        />
                        {/* Crosshair lines */}
                        <div className="absolute" style={{ width: '80px', height: '80px' }}>
                          <div className="absolute top-1/2 left-0 w-2 h-0.5" style={{ backgroundColor: getThreatColor(det.threat_level) }} />
                          <div className="absolute top-1/2 right-0 w-2 h-0.5" style={{ backgroundColor: getThreatColor(det.threat_level) }} />
                          <div className="absolute left-1/2 top-0 w-0.5 h-2" style={{ backgroundColor: getThreatColor(det.threat_level) }} />
                          <div className="absolute left-1/2 bottom-0 w-0.5 h-2" style={{ backgroundColor: getThreatColor(det.threat_level) }} />
                        </div>
                        {/* Label */}
                        <div
                          className="mt-1 px-2 py-0.5 rounded text-xs font-mono font-bold whitespace-nowrap"
                          style={{
                            backgroundColor: getThreatColor(det.threat_level),
                            color: '#000',
                          }}
                        >
                          {det.label} — {det.confidence}%
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Navigation for multiple images */}
                  {imageFiles.length > 1 && !isAnalyzing && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 px-4 py-2 rounded-full border border-white/10">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentImageIndex === 0}
                        className="text-white hover:bg-white/10"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Prev
                      </Button>
                      <span className="text-xs font-mono text-white">
                        {currentImageIndex + 1} / {imageFiles.length}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setCurrentImageIndex(prev => Math.min(imageFiles.length - 1, prev + 1))}
                        disabled={currentImageIndex === imageFiles.length - 1}
                        className="text-white hover:bg-white/10"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground font-mono gap-3">
                  <Upload className="w-12 h-12 opacity-50" />
                  <p>Upload image(s) or folder to begin</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                <input
                  type="file"
                  ref={folderInputRef}
                  onChange={handleFileUpload}
                  webkitdirectory=""
                  directory=""
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="flex-1">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Select Images
                </Button>
                <Button onClick={() => folderInputRef.current?.click()} variant="outline" className="flex-1 border-tactical-muted">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Folder
                </Button>
              </div>

              {imageUrls.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={analyzeImage}
                    disabled={isAnalyzing}
                    className="flex-1 bg-tactical-amber text-tactical-dark hover:bg-tactical-amber/90"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {imageFiles.length > 1 ? 'Batch Analyzing...' : 'Analyzing...'}
                      </>
                    ) : (
                      <>
                        <Crosshair className="w-4 h-4 mr-2" />
                        {imageFiles.length > 1 ? `Analyze All (${imageFiles.length})` : (analysisComplete ? 'Re-Analyze Image' : 'Analyze Image')}
                      </>
                    )}
                  </Button>
                  {analysisComplete && (
                    <Button
                      onClick={generateReport}
                      disabled={isGeneratingReport}
                      variant="secondary"
                      className="flex-1"
                    >
                      {isGeneratingReport ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                      ) : (
                        <><SkipForward className="w-4 h-4 mr-2" />{imageFiles.length > 1 ? 'Batch Report' : 'Generate Report'}</>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Detection Panel */}
          <Card className="p-4 bg-card border-border">
            <h3 className="text-lg font-bold text-foreground font-mono mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-tactical-amber" />
              DETECTIONS
            </h3>

            {sceneSummary && (
              <div className="mb-4 p-3 bg-tactical-dark rounded border border-border">
                <p className="text-xs text-muted-foreground font-mono mb-1">SCENE</p>
                <p className="text-sm text-foreground">{sceneSummary}</p>
              </div>
            )}

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {detections.length === 0 ? (
                <div className="text-center text-muted-foreground font-mono py-12">
                  <Crosshair className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{imageUrls.length > 0 ? 'Run analysis to detect threats' : 'Upload an image to begin'}</p>
                </div>
              ) : (
                detections.map((det, i) => (
                  <Card key={i} className="p-3 bg-tactical-dark border-border">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getThreatColor(det.threat_level) }}
                        />
                        <span className="font-mono font-bold text-sm text-foreground">{det.label}</span>
                      </div>
                      <Badge variant={getThreatBadgeVariant(det.threat_level)} className="font-mono text-xs">
                        {det.threat_level}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{det.description}</p>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {det.speed && (
                        <div className="bg-black/20 p-1 rounded text-[10px] font-mono">
                          <span className="text-muted-foreground uppercase">Speed:</span> {det.speed}
                        </div>
                      )}
                      {det.armor_type && (
                        <div className="bg-black/20 p-1 rounded text-[10px] font-mono">
                          <span className="text-muted-foreground uppercase">Armor:</span> {det.armor_type}
                        </div>
                      )}
                      {det.country_of_origin && (
                        <div className="bg-black/20 p-1 rounded text-[10px] font-mono col-span-2">
                          <span className="text-muted-foreground uppercase">Origin:</span> {det.country_of_origin}
                        </div>
                      )}
                    </div>
                    {det.reliability_level && (
                      <div className={`text-[10px] font-mono font-bold uppercase p-1 rounded text-center mb-3 ${
                        det.reliability_level === 'HIGH' ? 'bg-green-500/10 text-green-500' :
                        det.reliability_level === 'MODERATE' ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        Reliability: {det.reliability_level}
                        {det.reliability_level === 'LOW' && " — REQUIRES HUMAN VERIFICATION"}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-xs">{det.threat_type}</Badge>
                      <span className="text-xs font-mono text-muted-foreground">Conf: {det.confidence}%</span>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* Summary stats */}
            {detections.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-tactical-dark rounded">
                    <p className="text-2xl font-bold text-foreground font-mono">{detections.length}</p>
                    <p className="text-xs text-muted-foreground font-mono">TARGETS</p>
                  </div>
                  <div className="text-center p-2 bg-tactical-dark rounded">
                    <p className="text-2xl font-bold text-foreground font-mono">
                      {detections.length > 0 ? Math.round(detections.reduce((s, d) => s + d.confidence, 0) / detections.length) : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">AVG CONF</p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ImageDetection;
