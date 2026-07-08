import Hyperswarm from "hyperswarm";

/**
 * Join the P2P swarm for a room and replicate the room's Corestore on every connection.
 * Peers rendezvous on the base discovery key (derived from the room key that the host shares
 * out-of-band). PRD note: first DHT bootstrap can take 15–45s cold — pre-warm before a demo.
 */
export function joinRoom(room, { onPeer } = {}) {
  const swarm = new Hyperswarm();
  swarm.on("connection", (conn, info) => {
    room.replicate(conn);
    if (onPeer) onPeer(conn, info);
  });
  const discovery = swarm.join(room.base.discoveryKey, { server: true, client: true });
  return {
    swarm,
    flushed: () => discovery.flushed(),
    destroy: () => swarm.destroy(),
  };
}
