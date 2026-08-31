export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  branchId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}
