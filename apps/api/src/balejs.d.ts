declare module "balejs" {
  export class Client {
    constructor(auth: string, options?: { sessionDir?: string; sessionName?: string });
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    get_me(): Promise<{ username?: string; name?: string; id?: number }>;
    search_username(query: string): Promise<{ group?: { id?: string }; user?: { id?: string } }>;
    get_chat(chatId: string): Promise<{ id?: string } | undefined>;
    load_history(chatId: string, fromDate?: number, limit?: number): Promise<Array<{ date?: number; content?: string; text?: string; caption?: string }>>;
  }
}
