export interface Comment {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  comments: Comment[];
  category: string;
}

export type Category = 'Technology' | 'Programming' | 'Design' | 'Other';