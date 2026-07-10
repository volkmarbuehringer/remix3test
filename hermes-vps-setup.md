# Hermes VPS Setup

## 1. Installieren

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
```

## 2. Provider einrichten

```bash
hermes model
# DeepSeek v4 Flash auswählen
```

## 3. Gateway-Konfiguration

```bash
hermes config set platforms.webhook.enabled true
hermes config set platforms.webhook.extra.host "127.0.0.1"
hermes config set platforms.webhook.extra.port 8644
hermes config set platforms.webhook.extra.secret ""
```

## 4. Terminal-Tool freischalten

```bash
hermes config set platform_toolsets.webhook '["terminal", "web"]'
```

Danach `~/.hermes/config.yaml` prüfen — unter `platform_toolsets:` muss stehen:

```yaml
webhook:
  - terminal
  - web
```

## 5. Gateway starten

```bash
hermes gateway run
```

Als systemd-Service (optional):

```bash
hermes gateway install
systemctl --user enable --now hermes-gateway
sudo loginctl enable-linger $USER
```

## 6. Webhook-Subscription

```bash
hermes webhook subscribe app-webhook \
  --secret INSECURE_NO_AUTH \
  --prompt "Verarbeite den Webhook #{id}
Daten: {payload}
Callback an: {callbackUrl}

Analysiere die empfangenen Daten. POSTe dann das Ergebnis als JSON zurück an {callbackUrl}.

curl -X POST \"{callbackUrl}\" \
  -H \"Content-Type: application/json\" \
  -d '{\"id\":\"{id}\",\"status\":\"completed|needs_review|error\",\"needs_human\":true|false,\"reason\":\"...\",\"summary\":\"...\"}'

Status-Regeln:
- \"completed\" = alles ok
- \"needs_review\" = Daten unvollständig (needs_human: true)
- \"error\" = technischer Fehler

Prüfe ob curl erfolgreich war (HTTP 200)."
```

## 7. Prüfen

```bash
curl http://127.0.0.1:8644/health
# → {"status": "ok", "platform": "webhook"}
```

## Webhook-URL für deine App

```
POST http://127.0.0.1:8644/webhooks/app-webhook
Content-Type: application/json

{
  "id": "deine-echte-uuid",
  "callbackUrl": "http://127.0.0.1:44100/callback",
  "payload": { ... }
}
```

## Gateway steuern

```bash
systemctl --user stop hermes-gateway    # stoppen
systemctl --user start hermes-gateway   # starten
systemctl --user status hermes-gateway  # status
```
