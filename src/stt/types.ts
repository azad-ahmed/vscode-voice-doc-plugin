/**
 * Speech-to-Text Provider Interface
 * Alle STT-Provider müssen dieses Interface implementieren
 */
export interface STTProvider {
  /** Name des Providers (z.B. "OpenAI Whisper") */
  name: string;
  
  /** Prüft ob der Provider verfügbar/konfiguriert ist */
  isAvailable(): Promise<boolean>;
  
  /** 
   * Transkribiert eine Audio-Datei zu Text
   * @param audioPath Pfad zur WAV-Datei
   * @param language Sprache (z.B. "de-DE", "en-US")
   * @returns Transkribierter Text
   */
  transcribe(audioPath: string, language?: string): Promise<string>;
}

/**
 * Konfiguration für STT-Provider
 */
export interface STTConfig {
  /** Provider-Typ */
  provider: 'openai-whisper' | 'azure' | 'web-speech';
  
  /** API Key (für OpenAI/Azure) */
  apiKey?: string;
  
  /** Azure Region (nur für Azure) */
  region?: string;
  
  /** Sprache für Transkription */
  language: string;
}

/**
 * Ergebnis einer Transkription
 */
export interface TranscriptionResult {
  /** Transkribierter Text */
  text: string;
  
  /** Konfidenz-Score (0-1, wenn verfügbar) */
  confidence?: number;
  
  /** Verwendeter Provider */
  provider: string;
  
  /** Verarbeitungszeit in ms */
  processingTimeMs: number;
}
