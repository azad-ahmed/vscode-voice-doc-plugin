"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
const generator_1 = require("../../generator");
const factory_1 = require("../../stt/factory");
const whisper_1 = require("../../stt/providers/whisper");
const webSpeech_1 = require("../../stt/providers/webSpeech");
const audioQualityValidator_1 = require("../../utils/audioQualityValidator");
const errorHandler_1 = require("../../utils/errorHandler");
suite('Voice Documentation Plugin Test Suite', () => {
    suite('CommentGenerator', () => {
        let generator;
        setup(() => {
            generator = new generator_1.CommentGenerator('de-DE');
        });
        teardown(() => {
            sinon.restore();
        });
        suite('formatComment', () => {
            test('sollte einfachen Text formatieren', () => {
                const result = generator.formatComment('Diese Funktion berechnet die Summe', 'typescript');
                assert.ok(result.includes('Diese Funktion berechnet die Summe'));
                assert.ok(result.startsWith('//') || result.startsWith('/**'));
            });
            test('sollte leeren Text behandeln', () => {
                const result = generator.formatComment('', 'typescript');
                assert.strictEqual(result, '// Keine Spracheingabe erkannt');
            });
            test('sollte Füllwörter entfernen', () => {
                const result = generator.formatComment('äh also diese Funktion macht äh etwas', 'typescript');
                assert.ok(!result.toLowerCase().includes('äh'));
                assert.ok(!result.toLowerCase().includes('also'));
            });
            test('sollte technische Begriffe großschreiben', () => {
                const result = generator.formatComment('diese funktion nutzt ein array und eine variable', 'typescript');
                assert.ok(result.includes('Funktion'));
                assert.ok(result.includes('Array'));
                assert.ok(result.includes('Variable'));
            });
            test('sollte lange Texte umbrechen', () => {
                const longText = 'Dies ist ein sehr langer Text der mehr als achtzig Zeichen hat und daher umgebrochen werden sollte in mehrere Zeilen damit er besser lesbar ist';
                const result = generator.formatComment(longText, 'typescript');
                assert.ok(result.includes('\n') || result.includes('/**'));
            });
            test('sollte Satzstruktur verbessern', () => {
                const result = generator.formatComment('hier wird die datenbank initialisiert', 'typescript');
                assert.ok(result.includes('Datenbank initialisiert'));
                assert.ok(!result.toLowerCase().includes('hier wird'));
            });
        });
        suite('validateComment', () => {
            test('sollte gültige Kommentare erkennen', () => {
                const result = generator.validateComment('// Dies ist ein guter Kommentar');
                assert.strictEqual(result.isValid, true);
                assert.ok(result.score >= 60);
            });
            test('sollte zu kurze Kommentare erkennen', () => {
                const result = generator.validateComment('// Test');
                assert.ok(result.score < 100);
                assert.ok(result.suggestions.some(s => s.includes('zu kurz')));
            });
            test('sollte Füllwörter in Validierung erkennen', () => {
                const result = generator.validateComment('// äh also das macht was');
                assert.ok(result.score < 100);
                assert.ok(result.suggestions.some(s => s.includes('Füllwörter')));
            });
            test('sollte sehr lange Kommentare warnen', () => {
                const longComment = '// ' + 'test '.repeat(150);
                const result = generator.validateComment(longComment);
                assert.ok(result.score < 100);
                assert.ok(result.suggestions.some(s => s.includes('lang')));
            });
            test('sollte 60% Schwellenwert korrekt anwenden', () => {
                const comment = '// Ein ausreichend langer Kommentar ohne Probleme';
                const result = generator.validateComment(comment);
                assert.ok(result.score >= 60);
                assert.strictEqual(result.isValid, true);
            });
        });
        suite('Sprachspezifische Kommentare', () => {
            test('sollte Python Kommentare erstellen', () => {
                const result = generator.formatComment('Test Kommentar', 'python');
                assert.ok(result.startsWith('#') || result.startsWith('"""'));
            });
            test('sollte JavaScript Kommentare erstellen', () => {
                const result = generator.formatComment('Test Kommentar', 'javascript');
                assert.ok(result.startsWith('//') || result.startsWith('/**'));
            });
            test('sollte SQL Kommentare erstellen', () => {
                const result = generator.formatComment('Test Kommentar', 'sql');
                assert.ok(result.startsWith('--'));
            });
            test('sollte HTML Kommentare erstellen', () => {
                const result = generator.formatComment('Test Kommentar', 'html');
                assert.ok(result.startsWith('<!--'));
            });
            test('sollte CSS Kommentare erstellen', () => {
                const result = generator.formatComment('Test Kommentar', 'css');
                assert.ok(result.startsWith('//') || result.startsWith('/*'));
            });
            test('sollte Bash Kommentare erstellen', () => {
                const result = generator.formatComment('Test Kommentar', 'bash');
                assert.ok(result.startsWith('#'));
            });
        });
    });
    suite('STT Factory', () => {
        teardown(() => {
            sinon.restore();
        });
        test('sollte SimulatedSTTProvider zurückgeben wenn keine Credentials', async () => {
            const provider = await factory_1.STTFactory.createBestAvailableProvider();
            assert.ok(provider instanceof webSpeech_1.SimulatedSTTProvider);
        });
        test('sollte verfügbare Provider erkennen', async () => {
            const providers = await factory_1.STTFactory.detectAvailableProviders();
            assert.ok(Array.isArray(providers));
            assert.ok(providers.length > 0);
            assert.ok(providers[0].name);
            assert.ok(typeof providers[0].available === 'boolean');
        });
        test('sollte OpenAI und Azure Provider auflisten', async () => {
            const providers = await factory_1.STTFactory.detectAvailableProviders();
            const hasOpenAI = providers.some(p => p.name.includes('OpenAI'));
            const hasAzure = providers.some(p => p.name.includes('Azure'));
            assert.ok(hasOpenAI);
            assert.ok(hasAzure);
        });
    });
    suite('OpenAI Whisper Provider', () => {
        let provider;
        setup(() => {
            provider = new whisper_1.OpenAIWhisperProvider();
        });
        test('sollte nicht verfügbar sein ohne API Key', async () => {
            const available = await provider.isAvailable();
            assert.strictEqual(available, false);
        });
        test('sollte verfügbar sein mit API Key', async () => {
            provider.setApiKey('sk-test123');
            const available = await provider.isAvailable();
            assert.strictEqual(available, true);
        });
        test('sollte Fehler werfen bei Transkription ohne Key', async () => {
            try {
                await provider.transcribe('test.wav');
                assert.fail('Sollte Fehler werfen');
            }
            catch (error) {
                assert.ok(error.message.includes('API Key'));
            }
        });
        test('sollte korrekten Provider-Namen haben', () => {
            assert.strictEqual(provider.name, 'OpenAI Whisper API');
        });
    });
    suite('Simulated STT Provider', () => {
        let provider;
        setup(() => {
            provider = new webSpeech_1.SimulatedSTTProvider();
        });
        test('sollte immer verfügbar sein', async () => {
            const available = await provider.isAvailable();
            assert.strictEqual(available, true);
        });
        test('sollte simulierten Text zurückgeben', async () => {
            const result = await provider.transcribe('test.wav', 'de-DE');
            assert.ok(result);
            assert.ok(result.length > 0);
            assert.strictEqual(typeof result, 'string');
        });
        test('sollte verschiedene Texte simulieren', async () => {
            const results = new Set();
            for (let i = 0; i < 10; i++) {
                const result = await provider.transcribe('test.wav', 'de-DE');
                results.add(result);
            }
            assert.ok(results.size >= 2);
        });
        test('sollte korrekten Provider-Namen haben', () => {
            assert.strictEqual(provider.name, 'Simulated STT (Demo-Modus)');
        });
    });
    suite('Audio Quality Validator', () => {
        test('sollte ungültige Datei erkennen', async () => {
            const result = await audioQualityValidator_1.AudioQualityValidator.validateAudioFile('nonexistent.wav');
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.length > 0);
        });
        test('sollte minimale Dateigröße prüfen', async () => {
            assert.ok(audioQualityValidator_1.AudioQualityValidator);
        });
        test('sollte Quick-Validation bereitstellen', async () => {
            const result = await audioQualityValidator_1.AudioQualityValidator.quickValidation('test.wav');
            assert.strictEqual(typeof result, 'boolean');
        });
    });
    suite('Error Handler', () => {
        test('sollte Fehler protokollieren', () => {
            const error = new Error('Test Fehler');
            assert.doesNotThrow(() => {
                errorHandler_1.ErrorHandler.handleError('TestContext', error, false);
            });
        });
        test('sollte Warnungen behandeln', () => {
            assert.doesNotThrow(() => {
                errorHandler_1.ErrorHandler.handleWarning('TestContext', 'Test Warnung', false);
            });
        });
        test('sollte Logging unterstützen', () => {
            assert.doesNotThrow(() => {
                errorHandler_1.ErrorHandler.log('TestContext', 'Test Message', 'info');
            });
        });
        test('sollte Success-Logging unterstützen', () => {
            assert.doesNotThrow(() => {
                errorHandler_1.ErrorHandler.log('TestContext', 'Test Success', 'success');
            });
        });
    });
    suite('Edge Cases und Error Handling', () => {
        let generator;
        setup(() => {
            generator = new generator_1.CommentGenerator('de-DE');
        });
        test('sollte null-Input behandeln', () => {
            const result = generator.formatComment(null, 'typescript');
            assert.ok(result);
            assert.strictEqual(result, '// Keine Spracheingabe erkannt');
        });
        test('sollte undefined-Input behandeln', () => {
            const result = generator.formatComment(undefined, 'typescript');
            assert.ok(result);
            assert.strictEqual(result, '// Keine Spracheingabe erkannt');
        });
        test('sollte sehr lange Texte behandeln', () => {
            const longText = 'Test '.repeat(200);
            const result = generator.formatComment(longText, 'typescript');
            assert.ok(result);
            assert.ok(result.length > 0);
        });
        test('sollte Sonderzeichen behandeln', () => {
            const special = 'Test mit Sonderzeichen: äöüß €@#$%';
            const result = generator.formatComment(special, 'typescript');
            assert.ok(result);
            assert.ok(result.includes('Sonderzeichen'));
        });
        test('sollte unbekannte Sprachen mit Fallback behandeln', () => {
            const result = generator.formatComment('Test', 'unknown-language');
            assert.ok(result);
            assert.ok(result.startsWith('//'));
        });
        test('sollte Whitespace korrekt normalisieren', () => {
            const result = generator.formatComment('Test    mit     vielen    Leerzeichen', 'typescript');
            assert.ok(!result.includes('    '));
        });
        test('sollte Trailing Punctuation entfernen', () => {
            const result = generator.formatComment('Test Kommentar...!!!', 'typescript');
            assert.ok(!result.endsWith('...!!!'));
        });
    });
    suite('Integration Tests', () => {
        test('sollte vollständigen Workflow durchlaufen', async () => {
            const generator = new generator_1.CommentGenerator('de-DE');
            const provider = new webSpeech_1.SimulatedSTTProvider();
            const transcript = await provider.transcribe('test.wav', 'de-DE');
            assert.ok(transcript);
            const comment = generator.formatComment(transcript, 'typescript');
            assert.ok(comment);
            const validation = generator.validateComment(comment);
            assert.ok(validation);
            assert.ok(typeof validation.isValid === 'boolean');
            assert.ok(typeof validation.score === 'number');
        });
        test('sollte verschiedene Programmiersprachen unterstützen', async () => {
            const generator = new generator_1.CommentGenerator('de-DE');
            const languages = ['typescript', 'python', 'java', 'sql', 'html', 'css'];
            for (const lang of languages) {
                const comment = generator.formatComment('Test Kommentar', lang);
                assert.ok(comment, `Kommentar sollte für ${lang} generiert werden`);
                assert.ok(comment.length > 0);
            }
        });
        test('sollte Kommentare validieren können', () => {
            const generator = new generator_1.CommentGenerator('de-DE');
            const shortComment = '// Test';
            const validComment = '// Dies ist ein ausreichend langer Kommentar';
            const longComment = '// ' + 'Test '.repeat(100);
            const fillerComment = '// äh also test';
            const shortResult = generator.validateComment(shortComment);
            const validResult = generator.validateComment(validComment);
            const longResult = generator.validateComment(longComment);
            const fillerResult = generator.validateComment(fillerComment);
            assert.ok(shortResult.score < 100);
            assert.ok(validResult.isValid);
            assert.ok(longResult.score < 100);
            assert.ok(fillerResult.score < 100);
        });
    });
    suite('Performance Tests', () => {
        test('sollte Kommentare schnell formatieren', () => {
            const generator = new generator_1.CommentGenerator('de-DE');
            const start = Date.now();
            for (let i = 0; i < 100; i++) {
                generator.formatComment('Test Kommentar für Performance Test', 'typescript');
            }
            const duration = Date.now() - start;
            assert.ok(duration < 1000, 'Sollte unter 1 Sekunde für 100 Kommentare sein');
        });
        test('sollte Validierung schnell durchführen', () => {
            const generator = new generator_1.CommentGenerator('de-DE');
            const start = Date.now();
            for (let i = 0; i < 100; i++) {
                generator.validateComment('// Test Kommentar für Performance');
            }
            const duration = Date.now() - start;
            assert.ok(duration < 500, 'Sollte unter 500ms für 100 Validierungen sein');
        });
    });
});
//# sourceMappingURL=extension.test.js.map