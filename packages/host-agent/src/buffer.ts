const MAX_BUFFER_SIZE = 100 * 1024; // 100KB ring buffer

export class OutputBuffer {
  private chunks: Buffer[] = [];
  private totalSize = 0;

  push(data: Buffer): void {
    this.chunks.push(data);
    this.totalSize += data.length;

    // Trim oldest chunks if over limit
    while (this.totalSize > MAX_BUFFER_SIZE && this.chunks.length > 1) {
      const removed = this.chunks.shift()!;
      this.totalSize -= removed.length;
    }
  }

  getAll(): Buffer {
    return Buffer.concat(this.chunks);
  }

  clear(): void {
    this.chunks = [];
    this.totalSize = 0;
  }

  get size(): number {
    return this.totalSize;
  }
}
