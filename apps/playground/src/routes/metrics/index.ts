import { metricsJsonRoute } from '@blaizejs/plugin-metrics';

import { appRouter } from '../../app-router';

// JSON snapshot at GET /metrics/json
export const GET = appRouter.get(metricsJsonRoute);
