import bc from '@blaizejs/client';

import { routes } from './app-type.js';

const client = bc.create('https://api.example.com', routes); // fully typed client

console.log('Client created:', client);

export async function testClient() {
  try {
    const _helloResponse = await client.$get.getHello();
    const _helloPostResponse = await client.$post.postHello({ body: { name: 'World' } });

    const avatar = new File(['avatar data'], 'avatar.png', { type: 'image/png' });
    const newUser = await client.$post.createUser({
      body: { name: 'Alice', email: 'alice@example.com', role: 'admin' },
      files: {
        avatar,
      },
    });

    console.log(newUser);

    const cacheEvents = await client.$sse.getCacheEvents({
      query: { pattern: 'user:*' },
    });
    cacheEvents.on('cache.set', data => {
      console.log('Cache Set Event:', data);
    });

    const queueStream = await client.$sse.getQueueStream({
      query: { jobId: 'emailQueue' },
    });
    queueStream.on('job.cancelled', data => {
      console.log('Job Cancelled Event:', data);
    });
    const _notifications = await client.$sse.getNotifications({
      params: { userId: 'user123' },
    });
    // notifications.on('message', data => {
    //   console.log('SSE Message:', data);
    // });
    console.log('GET Hello Response:');
    console.log('GET Hello Response:', _helloResponse.name); // fully typed response
  } catch (error) {
    console.log(error); // fully typed error BlaizeError
  }
}
