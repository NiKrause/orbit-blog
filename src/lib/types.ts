export interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  date: string;
  comments: Comment[];
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
  date: string;
}

export type Category = 'Bitcoin' | 'Ethereum' | 'DeFi' | 'NFTs' | 'Trading';

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
  language?: string;        // The language of this post
  translatedFrom?: string;  // The source language if this is a translation
  originalPostId?: string;  // Reference to the original post if this is a translation
}
