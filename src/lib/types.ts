export interface Post {
  _id: string;
  title: string;
  content: string;
  category: string;
  date?: number;
  createdAt?: number;
  updatedAt?: number;
  identity?: string;
  mediaIds?: string[];
  language?: string;
  translatedFrom?: string;
  originalPostId?: string;
  comments?: Comment[];
}

export interface Comment {
  _id: string;
  postId: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface RemoteDB {
  _id: string;
  name: string;
  address: string;
  postsAddress?: string;
  commentsAddress?: string;
  mediaAddress?: string;
  fetchLater: boolean;
  date: string;
  postsCount?: number;
  commentsCount?: number;
  mediaCount?: number;
  access?: {
    write?: string[];
  };
  pinnedToVoyager?: boolean;
}

export type Category = string;

export interface BlogPost {
  _id: string;
  title: string;
  content: string;
  category: string;
  createdAt?: number;
  updatedAt?: number;
  date?: number;
  identity?: string;
  mediaIds?: string[];
  language?: string;
  translatedFrom?: string;
  originalPostId?: string;
}

export interface Media {
  cid: string;
  name: string;
  type: string;
  size: number;
  url?: string;
}

export interface DatabaseEntry<T> {
  _id: string;
  value: T;
  identity?: string;
}

export interface DatabaseUpdate {
  payload: {
    op: 'PUT' | 'DEL';
    key?: string;
    value?: any;
  };
}

export interface Helia {
  libp2p: Libp2p;
}

export interface Libp2p {
  peerId: {
    toString: () => string;
  };
  getConnections: () => Connection[];
  addEventListener: (event: string, handler: (event: any) => void) => void;
  removeEventListener: (event: string, handler: (event: any) => void) => void;
  peerStore: {
    delete: (peer: any) => Promise<void>;
  };
}

export interface Connection {
  remotePeer: {
    toString: () => string;
  };
  remoteAddr: {
    toString: () => string;
  };
  status: string;
  streams: any[];
  direction: string;
  close: () => Promise<void>;
}

export interface OrbitDB {
  open: (name: string, options?: any) => Promise<any>;
  identity: {
    id: string;
  };
  address: {
    toString: () => string;
  };
  access?: {
    write?: string[];
  };
  put: (entry: any) => Promise<void>;
  get: (key: string) => Promise<any>;
  all: () => Promise<any[]>;
  events: {
    on: (event: string, handler: (entry: DatabaseUpdate) => void) => void;
  };
}

export interface Voyager {
  add: (address: string) => Promise<any>;
  remove: (address: string) => Promise<void>;
  orbitdb: OrbitDB;
}
