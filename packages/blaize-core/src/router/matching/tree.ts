import type { HttpMethod, RouteMethodOptions, RouteNode } from '@blaize-types/router';

/**
 * Create a route tree for efficient route matching
 */
export function createRouteTree() {
  // Create root node
  const root: RouteNode = {
    segment: '',
    paramName: null,
    isWildcard: false,
    children: [],
    handlers: {},
    pattern: null,
  };

  return {
    /**
     * Add a route to the tree
     */
    add(path: string, method: HttpMethod, handler: RouteMethodOptions): void {
      // Normalize path
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }

      // Split path into segments
      const segments = path.split('/').filter(Boolean);

      // Handle root route special case
      if (segments.length === 0) {
        root.handlers[method] = handler;
        return;
      }

      let currentNode = root;

      // Navigate/build the tree for this path
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]!;
        const isLastSegment = i === segments.length - 1;

        // Check if this is a parameter segment
        const isParam = segment.startsWith(':');
        const isWildcard = segment === '*';
        const paramName = isParam ? segment.substring(1) : null;

        // Look for an existing matching node
        let matchingNode = currentNode.children.find(
          child =>
            child.segment === segment ||
            (child.isWildcard && isWildcard) ||
            (child.paramName !== null && isParam && child.paramName === paramName)
        );

        // Create a new node if no matching node was found
        if (!matchingNode) {
          matchingNode = {
            segment,
            paramName,
            isWildcard,
            children: [],
            handlers: {},
            pattern: isParam || isWildcard ? /^.*$/ : null,
          };

          currentNode.children.push(matchingNode);
        }

        // Move to the matching node
        currentNode = matchingNode;

        // If this is the last segment, add the handler
        if (isLastSegment) {
          currentNode.handlers[method] = handler;
        }
      }
    },

    /**
     * Match a path to a route in the tree
     */
    match(
      path: string,
      method: HttpMethod
    ): { handler: RouteMethodOptions; params: Record<string, string> } | null {
      // Normalize path
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }

      // Root path special case
      if (path === '/') {
        const handler = root.handlers[method];
        return handler ? { handler, params: {} } : null;
      }

      // Split path into segments
      const segments = path.split('/').filter(Boolean);

      // Track params during traversal
      const params: Record<string, string> = {};

      /**
       * Recursive function to match path segments
       */
      function matchNode(node: RouteNode, segmentIndex: number): RouteMethodOptions | null {
        // If we've matched all segments, check for a handler
        if (segmentIndex >= segments.length) {
          return node.handlers[method] || null;
        }

        const segment = segments[segmentIndex];

        // Try to match exact segment first
        for (const child of node.children) {
          // Exact match
          if (child.segment === segment || child.segment === segment) {
            const result = matchNode(child, segmentIndex + 1);
            if (result) return result;
          }
        }

        // Try to match parameter nodes
        for (const child of node.children) {
          if (child.paramName) {
            // Store parameter value
            params[child.paramName] = segment!;

            // Continue matching with the next segment
            const result = matchNode(child, segmentIndex + 1);
            if (result) return result;

            // Remove parameter if no match was found
            delete params[child.paramName];
          }
        }

        // Try to match wildcard nodes
        for (const child of node.children) {
          if (child.isWildcard) {
            // Store remaining path segments
            params['*'] = segments.slice(segmentIndex).join('/');

            // We've matched all segments with a wildcard
            return child.handlers[method] || null;
          }
        }

        // No match found
        return null;
      }

      // Start matching from the root
      const handler = matchNode(root, 0);

      return handler ? { handler, params } : null;
    },
  };
}
