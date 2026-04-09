import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, Target, AlertTriangle, Clock, CheckCircle,
  Activity, Eye, Download, Trash2, ChevronLeft, ChevronRight,
  FileText, RefreshCw, Search, Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import AnalysisReportView, { AnalysisReport } from "./AnalysisReport";

interface DetectionLog {
  id: string;
  created_at: string;
  analysis_result: string;
  threat_level: string;
  confidence_score: number;
  processing_time_ms: number;
  source_type: string;
  detected_objects: unknown;
  metadata: {
    report?: AnalysisReport;
    filename?: string;
    thumbnails?: string[];
    [key: string]: unknown;
  };
}

const Dashboard = () => {
  const [logs, setLogs] = useState<DetectionLog[]>([]);
  const [stats, setStats] = useState({ total: 0, critical: 0, avgConf: 0, avgTime: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(true);
  const [selectedLog, setSelectedLog] = useState<DetectionLog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const { toast } = useToast();
  const pageSize = 8;

  const fetchData = useCallback(async () => {
    const isPlaceholder = supabase.auth.getSession === undefined || 
                         (import.meta.env.VITE_SUPABASE_URL?.includes('placeholder') || !import.meta.env.VITE_SUPABASE_URL);
    
    if (isPlaceholder) {
      setIsSupabaseConfigured(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let query = supabase
        .from('detection_logs')
        .select('*', { count: 'exact' });

      if (sourceFilter !== 'all') {
        query = query.eq('source_type', sourceFilter);
      }

      // Note: Full-text search on JSONB is complex, so we'll do client-side search 
      // or search in metadata if possible. For now, we'll fetch and filter if needed,
      // but let's try to filter by threat level or source type server-side.
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (error) throw error;

      let allLogs = data as DetectionLog[] || [];
      
      // Client-side search for vehicle name in the current page
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        allLogs = allLogs.filter(log => 
          log.analysis_result.toLowerCase().includes(q) || 
          (log.metadata?.filename && log.metadata.filename.toLowerCase().includes(q))
        );
      }

      setLogs(allLogs);
      setTotalCount(count || 0);

      // Fetch stats from all records
      const { data: allData, error: statsError } = await supabase.from('detection_logs').select('threat_level, confidence_score, processing_time_ms');
      
      if (statsError) {
        console.error("Stats fetch error:", statsError);
        toast({
          title: "Stats Error",
          description: "Failed to calculate performance metrics: " + statsError.message,
          variant: "destructive"
        });
      } else if (allData) {
        const total = allData.length;
        const critical = allData.filter(l => l.threat_level === 'critical' || l.threat_level === 'high').length;
        const avgConf = total > 0 ? allData.reduce((s, l) => s + (Number(l.confidence_score) || 0), 0) / total : 0;
        const avgTime = total > 0 ? allData.reduce((s, l) => s + (l.processing_time_ms || 0), 0) / total : 0;
        setStats({ total, critical, avgConf: Math.round(avgConf * 10) / 10, avgTime: Math.round(avgTime) });
      }
    } catch (e) {
      console.error("Dashboard fetch error:", e);
      toast({
        title: "Fetch Error",
        description: e instanceof Error ? e.message : "Failed to retrieve detection history.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, sourceFilter, toast]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('dashboard_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'detection_logs' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, sourceFilter]); // Re-fetch when filter changes

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchData]);

  const deleteLog = async (id: string) => {
    try {
      await supabase.from('detection_logs').delete().eq('id', id);
      toast({ title: "Deleted", description: "Log removed." });
      fetchData();
    } catch { toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }); }
  };

  const exportLogs = () => {
    const csv = "Timestamp,Threat,Confidence,Source\n" + logs.map(l => 
      `${l.created_at},${l.threat_level},${l.confidence_score},${l.source_type}`
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detection_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getThreatBadge = (level: string): "default" | "secondary" | "destructive" | "outline" => {
    if (level === 'critical' || level === 'high') return 'destructive';
    if (level === 'medium') return 'secondary';
    return 'outline';
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <section className="py-16 bg-background" id="dashboard">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            <BarChart3 className="inline w-8 h-8 mr-2 text-tactical-amber" />
            OPERATIONS DASHBOARD
          </h2>
          <p className="text-muted-foreground font-mono">Detection history and performance metrics</p>
          
          {!isSupabaseConfigured && (
            <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg max-w-2xl mx-auto">
              <div className="flex items-center gap-3 text-destructive mb-2 justify-center">
                <AlertTriangle className="w-5 h-5" />
                <p className="font-bold font-mono uppercase text-sm">Supabase Not Configured</p>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                The dashboard requires a Supabase connection to store and retrieve detection history. 
                Please set <code className="bg-black/20 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-black/20 px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code> in your environment variables.
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-tactical-amber/20 rounded"><Target className="w-5 h-5 text-tactical-amber" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground font-mono">Total Analyses</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/20 rounded"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.critical}</p>
                <p className="text-xs text-muted-foreground font-mono">High/Critical</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/30 rounded"><CheckCircle className="w-5 h-5 text-accent-foreground" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.avgConf}%</p>
                <p className="text-xs text-muted-foreground font-mono">Avg Confidence</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded"><Clock className="w-5 h-5 text-secondary-foreground" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.avgTime}ms</p>
                <p className="text-xs text-muted-foreground font-mono">Avg Processing</p>
              </div>
            </div>
          </Card>
        </div>

        {/* History Table */}
        <Card className="p-6 bg-card border-border">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
            <h3 className="text-lg font-bold text-foreground font-mono flex items-center">
              <Activity className="w-5 h-5 mr-2 text-tactical-amber" />
              DETECTION HISTORY
            </h3>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search vehicle..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-black/20 border-border font-mono text-xs"
                />
              </div>
              
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[130px] bg-black/20 border-border font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3 h-3" />
                    <SelectValue placeholder="Source" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-tactical-dark border-border font-mono">
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={isLoading} className="h-9">
                  <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={exportLogs} className="h-9">
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </Button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground font-mono">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground font-mono">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No analyses recorded yet. Upload an image or video to begin.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-mono text-muted-foreground">TIME</th>
                      <th className="text-left py-2 px-3 text-xs font-mono text-muted-foreground">SOURCE</th>
                      <th className="text-left py-2 px-3 text-xs font-mono text-muted-foreground">THREAT</th>
                      <th className="text-left py-2 px-3 text-xs font-mono text-muted-foreground">CONFIDENCE</th>
                      <th className="text-right py-2 px-3 text-xs font-mono text-muted-foreground">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-border/50 hover:bg-tactical-dark/50">
                        <td className="py-3 px-3 text-sm font-mono text-foreground">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className="font-mono text-xs capitalize">{log.source_type}</Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={getThreatBadge(log.threat_level)} className="font-mono text-xs capitalize">{log.threat_level}</Badge>
                        </td>
                        <td className="py-3 px-3 text-sm font-mono text-foreground">{log.confidence_score?.toFixed(1)}%</td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteLog(log.id)} className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground font-mono">
                  Page {currentPage} of {totalPages || 1} ({totalCount} total)
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background border-border">
            <DialogHeader>
              <DialogTitle className="font-mono flex items-center gap-2">
                <Activity className="w-5 h-5 text-tactical-amber" />
                DETECTION DETAILS
              </DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="report" disabled={!selectedLog.metadata?.report}>
                    Tactical Report
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-tactical-dark p-3 rounded border border-border">
                      <p className="text-[10px] text-muted-foreground font-mono uppercase">Timestamp</p>
                      <p className="text-sm text-foreground font-mono">{new Date(selectedLog.created_at).toLocaleString()}</p>
                    </div>
                    <div className="bg-tactical-dark p-3 rounded border border-border">
                      <p className="text-[10px] text-muted-foreground font-mono uppercase">Source</p>
                      <Badge variant="outline" className="mt-1 capitalize">{selectedLog.source_type}</Badge>
                    </div>
                    <div className="bg-tactical-dark p-3 rounded border border-border">
                      <p className="text-[10px] text-muted-foreground font-mono uppercase">Threat Level</p>
                      <Badge variant={getThreatBadge(selectedLog.threat_level)} className="mt-1 capitalize">{selectedLog.threat_level}</Badge>
                    </div>
                    <div className="bg-tactical-dark p-3 rounded border border-border">
                      <p className="text-[10px] text-muted-foreground font-mono uppercase">Confidence</p>
                      <p className="text-sm text-foreground font-mono">{selectedLog.confidence_score?.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground font-mono mb-2 uppercase">Raw Analysis Data</p>
                    <div className="bg-tactical-dark p-4 rounded border border-border max-h-60 overflow-y-auto">
                      <pre className="text-[10px] text-foreground whitespace-pre-wrap font-mono">
                        {JSON.stringify(JSON.parse(selectedLog.analysis_result), null, 2)}
                      </pre>
                    </div>
                  </div>

                  {selectedLog.metadata?.filename && (
                    <div className="text-xs text-muted-foreground font-mono">
                      Source File: <span className="text-foreground">{selectedLog.metadata.filename}</span>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="report">
                  {selectedLog.metadata?.report ? (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <AnalysisReportView 
                        report={selectedLog.metadata.report} 
                        frameCaptures={selectedLog.metadata.thumbnails || []} 
                      />
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground font-mono">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No tactical report available for this entry.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default Dashboard;
