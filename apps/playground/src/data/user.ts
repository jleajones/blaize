/**
 * Sample User Data for Playground App
 *
 * In-memory user storage with realistic sample data for testing
 */

export interface User {
  id: string;
  name: string;
  email: string;
  bio?: string;
  avatar: {
    filename: string;
    mimetype: string;
    size: number;
    url: string;
  };
  coverPhoto?: {
    filename: string;
    mimetype: string;
    size: number;
    url: string;
  };
  role: 'admin' | 'user' | 'moderator';
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

/**
 * In-memory user storage
 *
 * In a real application, this would be a database.
 * For the playground, we use a Map for O(1) lookups.
 */
export const users = new Map<string, User>();

/**
 * Sample users with realistic data
 */
export const SAMPLE_USERS: User[] = [
  {
    id: 'user_001',
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    bio: 'Full-stack developer specializing in TypeScript and React. Building the future of web applications.',
    avatar: {
      filename: 'sarah-avatar.jpg',
      mimetype: 'image/jpeg',
      size: 245678,
      url: 'https://storage.example.com/avatars/sarah-avatar.jpg',
    },
    coverPhoto: {
      filename: 'sarah-cover.jpg',
      mimetype: 'image/jpeg',
      size: 892456,
      url: 'https://storage.example.com/covers/sarah-cover.jpg',
    },
    role: 'admin',
    createdAt: '2024-01-10T08:30:00.000Z',
    updatedAt: '2024-01-15T14:22:00.000Z',
    isActive: true,
  },
  {
    id: 'user_002',
    name: 'Marcus Johnson',
    email: 'marcus.j@example.com',
    bio: 'DevOps engineer passionate about automation and cloud infrastructure. AWS certified solutions architect.',
    avatar: {
      filename: 'marcus-profile.png',
      mimetype: 'image/png',
      size: 189234,
      url: 'https://storage.example.com/avatars/marcus-profile.png',
    },
    role: 'user',
    createdAt: '2024-01-12T10:15:00.000Z',
    updatedAt: '2024-01-18T09:45:00.000Z',
    isActive: true,
  },
  {
    id: 'user_003',
    name: 'Elena Rodriguez',
    email: 'elena.rodriguez@example.com',
    bio: 'UX/UI designer with a love for minimalist design and accessibility. Creating inclusive digital experiences.',
    avatar: {
      filename: 'elena-photo.jpg',
      mimetype: 'image/jpeg',
      size: 312456,
      url: 'https://storage.example.com/avatars/elena-photo.jpg',
    },
    coverPhoto: {
      filename: 'elena-banner.png',
      mimetype: 'image/png',
      size: 1245678,
      url: 'https://storage.example.com/covers/elena-banner.png',
    },
    role: 'moderator',
    createdAt: '2024-01-08T14:20:00.000Z',
    updatedAt: '2024-01-19T11:30:00.000Z',
    isActive: true,
  },
  {
    id: 'user_004',
    name: 'James Wilson',
    email: 'james.wilson@example.com',
    bio: 'Backend engineer focused on scalable microservices. GraphQL enthusiast and open-source contributor.',
    avatar: {
      filename: 'james-pic.jpg',
      mimetype: 'image/jpeg',
      size: 278901,
      url: 'https://storage.example.com/avatars/james-pic.jpg',
    },
    role: 'user',
    createdAt: '2024-01-14T16:45:00.000Z',
    updatedAt: '2024-01-14T16:45:00.000Z',
    isActive: true,
  },
  {
    id: 'user_005',
    name: 'Priya Patel',
    email: 'priya.patel@example.com',
    bio: 'Data scientist and ML engineer. Working on cutting-edge AI solutions for healthcare applications.',
    avatar: {
      filename: 'priya-avatar.png',
      mimetype: 'image/png',
      size: 198765,
      url: 'https://storage.example.com/avatars/priya-avatar.png',
    },
    coverPhoto: {
      filename: 'priya-cover.jpg',
      mimetype: 'image/jpeg',
      size: 756432,
      url: 'https://storage.example.com/covers/priya-cover.jpg',
    },
    role: 'user',
    createdAt: '2024-01-05T09:00:00.000Z',
    updatedAt: '2024-01-17T13:15:00.000Z',
    isActive: true,
  },
  {
    id: 'user_006',
    name: 'Alex Thompson',
    email: 'alex.t@example.com',
    bio: 'Mobile developer building cross-platform apps with React Native. iOS and Android expert.',
    avatar: {
      filename: 'alex-profile.jpg',
      mimetype: 'image/jpeg',
      size: 234567,
      url: 'https://storage.example.com/avatars/alex-profile.jpg',
    },
    role: 'user',
    createdAt: '2024-01-11T11:30:00.000Z',
    updatedAt: '2024-01-16T10:20:00.000Z',
    isActive: false, // Inactive user for testing
  },
  {
    id: 'user_007',
    name: 'Yuki Tanaka',
    email: 'yuki.tanaka@example.com',
    bio: 'Security engineer specializing in application security and penetration testing. CISSP certified.',
    avatar: {
      filename: 'yuki-avatar.png',
      mimetype: 'image/png',
      size: 167890,
      url: 'https://storage.example.com/avatars/yuki-avatar.png',
    },
    coverPhoto: {
      filename: 'yuki-banner.jpg',
      mimetype: 'image/jpeg',
      size: 934567,
      url: 'https://storage.example.com/covers/yuki-banner.jpg',
    },
    role: 'moderator',
    createdAt: '2024-01-07T15:10:00.000Z',
    updatedAt: '2024-01-18T16:40:00.000Z',
    isActive: true,
  },
  {
    id: 'user_008',
    name: 'Sofia Martinez',
    email: 'sofia.martinez@example.com',
    bio: 'Product manager with a technical background. Bridging the gap between engineering and business.',
    avatar: {
      filename: 'sofia-photo.jpg',
      mimetype: 'image/jpeg',
      size: 289012,
      url: 'https://storage.example.com/avatars/sofia-photo.jpg',
    },
    role: 'user',
    createdAt: '2024-01-13T12:25:00.000Z',
    updatedAt: '2024-01-19T08:55:00.000Z',
    isActive: true,
  },
  {
    id: 'user_009',
    name: 'David Kim',
    email: 'david.kim@example.com',
    bio: 'Frontend architect passionate about performance optimization and modern web standards.',
    avatar: {
      filename: 'david-avatar.png',
      mimetype: 'image/png',
      size: 156789,
      url: 'https://storage.example.com/avatars/david-avatar.png',
    },
    coverPhoto: {
      filename: 'david-cover.png',
      mimetype: 'image/png',
      size: 1123456,
      url: 'https://storage.example.com/covers/david-cover.png',
    },
    role: 'user',
    createdAt: '2024-01-09T13:40:00.000Z',
    updatedAt: '2024-01-15T17:20:00.000Z',
    isActive: true,
  },
  {
    id: 'user_010',
    name: 'Amara Okafor',
    email: 'amara.okafor@example.com',
    bio: 'Tech lead and mentor. Building high-performing engineering teams and scalable platforms.',
    avatar: {
      filename: 'amara-profile.jpg',
      mimetype: 'image/jpeg',
      size: 223456,
      url: 'https://storage.example.com/avatars/amara-profile.jpg',
    },
    role: 'admin',
    createdAt: '2024-01-06T10:05:00.000Z',
    updatedAt: '2024-01-19T12:10:00.000Z',
    isActive: true,
  },
];

/**
 * Initialize the in-memory user store with sample data
 */
export function initializeUserStore(): void {
  SAMPLE_USERS.forEach(user => {
    users.set(user.id, user);
  });
  console.log(`Initialized user store with ${users.size} sample users`);
}

/**
 * Get all users
 */
export function getAllUsers(): User[] {
  return Array.from(users.values());
}

/**
 * Get active users only
 */
export function getActiveUsers(): User[] {
  return Array.from(users.values()).filter(user => user.isActive);
}

/**
 * Get user by ID
 */
export function getUserById(id: string): User | undefined {
  return users.get(id);
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): User | undefined {
  return Array.from(users.values()).find(user => user.email === email);
}

/**
 * Create a new user
 */
export function addUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
  const id = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const now = new Date().toISOString();

