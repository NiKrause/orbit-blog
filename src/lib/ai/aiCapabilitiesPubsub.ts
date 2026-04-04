import type { Libp2p } from 'libp2p';
import type { Message } from '@libp2p/interface-pubsub';
import {
  AI_REMOTE_PROTOCOL_VERSION,
  decodeAiCapabilitiesPayload,
  encodeAiCapabilitiesPayload,
  LE_SPACE_AI_CAPABILITIES_TOPIC,
  type AiRemoteCapabilitiesPayload,
} from './aiRemoteCapabilities.js';
import { listKlingI2vManifests } from './modelRegistry.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('p2p');

/** Latest known remote advertisement per libp2p peer id string (from signed pubsub sender only). */
const remoteCapabilitiesByPeerId = new Map<string, AiRemoteCapabilitiesPayload>();

export function getRemoteAiCapabilitiesSnapshot(): ReadonlyMap<string, AiRemoteCapabilitiesPayload> {
  return remoteCapabilitiesByPeerId;
}

function senderPeerIdString(msg: Message): string | undefined {
  if (msg.type === 'signed') {
    return msg.from.toString();
  }
  return undefined;
}

const PUBLISH_INTERVAL_MS = 60_000;

/**
 * Subscribes to {@link LE_SPACE_AI_CAPABILITIES_TOPIC}, publishes local Kling manifest ids on an
 * interval and on peer connect. Uses the existing `libp2p.services.pubsub` instance only.
 *
 * @returns disposer — call on app teardown (e.g. Svelte `onDestroy`) to avoid duplicate listeners on HMR.
 */
export function startAiCapabilitiesPubsub(libp2p: Libp2p): () => void {
  const pubsub = libp2p.services.pubsub as
    | {
        subscribe(topic: string): void;
        unsubscribe(topic: string): void;
        publish(topic: string, data: Uint8Array): Promise<unknown>;
        addEventListener(
          type: 'message',
          listener: (ev: CustomEvent<Message>) => void
        ): void;
        removeEventListener(
          type: 'message',
          listener: (ev: CustomEvent<Message>) => void
        ): void;
      }
    | undefined;

  if (!pubsub) {
    log.warn('libp2p.services.pubsub missing; AI capabilities advertisement disabled');
    return () => {};
  }

  const publishLocal = async (): Promise<void> => {
    const manifests = listKlingI2vManifests();
    const models = manifests.map((m) => m.id);
    if (models.length === 0) {
      return;
    }
    const payload = {
      protocolVersion: AI_REMOTE_PROTOCOL_VERSION,
      models,
    };
    const bytes = encodeAiCapabilitiesPayload(payload);
    try {
      await pubsub.publish(LE_SPACE_AI_CAPABILITIES_TOPIC, bytes);
    } catch {
      // No peers / mesh timing — ignore (NFR-1: never log payload)
    }
  };

  const onMessage = (evt: CustomEvent<Message>): void => {
    try {
      const msg = evt.detail;
      if (!msg || msg.topic !== LE_SPACE_AI_CAPABILITIES_TOPIC) return;
      const sender = senderPeerIdString(msg);
      if (!sender) return;

      const data = msg.data;
      if (!data || data.length === 0) return;

      const validated = decodeAiCapabilitiesPayload(data, AI_REMOTE_PROTOCOL_VERSION);
      if (!validated.ok) return;

      remoteCapabilitiesByPeerId.set(sender, validated.value);
    } catch {
      // Malformed or unexpected — never throw from hot path (AC5)
    }
  };

  pubsub.addEventListener('message', onMessage);
  pubsub.subscribe(LE_SPACE_AI_CAPABILITIES_TOPIC);

  const interval = window.setInterval(() => {
    void publishLocal();
  }, PUBLISH_INTERVAL_MS);

  const onPeerConnect = (): void => {
    void publishLocal();
  };

  const onPeerDisconnect = (evt: CustomEvent<unknown>): void => {
    try {
      const id = (evt.detail as { id?: { toString(): string } })?.id;
      if (id) {
        remoteCapabilitiesByPeerId.delete(id.toString());
      }
    } catch {
      /* ignore */
    }
  };

  libp2p.addEventListener('peer:connect', onPeerConnect);
  libp2p.addEventListener('peer:disconnect', onPeerDisconnect);

  void publishLocal();

  return () => {
    window.clearInterval(interval);
    libp2p.removeEventListener('peer:connect', onPeerConnect);
    libp2p.removeEventListener('peer:disconnect', onPeerDisconnect);
    pubsub.removeEventListener('message', onMessage);
    try {
      pubsub.unsubscribe(LE_SPACE_AI_CAPABILITIES_TOPIC);
    } catch {
      /* ignore */
    }
  };
}
