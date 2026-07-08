// Turn opaque production errors into a clear message. Next sanitizes thrown server-action errors
// in production ("an error occurred in the server components render… digest…"), which is useless
// to a user. On the public instance the real cause is almost always "no wallet on this node".
export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/server components render|omitted in production|digest|An unexpected response|Connection closed/i.test(m)) {
    return "This action runs on your own local Whisl instance. The public site is read-only.";
  }
  if (/WHISL_WALLET_SEED|no wallet/i.test(m)) {
    return "This instance has no wallet. Run your own Whisl node with a funded wallet to do this.";
  }
  return m;
}
