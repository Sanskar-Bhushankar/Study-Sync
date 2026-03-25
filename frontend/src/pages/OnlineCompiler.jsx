import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { loadPyodide } from 'pyodide';
import { useAuth } from '../contexts/AuthContext';
import AppHeader from '../components/AppHeader';

const STORAGE = {
  js: 'ss_compiler_js',
  py: 'ss_compiler_py',
  stdin: 'ss_compiler_stdin',
};

const PYODIDE_INDEX = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';

const DEFAULTS = {
  javascript: `// JavaScript (browser sandbox)\nconsole.log("Hello, StudySync!");\n`,
  python: `# Python (Pyodide)\nprint("Hello, StudySync!")\n`,
};

function loadStored(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v != null ? v : fallback;
  } catch {
    return fallback;
  }
}

function runJavaScript(code, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../jsRunnerWorker.js', import.meta.url), { type: 'classic' });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(tid);
      worker.terminate();
    };
    const tid = setTimeout(() => {
      finish();
      reject(new Error('Execution timed out (' + timeoutMs / 1000 + 's limit).'));
    }, timeoutMs);
    worker.onmessage = (ev) => {
      finish();
      const { lines, thrown } = ev.data;
      let text;
      if (thrown) {
        text =
          (lines && lines.length ? lines.join('\n') + '\n\n' : '') + 'Error: ' + thrown;
      } else {
        text = (lines && lines.length ? lines.join('\n') : '') || '(no output)';
      }
      resolve(text);
    };
    worker.onerror = (ev) => {
      finish();
      reject(ev.error || new Error(ev.message || 'Worker failed'));
    };
    worker.postMessage({ code, timeoutMs });
  });
}

function useCompilerLayoutNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

