import { ConflictError, file } from 'blaizejs';
import { z } from 'zod';

import { appRouter } from '../../app-router';
import { addUser, getActiveUsers, getAllUsers, getUserByEmail } from '../../data/user';

export const getUsers = appRouter.get({
  schema: {
    response: z.object({
      users: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          bio: z.string().optional(),
          avatar: z.object({
            filename: z.string(),
            mimetype: z.string(),
            size: z.number(),
            url: z.string(),
          }),
          role: z.enum(['admin', 'user', 'moderator']),
          isActive: z.boolean(),
        })
      ),
      count: z.number(),
    }),
  },
  handler: async ({ ctx, logger }) => {
    const { active } = ctx.request.query;
    logger.info('Fetching users', { activeOnly: active });

    const users = active ? getActiveUsers() : getAllUsers();
    return {
      users,
      count: users.length,
    };
  },
});

export const createUser = appRouter.post({
  schema: {
    response: z.object({
      message: z.string(),
      user: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        bio: z.string().optional(),
        avatar: z.object({
          filename: z.string(),
          mimetype: z.string(),
          size: z.number(),
          url: z.string(), // Mock URL where the avatar would be stored
        }),
        coverPhoto: z
          .object({
            filename: z.string(),
            mimetype: z.string(),
            size: z.number(),
            url: z.string(),
          })
          .optional(),
        role: z.enum(['admin', 'user', 'moderator']),
        createdAt: z.string(),
        updatedAt: z.string(),
        isActive: z.boolean(),
      }),
    }),
    body: z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Invalid email address'),
      bio: z.string().optional(),
      role: z.enum(['admin', 'user', 'moderator']).default('user'),
    }),
    files: z.object({
      avatar: file({
        maxSize: '5MB',
        accept: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      }),
      coverPhoto: file({
        maxSize: '10MB',
        accept: ['image/*'],
      }).optional(),
    }),
  },
  handler: async ({ ctx, logger }) => {
    logger.info('Creating new user with avatar', {
      name: ctx.request.body.name,
      email: ctx.request.body.email,
      hasAvatar: !!ctx.request.files.avatar,
      hasCoverPhoto: !!ctx.request.files.coverPhoto,
    });

    // Extract validated body and files
    const { name, email, bio, role } = ctx.request.body;
    const { avatar, coverPhoto } = ctx.request.files;

    // Check if email already exists
    const existingUser = getUserByEmail(email);
    if (existingUser) {
      logger.warn('User creation failed - email already exists', { email });
      throw new ConflictError('A user with this email already exists', {
        conflictType: 'duplicate_key',
        field: 'email',
        providedValue: email,
        conflictingResource: {
          id: existingUser.id,
          email: existingUser.email,
        },
        resolution: 'Provide a different email address',
      });
    }

    // Log avatar details
    logger.info('Avatar details', {
      filename: avatar.originalname,
      mimetype: avatar.mimetype,
      size: avatar.size,
      encoding: avatar.encoding,
    });

    // In a real application, you would:
    // 1. Save the file to cloud storage (S3, CloudFlare R2, etc.)
    // 2. Generate a public URL
    // 3. Store metadata in database
    // 4. Maybe resize/optimize the image
    // 5. Generate thumbnails
    // For this demo, we'll simulate the storage process
    const timestamp = Date.now();
    const avatarUrl = `https://storage.example.com/avatars/${timestamp}-${avatar.originalname}`;
    let coverPhotoData:
      | { filename: string; mimetype: string; size: number; url: string }
      | undefined;

    if (coverPhoto) {
      logger.info('Cover photo details', {
        filename: coverPhoto.originalname,
        mimetype: coverPhoto.mimetype,
        size: coverPhoto.size,
      });

      coverPhotoData = {
        filename: coverPhoto.originalname,
        mimetype: coverPhoto.mimetype,
        size: coverPhoto.size,
        url: `https://storage.example.com/covers/${timestamp}-${coverPhoto.originalname}`,
      };
    }

    // Simulate database save
    const newUser = addUser({
      name,
      email,
      role,
      avatar: {
        filename: avatar.originalname,
        mimetype: avatar.mimetype,
        size: avatar.size,
        url: avatarUrl,
      },
      isActive: true,
      ...(bio !== undefined ? { bio } : {}),
      ...(coverPhotoData !== undefined ? { coverPhoto: coverPhotoData } : {}),
    });

    // Publish event for other services
    ctx.services.queue.add('emails', 'sendWelcomeEmail', {
      email,
      name,
    });

    logger.info('User created successfully', {
      userId: newUser.id,
      avatarUrl,
      coverPhotoUrl: coverPhotoData?.url,
    });

    // Return response
    return {
      message: 'User created successfully with avatar',
      user: newUser,
    };
  },
});
