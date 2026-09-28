// Ersetzt das Modul 'vscode' für die Unit-Tests. Es existiert nur im
// Extension-Host von VS Code; wird per .mocharc.json vor den Tests geladen.
import Module from 'module';

const vscodeStub = {
    window: {
        showErrorMessage: async () => undefined,
        showWarningMessage: async () => undefined,
        showInformationMessage: async () => undefined
    }
};

type ModuleLoader = (request: string, ...rest: unknown[]) => unknown;
const loader = Module as unknown as { _load: ModuleLoader };
const originalLoad = loader._load;

loader._load = function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === 'vscode') {
        return vscodeStub;
    }
    return originalLoad.call(this, request, ...rest);
};