  const newUser: User = {
    ...userData,
    id,
    createdAt: now,
    updatedAt: now,
  };

  users.set(id, newUser);
  return newUser;
}

/**
 * Update an existing user
 */
export function updateUser(
  id: string,
  updates: Partial<Omit<User, 'id' | 'createdAt'>>
): User | undefined {
  const user = users.get(id);
  if (!user) {
    return undefined;
  }

  const updatedUser: User = {
    ...user,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  users.set(id, updatedUser);
  return updatedUser;
}

/**
 * Delete a user
 */
export function deleteUser(id: string): boolean {
  return users.delete(id);
}

/**
 * Search users by name or email
 */
export function searchUsers(query: string): User[] {
  const lowerQuery = query.toLowerCase();
  return Array.from(users.values()).filter(
    user =>
      user.name.toLowerCase().includes(lowerQuery) || user.email.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get users by role
 */
export function getUsersByRole(role: User['role']): User[] {
  return Array.from(users.values()).filter(user => user.role === role);
}

/**
 * Get user statistics
 */
export function getUserStats() {
  const allUsers = Array.from(users.values());

  return {
    total: allUsers.length,
    active: allUsers.filter(u => u.isActive).length,
    inactive: allUsers.filter(u => !u.isActive).length,
    byRole: {
      admin: allUsers.filter(u => u.role === 'admin').length,
      moderator: allUsers.filter(u => u.role === 'moderator').length,
      user: allUsers.filter(u => u.role === 'user').length,
    },
    withCoverPhoto: allUsers.filter(u => u.coverPhoto).length,
  };
}

// Auto-initialize on import (optional - comment out if you want manual init)
initializeUserStore();