export default function OnlineCompiler() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const narrow = useCompilerLayoutNarrow();

  const [language, setLanguage] = useState('javascript');
  const [sources, setSources] = useState(() => ({
    javascript: loadStored(STORAGE.js, DEFAULTS.javascript),
    python: loadStored(STORAGE.py, DEFAULTS.python),
  }));
  const [stdin, setStdin] = useState(() => loadStored(STORAGE.stdin, ''));
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [pyodideStatus, setPyodideStatus] = useState('idle'); // idle | loading | ready | error

  const pyodideRef = useRef(null);
  const pyodideLoadingRef = useRef(null);
  const runRef = useRef(async () => {});
  const editorRef = useRef(null);
  /** Bumps each Run; async completions only apply `setOutput` / `setRunning` if still current. */
  const runGenerationRef = useRef(0);
  const prevLanguageRef = useRef(language);

  const ensurePyodide = useCallback(async () => {
    if (pyodideRef.current) return pyodideRef.current;
    if (!pyodideLoadingRef.current) {
      setPyodideStatus('loading');
      pyodideLoadingRef.current = loadPyodide({ indexURL: PYODIDE_INDEX })
        .then((py) => {
          pyodideRef.current = py;
          setPyodideStatus('ready');
          return py;
        })
        .catch((err) => {
          setPyodideStatus('error');
          throw err;
        })
        .finally(() => {
          pyodideLoadingRef.current = null;
        });
    }
    return pyodideLoadingRef.current;
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE.js, sources.javascript);
      localStorage.setItem(STORAGE.py, sources.python);
      localStorage.setItem(STORAGE.stdin, stdin);
    } catch {
      /* ignore */
    }
  }, [sources.javascript, sources.python, stdin]);

  useEffect(() => {
    if (prevLanguageRef.current !== language) {
      prevLanguageRef.current = language;
      runGenerationRef.current += 1;
      setOutput('');
    }
  }, [language]);

  const code = sources[language];
  const setCode = useCallback((value) => {
    setSources((s) => ({ ...s, [language]: value ?? '' }));
  }, [language]);

  const handleRun = useCallback(async () => {
    const live =
      editorRef.current && typeof editorRef.current.getValue === 'function'
        ? editorRef.current.getValue()
        : sources[language];
    const src = live ?? '';

    const runId = ++runGenerationRef.current;
    setRunning(true);
    setOutput('');

    const finishIfCurrent = (fn) => {
      if (runId === runGenerationRef.current) fn();
    };

    try {
      if (language === 'javascript') {
        const text = await runJavaScript(src);
        finishIfCurrent(() => setOutput(text));
      } else {
        const pyodide = await ensurePyodide();
        if (runId !== runGenerationRef.current) return;

        const outDec = new TextDecoder();
        const errDec = new TextDecoder();
        let stdoutText = '';
        let stderrText = '';
        pyodide.setStdout({
          write: (buf) => {
            stdoutText += outDec.decode(buf, { stream: true });
            return buf.byteLength;
          },
        });
        pyodide.setStderr({
          write: (buf) => {
            stderrText += errDec.decode(buf, { stream: true });
            return buf.byteLength;
          },
        });

        const normalized = stdin.replace(/\r\n/g, '\n');
        const stdinLines = normalized === '' ? [] : normalized.split('\n');
        let stdinLineIndex = 0;
        pyodide.setStdin({
          stdin: () => {
            if (stdinLineIndex >= stdinLines.length) return null;
            return `${stdinLines[stdinLineIndex++]}\n`;
          },
        });

        if (runId !== runGenerationRef.current) return;

        try {
          await pyodide.runPythonAsync(src);
        } catch (e) {
          const msg = e && e.message ? e.message : String(e);
          if (stdoutText && !stdoutText.endsWith('\n')) stdoutText += '\n';
          stdoutText += msg;
        }
        if (runId !== runGenerationRef.current) return;

        stdoutText += outDec.decode();
        stderrText += errDec.decode();

        let combined = stdoutText;
        if (stderrText) {
          if (combined && !combined.endsWith('\n')) combined += '\n';
          combined += stderrText;
        }
        finishIfCurrent(() => setOutput(combined === '' ? '(no output)' : combined));
      }
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      finishIfCurrent(() => setOutput('Error: ' + msg));
    } finally {
      finishIfCurrent(() => setRunning(false));
    }
  }, [language, sources, stdin, ensurePyodide]);

  useEffect(() => {
    runRef.current = handleRun;
  }, [handleRun]);

  const onEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runRef.current();
    });
  }, []);

  const selectStyle = {
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-h)',
    fontSize: 14,
    minWidth: 140,
    cursor: 'pointer',
  };

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <AppHeader user={user} onLogout={() => logout().then(() => navigate('/'))} />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          width: '100%',
          maxWidth: 1320,
          margin: '0 auto',
          padding:
            'clamp(20px, 3vw, 28px) clamp(12px, 2vw, 24px) clamp(12px, 2vw, 20px)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, paddingRight: 8 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--text-h)',
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
              }}
            >
              Online compiler
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Run JavaScript or Python in the browser. <span className="mono">Ctrl+Enter</span> runs code.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              Language
              <select
                value={language}
                style={selectStyle}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
              </select>
            </label>
            {language === 'python' && pyodideStatus === 'loading' && (
              <span style={{ fontSize: 12, color: 'var(--accent)' }}>Loading Python…</span>
            )}
            <button
              type="button"
              disabled={running}
              onClick={() => handleRun()}
              style={{
                padding: '10px 22px',
                borderRadius: 'var(--radius)',
                fontWeight: 600,
                fontSize: 14,
                background: running ? 'var(--border)' : 'var(--accent)',
                color: running ? 'var(--text-muted)' : 'var(--bg)',
                border: 'none',
                opacity: running ? 0.85 : 1,
                cursor: running ? 'not-allowed' : 'pointer',
                boxShadow: running ? 'none' : 'var(--shadow-sm)',
              }}
            >
              {running ? 'Running…' : 'Run'}
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: narrow ? 'column' : 'row',
            gap: 16,
            minHeight: 0,
            alignItems: 'stretch',
          }}
        >
          <section
            style={{
              flex: narrow ? '0 0 auto' : 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-card)',
              overflow: 'hidden',
              minHeight: narrow ? 320 : 0,
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-h)',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              Code
            </div>
            <div style={{ flex: 1, minHeight: narrow ? 300 : 360, position: 'relative' }}>
              <Editor
                height="100%"
                language={language === 'python' ? 'python' : 'javascript'}
                theme="vs-dark"
                value={code}
                onChange={setCode}
                onMount={onEditorMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: 'var(--mono), monospace',
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                  padding: { top: 12, bottom: 12 },
                }}
              />
            </div>
          </section>

          <section
            style={{
              flex: narrow ? '0 0 auto' : 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: narrow ? 'auto' : 0,
            }}
          >
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-card)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                flex: narrow ? '0 0 auto' : '1 1 42%',
                maxHeight: narrow ? 200 : 280,
                minHeight: narrow ? 120 : 140,
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-h)',
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                }}
              >
                Input {language === 'python' ? '(stdin)' : '(Python only)'}
              </div>
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                disabled={language !== 'python'}
                placeholder={
                  language === 'python'
                    ? 'One line per input() call (e.g. 1 2 for a, b = map(int, input().split()))…'
                    : 'Switch to Python to use stdin.'
                }
                style={{
                  flex: 1,
                  width: '100%',
                  minHeight: narrow ? 88 : 96,
                  margin: 0,
                  border: 'none',
                  borderRadius: 0,
                  resize: 'vertical',
                  fontFamily: 'var(--mono), monospace',
                  fontSize: 13,
                  lineHeight: 1.45,
                  padding: '12px 14px',
                  background: language === 'python' ? 'var(--bg-elevated)' : 'var(--bg)',
                  color: language === 'python' ? 'var(--text-h)' : 'var(--text-muted)',
                  opacity: language === 'python' ? 1 : 0.7,
                }}
              />
            </div>

            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-card)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                flex: narrow ? '1 1 240px' : '1 1 58%',
                minHeight: narrow ? 200 : 220,
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-h)',
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                }}
              >
                Output
              </div>
              <pre
                style={{
                  flex: 1,
                  margin: 0,
                  padding: '12px 14px',
                  overflow: 'auto',
                  fontFamily: 'var(--mono), monospace',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--text)',
                  background: 'var(--code-bg)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {output || (running ? '…' : 'Run to see output here.')}
              </pre>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
