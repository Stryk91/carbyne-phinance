import { Component, createSignal } from 'solid-js';
import { settingsStore } from '../stores';

export const Settings: Component = () => {
  // Local state for form inputs (so we don't update store on every keystroke)
  const [finnhubKey, setFinnhubKey] = createSignal(settingsStore.state.finnhubApiKey);
  const [claudeKey, setClaudeKey] = createSignal(settingsStore.state.claudeApiKey);
  const [refreshInterval, setRefreshInterval] = createSignal(settingsStore.state.autoRefreshInterval);

  const handleSaveFinnhub = () => {
    settingsStore.setFinnhubApiKey(finnhubKey());
  };

  const handleSaveClaude = () => {
    settingsStore.setClaudeApiKey(claudeKey());
  };

  const handleSaveRefresh = () => {
    settingsStore.setAutoRefreshInterval(refreshInterval());
  };

  return (
    <div class="editor-content">
      <div class="settings-container">
        <h2 class="settings-title">Settings</h2>

        {/* API Keys Section */}
        <section class="settings-section">
          <h3 class="settings-section-title">API Keys</h3>
          <p class="settings-description">
            Configure API keys for external services. Keys are stored locally in your browser.
          </p>

          <div class="settings-field">
            <label class="settings-label">Finnhub API Key</label>
            <p class="settings-hint">
              Required for news feed. Get a free key at{' '}
              <a href="https://finnhub.io" target="_blank" rel="noopener" class="settings-link">
                finnhub.io
              </a>
            </p>
            <div class="settings-input-row">
              <input
                type="password"
                class="input"
                placeholder="Enter your Finnhub API key"
                value={finnhubKey()}
                onInput={(e) => setFinnhubKey(e.currentTarget.value)}
              />
              <button class="btn btn-primary" onClick={handleSaveFinnhub}>
                Save
              </button>
            </div>
            {settingsStore.hasFinnhubKey() && (
              <span class="settings-status success">Key configured</span>
            )}
          </div>

          <div class="settings-field">
            <label class="settings-label">Claude API Key</label>
            <p class="settings-hint">
              Optional. Used for AI-powered trading insights.
            </p>
            <div class="settings-input-row">
              <input
                type="password"
                class="input"
                placeholder="Enter your Claude API key"
                value={claudeKey()}
                onInput={(e) => setClaudeKey(e.currentTarget.value)}
              />
              <button class="btn btn-primary" onClick={handleSaveClaude}>
                Save
              </button>
            </div>
            {settingsStore.hasClaudeKey() && (
              <span class="settings-status success">Key configured</span>
            )}
          </div>
        </section>

        {/* UI Preferences Section */}
        <section class="settings-section">
          <h3 class="settings-section-title">Preferences</h3>

          <div class="settings-field">
            <label class="settings-label">Auto Refresh Interval</label>
            <p class="settings-hint">
              How often to refresh data (in seconds). Set to 0 to disable.
            </p>
            <div class="settings-input-row">
              <input
                type="number"
                class="input"
                min="0"
                max="300"
                value={refreshInterval()}
                onInput={(e) => setRefreshInterval(parseInt(e.currentTarget.value) || 0)}
                style={{ width: '100px' }}
              />
              <span class="settings-unit">seconds</span>
              <button class="btn btn-primary" onClick={handleSaveRefresh}>
                Save
              </button>
            </div>
          </div>

          <div class="settings-field">
            <label class="settings-label">Show Sparklines</label>
            <p class="settings-hint">
              Display mini price charts in the watchlist.
            </p>
            <button
              class={`btn ${settingsStore.state.showSparklines ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => settingsStore.toggleSparklines()}
            >
              {settingsStore.state.showSparklines ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </section>

        {/* Team Section */}
        <section class="settings-section">
          <h3 class="settings-section-title">Portfolio Team</h3>
          <p class="settings-description">
            Switch between KALIC and DC team portfolios.
          </p>
          <div class="settings-team-toggle">
            <button
              class={`btn ${settingsStore.state.activeTeam === 'KALIC' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => settingsStore.setActiveTeam('KALIC')}
            >
              KALIC
            </button>
            <button
              class={`btn ${settingsStore.state.activeTeam === 'DC' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => settingsStore.setActiveTeam('DC')}
            >
              DC
            </button>
          </div>
          <p class="settings-hint">
            Current: <strong>{settingsStore.state.activeTeam}</strong>
          </p>
        </section>
      </div>
    </div>
  );
};
