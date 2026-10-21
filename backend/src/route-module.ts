/**
 * The shape of a src/routes/**\/route.ts module. Handlers are plain Web
 * standard functions — `Request` in, `Response` out — so they carry no
 * framework dependency and can move between Node and an edge runtime.
 */
// `any`: each route narrows params to its own segments (`{ id: string }`), and
// the router only knows them as a string map at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteContext = { params: Promise<any> };
export type RouteHandler = (req: Request, ctx: RouteContext) => Response | Promise<Response>;

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type Method = (typeof METHODS)[number];

export type RouteModule = Partial<Record<Method, RouteHandler>> & Record<string, unknown>;
