export interface INotificationAdapter {
  sendVerificationCode(destination: string, code: string): Promise<void>;
}
