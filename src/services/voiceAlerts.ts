class VoiceAlertService {
  private synthesis: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.loadVoice();
  }

  private loadVoice() {
    const voices = this.synthesis.getVoices();
    // Prefer a male, authoritative voice if available
    this.voice = voices.find(v => 
      v.name.includes('Google UK English Male') || 
      v.name.includes('Microsoft David') ||
      v.name.includes('Male') ||
      v.lang.startsWith('en-GB')
    ) || voices[0];
  }

  speak(text: string) {
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) {
      utterance.voice = this.voice;
    }
    utterance.pitch = 0.8; // Lower pitch for authority
    utterance.rate = 1.0;
    this.synthesis.speak(utterance);
  }

  announceThreat(type: string, level: string) {
    const message = `Alert. ${level} priority threat detected. Target identified as ${type}. Immediate tactical assessment required.`;
    this.speak(message);
  }
}

export const voiceAlerts = new VoiceAlertService();
