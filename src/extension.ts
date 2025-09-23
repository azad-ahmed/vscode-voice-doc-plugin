
import * as vscode from 'vscode';
import { CommentGenerator } from './generator';
import { AudioRecorder } from './audio/recorder';
import { createSTT } from './stt/factory';

let isRecording = false;

export async function activate(context: vscode.ExtensionContext) {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  status.text = 'VoiceDoc: Ready (Ctrl+Alt+R)';
  status.command = 'voiceDoc.recordOrStop';
  status.show();

  // secrets: allow storing api key securely
  const secrets = context.secrets;

  const toggle = vscode.commands.registerCommand('voiceDoc.recordOrStop', async () => {
    try {
      if (!isRecording) {
        isRecording = true;
        status.text = 'VoiceDoc: Recording... (Ctrl+Alt+R to stop)';
        await AudioRecorder.start();
        vscode.window.showInformationMessage('VoiceDoc recording started.');
      } else {
        const audioPath = await AudioRecorder.stop();
        status.text = 'VoiceDoc: Transcribing...';

        const cfg = vscode.workspace.getConfiguration('voiceDoc');
        const provider = cfg.get<string>('sttProvider', 'azure');
        const langPref = cfg.get<string>('language', 'auto');

        const azureKey = (await secrets.get('voiceDoc.azure.apiKey')) ?? cfg.get<string>('azure.apiKey', '');
        const azureRegion = cfg.get<string>('azure.region', 'westeurope');

        const stt = createSTT({ provider, azure: { key: azureKey, region: azureRegion } });
        const transcript = await stt.transcribe(audioPath);

        const comment = new CommentGenerator(langPref).formatComment(transcript, getLanguageId());
        await insertComment(comment);
        status.text = 'VoiceDoc: Ready (Ctrl+Alt+R)';
        vscode.window.showInformationMessage('VoiceDoc comment inserted.');
        isRecording = false;
      }
    } catch (e: any) {
      vscode.window.showErrorMessage(`VoiceDoc error: ${e?.message ?? e}`);
      isRecording = false;
      status.text = 'VoiceDoc: Ready (Ctrl+Alt+R)';
      try { await AudioRecorder.forceStop(); } catch {}
    }
  });

  const insertFromText = vscode.commands.registerCommand('voiceDoc.insertFromText', async () => {
    const input = await vscode.window.showInputBox({ prompt: 'Enter text to turn into a code comment' });
    if (!input) return;
    const lang = vscode.workspace.getConfiguration('voiceDoc').get<string>('language', 'auto');
    const comment = new CommentGenerator(lang).formatComment(input, getLanguageId());
    await insertComment(comment);
  });

  context.subscriptions.push(toggle, insertFromText, status);
}

function getLanguageId(): string {
  const editor = vscode.window.activeTextEditor;
  return editor?.document.languageId ?? 'plaintext';
}

async function insertComment(comment: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  await editor.edit(builder => {
    builder.insert(editor.selection.active, comment + '\n');
  });
}

export function deactivate() {}
