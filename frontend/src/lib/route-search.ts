/** Default search params for routes that declare required validateSearch fields. */
export const ROUTE_SEARCH = {
  feed: { composer: undefined },
  register: { ref: undefined },
  messenger: { chat: undefined },
  subscription: { payment: undefined, uuid: undefined, provider: undefined },
} as const;
