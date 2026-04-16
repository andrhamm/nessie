import type { MemoryEntry, MemoryStore } from "./memory";

export class InMemoryStore implements MemoryStore {
  private memories: MemoryEntry[] = [];

  async save(speaker: string, content: string): Promise<void> {
    this.memories.push({
      speaker,
      content,
      timestamp: Date.now(),
    });
  }

  async recall(query: string, speaker?: string): Promise<string[]> {
    const lowerQuery = query.toLowerCase();
    return this.memories
      .filter((m) => {
        const matchesQuery = m.content.toLowerCase().includes(lowerQuery);
        const matchesSpeaker = speaker ? m.speaker === speaker : true;
        return matchesQuery && matchesSpeaker;
      })
      .map((m) => m.content);
  }

  async getSpeakerContext(_deviceId: string): Promise<string> {
    if (this.memories.length === 0) {
      return "";
    }

    const bySpeaker = new Map<string, string[]>();
    for (const memory of this.memories) {
      const existing = bySpeaker.get(memory.speaker);
      if (existing) {
        existing.push(memory.content);
      } else {
        bySpeaker.set(memory.speaker, [memory.content]);
      }
    }

    const lines: string[] = ["## Memories"];
    for (const [speaker, memories] of bySpeaker) {
      const label = speaker || "general";
      for (const content of memories) {
        lines.push(`- [${label}] ${content}`);
      }
    }

    return lines.join("\n");
  }

  /** Visible for testing. Returns a copy of all stored memories. */
  getAll(): ReadonlyArray<MemoryEntry> {
    return [...this.memories];
  }

  /** Visible for testing. Clears all memories. */
  clear(): void {
    this.memories = [];
  }
}
