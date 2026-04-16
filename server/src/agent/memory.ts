export interface MemoryEntry {
  speaker: string;
  content: string;
  timestamp: number;
}

export interface MemoryStore {
  /** Save a memory about a speaker or general topic. */
  save(speaker: string, content: string): Promise<void>;

  /** Search memories by substring match, optionally filtered by speaker. */
  recall(query: string, speaker?: string): Promise<string[]>;

  /** Get formatted speaker context string for system prompt injection. */
  getSpeakerContext(deviceId: string): Promise<string>;
}
