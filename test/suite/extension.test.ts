import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { CommentGenerator } from '../../src/generator';
import { STTFactory } from '../../src/stt/factory';
import { OpenAIWhisperProvider } from '../../src/stt/providers/whisper';
import { SimulatedSTTProvider } from '../../src/stt/providers/webSpeech';
import { AudioQualityValidator } from '../../src/utils/audioQualityValidator';
import { ErrorHandler } from '../../src/utils/errorHandler';
import { ConfigManager } from '../../src/utils/configManager';

suite('Voice Documentation Plugin Test Suite', () => {
    
    // Mock ConfigManager für alle Tests
    let configManagerStub: sinon.SinonStub;
    
    setup(() => {
        // Mock ConfigManager.getSecret to return undefined (no API keys)
        configManagerStub = sinon.stub(ConfigManager, 'getSecret').resolves(undefined);
    });

    teardown(() => {
        sinon.restore();
    });
    
    suite('CommentGenerator', () => {
        let generator: CommentGenerator;

        setup(() => {
            generator = new CommentGenerator('de-DE');
        });

        suite('formatComment', () => {
            test('sollte einfachen Text formatieren', () => {
                const result = generator.formatComment(
                    'Diese Funktion berechnet die Summe',
                    'typescript'
                );
                
                assert.ok(result.includes('Diese Funktion berechnet die Summe'));
                assert.ok(result.startsWith('//') || result.startsWith('/**'));
            });

            test('sollte leeren Text behandeln', () => {
                const result = generator.formatComment('', 'typescript');
                assert.strictEqual(result, '// Keine Spracheingabe erkannt');
            });

            test('sollte Füllwörter entfernen', () => {
                // Test mit "also" am Anfang + Space
                const result = generator.formatComment(
                    'also diese Funktion macht etwas',
                    'typescript'
                );
                
                // Prüfe ob "also" nicht am Anfang des Kommentars steht
                const commentText = result.replace(/^(\/\/|\/\*\*)\s*/, '').toLowerCase();
                assert.ok(!commentText.startsWith('also'), 'Also sollte nicht am Anfang stehen');
            });

            test('sollte technische Begriffe großschreiben', () => {
                const result = generator.formatComment(
                    'diese funktion nutzt ein array und eine variable',
                    'typescript'
                );
                
                assert.ok(result.includes('Funktion'));
                assert.ok(result.includes('Array'));
                assert.ok(result.includes('Variable'));
            });

            test('sollte lange Texte umbrechen', () => {
                const longText = 'Dies ist ein sehr langer Text der mehr als achtzig Zeichen hat und daher umgebrochen werden sollte in mehrere Zeilen damit er besser lesbar ist';
                const result = generator.formatComment(longText, 'typescript');
                
                assert.ok(result.includes('\n') || result.includes('/**'));
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
                assert.ok(result.suggestions.some((s: string) => s.includes('zu kurz')));
            });

            test('sollte sehr lange Kommentare warnen', () => {
                const longComment = '// ' + 'test '.repeat(150);
                const result = generator.validateComment(longComment);
                
                assert.ok(result.score < 100);
                assert.ok(result.suggestions.some((s: string) => s.includes('lang')));
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
        });
    });

    suite('STT Factory', () => {
        test('sollte SimulatedSTTProvider zurückgeben wenn keine Credentials', async () => {
            // Mock vscode.window.showWarningMessage to avoid dialog in tests
            const vscodeStub = sinon.stub(vscode.window, 'showWarningMessage')
                .resolves('Demo-Modus aktivieren' as any);
            
            try {
                const provider = await STTFactory.createBestAvailableProvider();
                assert.ok(provider !== null, 'Provider sollte nicht null sein');
                // Provider kann EnhancedDemoProvider oder SimulatedSTTProvider sein
                assert.ok(
                    provider.name.includes('Demo') || provider.name.includes('Simulat'),
                    `Provider sollte Demo oder Simulated sein, ist aber: ${provider.name}`
                );
            } finally {
                vscodeStub.restore();
            }
        });

        test('sollte verfügbare Provider erkennen', async () => {
            const providers = await STTFactory.detectAvailableProviders();
            
            assert.ok(Array.isArray(providers));
            assert.ok(providers.length > 0);
            assert.ok(providers[0].name);
            assert.ok(typeof providers[0].available === 'boolean');
        });

        test('sollte OpenAI und Azure Provider auflisten', async () => {
            const providers = await STTFactory.detectAvailableProviders();
            
            const hasOpenAI = providers.some((p: any) => p.name.includes('OpenAI'));
            const hasAzure = providers.some((p: any) => p.name.includes('Azure'));
            
            assert.ok(hasOpenAI);
            assert.ok(hasAzure);
        });
    });

    suite('OpenAI Whisper Provider', () => {
        let provider: OpenAIWhisperProvider;

        setup(() => {
            provider = new OpenAIWhisperProvider();
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

        test('sollte korrekten Provider-Namen haben', () => {
            assert.strictEqual(provider.name, 'OpenAI Whisper API');
        });
    });

    suite('Simulated STT Provider', () => {
        let provider: SimulatedSTTProvider;

        setup(() => {
            provider = new SimulatedSTTProvider();
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

        test('sollte korrekten Provider-Namen haben', () => {
            assert.strictEqual(provider.name, 'Simulated STT (Demo-Modus)');
        });
    });

    suite('Error Handler', () => {
        test('sollte Fehler protokollieren', () => {
            const error = new Error('Test Fehler');
            assert.doesNotThrow(() => {
                ErrorHandler.handleError('TestContext', error, false);
            });
        });

        test('sollte Warnungen behandeln', () => {
            assert.doesNotThrow(() => {
                ErrorHandler.handleWarning('TestContext', 'Test Warnung', false);
            });
        });

        test('sollte Logging unterstützen', () => {
            assert.doesNotThrow(() => {
                ErrorHandler.log('TestContext', 'Test Message', 'info');
            });
        });
    });

    suite('Edge Cases', () => {
        let generator: CommentGenerator;

        setup(() => {
            generator = new CommentGenerator('de-DE');
        });

        test('sollte null-Input behandeln', () => {
            const result = generator.formatComment(null as any, 'typescript');
            assert.ok(result);
            assert.strictEqual(result, '// Keine Spracheingabe erkannt');
        });

        test('sollte undefined-Input behandeln', () => {
            const result = generator.formatComment(undefined as any, 'typescript');
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
    });

    suite('Integration Tests', () => {
        test('sollte vollständigen Workflow durchlaufen', async () => {
            const generator = new CommentGenerator('de-DE');
            const provider = new SimulatedSTTProvider();

            const transcript = await provider.transcribe('test.wav', 'de-DE');
            assert.ok(transcript);

            const comment = generator.formatComment(transcript, 'typescript');
            assert.ok(comment);

            const validation = generator.validateComment(comment);
            assert.ok(validation);
            assert.ok(typeof validation.isValid === 'boolean');
            assert.ok(typeof validation.score === 'number');
        });

        test('sollte verschiedene Programmiersprachen unterstützen', () => {
            const generator = new CommentGenerator('de-DE');
            const languages = ['typescript', 'python', 'java', 'sql', 'html', 'css'];

            for (const lang of languages) {
                const comment = generator.formatComment('Test Kommentar', lang);
                assert.ok(comment, `Kommentar sollte für ${lang} generiert werden`);
                assert.ok(comment.length > 0);
            }
        });
    });

    suite('Performance Tests', () => {
        test('sollte Kommentare schnell formatieren', () => {
            const generator = new CommentGenerator('de-DE');
            const start = Date.now();
            
            for (let i = 0; i < 100; i++) {
                generator.formatComment('Test Kommentar für Performance Test', 'typescript');
            }
            
            const duration = Date.now() - start;
            assert.ok(duration < 1000, 'Sollte unter 1 Sekunde für 100 Kommentare sein');
        });

        test('sollte Validierung schnell durchführen', () => {
            const generator = new CommentGenerator('de-DE');
            const start = Date.now();
            
            for (let i = 0; i < 100; i++) {
                generator.validateComment('// Test Kommentar für Performance');
            }
            
            const duration = Date.now() - start;
            assert.ok(duration < 500, 'Sollte unter 500ms für 100 Validierungen sein');
        });
    });
});
