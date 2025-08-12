import bc from '@blaizejs/client';

import { routes } from './app-type.js';

const client = bc.create('https://api.example.com', routes); // fully typed client

console.log('Client created:', client);

export async function testClient() {
  try {
    const _helloResponse = await client.$get.getHello();
    const _helloPostResponse = await client.$post.postHello({ body: { name: 'World' } });
    console.log('GET Hello Response:');
    console.log('GET Hello Response:', _helloResponse.name); // fully typed response
  } catch (error) {
    console.log(error); // fully typed error BlaizeError
  }
}
