import { Component, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  HistogramData,
  ColorType,
  CrosshairMode,
  Time,
} from 'lightweight-charts';

export interface OHLCData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TradingChartProps {
  symbol: string;
  data: OHLCData[];
  chartType?: 'candlestick' | 'line' | 'area';
  height?: number;
  showVolume?: boolean;
}

// Design token colors matching tokens.css
const CHART_COLORS = {
  background: '#1e1e1e',
  textColor: '#cccccc',
  textMuted: '#6e6e6e',
  gridColor: '#3c3c3c',
  borderColor: '#474747',
  upColor: '#4ec9b0',
  downColor: '#f14c4c',
  volumeUp: 'rgba(78, 201, 176, 0.5)',
  volumeDown: 'rgba(241, 76, 76, 0.5)',
  crosshairColor: '#758696',
  areaTopColor: 'rgba(78, 201, 176, 0.4)',
  areaBottomColor: 'rgba(78, 201, 176, 0.0)',
  lineColor: '#4ec9b0',
};

export const TradingChart: Component<TradingChartProps> = (props) => {
  let chartContainer: HTMLDivElement | undefined;
  let chart: IChartApi | undefined;
  let mainSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | undefined;
  let volumeSeries: ISeriesApi<'Histogram'> | undefined;

  const [containerWidth, setContainerWidth] = createSignal(0);

  // Convert string time to proper Time format for lightweight-charts
  const formatTime = (timeStr: string): Time => {
    // Handle both ISO date strings and Unix timestamps
    if (timeStr.includes('-')) {
      return timeStr.split('T')[0] as Time; // Return YYYY-MM-DD format
    }
    return parseInt(timeStr) as Time;
  };

  // Transform data for the chart
  const getCandlestickData = (): CandlestickData[] => {
    return props.data.map((d) => ({
      time: formatTime(d.time),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
  };

  const getLineData = (): LineData[] => {
    return props.data.map((d) => ({
      time: formatTime(d.time),
      value: d.close,
    }));
  };

  const getVolumeData = (): HistogramData[] => {
    return props.data
      .filter((d) => d.volume !== undefined)
      .map((d) => ({
        time: formatTime(d.time),
        value: d.volume!,
        color: d.close >= d.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
      }));
  };

  const initChart = () => {
    if (!chartContainer) return;

    const chartHeight = props.height || 300;

    // Create the chart
    chart = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: chartHeight,
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.textColor,
        fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_COLORS.gridColor, style: 1 },
        horzLines: { color: CHART_COLORS.gridColor, style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: CHART_COLORS.crosshairColor,
          width: 1,
          style: 2,
          labelBackgroundColor: CHART_COLORS.borderColor,
        },
        horzLine: {
          color: CHART_COLORS.crosshairColor,
          width: 1,
          style: 2,
          labelBackgroundColor: CHART_COLORS.borderColor,
        },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.borderColor,
        scaleMargins: {
          top: 0.1,
          bottom: props.showVolume ? 0.25 : 0.1,
        },
      },
      timeScale: {
        borderColor: CHART_COLORS.borderColor,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) => {
          const date = new Date(time as string);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Create the main series based on chart type
    const chartType = props.chartType || 'candlestick';

    if (chartType === 'candlestick') {
      mainSeries = chart.addCandlestickSeries({
        upColor: CHART_COLORS.upColor,
        downColor: CHART_COLORS.downColor,
        borderUpColor: CHART_COLORS.upColor,
        borderDownColor: CHART_COLORS.downColor,
        wickUpColor: CHART_COLORS.upColor,
        wickDownColor: CHART_COLORS.downColor,
      });
      mainSeries.setData(getCandlestickData());
    } else if (chartType === 'line') {
      mainSeries = chart.addLineSeries({
        color: CHART_COLORS.lineColor,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: CHART_COLORS.lineColor,
        crosshairMarkerBackgroundColor: CHART_COLORS.background,
      });
      mainSeries.setData(getLineData());
    } else if (chartType === 'area') {
      mainSeries = chart.addAreaSeries({
        topColor: CHART_COLORS.areaTopColor,
        bottomColor: CHART_COLORS.areaBottomColor,
        lineColor: CHART_COLORS.lineColor,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: CHART_COLORS.lineColor,
        crosshairMarkerBackgroundColor: CHART_COLORS.background,
      });
      mainSeries.setData(getLineData());
    }

    // Add volume series if enabled
    if (props.showVolume && props.data.some((d) => d.volume !== undefined)) {
      volumeSeries = chart.addHistogramSeries({
        color: CHART_COLORS.volumeUp,
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.85,
          bottom: 0,
        },
      });

      volumeSeries.setData(getVolumeData());
    }

    // Fit content to view
    chart.timeScale().fitContent();

    // Store initial width
    setContainerWidth(chartContainer.clientWidth);
  };

  // Handle resize
  const handleResize = () => {
    if (chart && chartContainer) {
      const newWidth = chartContainer.clientWidth;
      if (newWidth !== containerWidth()) {
        chart.applyOptions({ width: newWidth });
        setContainerWidth(newWidth);
      }
    }
  };

  // Setup ResizeObserver for container changes
  let resizeObserver: ResizeObserver | undefined;

  onMount(() => {
    initChart();

    // Setup resize observer
    if (chartContainer) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(chartContainer);
    }

    // Also listen to window resize
    window.addEventListener('resize', handleResize);
  });

  // Update data when props change
  createEffect(() => {
    const data = props.data;
    const chartType = props.chartType || 'candlestick';

    if (mainSeries && data.length > 0) {
      if (chartType === 'candlestick') {
        (mainSeries as ISeriesApi<'Candlestick'>).setData(getCandlestickData());
      } else {
        (mainSeries as ISeriesApi<'Line'> | ISeriesApi<'Area'>).setData(getLineData());
      }

      if (volumeSeries && props.showVolume) {
        volumeSeries.setData(getVolumeData());
      }

      chart?.timeScale().fitContent();
    }
  });

  // Cleanup
  onCleanup(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    window.removeEventListener('resize', handleResize);
    if (chart) {
      chart.remove();
    }
  });

  return (
    <div
      ref={chartContainer}
      class="trading-chart"
      style={{
        width: '100%',
        height: `${props.height || 300}px`,
        'border-radius': '4px',
        overflow: 'hidden',
      }}
    />
  );
};

export default TradingChart;