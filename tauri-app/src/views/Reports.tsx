import { Component, For, Show, createSignal, createResource } from 'solid-js';
import {
  getReportList,
  getReportContent,
  generatePdfReport,
  type ReportItem,
} from '../api';

export const Reports: Component = () => {
  const [selectedReport, setSelectedReport] = createSignal<string | null>(null);
  const [reportContent, setReportContent] = createSignal<string>('');
  const [filterType, setFilterType] = createSignal<string>('all');
  const [message, setMessage] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null);
  const [generating, setGenerating] = createSignal(false);

  // Fetch report list
  const [reportsData, { refetch }] = createResource(getReportList);

  // Filter reports by type
  const filteredReports = () => {
    const reports = reportsData() || [];
    const filter = filterType();
    if (filter === 'all') return reports;
    return reports.filter(r => r.report_type === filter);
  };

  // Get unique report types for filter
  const reportTypes = () => {
    const reports = reportsData() || [];
    const types = new Set(reports.map(r => r.report_type));
    return ['all', ...Array.from(types)];
  };

  const handleSelectReport = async (report: ReportItem) => {
    setSelectedReport(report.path);
    try {
      const content = await getReportContent(report.path);
      setReportContent(content);
    } catch (e) {
      setMessage({ type: 'error', text: `Failed to load report: ${e}` });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleGeneratePdf = async () => {
    const selected = selectedReport();
    if (!selected) return;

    setGenerating(true);
    try {
      const result = await generatePdfReport(selected);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        refetch();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (e) {
      setMessage({ type: 'error', text: `PDF generation failed: ${e}` });
    } finally {
      setGenerating(false);
    }
    setTimeout(() => setMessage(null), 5000);
  };

  // Simple markdown to HTML converter for display
  const renderMarkdown = (md: string) => {
    return md
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
      // Inline code
      .replace(/`(.+?)`/g, '<code class="inline-code">$1</code>')
      // Tables (basic)
      .replace(/^\|(.+)\|$/gm, (match, content) => {
        const cells = content.split('|').map((c: string) => c.trim());
        const isHeader = cells.some((c: string) => c.match(/^-+$/));
        if (isHeader) return '';
        return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join('')}</tr>`;
      })
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div class="editor-content">
      <div class="reports-container">
        {/* Header */}
        <div class="reports-header">
          <h2>Trading Reports</h2>
          <div class="reports-actions">
            <select
              class="input"
              style={{ width: '150px' }}
              value={filterType()}
              onChange={(e) => setFilterType(e.currentTarget.value)}
            >
              <For each={reportTypes()}>
                {(type) => (
                  <option value={type}>
                    {type === 'all' ? 'All Types' : type.replace('_', ' ')}
                  </option>
                )}
              </For>
            </select>
            <button class="btn btn-secondary" onClick={() => refetch()}>
              Refresh
            </button>
          </div>
        </div>

        {/* Message */}
        <Show when={message()}>
          <div class={`alert-message ${message()!.type}`}>
            {message()!.text}
          </div>
        </Show>

        <div class="reports-layout">
          {/* Reports List */}
          <div class="reports-list-panel">
            <div class="panel-header">
              <span>Reports ({filteredReports().length})</span>
            </div>
            <div class="reports-list">
              <For each={filteredReports()} fallback={
                <div class="empty-state">No reports found</div>
              }>
                {(report) => (
                  <div
                    class={`report-item ${selectedReport() === report.path ? 'selected' : ''}`}
                    onClick={() => handleSelectReport(report)}
                  >
                    <div class="report-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>
                    <div class="report-info">
                      <div class="report-name">{report.name}</div>
                      <div class="report-meta">
                        <span class="report-type-badge">{report.report_type}</span>
                        <span class="report-date">{report.date}</span>
                        <span class="report-size">{report.size_kb}KB</span>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Report Viewer */}
          <div class="report-viewer-panel">
            <Show when={selectedReport()} fallback={
              <div class="empty-viewer">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <p>Select a report to view</p>
              </div>
            }>
              <div class="viewer-header">
                <span class="viewer-title">
                  {selectedReport()?.split('/').pop()}
                </span>
                <div class="viewer-actions">
                  <button
                    class="btn btn-primary"
                    onClick={handleGeneratePdf}
                    disabled={generating() || !selectedReport()?.endsWith('.md')}
                  >
                    {generating() ? 'Generating...' : 'Export PDF'}
                  </button>
                </div>
              </div>
              <div class="viewer-content">
                <div
                  class="markdown-content"
                  innerHTML={renderMarkdown(reportContent())}
                />
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};
