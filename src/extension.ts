import * as vscode from "vscode";
import { CommentGenerator } from "./generator";
import { IntegratedVoiceHandler } from "./integratedVoiceHandler";

let voiceHandler: IntegratedVoiceHandler | null = null;
let generator: CommentGenerator | null = null;

/**
 * Aktiviert die Extension
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log("Voice Documentation Extension wird aktiviert...");

  // Initialisiere Comment Generator
  generator = new CommentGenerator("auto", context);
  await generator.initializeAI();

  // Initialisiere Voice Handler (integrierte Lösung)
  voiceHandler = new IntegratedVoiceHandler(context, generator);

  // === Kommandos registrieren ===

  // 1. Hauptkommando: Voice Documentation Toggle
  const toggleRecordingCommand = vscode.commands.registerCommand(
    "voiceDocs.toggleRecording",
    async () => {
      if (voiceHandler) {
        await voiceHandler.toggleRecording();
      }
    }
  );

  // 2. Direkte Text-Eingabe
  const quickInputCommand = vscode.commands.registerCommand(
    "voiceDocs.quickInput",
    async () => {
      if (voiceHandler) {
        await voiceHandler.showQuickInput();
      }
    }
  );

  // 3. Strukturierte Eingabe
  const multiStepCommand = vscode.commands.registerCommand(
    "voiceDocs.multiStep",
    async () => {
      if (voiceHandler) {
        await voiceHandler.showMultiStepInput();
      }
    }
  );

  // 4. Clipboard-Methode
  const clipboardCommand = vscode.commands.registerCommand(
    "voiceDocs.clipboard",
    async () => {
      if (voiceHandler) {
        await voiceHandler.startClipboardMonitoring();
      }
    }
  );

  // 5. System Voice Typing
  const systemVoiceCommand = vscode.commands.registerCommand(
    "voiceDocs.systemVoice",
    async () => {
      if (voiceHandler) {
        await voiceHandler.useSystemVoiceTyping();
      }
    }
  );

  // 6. Ausgewählten Text mit AI verbessern
  const enhanceTextCommand = vscode.commands.registerTextEditorCommand(
    "voiceDocs.enhanceText",
    async (textEditor, edit) => {
      const selection = textEditor.selection;
      const selectedText = textEditor.document.getText(selection);

      if (!selectedText) {
        vscode.window.showWarningMessage("Bitte wählen Sie zuerst Text aus");
        return;
      }

      if (generator) {
        const enhanced = await generator.processVoiceInput(selectedText);
        vscode.window.showInformationMessage(
          "Text wurde verarbeitet und eingefügt"
        );
      }
    }
  );

  // 7. API Keys konfigurieren
  const configureOpenAICommand = vscode.commands.registerCommand(
    "voiceDocs.configureOpenAI",
    async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: "OpenAI API Key eingeben",
        password: true,
        placeHolder: "sk-...",
      });

      if (apiKey) {
        // Teste den Key sofort
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Teste OpenAI API Key...",
            cancellable: false,
          },
          async () => {
            const testResult = await generator?.testOpenAIKey(apiKey);

            if (testResult?.valid) {
              // Speichere nur wenn gültig
              await context.secrets.store("openai.apiKey", apiKey);
              vscode.window.showInformationMessage(testResult.message);

              // Neu initialisieren
              await generator?.initializeAI();
            } else {
              // Zeige Fehler, speichere nicht
              vscode.window.showErrorMessage(
                testResult?.message || "API Key ungültig"
              );
            }
          }
        );
      }
    }
  );

  const configureAnthropicCommand = vscode.commands.registerCommand(
    "voiceDocs.configureAnthropic",
    async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: "Anthropic/Claude API Key eingeben",
        password: true,
        placeHolder: "sk-ant-...",
      });

      if (apiKey) {
        // Teste den Key sofort
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Teste Anthropic API Key...",
            cancellable: false,
          },
          async () => {
            const testResult = await generator?.testAnthropicKey(apiKey);

            if (testResult?.valid) {
              // Speichere nur wenn gültig
              await context.secrets.store("anthropic.apiKey", apiKey);
              vscode.window.showInformationMessage(testResult.message);

              // Neu initialisieren
              await generator?.initializeAI();
            } else {
              // Zeige Fehler, speichere nicht
              vscode.window.showErrorMessage(
                testResult?.message || "API Key ungültig"
              );
            }
          }
        );
      }
    }
  );

  // 8. Test Commands für API Keys
  const testOpenAIKeyCommand = vscode.commands.registerCommand(
    "voiceDocs.testOpenAI",
    async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Teste OpenAI API Key...",
          cancellable: false,
        },
        async () => {
          const result = await generator?.testOpenAIKey();

          if (!result) {
            vscode.window.showErrorMessage("Kein Generator initialisiert");
            return;
          }

          // Zeige detailliertes Ergebnis
          if (result.valid) {
            const action = await vscode.window.showInformationMessage(
              result.message,
              "Details"
            );

            if (action === "Details") {
              const quickPick = vscode.window.createQuickPick();
              quickPick.title = "OpenAI API Status";
              quickPick.items = [
                { label: "✅ Status", description: "API Key ist gültig" },
                { label: "🤖 Model", description: result.model || "Unbekannt" },
                {
                  label: "🔑 Key",
                  description:
                    "***" +
                    (await context.secrets.get("openai.apiKey"))?.slice(-4),
                },
              ];
              quickPick.show();
            }
          } else {
            vscode.window.showErrorMessage(result.message);
          }
        }
      );
    }
  );

  const testAnthropicKeyCommand = vscode.commands.registerCommand(
    "voiceDocs.testAnthropic",
    async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Teste Anthropic API Key...",
          cancellable: false,
        },
        async () => {
          const result = await generator?.testAnthropicKey();

          if (!result) {
            vscode.window.showErrorMessage("Kein Generator initialisiert");
            return;
          }

          // Zeige detailliertes Ergebnis
          if (result.valid) {
            const action = await vscode.window.showInformationMessage(
              result.message,
              "Details"
            );

            if (action === "Details") {
              const quickPick = vscode.window.createQuickPick();
              quickPick.title = "Anthropic API Status";
              quickPick.items = [
                { label: "✅ Status", description: "API Key ist gültig" },
                { label: "🤖 Model", description: result.model || "Unbekannt" },
                {
                  label: "🔑 Key",
                  description:
                    "***" +
                    (await context.secrets.get("anthropic.apiKey"))?.slice(-4),
                },
              ];
              quickPick.show();
            }
          } else {
            vscode.window.showErrorMessage(result.message);
          }
        }
      );
    }
  );

  // 9. Test alle Keys Command
  const testAllKeysCommand = vscode.commands.registerCommand(
    "voiceDocs.testAllKeys",
    async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Teste alle API Keys...",
          cancellable: false,
        },
        async () => {
          const results = await generator?.testAllKeys();

          if (!results) {
            vscode.window.showErrorMessage("Kein Generator initialisiert");
            return;
          }

          // Erstelle Übersicht
          const items: vscode.QuickPickItem[] = [];

          if (results.openai) {
            items.push({
              label: results.openai.valid ? "✅ OpenAI" : "❌ OpenAI",
              description: results.openai.message,
              detail: results.openai.model
                ? `Model: ${results.openai.model}`
                : undefined,
            });
          } else {
            items.push({
              label: "⚠️ OpenAI",
              description: "Kein API Key konfiguriert",
            });
          }

          if (results.anthropic) {
            items.push({
              label: results.anthropic.valid ? "✅ Anthropic" : "❌ Anthropic",
              description: results.anthropic.message,
              detail: results.anthropic.model
                ? `Model: ${results.anthropic.model}`
                : undefined,
            });
          } else {
            items.push({
              label: "⚠️ Anthropic",
              description: "Kein API Key konfiguriert",
            });
          }

          const quickPick = vscode.window.createQuickPick();
          quickPick.title = "API Keys Status";
          quickPick.items = items;
          quickPick.show();
        }
      );
    }
  );

  // 10. Kommentar-Validierung
  const validateCommentCommand = vscode.commands.registerCommand(
    "voiceDocs.validateComment",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const position = editor.selection.active;
      const line = editor.document.lineAt(position.line);
      const commentText = line.text.trim();

      if (generator) {
        const validation = generator.validateComment(commentText);

        const message =
          `Kommentar-Qualität: ${validation.score}/100\n` +
          `${validation.isValid ? "✅ Gültig" : "❌ Verbesserung nötig"}\n` +
          `${validation.suggestions.join("\n")}`;

        vscode.window.showInformationMessage(message);
      }
    }
  );

  // 9. Quick Pick für AI Provider
  const selectAIProviderCommand = vscode.commands.registerCommand(
    "voiceDocs.selectProvider",
    async () => {
      const provider = await vscode.window.showQuickPick(
        [
          "OpenAI (GPT-4)",
          "Anthropic (Claude)",
          "Keine AI (nur Basis-Verarbeitung)",
        ],
        {
          placeHolder: "Wählen Sie den AI-Provider",
        }
      );

      if (provider) {
        let configValue = "none";
        if (provider.includes("OpenAI")) configValue = "openai";
        if (provider.includes("Anthropic")) configValue = "anthropic";

        await vscode.workspace
          .getConfiguration("voiceDocs")
          .update("aiProvider", configValue, vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage(
          `AI Provider geändert zu: ${provider}`
        );
      }
    }
  );

  // === Konfiguration überwachen ===
  vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (e.affectsConfiguration("voiceDocs")) {
      // Neu laden bei Konfigurations-Änderungen
      await generator?.initializeAI();
      vscode.window.showInformationMessage(
        "Voice Docs Konfiguration aktualisiert"
      );
    }
  });

  // === Registriere alle Kommandos ===
  context.subscriptions.push(
    toggleRecordingCommand,
    quickInputCommand,
    multiStepCommand,
    clipboardCommand,
    systemVoiceCommand,
    enhanceTextCommand,
    configureOpenAICommand,
    configureAnthropicCommand,
    testOpenAIKeyCommand,
    testAnthropicKeyCommand,
    testAllKeysCommand,
    validateCommentCommand,
    selectAIProviderCommand
  );

  // === Initiale Prüfungen ===

  // Prüfe ob API Keys vorhanden sind
  const hasOpenAI = await context.secrets.get("openai.apiKey");
  const hasAnthropic = await context.secrets.get("anthropic.apiKey");

  if (!hasOpenAI && !hasAnthropic) {
    const action = await vscode.window.showInformationMessage(
      "Voice Documentation: Keine API Keys konfiguriert. Möchten Sie jetzt einen API Key hinzufügen?",
      "OpenAI",
      "Anthropic",
      "Später"
    );

    if (action === "OpenAI") {
      await vscode.commands.executeCommand("voiceDocs.configureOpenAI");
    } else if (action === "Anthropic") {
      await vscode.commands.executeCommand("voiceDocs.configureAnthropic");
    }
  }

  console.log("Voice Documentation Extension erfolgreich aktiviert!");

  // Zeige Willkommensnachricht
  vscode.window.showInformationMessage(
    'Voice Documentation bereit! Klicken Sie auf "Voice Docs" in der Statusleiste oder nutzen Sie Ctrl+Shift+V'
  );
}

/**
 * Deaktiviert die Extension
 */
export function deactivate() {
  console.log("Voice Documentation Extension wird deaktiviert...");

  // Cleanup
  if (voiceHandler) {
    voiceHandler.dispose();
    voiceHandler = null;
  }

  generator = null;

  console.log("Voice Documentation Extension deaktiviert");
}
