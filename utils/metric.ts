import { MeterProvider } from '@opentelemetry/sdk-metrics-base';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { metrics } from '@opentelemetry/api';

export async function startExporter(){

  if(!process.env.PROM_PORT){
      process.env.PROM_PORT = "9464"
  }

  // Create Prometheus Exporter
  const prometheusExporter = new PrometheusExporter(
    { port: Number(process.env.PROM_PORT) },
    () => {
      console.log('Prometheus scrape endpoint: http://localhost:9464/metrics');
    }
  );

  // Set up MeterProvider manually
  const meterProvider = new MeterProvider();
  meterProvider.addMetricReader(prometheusExporter);

  // Set global meter provider so `metrics.getMeter()` works
  metrics.setGlobalMeterProvider(meterProvider);

  // Get a meter
  const meter = metrics.getMeter('iglu-meter');
  const prefix = "iglu_cache"

  // 
  const drvCounter = meter.createObservableGauge(prefix + "_derivation_count" ,{
    description: 'Number of derivations in the cache',
  });

  drvCounter.addCallback((res) => {
    res.observe(20, {cache: "default"})
  })
}
