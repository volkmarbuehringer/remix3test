export interface NotificationData {
  recipient: string
  type: 'confirmation' | 'reminder' | 'cancellation'
  appointmentId?: number
  resourceName?: string
  date?: number
  timeRange?: string
  customerName?: string
  title?: string
}

export interface NotificationResult {
  sent: boolean
  provider: string
  error?: string
}

export interface NotificationSender {
  send(recipient: string, type: NotificationData['type'], data: NotificationData): Promise<NotificationResult>
}

export const consoleNotificationSender: NotificationSender = {
  async send(recipient, type, data) {
    console.log('[Notification]', JSON.stringify({
      recipient,
      type,
      appointmentId: data.appointmentId,
      resourceName: data.resourceName,
      date: data.date,
      timeRange: data.timeRange,
      customerName: data.customerName,
      title: data.title,
      timestamp: new Date().toISOString(),
    }))
    return { sent: true, provider: 'console' }
  },
}
