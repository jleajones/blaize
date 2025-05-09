/**
 * BlaizeJS Type System
 *
 * Types and utilities for type inference and validation.
 */

import type { ZodSchema } from 'zod';

/**
 * Extract type from schema
 */
export type InferSchemaType<T extends ZodSchema<any>> = T extends ZodSchema<infer U> ? U : never;

/**
 * Convert path pattern to type (e.g., '/users/:id' => { id: string })
 */
export type PathParams<T extends string> = T extends `${string}:${infer Param}/${infer Rest}`
  ? { [K in Param]: string } & PathParams<Rest>
  : T extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : T extends `${string}[${infer Param}]/${infer Rest}`
      ? { [K in Param]: string } & PathParams<Rest>
      : T extends `${string}[${infer Param}]`
        ? { [K in Param]: string }
        : object;

/**
 * Route parameter types
 */
export type RouteParams<T extends string | Record<string, any>> = T extends string
  ? PathParams<T>
  : T;

/**
 * HTTP status codes
 */
export enum HttpStatus {
  // 2xx Success
  OK = 200,
  Created = 201,
  Accepted = 202,
  NoContent = 204,

  // 3xx Redirection
  MovedPermanently = 301,
  Found = 302,
  SeeOther = 303,
  NotModified = 304,
  TemporaryRedirect = 307,
  PermanentRedirect = 308,

  // 4xx Client Errors
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  Conflict = 409,
  Gone = 410,
  UnprocessableEntity = 422,
  TooManyRequests = 429,

  // 5xx Server Errors
  InternalServerError = 500,
  NotImplemented = 501,
  BadGateway = 502,
  ServiceUnavailable = 503,
  GatewayTimeout = 504,
}

/**
 * Common content types
 */
export enum ContentType {
  Json = 'application/json',
  Text = 'text/plain',
  Html = 'text/html',
  Xml = 'application/xml',
  FormUrlEncoded = 'application/x-www-form-urlencoded',
  FormData = 'multipart/form-data',
  OctetStream = 'application/octet-stream',
  Css = 'text/css',
  Javascript = 'application/javascript',
  EventStream = 'text/event-stream',
}
