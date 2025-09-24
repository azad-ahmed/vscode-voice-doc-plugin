import * as vscode from "vscode";
import { CommentGenerator } from "./generator";
import { AIService } from "./services/aiService";

let isRecording = false;
let recordingStatusBarItem: vscode.StatusBarItem;
let aiService: AIService;
let commentGenerator: CommentGenerator;

export function activate(context: vscode.ExtensionContext) {
  console.log("Voice Documentation Plugin aktiviert");

  // Services initialisieren
  aiService = new AIService();
  commentGenerator = new CommentGenerator();

  // Status Bar Item erstellen
  recordingStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  recordingStatusBarItem.text = "$(record) Voice Doc";
  recordingStatusBarItem.command = "voiceDoc.startRecording";
  recordingStatusBarItem.tooltip = "Start Voice Documentation Recording";
  recordingStatusBarItem.show();
  context.subscriptions.push(recordingStatusBarItem);

  // Commands registrieren
  registerCommands(context);

  // Konfiguration Change Listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("voiceDoc")) {
        vscode.window.showInformationMessage(
          "Voice Doc Konfiguration aktualisiert"
        );
      }
    })
  );

  // Willkommensnachricht beim ersten Start
  const hasShownWelcome = context.globalState.get("voiceDoc.hasShownWelcome");
  if (!hasShownWelcome) {
    showWelcomeMessage(context);
  }
}

function registerCommands(context: vscode.ExtensionContext) {
  // Start Recording Command
  let startRecordingCommand = vscode.commands.registerCommand(
    "voiceDoc.startRecording",
    async () => {
      if (isRecording) {
        vscode.window.showWarningMessage("Aufnahme läuft bereits...");
        return;
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("Kein aktiver Editor gefunden");
        return;
      }

      await startVoiceRecording(editor);
    }
  );

  // Stop Recording Command
  let stopRecordingCommand = vscode.commands.registerCommand(
    "voiceDoc.stopRecording",
    async () => {
      if (!isRecording) {
        vscode.window.showWarningMessage("Keine aktive Aufnahme");
        return;
      }

      await stopVoiceRecording();
    }
  );

  // Configure API Command
  let configureApiCommand = vscode.commands.registerCommand(
    "voiceDoc.configureApi",
    async () => {
      await showApiConfiguration();
    }
  );

  // Test Connection Command
  let testConnectionCommand = vscode.commands.registerCommand(
    "voiceDoc.testConnection",
    async () => {
      await testAIConnections();
    }
  );

  context.subscriptions.push(
    startRecordingCommand,
    stopRecordingCommand,
    configureApiCommand,
    testConnectionCommand
  );
}

async function startVoiceRecording(editor: vscode.TextEditor) {
  try {
    isRecording = true;
    updateStatusBarItem(true);

    // Simuliere Aufnahmestart (hier würde echte Audio-Aufnahme starten)
    vscode.window
      .showInformationMessage(
        "🎤 Aufnahme gestartet - sprechen Sie jetzt!",
        "Stop"
      )
      .then((selection) => {
        if (selection === "Stop") {
          vscode.commands.executeCommand("voiceDoc.stopRecording");
        }
      });

    // Für Demo: Nach 5 Sekunden automatisch stoppen
    setTimeout(async () => {
      if (isRecording) {
        await simulateTranscription(editor);
      }
    }, 5000);
  } catch (error) {
    console.error("Error starting recording:", error);
    vscode.window.showErrorMessage(
      `Fehler beim Starten der Aufnahme: ${error}`
    );
    isRecording = false;
    updateStatusBarItem(false);
  }
}

async function stopVoiceRecording() {
  try {
    isRecording = false;
    updateStatusBarItem(false);
    vscode.window.showInformationMessage("⏹️ Aufnahme gestoppt");
  } catch (error) {
    console.error("Error stopping recording:", error);
    vscode.window.showErrorMessage(
      `Fehler beim Stoppen der Aufnahme: ${error}`
    );
  }
}

