import { metricsDashboardRoute } from '@blaizejs/plugin-metrics';

import { appRouter } from '../../app-router';

// HTML dashboard at GET /metrics/dashboard
export const GET = appRouter.get(metricsDashboardRoute);
