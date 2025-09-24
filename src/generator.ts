import * as vscode from "vscode";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export class CommentGenerator {
  private language: string;
  private openaiClient: OpenAI | null = null;
  private anthropicClient: Anthropic | null = null;
  private context: vscode.ExtensionContext;
  private codeContextTracker: CodeContextTracker;

  constructor(language: string = "auto", context: vscode.ExtensionContext) {
    this.language = language;
    this.context = context;
    this.codeContextTracker = new CodeContextTracker();
  }

  /**
   * Initialisiert die AI Clients mit gesicherten API Keys
   */
  async initializeAI() {
    try {
      // OpenAI initialisieren
      const openaiKey = await this.context.secrets.get("openai.apiKey");
      if (openaiKey) {
        this.openaiClient = new OpenAI({
          apiKey: openaiKey,
          timeout: 30 * 1000,
          maxRetries: 3,
        });
      }

      // Claude/Anthropic initialisieren
      const anthropicKey = await this.context.secrets.get("anthropic.apiKey");
      if (anthropicKey) {
        this.anthropicClient = new Anthropic({
          apiKey: anthropicKey,
        });
      }
    } catch (error) {
      console.error("Fehler bei AI Initialisierung:", error);
    }
  }

  /**
   * Testet OpenAI API Key
   */
  async testOpenAIKey(
    apiKey?: string
  ): Promise<{ valid: boolean; message: string; model?: string }> {
    try {
      // Verwende übergebenen Key oder gespeicherten
      const keyToTest =
        apiKey || (await this.context.secrets.get("openai.apiKey"));

      if (!keyToTest) {
        return {
          valid: false,
          message: "❌ Kein API Key vorhanden",
        };
      }

      // Erstelle temporären Client
      const testClient = new OpenAI({
        apiKey: keyToTest,
        timeout: 10 * 1000,
      });

      // Teste mit minimalem API Call
      const response = await testClient.models.list();

      // Prüfe ob GPT-4 verfügbar ist
      const models = response.data.map((m) => m.id);
      const hasGPT4 = models.some((m) => m.includes("gpt-4"));
      const hasGPT4o = models.some((m) => m.includes("gpt-4o"));

      let modelInfo = "GPT-3.5";
      if (hasGPT4o) modelInfo = "GPT-4o";
      else if (hasGPT4) modelInfo = "GPT-4";

      return {
        valid: true,
        message: `✅ OpenAI Key gültig! Verfügbar: ${modelInfo}`,
        model: modelInfo,
      };
    } catch (error: any) {
      // Analysiere Fehlertyp
      if (error?.status === 401) {
        return {
          valid: false,
          message: "❌ Ungültiger API Key",
        };
      } else if (error?.status === 429) {
        return {
          valid: true, // Key ist gültig, aber Rate-Limit
          message: "⚠️ API Key gültig, aber Rate-Limit erreicht",
        };
      } else if (error?.status === 403) {
        return {
          valid: false,
          message: "❌ API Key hat keine Berechtigung",
        };
      } else if (error?.code === "ENOTFOUND") {
        return {
          valid: false,
          message: "❌ Keine Internetverbindung",
        };
      } else {
        return {
          valid: false,
          message: `❌ Fehler: ${error?.message || "Unbekannter Fehler"}`,
        };
      }
    }
  }

  /**
   * Testet Anthropic/Claude API Key
   */
  async testAnthropicKey(
    apiKey?: string
  ): Promise<{ valid: boolean; message: string; model?: string }> {
    try {
      // Verwende übergebenen Key oder gespeicherten
      const keyToTest =
        apiKey || (await this.context.secrets.get("anthropic.apiKey"));

      if (!keyToTest) {
        return {
          valid: false,
          message: "❌ Kein API Key vorhanden",
        };
      }

      // Erstelle temporären Client
      const testClient = new Anthropic({
        apiKey: keyToTest,
      });

      // Teste mit minimalem API Call
      const response = await testClient.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }],
      });

      // Prüfe verfügbare Modelle basierend auf Response
      const model = response.model;
      let modelInfo = "Claude";
      if (model.includes("opus")) modelInfo = "Claude 3 Opus";
      else if (model.includes("sonnet")) modelInfo = "Claude 3 Sonnet";
      else if (model.includes("haiku")) modelInfo = "Claude 3 Haiku";

      return {
        valid: true,
        message: `✅ Anthropic Key gültig! Model: ${modelInfo}`,
        model: modelInfo,
      };
    } catch (error: any) {
      // Analysiere Fehlertyp
      if (error?.status === 401) {
        return {
          valid: false,
          message: "❌ Ungültiger API Key",
        };
      } else if (error?.status === 429) {
        return {
          valid: true, // Key ist gültig, aber Rate-Limit
          message: "⚠️ API Key gültig, aber Rate-Limit erreicht",
        };
      } else if (error?.status === 403) {
        return {
          valid: false,
          message: "❌ API Key hat keine Berechtigung",
        };
      } else if (error?.status === 400 && error?.message?.includes("credit")) {
        return {
          valid: true,
          message: "⚠️ API Key gültig, aber kein Guthaben",
        };
      } else if (error?.code === "ENOTFOUND") {
        return {
          valid: false,
          message: "❌ Keine Internetverbindung",
        };
      } else {
        return {
          valid: false,
          message: `❌ Fehler: ${error?.message || "Unbekannter Fehler"}`,
        };
      }
    }
  }

  /**
   * Testet alle konfigurierten API Keys
   */
  async testAllKeys(): Promise<{ openai?: any; anthropic?: any }> {
    const results: any = {};

    // Teste OpenAI
    const openaiKey = await this.context.secrets.get("openai.apiKey");
    if (openaiKey) {
      results.openai = await this.testOpenAIKey();
    }

    // Teste Anthropic
    const anthropicKey = await this.context.secrets.get("anthropic.apiKey");
    if (anthropicKey) {
      results.anthropic = await this.testAnthropicKey();
    }

    return results;
  }

  /**
   * Hauptmethode: Verarbeitet Spracheingabe mit AI-Enhancement
   */
  async processVoiceInput(transcript: string): Promise<string> {
    if (!transcript || transcript.trim().length === 0) {
      return "// Keine Spracheingabe erkannt";
    }

    try {
      // 1. Text bereinigen
      const cleanedText = this.cleanTranscript(transcript);

      // 2. Aktuellen Code-Kontext ermitteln
      const codeContext = await this.codeContextTracker.getCurrentContext();

      // 3. Mit AI verbessern
      const enhancedText = await this.enhanceWithAI(cleanedText, codeContext);

      // 4. Als Kommentar formatieren
      const comment = this.generateCommentForContext(enhancedText, codeContext);

      // 5. In Code einfügen
      await this.insertCommentAtPosition(comment, codeContext);

      return comment;
    } catch (error) {
      vscode.window.showErrorMessage(`Fehler bei Verarbeitung: ${error}`);
      return this.formatComment(transcript, "typescript");
    }
  }

  /**
   * Verbessert den Text mit KI (ChatGPT oder Claude)
   */
  private async enhanceWithAI(
    text: string,
    context: CodeContext | null
  ): Promise<string> {
    // Prüfe welche AI verfügbar ist
    const aiProvider = vscode.workspace
      .getConfiguration("voiceDocs")
      .get<string>("aiProvider", "openai");

    if (aiProvider === "openai" && this.openaiClient) {
      return await this.enhanceWithOpenAI(text, context);
    }

    if (aiProvider === "anthropic" && this.anthropicClient) {
      return await this.enhanceWithClaude(text, context);
    }

    // Fallback: Nur technische Begriffe ersetzen
    return this.processText(text);
  }

  /**
   * OpenAI GPT Enhancement
   */
  private async enhanceWithOpenAI(
    text: string,
    context: CodeContext | null
  ): Promise<string> {
    if (!this.openaiClient) return text;

    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(text, context);

    try {
      const completion = await this.openaiClient.chat.completions.create({
        model: vscode.workspace
          .getConfiguration("voiceDocs")
          .get("openaiModel", "gpt-4o-mini"),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      return completion.choices[0]?.message?.content || text;
    } catch (error) {
      console.error("OpenAI Fehler:", error);
      return text;
    }
  }

  /**
   * Claude Enhancement
   */
  private async enhanceWithClaude(
    text: string,
    context: CodeContext | null
  ): Promise<string> {
    if (!this.anthropicClient) return text;

    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(text, context);

    try {
      const message = await this.anthropicClient.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 500,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const content = message.content[0];
      if (content.type === "text") {
        return content.text;
      }
      return text;
    } catch (error) {
      console.error("Claude Fehler:", error);
      return text;
    }
  }

  /**
   * Erstellt System-Prompt für AI
   */
  private buildSystemPrompt(context: CodeContext | null): string {
    let prompt = `Du bist ein Experte für technische Dokumentation.
Konvertiere gesprochenen Text in professionelle Code-Kommentare.
Regeln:
1. Korrigiere Grammatik und Rechtschreibung
2. Nutze korrekte technische Begriffe
3. Sei präzise und klar
4. Behalte die ursprüngliche Bedeutung bei
5. Formatiere als einzeiliger Kommentar ohne Markup`;

    if (context) {
      prompt += `\n\nDer Nutzer dokumentiert gerade: ${context.type} "${context.name}" in ${context.language}.`;
    }

    return prompt;
  }

  /**
   * Erstellt User-Prompt für AI
   */
  private buildUserPrompt(text: string, context: CodeContext | null): string {
    let prompt = `Spracheingabe: "${text}"`;

    if (context && context.code) {
      const codePreview = context.code.substring(0, 200);
      prompt += `\n\nCode-Kontext:\n${codePreview}${
        context.code.length > 200 ? "..." : ""
      }`;
    }

    prompt += `\n\nGib nur den verbesserten Kommentartext zurück, ohne Formatierung.`;

    return prompt;
  }

  /**
   * Formatiert Kommentar basierend auf Code-Kontext
   */
  private generateCommentForContext(
    text: string,
    context: CodeContext | null
  ): string {
    if (!context) {
      return this.formatComment(text, "typescript");
    }

    // Für Funktionen/Methoden -> JSDoc
    if (context.type === "function" || context.type === "method") {
      return this.generateJSDocComment(text, context);
    }

    // Für Klassen -> Klassen-Dokumentation
    if (context.type === "class") {
      return this.generateClassComment(text, context);
    }

    // Standard Kommentar
    const commentStyle = this.getCommentStyle(context.language);
    return `${commentStyle.single} ${text}`;
  }

  /**
   * Generiert JSDoc Kommentar
   */
  private generateJSDocComment(text: string, context: CodeContext): string {
    const lines = ["/**"];

    // Hauptbeschreibung
    const wrappedText = this.wrapText(text, 70);
    wrappedText.forEach((line) => {
      lines.push(` * ${line}`);
    });

    // Parameter hinzufügen (falls vorhanden)
    if (context.parameters && context.parameters.length > 0) {
      lines.push(" *");
      context.parameters.forEach((param) => {
        lines.push(
          ` * @param {${param.type || "*"}} ${param.name} - TODO: Beschreibung`
        );
      });
    }

    // Rückgabetyp
    if (context.returnType && context.returnType !== "void") {
      lines.push(` * @returns {${context.returnType}}`);
    }

    lines.push(" */");
    return lines.join("\n") + "\n";
  }

  /**
   * Generiert Klassen-Kommentar
   */
  private generateClassComment(text: string, context: CodeContext): string {
    const lines = ["/**"];
    const wrappedText = this.wrapText(text, 70);
    wrappedText.forEach((line) => {
      lines.push(` * ${line}`);
    });
    lines.push(" * @class " + context.name);
    lines.push(" */");
    return lines.join("\n") + "\n";
  }

  /**
   * Fügt Kommentar an der richtigen Stelle ein
   */
  private async insertCommentAtPosition(
    comment: string,
    context: CodeContext | null
  ) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !context) {
      // Fallback: Am Cursor einfügen
      if (editor) {
        await editor.edit((editBuilder) => {
          editBuilder.insert(editor.selection.active, comment);
        });
      }
      return;
    }

    // Intelligente Position finden
    const insertPosition = this.findOptimalInsertPosition(
      editor.document,
      context
    );

    await editor.edit((editBuilder) => {
      // Prüfe ob schon ein Kommentar existiert
      const lineAbove = Math.max(0, insertPosition.line - 1);
      const lineText = editor.document.lineAt(lineAbove).text;

      if (lineText.includes("/**") || lineText.includes("//")) {
        // Ersetze existierenden Kommentar
        const range = new vscode.Range(
          new vscode.Position(lineAbove, 0),
          new vscode.Position(insertPosition.line, 0)
        );
        editBuilder.replace(range, comment);
      } else {
        // Füge neuen Kommentar ein
        editBuilder.insert(insertPosition, comment);
      }
    });
  }

  /**
   * Findet die optimale Einfügeposition für den Kommentar
   */
  private findOptimalInsertPosition(
    document: vscode.TextDocument,
    context: CodeContext
  ): vscode.Position {
    // Direkt über dem Code-Block
    const line = context.range.start.line;
    const indentation = this.getIndentation(document.lineAt(line).text);

    // Mit korrekter Einrückung
    return new vscode.Position(line, 0);
  }

  /**
   * Ermittelt die Einrückung einer Zeile
   */
  private getIndentation(lineText: string): string {
    const match = lineText.match(/^(\s*)/);
    return match ? match[1] : "";
  }

  // === Bestehende Methoden beibehalten ===

  private cleanTranscript(transcript: string): string {
    return transcript
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^(äh|ähm|also|ja|okay)\s*/gi, "")
      .replace(/\s+(äh|ähm|also)\s+/gi, " ")
      .replace(/\.$/, "")
      .trim();
  }

  private processText(text: string): string {
    if (text.length === 0) return text;

    text = this.replaceTechnicalTerms(text);
    text = this.improveSentenceStructure(text);

    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private replaceTechnicalTerms(text: string): string {
    const replacements: { [key: string]: string } = {
      funktion: "Funktion",
      methode: "Methode",
      klasse: "Klasse",
      variable: "Variable",
      parameter: "Parameter",
      return: "Return",
      array: "Array",
      objekt: "Objekt",
      string: "String",
      integer: "Integer",
      boolean: "Boolean",
      loop: "Schleife",
      schleife: "Schleife",
      bedingung: "Bedingung",
      if: "If-Bedingung",
      else: "Else-Zweig",
      "try catch": "Try-Catch-Block",
      exception: "Exception",
      fehlerbehandlung: "Fehlerbehandlung",
      api: "API",
      datenbank: "Datenbank",
      sql: "SQL",
      query: "Query",
      json: "JSON",
      xml: "XML",
    };

    let result = text;
    Object.keys(replacements).forEach((key) => {
      const regex = new RegExp(`\\b${key}\\b`, "gi");
      result = result.replace(regex, replacements[key]);
    });

    return result;
  }

  private improveSentenceStructure(text: string): string {
    const improvements = [
      {
        pattern: /^(diese|die|der|das)\s+(.+?)\s+(macht|tut|ist|wird)/i,
        replacement: "$2 $3",
      },
      {
        pattern: /^hier\s+(.+)/i,
        replacement: "$1",
      },
      {
        pattern: /^(berechnet|erstellt|initialisiert|definiert)\s+(.+)/i,
        replacement: "$1 $2",
      },
    ];

    let result = text;
    improvements.forEach((improvement) => {
      result = result.replace(improvement.pattern, improvement.replacement);
    });

    return result;
  }

  formatComment(transcript: string, languageId: string): string {
    return this.generateCommentForLanguage(
      this.processText(this.cleanTranscript(transcript)),
      languageId
    );
  }

  private generateCommentForLanguage(text: string, languageId: string): string {
    const commentStyles = this.getCommentStyle(languageId);

    if (text.length <= 80) {
      return `${commentStyles.single} ${text}`;
    }

    if (commentStyles.multi) {
      const lines = this.wrapText(text, 70);
      return (
        commentStyles.multi.start +
        "\n" +
        lines.map((line) => ` * ${line}`).join("\n") +
        "\n" +
        commentStyles.multi.end
      );
    }

    const lines = this.wrapText(text, 70);
    return lines.map((line) => `${commentStyles.single} ${line}`).join("\n");
  }

  private getCommentStyle(languageId: string): {
    single: string;
    multi?: { start: string; end: string };
  } {
    const styles: { [key: string]: any } = {
      javascript: { single: "//", multi: { start: "/**", end: " */" } },
      typescript: { single: "//", multi: { start: "/**", end: " */" } },
      java: { single: "//", multi: { start: "/**", end: " */" } },
      csharp: { single: "//", multi: { start: "/**", end: " */" } },
      cpp: { single: "//", multi: { start: "/**", end: " */" } },
      c: { single: "//", multi: { start: "/*", end: " */" } },
      python: { single: "#", multi: { start: '"""', end: '"""' } },
      html: { single: "<!--", multi: { start: "<!--", end: "-->" } },
      css: { single: "//", multi: { start: "/*", end: " */" } },
      sql: { single: "--" },
      bash: { single: "#" },
      powershell: { single: "#" },
      ruby: { single: "#" },
      php: { single: "//", multi: { start: "/**", end: " */" } },
      go: { single: "//", multi: { start: "/*", end: " */" } },
      rust: { single: "//", multi: { start: "/*", end: " */" } },
    };

    return styles[languageId] || { single: "//" };
  }

  private wrapText(text: string, maxLength: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + word).length <= maxLength) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Validiert die Qualität eines generierten Kommentars
   */
  validateComment(comment: string): {
    isValid: boolean;
    score: number;
    suggestions: string[];
  } {
    const suggestions: string[] = [];
    let score = 100;

    if (comment.length < 10) {
      score -= 30;
      suggestions.push("Kommentar ist zu kurz");
    }

    if (comment.length > 500) {
      score -= 20;
      suggestions.push("Kommentar ist sehr lang - eventuell aufteilen");
    }

    const fillerWords = ["äh", "ähm", "also", "ja", "okay"];
    const hasFillers = fillerWords.some((word) =>
      comment.toLowerCase().includes(word)
    );
    if (hasFillers) {
      score -= 15;
      suggestions.push("Füllwörter entdeckt");
    }

    return {
      isValid: score >= 50,
      score,
      suggestions,
    };
  }
}