async function simulateTranscription(editor: vscode.TextEditor) {
  // Demo-Transkription für Tests
  const demoTranscript =
    "Diese Funktion berechnet den Steuerbetrag basierend auf dem Einkommen";

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Voice Doc",
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "Verarbeite Spracheingabe..." });

      try {
        // Code-Kontext extrahieren
        const position = editor.selection.active;
        const lineText = editor.document.lineAt(position.line).text;
        const codeContext = getCodeContext(editor, position);

        // Kommentar generieren
        const comment = await commentGenerator.formatComment(
          demoTranscript,
          editor.document.languageId,
          codeContext
        );

        // Kommentar einfügen
        await insertComment(editor, position, comment);

        progress.report({ message: "Kommentar eingefügt!" });
      } catch (error) {
        console.error("Error processing transcription:", error);
        vscode.window.showErrorMessage(`Fehler bei der Verarbeitung: ${error}`);
      } finally {
        isRecording = false;
        updateStatusBarItem(false);
      }
    }
  );
}

function getCodeContext(
  editor: vscode.TextEditor,
  position: vscode.Position
): string {
  // Extrahiere Code-Kontext um die aktuelle Position
  const startLine = Math.max(0, position.line - 5);
  const endLine = Math.min(editor.document.lineCount - 1, position.line + 5);

  let context = "";
  for (let i = startLine; i <= endLine; i++) {
    context += editor.document.lineAt(i).text + "\n";
  }

  return context.trim();
}

async function insertComment(
  editor: vscode.TextEditor,
  position: vscode.Position,
  comment: string
) {
  const edit = new vscode.WorkspaceEdit();
  const insertPosition = new vscode.Position(position.line, 0);

  // Formatiere Kommentar mit korrekter Einrückung
  const lineText = editor.document.lineAt(position.line).text;
  const indentation = lineText.match(/^\s*/)?.[0] || "";
  const formattedComment =
    comment
      .split("\n")
      .map((line) => indentation + line)
      .join("\n") + "\n";

  edit.insert(editor.document.uri, insertPosition, formattedComment);

  await vscode.workspace.applyEdit(edit);

  // Cursor nach dem Kommentar positionieren
  const newPosition = new vscode.Position(
    position.line + comment.split("\n").length,
    0
  );
  editor.selection = new vscode.Selection(newPosition, newPosition);
}

async function showApiConfiguration() {
  const items = [
    {
      label: "$(key) OpenAI API Key konfigurieren",
      description: "ChatGPT Integration",
      action: "openai",
    },
    {
      label: "$(key) Anthropic API Key konfigurieren",
      description: "Claude Integration",
      action: "anthropic",
    },
    {
      label: "$(settings-gear) AI Provider wählen",
      description: "Zwischen OpenAI, Anthropic oder lokal wählen",
      action: "provider",
    },
    {
      label: "$(plug) Verbindung testen",
      description: "API Verbindungen überprüfen",
      action: "test",
    },
    {
      label: "$(book) Einstellungen öffnen",
      description: "Alle Voice Doc Einstellungen",
      action: "settings",
    },
  ];

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: "Was möchten Sie konfigurieren?",
  });

  if (!selection) {
    return;
  }

  switch (selection.action) {
    case "openai":
      await configureOpenAI();
      break;
    case "anthropic":
      await configureAnthropic();
      break;
    case "provider":
      await selectAIProvider();
      break;
    case "test":
      await testAIConnections();
      break;
    case "settings":
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "voiceDoc"
      );
      break;
  }
}

async function configureOpenAI() {
  const apiKey = await vscode.window.showInputBox({
    prompt: "OpenAI API Key eingeben",
    password: true,
    placeHolder: "sk-...",
    validateInput: (value) => {
      if (!value || !value.startsWith("sk-")) {
        return 'API Key muss mit "sk-" beginnen';
      }
      return null;
    },
  });

  if (apiKey) {
    await vscode.workspace
      .getConfiguration("voiceDoc")
      .update("openai.apiKey", apiKey, vscode.ConfigurationTarget.Global);

    // Test der Verbindung
    vscode.window.showInformationMessage(
      "OpenAI API Key gespeichert. Teste Verbindung..."
    );
    const testResult = await aiService.testConnection();

    if (testResult.openai) {
      vscode.window.showInformationMessage("✅ OpenAI Verbindung erfolgreich!");
    } else {
      vscode.window.showErrorMessage(
        "❌ OpenAI Verbindung fehlgeschlagen. Prüfen Sie Ihren API Key."
      );
    }
  }
}

