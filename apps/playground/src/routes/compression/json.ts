/**
 * Compression JSON Demo Route
 *
 * GET /compression/json
 *
 * Returns a large JSON payload (>5KB) to demonstrate compression.
 * The response is automatically compressed by the global compression middleware.
 */
import { z } from 'zod';

import { appRouter } from '../../app-router';

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  department: z.string(),
  location: z.string(),
  joinedAt: z.string(),
  bio: z.string(),
});

/**
 * Generate a large array of user objects to produce a >5KB JSON payload.
 */
function generateLargePayload() {
  const departments = ['Engineering', 'Marketing', 'Sales', 'Support', 'Design', 'Product', 'Finance', 'HR'];
  const locations = ['San Francisco', 'New York', 'London', 'Berlin', 'Tokyo', 'Sydney', 'Toronto', 'Singapore'];
  const roles = ['Engineer', 'Manager', 'Director', 'VP', 'Analyst', 'Designer', 'Lead', 'Intern'];

  const users = Array.from({ length: 50 }, (_, i) => ({
    id: `user-${String(i + 1).padStart(4, '0')}`,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    role: roles[i % roles.length]!,
    department: departments[i % departments.length]!,
    location: locations[i % locations.length]!,
    joinedAt: new Date(2020, i % 12, (i % 28) + 1).toISOString(),
    bio: `This is a detailed biography for user ${i + 1}. They work in the ${departments[i % departments.length]} department as a ${roles[i % roles.length]} based in ${locations[i % locations.length]}. They have been with the company since ${2020 + Math.floor(i / 12)}.`,
  }));

  return users;
}

export const GET = appRouter.get({
  schema: {
    response: z.object({
      message: z.string(),
      count: z.number(),
      payloadSizeBytes: z.number(),
      users: z.array(userSchema),
    }),
  },
  handler: async ({ logger }) => {
    const users = generateLargePayload();
    const payload = JSON.stringify(users);

    logger.info('Serving large JSON payload for compression demo', {
      count: users.length,
      sizeBytes: Buffer.byteLength(payload),
    });

    return {
      message: '📦 Large JSON payload for compression testing. Check Content-Encoding header!',
      count: users.length,
      payloadSizeBytes: Buffer.byteLength(payload),
      users,
    };
  },
});

