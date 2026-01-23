import { Component } from 'solid-js';
import { appStore } from '../../stores';

export const TitleBar: Component = () => {
  return (
    <header class="titlebar">
      <div class="titlebar-left">
        <div style={{ 
          width: '16px', 
          height: '16px', 
          background: 'var(--accent-primary)', 
          'border-radius': '3px' 
        }}></div>
        <span class="titlebar-title">Financial Pipeline</span>
      </div>
      <div style={{ flex: 1, display: 'flex', 'justify-content': 'center' }}>
        <button 
          class="btn btn-ghost"
          style={{ 
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            'border-radius': '4px',
            padding: 'var(--space-1) var(--space-4)',
            color: 'var(--text-tertiary)',
            'font-size': 'var(--text-sm)',
            'min-width': '300px',
            'text-align': 'left',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
          }}
          onClick={() => appStore.openCommandPalette()}
        >
          <span>Search symbols, commands...</span>
          <span style={{ 
            background: 'var(--bg-surface)', 
            padding: '2px 6px', 
            'border-radius': '3px',
            'font-size': 'var(--text-xs)',
          }}>
            Ctrl+Shift+P
          </span>
        </button>
      </div>
      <div class="titlebar-controls">
        <button class="titlebar-btn">─</button>
        <button class="titlebar-btn">□</button>
        <button class="titlebar-btn close">✕</button>
      </div>
    </header>
  );
};