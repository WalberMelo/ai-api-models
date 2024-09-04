// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

export type User = any;

@Injectable()
export class UsersService {
  private readonly users = [
    {
      userId: 1,
      username: process.env.USER_NAME,
      password: process.env.USER_PASSWORD_HASH,
    },
  ];

  async findOne(username: string): Promise<User | undefined> {
    return this.users.find((user) => user.username === username);
  }

  async validateUserPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
