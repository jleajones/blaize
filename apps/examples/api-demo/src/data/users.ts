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
  department: string;
  location: string;
  bio: string;
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
      department: 'Engineering',
      location: 'New York',
      bio: 'Alice is a senior engineer with 10 years of experience in web development.',
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
      department: 'Marketing',
      location: 'San Francisco',
      bio: 'Bob is a marketing specialist with a focus on digital campaigns and brand growth.',
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
      department: 'Sales',
      location: 'Chicago',
      bio: 'Carla is a sales manager with extensive experience in B2B enterprise sales.',
    },
  ],
  [
    'usr_4',
    {
      id: 'usr_4',
      name: 'David Kim',
      email: 'david.kim@example.com',
      role: 'admin',
      createdAt: '2024-01-28T10:00:00.000Z',
      department: 'Engineering',
      location: 'Seattle',
      bio: 'David leads the platform team and specializes in distributed systems and infrastructure.',
    },
  ],
  [
    'usr_5',
    {
      id: 'usr_5',
      name: 'Elena Vasquez',
      email: 'elena.vasquez@example.com',
      role: 'user',
      createdAt: '2024-04-10T14:20:00.000Z',
      department: 'Design',
      location: 'Austin',
      bio: 'Elena is a product designer focused on accessible, user-centered interfaces.',
    },
  ],
  [
    'usr_6',
    {
      id: 'usr_6',
      name: 'Frank Oduya',
      email: 'frank.oduya@example.com',
      role: 'user',
      createdAt: '2024-05-01T09:00:00.000Z',
      department: 'Finance',
      location: 'New York',
      bio: 'Frank is a financial analyst with a background in SaaS revenue modeling and forecasting.',
    },
  ],
  [
    'usr_7',
    {
      id: 'usr_7',
      name: 'Grace Liu',
      email: 'grace.liu@example.com',
      role: 'user',
      createdAt: '2024-03-22T11:45:00.000Z',
      department: 'Engineering',
      location: 'San Francisco',
      bio: 'Grace is a full-stack engineer who enjoys building type-safe APIs and developer tooling.',
    },
  ],
  [
    'usr_8',
    {
      id: 'usr_8',
      name: 'Hassan Al-Farsi',
      email: 'hassan.alfarsi@example.com',
      role: 'user',
      createdAt: '2024-06-15T08:30:00.000Z',
      department: 'Support',
      location: 'London',
      bio: 'Hassan manages enterprise support accounts and has deep expertise in customer success.',
    },
  ],
  [
    'usr_9',
    {
      id: 'usr_9',
      name: 'Isabel Nakamura',
      email: 'isabel.nakamura@example.com',
      role: 'admin',
      createdAt: '2024-02-08T13:00:00.000Z',
      department: 'Product',
      location: 'Toronto',
      bio: 'Isabel is a product manager who bridges engineering and customer needs to ship impactful features.',
    },
  ],
  [
    'usr_10',
    {
      id: 'usr_10',
      name: 'James Okonkwo',
      email: 'james.okonkwo@example.com',
      role: 'user',
      createdAt: '2024-07-03T15:10:00.000Z',
      department: 'Marketing',
      location: 'Lagos',
      bio: 'James specializes in content strategy and has grown organic traffic across multiple SaaS products.',
    },
  ],
  [
    'usr_11',
    {
      id: 'usr_11',
      name: 'Karen Johansson',
      email: 'karen.johansson@example.com',
      role: 'user',
      createdAt: '2024-04-25T10:30:00.000Z',
      department: 'HR',
      location: 'Stockholm',
      bio: 'Karen leads people operations and is passionate about building high-trust engineering cultures.',
    },
  ],
  [
    'usr_12',
    {
      id: 'usr_12',
      name: 'Liam Brennan',
      email: 'liam.brennan@example.com',
      role: 'user',
      createdAt: '2024-08-12T09:45:00.000Z',
      department: 'Engineering',
      location: 'Dublin',
      bio: 'Liam is a backend engineer with deep experience in Node.js, TypeScript, and event-driven architecture.',
    },
  ],
  [
    'usr_13',
    {
      id: 'usr_13',
      name: 'Maya Patel',
      email: 'maya.patel@example.com',
      role: 'user',
      createdAt: '2024-05-18T11:00:00.000Z',
      department: 'Design',
      location: 'Bangalore',
      bio: 'Maya is a design systems engineer who builds component libraries used across multiple product teams.',
    },
  ],
  [
    'usr_14',
    {
      id: 'usr_14',
      name: 'Nathan Brooks',
      email: 'nathan.brooks@example.com',
      role: 'user',
      createdAt: '2024-09-02T14:00:00.000Z',
      department: 'Sales',
      location: 'Boston',
      bio: 'Nathan is an enterprise account executive focused on mid-market and upmarket expansion.',
    },
  ],
  [
    'usr_15',
    {
      id: 'usr_15',
      name: 'Olivia Svensson',
      email: 'olivia.svensson@example.com',
      role: 'admin',
      createdAt: '2024-01-30T08:15:00.000Z',
      department: 'Engineering',
      location: 'Gothenburg',
      bio: 'Olivia is an engineering manager overseeing the API platform and developer experience teams.',
    },
  ],
  [
    'usr_16',
    {
      id: 'usr_16',
      name: 'Paulo Mendes',
      email: 'paulo.mendes@example.com',
      role: 'user',
      createdAt: '2024-06-28T12:00:00.000Z',
      department: 'Finance',
      location: 'São Paulo',
      bio: 'Paulo oversees financial reporting and works closely with leadership on growth planning.',
    },
  ],
  [
    'usr_17',
    {
      id: 'usr_17',
      name: 'Quinn Harrington',
      email: 'quinn.harrington@example.com',
      role: 'user',
      createdAt: '2024-07-19T10:20:00.000Z',
      department: 'Product',
      location: 'New York',
      bio: 'Quinn drives roadmap strategy and works across engineering and design to define product direction.',
    },
  ],
  [
    'usr_18',
    {
      id: 'usr_18',
      name: 'Rachel Nguyen',
      email: 'rachel.nguyen@example.com',
      role: 'user',
      createdAt: '2024-03-14T09:30:00.000Z',
      department: 'Support',
      location: 'Ho Chi Minh City',
      bio: 'Rachel leads the technical support team and owns documentation quality across the platform.',
    },
  ],
  [
    'usr_19',
    {
      id: 'usr_19',
      name: 'Samuel Adeyemi',
      email: 'samuel.adeyemi@example.com',
      role: 'user',
      createdAt: '2024-08-05T13:45:00.000Z',
      department: 'Engineering',
      location: 'Accra',
      bio: 'Samuel is a DevOps engineer specializing in CI/CD pipelines, container orchestration, and cloud infrastructure.',
    },
  ],
  [
    'usr_20',
    {
      id: 'usr_20',
      name: 'Tina Hoffmann',
      email: 'tina.hoffmann@example.com',
      role: 'user',
      createdAt: '2024-09-20T08:00:00.000Z',
      department: 'Marketing',
      location: 'Berlin',
      bio: 'Tina leads product marketing and is responsible for positioning, messaging, and launch strategy.',
    },
  ],
  [
    'usr_21',
    {
      id: 'usr_21',
      name: 'Umar Sheikh',
      email: 'umar.sheikh@example.com',
      role: 'user',
      createdAt: '2024-10-01T11:30:00.000Z',
      department: 'Engineering',
      location: 'Karachi',
      bio: 'Umar is a security engineer focused on API hardening, threat modeling, and compliance.',
    },
  ],
  [
    'usr_22',
    {
      id: 'usr_22',
      name: 'Valentina Cruz',
      email: 'valentina.cruz@example.com',
      role: 'user',
      createdAt: '2024-10-14T14:00:00.000Z',
      department: 'Sales',
      location: 'Mexico City',
      bio: 'Valentina manages LATAM sales partnerships and has a strong track record in channel development.',
    },
  ],
  [
    'usr_23',
    {
      id: 'usr_23',
      name: 'William Park',
      email: 'william.park@example.com',
      role: 'user',
      createdAt: '2024-11-03T09:00:00.000Z',
      department: 'Product',
      location: 'Seoul',
      bio: 'William is a product analyst who uses data to inform feature prioritization and measure outcomes.',
    },
  ],
  [
    'usr_24',
    {
      id: 'usr_24',
      name: 'Xia Wong',
      email: 'xia.wong@example.com',
      role: 'user',
      createdAt: '2024-11-18T10:45:00.000Z',
      department: 'Design',
      location: 'Hong Kong',
      bio: 'Xia is a UX researcher who conducts usability studies and translates findings into actionable design improvements.',
    },
  ],
  [
    'usr_25',
    {
      id: 'usr_25',
      name: 'Yara El-Amin',
      email: 'yara.elamin@example.com',
      role: 'user',
      createdAt: '2024-12-01T08:30:00.000Z',
      department: 'HR',
      location: 'Cairo',
      bio: 'Yara specializes in talent acquisition and has built engineering hiring pipelines across EMEA.',
    },
  ],
]);

let counter = 26;

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
