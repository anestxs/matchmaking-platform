import { ConflictException } from '@nestjs/common';

export type OAuthLoginErrorReason = 'email_taken' | 'email_missing';

export class OAuthLoginException extends ConflictException {
  constructor(
    readonly reason: OAuthLoginErrorReason,
    message: string,
  ) {
    super(message);
  }
}
