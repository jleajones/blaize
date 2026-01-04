import { metricsPrometheusRoute } from '@blaizejs/plugin-metrics';

import { appRouter } from '../../app-router';

// Prometheus endpoint at GET /metrics
export const GET = appRouter.get({
  handler: metricsPrometheusRoute,
});