// === Code Context Tracker ===

interface CodeContext {
  type: "function" | "method" | "class" | "property" | "variable";
  name: string;
  language: string;
  code: string;
  range: vscode.Range;
  parameters?: Array<{ name: string; type?: string }>;
  returnType?: string;
}

class CodeContextTracker {
  private currentContext: CodeContext | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Verfolge Cursor-Bewegungen
    vscode.window.onDidChangeTextEditorSelection((e) => {
      this.updateContextDebounced(e.textEditor);
    });
  }

  private updateContextDebounced(editor: vscode.TextEditor) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.updateContext(editor);
    }, 200);
  }

  private async updateContext(editor: vscode.TextEditor) {
    const document = editor.document;
    const position = editor.selection.active;

    // Nutze VS Code Symbol Provider
    const symbols = await vscode.commands.executeCommand<
      vscode.DocumentSymbol[]
    >("vscode.executeDocumentSymbolProvider", document.uri);

    if (symbols) {
      const symbol = this.findSymbolAtPosition(symbols, position);
      if (symbol) {
        this.currentContext = this.symbolToContext(symbol, document);
      }
    }
  }

  private findSymbolAtPosition(
    symbols: vscode.DocumentSymbol[],
    position: vscode.Position
  ): vscode.DocumentSymbol | null {
    for (const symbol of symbols) {
      if (symbol.range.contains(position)) {
        // Rekursiv in Kinder suchen
        if (symbol.children && symbol.children.length > 0) {
          const child = this.findSymbolAtPosition(symbol.children, position);
          if (child) return child;
        }
        return symbol;
      }
    }
    return null;
  }

  private symbolToContext(
    symbol: vscode.DocumentSymbol,
    document: vscode.TextDocument
  ): CodeContext {
    return {
      type: this.symbolKindToType(symbol.kind),
      name: symbol.name,
      language: document.languageId,
      code: document.getText(symbol.range),
      range: symbol.range,
    };
  }

  private symbolKindToType(kind: vscode.SymbolKind): CodeContext["type"] {
    switch (kind) {
      case vscode.SymbolKind.Function:
        return "function";
      case vscode.SymbolKind.Method:
        return "method";
      case vscode.SymbolKind.Class:
        return "class";
      case vscode.SymbolKind.Property:
        return "property";
      default:
        return "variable";
    }
  }

  async getCurrentContext(): Promise<CodeContext | null> {
    return this.currentContext;
  }
}
