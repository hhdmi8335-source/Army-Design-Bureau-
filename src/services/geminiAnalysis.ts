import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini API
// Note: process.env.GEMINI_API_KEY is automatically provided in this environment
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Detection {
  label: string;
  threat_type: string;
  confidence: number;
  threat_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  x_percent: number;
  y_percent: number;
  description: string;
  speed?: string;
  armor_type?: string;
  country_of_origin?: string;
  tracking_id?: string;
  reliability_level?: 'HIGH' | 'MODERATE' | 'LOW';
}

export interface AnalysisResult {
  detections: Detection[];
  scene_summary: string;
  report?: AnalysisReport;
}

export interface AnalysisReport {
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
  }>;
  terrain_assessment: string;
  recommended_actions: string[];
  engagement_priority: Array<{
    priority: number;
    target: string;
    justification: string;
  }>;
}

const DETECTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: "Common name of the object (e.g., T-72 Tank, Humvee)" },
          threat_type: { type: Type.STRING, description: "Category (e.g., Armored Vehicle, Infantry, Aircraft)" },
          confidence: { type: Type.NUMBER, description: "Confidence score 0-100" },
          threat_level: { type: Type.STRING, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] },
          x_percent: { type: Type.NUMBER, description: "Horizontal position 0-100" },
          y_percent: { type: Type.NUMBER, description: "Vertical position 0-100" },
          description: { type: Type.STRING, description: "Brief tactical description" },
          speed: { type: Type.STRING, description: "Estimated speed if applicable" },
          armor_type: { type: Type.STRING, description: "Armor classification if applicable" },
          country_of_origin: { type: Type.STRING, description: "Likely country of origin" },
          reliability_level: { type: Type.STRING, enum: ['HIGH', 'MODERATE', 'LOW'] }
        },
        required: ["label", "threat_type", "confidence", "threat_level", "x_percent", "y_percent", "description"]
      }
    },
    scene_summary: { type: Type.STRING, description: "Overall tactical summary of the scene" }
  },
  required: ["detections", "scene_summary"]
};

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    report_title: { type: Type.STRING },
    overall_threat_level: { type: Type.STRING },
    confidence_score: { type: Type.NUMBER },
    executive_summary: { type: Type.STRING },
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          finding_number: { type: Type.INTEGER },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          threat_type: { type: Type.STRING },
          threat_level: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          frame_index: { type: Type.INTEGER },
          tactical_significance: { type: Type.STRING }
        }
      }
    },
    terrain_assessment: { type: Type.STRING },
    recommended_actions: { type: Type.ARRAY, items: { type: Type.STRING } },
    engagement_priority: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          priority: { type: Type.INTEGER },
          target: { type: Type.STRING },
          justification: { type: Type.STRING }
        }
      }
    }
  },
  required: ["report_title", "overall_threat_level", "confidence_score", "executive_summary", "findings", "terrain_assessment", "recommended_actions", "engagement_priority"]
};

const FULL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detections: DETECTION_SCHEMA.properties.detections,
    scene_summary: DETECTION_SCHEMA.properties.scene_summary,
    report: REPORT_SCHEMA
  },
  required: ["detections", "scene_summary", "report"]
};

export async function analyzeImages(imagesBase64: string[], mode: 'detect' | 'report' | 'full' = 'detect'): Promise<AnalysisResult | AnalysisReport> {
  const prompt = mode === 'detect' 
    ? "Analyze these tactical surveillance images. Detect all military and civilian vehicles, personnel, and potential threats. Provide precise coordinates (x, y as percentages), threat levels, and detailed specifications like armor type and origin if identifiable. Focus on the most significant threats across all images."
    : mode === 'report'
    ? "Generate a comprehensive tactical intelligence report based on these surveillance images. Include executive summary, detailed findings across all images, terrain assessment, and recommended actions."
    : "Perform a complete tactical analysis. First, detect all military and civilian vehicles, personnel, and potential threats with precise coordinates. Second, generate a comprehensive tactical intelligence report including executive summary, detailed findings, terrain assessment, and recommended actions.";

  const contents = imagesBase64.map(image => {
    const base64Data = image.split(',')[1] || image;
    const mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';
    return { inlineData: { data: base64Data, mimeType } };
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          ...contents,
          { text: prompt }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: mode === 'detect' ? DETECTION_SCHEMA : mode === 'report' ? REPORT_SCHEMA : FULL_SCHEMA
    }
  });

  return JSON.parse(response.text);
}

export async function analyzeImage(imageBase64: string, mode: 'detect' | 'report' | 'full' = 'detect'): Promise<AnalysisResult | AnalysisReport> {
  return analyzeImages([imageBase64], mode);
}

export async function analyzeVideoFrames(framesBase64: string[], mode: 'detect' | 'report' | 'full' = 'detect'): Promise<AnalysisResult | AnalysisReport> {
  const prompt = mode === 'detect'
    ? "Analyze these sequential video frames for tactical threat detection. Identify vehicles, track movements, and assess threat levels. Provide details for the most recent frame."
    : mode === 'report'
    ? "Generate a comprehensive tactical intelligence report based on these sequential video frames. Analyze movement patterns, terrain, and threat evolution."
    : "Perform a complete tactical analysis of these video frames. First, detect all vehicles and threats with tracking. Second, generate a comprehensive tactical intelligence report analyzing movement patterns, terrain, and threat evolution.";

  const contents = framesBase64.map(frame => {
    const base64Data = frame.split(',')[1] || frame;
    const mimeType = frame.split(';')[0].split(':')[1] || 'image/jpeg';
    return { inlineData: { data: base64Data, mimeType } };
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [...contents, { text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: mode === 'detect' ? DETECTION_SCHEMA : mode === 'report' ? REPORT_SCHEMA : FULL_SCHEMA
    }
  });

  return JSON.parse(response.text);
}
