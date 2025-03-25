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
    date: string;
}
//# sourceMappingURL=types.d.ts.map