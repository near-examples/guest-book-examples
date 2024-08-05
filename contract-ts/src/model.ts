export const POINT_ONE = '100000000000000000000000';

export class PostedMessage {
  static schema = {
    'premium': 'boolean',
    'sender': 'string',
    'text': 'string'
  }

  premium: boolean;
  sender: string;
  text: string;

  constructor({ premium, sender, text }: PostedMessage) {
    this.premium = premium;
    this.sender = sender;
    this.text = text;
  }
}