async function configureAnthropic() {
  const apiKey = await vscode.window.showInputBox({
    prompt: "Anthropic API Key eingeben",
    password: true,
    placeHolder: "sk-ant-...",
    validateInput: (value) => {
      if (!value || !value.startsWith("sk-ant-")) {
        return 'API Key muss mit "sk-ant-" beginnen';
      }
      return null;
    },
  });

  if (apiKey) {
    await vscode.workspace
      .getConfiguration("voiceDoc")
      .update("anthropic.apiKey", apiKey, vscode.ConfigurationTarget.Global);

    // Test der Verbindung
    vscode.window.showInformationMessage(
      "Anthropic API Key gespeichert. Teste Verbindung..."
    );
    const testResult = await aiService.testConnection();

    if (testResult.anthropic) {
      vscode.window.showInformationMessage("✅ Claude Verbindung erfolgreich!");
    } else {
      vscode.window.showErrorMessage(
        "❌ Claude Verbindung fehlgeschlagen. Prüfen Sie Ihren API Key."
      );
    }
  }
}

async function selectAIProvider() {
  const providers = [
    {
      label: "Lokale Verarbeitung",
      description: "Nur lokale Textverarbeitung",
      value: "local",
    },
    {
      label: "OpenAI ChatGPT",
      description: "Erfordert OpenAI API Key",
      value: "openai",
    },
    {
      label: "Anthropic Claude",
      description: "Erfordert Anthropic API Key",
      value: "anthropic",
    },
  ];

  const selection = await vscode.window.showQuickPick(providers, {
    placeHolder: "AI Provider auswählen",
  });

  if (selection) {
    await vscode.workspace
      .getConfiguration("voiceDoc")
      .update("aiProvider", selection.value, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage(
      `AI Provider auf ${selection.label} gesetzt`
    );
  }
}

async function testAIConnections() {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Voice Doc",
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "Teste AI Verbindungen..." });

      const results = await aiService.testConnection();

      let message = "AI Verbindungstest:\n";
      message += `OpenAI: ${results.openai ? "✅" : "❌"}\n`;
      message += `Anthropic: ${results.anthropic ? "✅" : "❌"}`;

      if (results.openai || results.anthropic) {
        vscode.window.showInformationMessage(message);
      } else {
        vscode.window.showWarningMessage(
          message + "\n\nKonfigurieren Sie mindestens einen API Key."
        );
      }
    }
  );
}

function updateStatusBarItem(recording: boolean) {
  if (recording) {
    recordingStatusBarItem.text = "$(debug-stop) Recording...";
    recordingStatusBarItem.command = "voiceDoc.stopRecording";
    recordingStatusBarItem.tooltip = "Stop Voice Recording";
    recordingStatusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
  } else {
    recordingStatusBarItem.text = "$(record) Voice Doc";
    recordingStatusBarItem.command = "voiceDoc.startRecording";
    recordingStatusBarItem.tooltip = "Start Voice Documentation Recording";
    recordingStatusBarItem.backgroundColor = undefined;
  }
}

async function showWelcomeMessage(context: vscode.ExtensionContext) {
  const selection = await vscode.window.showInformationMessage(
    "Willkommen bei Voice Documentation! 🎤",
    "API konfigurieren",
    "Später"
  );

  if (selection === "API konfigurieren") {
    await showApiConfiguration();
  }

  context.globalState.update("voiceDoc.hasShownWelcome", true);
}

export function deactivate() {
  if (recordingStatusBarItem) {
    recordingStatusBarItem.dispose();
  }
  console.log("Voice Documentation Plugin deaktiviert");
}
