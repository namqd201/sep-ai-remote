import { Request, Response, NextFunction } from 'express';
import { PairRequest, PairResponse, JwtPayload } from '@sep-ai/shared';
export interface AuthenticatedRequest extends Request {
    user?: JwtPayload;
}
export declare class AuthService {
    pair(req: PairRequest): PairResponse;
    verify(token: string): JwtPayload | null;
    authenticateMiddleware: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
}
export declare const authService: AuthService;
//# sourceMappingURL=authService.d.ts.map