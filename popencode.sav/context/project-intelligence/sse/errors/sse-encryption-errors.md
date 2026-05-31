<!-- Context: sse/errors/sse-encryption-errors | Priority: medium | Version: 1.0 | Updated: 2026-03-24 -->

# SSE Encryption Errors

Common encryption/decryption issues and solutions for SSE messaging.

## Common Errors

### Wrong Key Error

**Symptom**: `DOMException: The operation failed for an operation-specific reason`

**Cause**: Key used for decryption differs from key used for encryption.

**Solution**:

```typescript
try {
  decrypted = await decrypt(encryptedText, password)
} catch (error) {
  // Key is wrong - prompt user for correct key
  showError('Wrong encryption key')
}
```

### Corrupted Data Error

**Symptom**: Decryption returns garbage or throws

**Cause**: Base64 decoding failed or data truncated in transit

**Solution**: Check message integrity before decryption

```typescript
if (combined.length < 29) {
  // 16 (salt) + 12 (IV) + 1 (min ciphertext)
  throw new Error('Message too short')
}
```

### "Encrypted - no key" Displayed

**Symptom**: User sees `[encrypted - no key]` instead of plaintext

**Cause**: No encryption key entered in UI

**Solution**: Enter encryption key in the Decrypt input field and click Decrypt

### "Encrypted - wrong key or corrupted" Displayed

**Symptom**: Message stays encrypted even after entering key

**Cause**: Wrong key entered, or message was encrypted with different key

**Solution**: Try a different key. If multiple keys exist, try each one.

## Error Flow

```
User receives message → Has key?
├─ NO → Show "[encrypted - no key]"
└─ YES → Attempt decrypt
         ├─ SUCCESS → Show plaintext, ACK deletion
         └─ FAIL → Show "[encrypted - wrong key]"
                   └─ User enters different key → Retry
```

## Client-Side Error Handling

```typescript
eventSource.addEventListener('offline', async (e) => {
  let data = JSON.parse(e.data)

  if (!data.encrypted) {
    // Plaintext - display directly
    displayMessage(data.message)
    return
  }

  if (!encryptionKey) {
    // No key available
    data.message = '[encrypted - no key]'
    displayMessage(data.message)
    return
  }

  try {
    let decrypted = await decrypt(data.message, encryptionKey)
    if (decrypted.includes('[encrypted')) {
      // Decryption failed
      displayMessage(decrypted) // Shows "[encrypted - wrong key]"
    } else {
      // Success - acknowledge
      displayMessage(decrypted)
      await fetch(`/messages/ack?ids=${data.msgId}`, { method: 'POST' })
    }
  } catch (error) {
    displayMessage('[encrypted - wrong key]')
  }
})
```

## Debugging Tips

1. **Check console logs**: Encryption functions log `[DECRYPT]` messages
2. **Verify key length**: Keys should be 4+ characters
3. **Test with known plaintext**: Encrypt "test" and decrypt with same key
4. **Check localStorage**: Key may persist from previous session

## Recovery Strategies

| Scenario            | Recovery                                       |
| ------------------- | ---------------------------------------------- |
| Key lost            | Message cannot be decrypted - user must delete |
| Wrong key           | Try different key or message lost              |
| Corrupted           | Message cannot be decrypted - user must delete |
| Offline with no key | Enter key later via Decrypt button             |

## 📂 Codebase References

**Client encryption**: `demos/sse/app/assets/message-stream.tsx` (decrypt function line ~140)
**Offline handler**: `demos/sse/app/assets/message-stream.tsx` (offline event listener)

## Related

- `concepts/e2e-encryption.md` - Encryption concept
- `lookup/offline-message-flow.md` - Offline message lifecycle
