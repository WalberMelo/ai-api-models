import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// This guard uses the local strategy defined in LocalStrategy to authenticate users with a username and password.

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
