// ---------------------------------------------------------------------------
// In-memory user store
// Pure functional — no classes, no mutation outside the store module.
// ---------------------------------------------------------------------------

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
};

// Seed data — gives the demo something interesting to explore
const store = new Map<string, User>([
  [
    'usr_1',
    {
      id: 'usr_1',
      name: 'Alice Chen',
      email: 'alice@example.com',
      role: 'admin',
      createdAt: '2024-01-15T08:00:00.000Z',
    },
  ],
  [
    'usr_2',
    {
      id: 'usr_2',
      name: 'Bob Torres',
      email: 'bob@example.com',
      role: 'user',
      createdAt: '2024-02-20T12:30:00.000Z',
    },
  ],
  [
    'usr_3',
    {
      id: 'usr_3',
      name: 'Carla Moss',
      email: 'carla@example.com',
      role: 'user',
      createdAt: '2024-03-05T09:15:00.000Z',
    },
  ],
]);

let counter = 4;

export const listUsers = (): User[] => Array.from(store.values());

export const getUser = (id: string): User | undefined => store.get(id);

export const createUser = (data: Omit<User, 'id' | 'createdAt'>): User => {
  const user: User = {
    id: `usr_${counter++}`,
    createdAt: new Date().toISOString(),
    ...data,
  };
  store.set(user.id, user);
  return user;
};
