<!-- Context: development/remix3/packages/concepts | Priority: medium | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: File Storage S3

**Purpose**: S3 backend for `remix/file-storage`. Works with AWS S3 and S3-compatible providers (MinIO, LocalStack).

**Key Points**:
- S3-compatible API (AWS, MinIO, LocalStack)
- Preserves File metadata (name, type, lastModified)
- Uses `aws4fetch` for SigV4 signing
- Works with any S3-compatible service

**Minimal Example**:
```ts
import { createS3FileStorage } from 'remix/file-storage-s3'

let storage = createS3FileStorage({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  bucket: 'my-app-uploads',
  region: 'us-east-1',
})

await storage.set('uploads/hello.txt', new File(['hello'], 'hello.txt'))
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/file-storage-s3