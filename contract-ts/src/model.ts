import * as borsh from 'borsh';

export const POINT_ONE = '100000000000000000000000';

export class PostedMessage {
  premium: boolean;
  sender: string;
  text: string;

  constructor({ premium, sender, text }: PostedMessage) {
    this.premium = premium;
    this.sender = sender;
    this.text = text;
  }
}

export const MessageSchema: borsh.Schema = {
  struct: {
    premium: 'bool',
    sender: 'string',
    text: 'string',
  },
};
