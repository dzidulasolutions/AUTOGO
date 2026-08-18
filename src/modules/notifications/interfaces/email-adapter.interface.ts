export interface IEmailAdapter {
  send(to: string, subject: string, htmlContent: string): Promise<void>;
}
